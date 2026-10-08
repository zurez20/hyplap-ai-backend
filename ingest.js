import fs from "fs/promises";
import path from "path";
import { ChromaClient } from "chromadb";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

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

async function main() {
    const collection = await chroma.getOrCreateCollection({
        name: "hyplap_knowledge",
        embeddingFunction: null,
    });

    const files = await fs.readdir(knowledgeDir);

    const documents = [];
    const embeddings = [];
    const ids = [];
    const metadatas = [];

    for (const file of files) {
        if (!file.endsWith(".txt")) continue;

        console.log(`Processing: ${file}`);

        const filePath = path.join(knowledgeDir, file);
        const content = await fs.readFile(filePath, "utf8");

        const chunks = chunkText(content);

        console.log(`  Chunks: ${chunks.length}`);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            const embedding = await createEmbedding(chunk);

            documents.push(chunk);
            embeddings.push(embedding);

            ids.push(`${file}-${i}`);

            metadatas.push({
                source: file,
                chunkIndex: i,
            });
        }
    }

    console.log(`\nTotal chunks: ${documents.length}`);
    console.log("Adding to ChromaDB...");

    await collection.upsert({
        ids,
        embeddings,
        documents,
        metadatas,
    });

    console.log("Done!");
}

main().catch(console.error);