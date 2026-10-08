// It takes a user's question from the command line, 
// turns it into an AI vector with Gemini, and fetches the top 3 
// most relevant text chunks from a local Chroma vector database. and print in console

// import { ChromaClient } from "chromadb";
// import { GoogleGenAI } from "@google/genai";
// import "dotenv/config";

// const chroma = new ChromaClient({
//   host: "localhost",
//   port: 8000,
//   ssl: false,
// });

// const ai = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY,
// });

// async function createEmbedding(text) {
//   const response = await ai.models.embedContent({
//     model: "gemini-embedding-001",
//     contents: text,
//   });

//   return response.embeddings[0].values;
// }

// async function searchKnowledge(query) {
//   console.log(`Searching for: "${query}"`);

//   const queryEmbedding = await createEmbedding(query);

//   const collection = await chroma.getCollection({
//     name: "hyplap_knowledge",
//     embeddingFunction: null,
//   });

//   const results = await collection.query({
//     queryEmbeddings: [queryEmbedding],
//     nResults: 3,
//   });

//   return results;
// }

// const query = process.argv.slice(2).join(" ");

// if (!query) {
//   console.log("Please provide a question.");
//   process.exit(1);
// }

// const results = await searchKnowledge(query);

// console.log("\nResults:\n");

// const documents = results.documents?.[0] || [];
// const distances = results.distances?.[0] || [];
// const metadatas = results.metadatas?.[0] || [];

// documents.forEach((document, index) => {
//   console.log(`\n--- Result ${index + 1} ---`);

//   console.log("Source:", metadatas[index]?.source);
//   console.log("Chunk:", metadatas[index]?.chunkIndex);
//   console.log("Distance:", distances[index]);

//   console.log("\nContent:");
//   console.log(document);
// });