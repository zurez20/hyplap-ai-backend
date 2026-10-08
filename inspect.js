// It connects to local ChromaDB, counts how many items are in the hyplap_knowledge collection,
//  and prints the ID, dimension size, and raw vector of the first stored entry.

// import { ChromaClient } from "chromadb";

// const chroma = new ChromaClient();

// async function main() {
//     const collection = await chroma.getOrCreateCollection({
//         name: "hyplap_knowledge",
//         embeddingFunction: null,
//     });

//     const count = await collection.count();
//     console.log("Total items:", count);

//     const results = await collection.get({
//         include: ["embeddings", "documents", "metadatas"],
//     });

//     console.log("ID:", results.ids[0]);
//     console.log("Vector length:", results.embeddings[0].length);
//     console.log("Vector:", results.embeddings[0]);
// }

// main().catch(console.error);