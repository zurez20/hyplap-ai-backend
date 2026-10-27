import fs from "fs/promises";
import path from "path";
import { ChromaClient } from "chromadb";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import crypto from "crypto";

const INDEX_VERSION = "1"; // bump when you change chunk size/overlap or the embedding model


const chroma = new ChromaClient({
    host: "localhost",
    port: 8000,
    ssl: false,
});

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const knowledgeDir = path.join(process.cwd(), "knowledge");

// const CHUNK_SIZE = 1500;

function chunkText(text, chunkSize = 1500, overlap = 200) {
    // First try to split on paragraph/section boundaries
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    const chunks = [];
    let current = "";

    for (const para of paragraphs) {
        if ((current + "\n\n" + para).length <= chunkSize) {
            current = current ? current + "\n\n" + para : para;
        } else {
            if (current) chunks.push(current);
            // If a single paragraph is itself too long, hard-slice it with overlap
            if (para.length > chunkSize) {
                for (let i = 0; i < para.length; i += chunkSize - overlap) {
                    chunks.push(para.slice(i, i + chunkSize));
                }
                current = "";
            } else {
                current = para;
            }
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

async function createEmbedding(text) {
    const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: text,
    });

    return response.embeddings[0].values;
}

function hashContent(content) {
    return crypto
        .createHash("sha256")
        .update(`${INDEX_VERSION}:${content}`)
        .digest("hex");
}

async function main() {
    const collection = await chroma.getOrCreateCollection({
        name: "hyplap_knowledge",
        embeddingFunction: null,
    });

    // What's already indexed: source file -> hash
    const existing = await collection.get({ include: ["metadatas"] });
    const indexedHashes = new Map();
    for (const meta of existing.metadatas) {
        if (meta?.source) indexedHashes.set(meta.source, meta.fileHash);
    }

    const files = (await fs.readdir(knowledgeDir)).filter((f) => f.endsWith(".txt"));

    let updated = 0;
    let skipped = 0;

    for (const file of files) {
        const content = await fs.readFile(path.join(knowledgeDir, file), "utf8");
        const fileHash = hashContent(content);

        if (indexedHashes.get(file) === fileHash) {
            skipped++;
            continue;
        }

        console.log(`Re-indexing: ${file}`);
        const chunks = chunkText(content);

        // Embed first, so a failed API call doesn't leave the page with no chunks
        const embeddings = [];
        for (const chunk of chunks) {
            embeddings.push(await createEmbedding(chunk));
        }

        // Drop the page's old chunks (including leftovers if it got shorter), then insert new ones
        await collection.delete({ where: { source: file } });

        if (chunks.length > 0) {
            await collection.upsert({
                ids: chunks.map((_, i) => `${file}-${i}`),
                embeddings,
                documents: chunks,
                metadatas: chunks.map((_, i) => ({ source: file, chunkIndex: i, fileHash })),
            });
        }

        updated++;
    }

    // Pages that no longer exist in knowledge/
    const currentFiles = new Set(files);
    for (const source of indexedHashes.keys()) {
        if (!currentFiles.has(source)) {
            console.log(`Removing deleted page: ${source}`);
            await collection.delete({ where: { source } });
        }
    }

    console.log(`Done. Re-indexed: ${updated}, unchanged: ${skipped}`);
}

main().catch(console.error);