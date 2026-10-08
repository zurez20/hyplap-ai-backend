import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";

const BASE_URL = "https://www.hyplap.com";
const BASE_HOST = new URL(BASE_URL).hostname;
const visited = new Set();
const knowledgeDir = path.join(process.cwd(), "knowledge");

const DEFAULT_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
};

function extractStructuredText($, root) {
    const blockSelectors = "h1, h2, h3, h4, h5, h6, p, li, blockquote, td, th";
    const blocks = [];
    const capturedNodes = new Set();

    root.find(blockSelectors).each((_, el) => {
        const $el = $(el);
        if ($el.parents(blockSelectors).length > 0) return;

        const text = $el.text().replace(/\s+/g, " ").trim();
        if (text.length === 0) return;

        const tag = el.tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag)) {
            blocks.push(`\n## ${text}\n`);
        } else {
            blocks.push(text);
        }
        capturedNodes.add(el);
    });

    // Fallback pass: catch text sitting directly in div/span with no
    // semantic wrapper, that the structured pass above missed entirely.
    root.find("div, span").each((_, el) => {
        const $el = $(el);

        // Skip if this element is inside something we already captured
        if ($el.parents(blockSelectors).length > 0) return;
        if (capturedNodes.has(el)) return;
        if ($el.find(blockSelectors).length > 0) return;

        // Only take the DIRECT text of this node, not descendants,
        // so we don't re-grab text that a child div/span will also grab
        const directText = $el
            .contents()
            .filter((_, node) => node.type === "text")
            .text()
            .replace(/\s+/g, " ")
            .trim();

        if (directText.length > 0) {
            blocks.push(directText);
        }
    });

    return blocks.join("\n\n");
}

function normalizeUrl(url) {
    const parsed = new URL(url);
    parsed.hash = "";
    // Remove trailing slash
    let pathname = parsed.pathname.replace(/\/+$/, "");
    // /home is the same as /
    if (pathname === "/home") {
        pathname = "";
    }
    parsed.pathname = pathname;
    return parsed.toString();
}

function getFileName(url) {
    const parsed = new URL(url);
    let pathname = parsed.pathname;
    if (!pathname || pathname === "/") {
        return "home.txt";
    }
    pathname = pathname.replace(/^\/|\/$/g, "");
    return `${pathname.replace(/\//g, "-")}.txt`;
}

// Removes duplicate sentences that come from carousels, sliders,
// or tab components that render the same DOM content multiple times.
function dedupeContent(text) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const seen = new Set();
    const result = [];
    for (const s of sentences) {
        const key = s.trim().toLowerCase();
        if (key.length > 20 && seen.has(key)) continue; // skip exact repeats of substantial sentences
        seen.add(key);
        result.push(s);
    }
    return result.join(" ");
}

/**
 * Performs a GET request and automatically solves the 409 anti-bot challenge
 * by extracting the cookie from the response and retrying.
 */
async function fetchWithCookieChallenge(url) {
    // First request – allow 409 so we can inspect the body
    let response = await axios.get(url, {
        timeout: 15000,
        headers: DEFAULT_HEADERS,
        validateStatus: (status) => status < 500, // don't throw on 4xx
    });

    // If we received the anti-bot page, extract the cookie and retry
    if (
        response.status === 409 &&
        typeof response.data === "string" &&
        response.data.includes("document.cookie")
    ) {
        const match = response.data.match(
            /document\.cookie\s*=\s*["']([^"']+)["']/i
        );

        if (match) {
            const cookie = match[1]; // e.g. "humans_21909=1"
            console.log(`  → Anti-bot challenge detected. Setting cookie: ${cookie}`);

            // Retry with the cookie
            response = await axios.get(url, {
                timeout: 15000,
                headers: {
                    ...DEFAULT_HEADERS,
                    Cookie: cookie,
                },
            });
        } else {
            throw new Error("409 received but could not extract anti-bot cookie");
        }
    }

    // Final safety check
    if (response.status !== 200) {
        throw new Error(`Unexpected status ${response.status} after challenge`);
    }

    return response;
}

async function scrapePage(url) {
    url = normalizeUrl(url);
    if (visited.has(url)) {
        return;
    }
    visited.add(url);

    try {
        console.log(`Scraping: ${url}`);

        const response = await fetchWithCookieChallenge(url);

        const $ = cheerio.load(response.data);

        // Remove elements that don't contain useful information
        $("script, style, noscript, iframe, svg, canvas").remove();
        $("header, nav, footer").remove();

        const title = $("title").text().trim();
        const mainContent = $("main, article").first();
        const root = mainContent.length ? mainContent : $("body");
        let content = extractStructuredText($, root);

        // Strip repeated sentences from carousels/tabs before saving
        const beforeLength = content.length;
        content = dedupeContent(content);
        const afterLength = content.length;

        const fileName = getFileName(url);
        const fileContent = `URL: ${url}
TITLE: ${title}
${content}
`;

        await fs.writeFile(
            path.join(knowledgeDir, fileName),
            fileContent,
            "utf8"
        );

        console.log(`Saved: knowledge/${fileName}`);
        console.log(`Characters: ${afterLength} (deduped from ${beforeLength})`);
        console.log("--------------------------------");

        // Find internal links
        const links = new Set();
        $("a[href]").each((_, element) => {
            const href = $(element).attr("href");
            if (!href) return;
            try {
                const link = new URL(href, BASE_URL);
                // Only crawl Hyplap pages
                if (link.hostname !== BASE_HOST) {
                    return;
                }
                const normalizedLink = normalizeUrl(link.href);
                links.add(normalizedLink);
            } catch {
                // Ignore invalid URLs
            }
        });

        for (const link of links) {
            await scrapePage(link);
        }
    } catch (error) {
        console.error(`Failed: ${url}`);
        console.error(error.message);
    }
}

async function start() {
    await fs.mkdir(knowledgeDir, {
        recursive: true,
    });
    await scrapePage(BASE_URL);
    console.log("\n==============================");
    console.log("Scraping completed");
    console.log(`Pages scraped: ${visited.size}`);
    console.log("==============================");
}

start();