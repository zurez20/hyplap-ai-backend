import { ChromaClient } from "chromadb";
import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from "url";
import "dotenv/config";

const chroma = new ChromaClient({
  host: "localhost",
  port: 8000,
  ssl: false,
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function createEmbedding(text) {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });

  return response.embeddings[0].values;
}

export async function searchKnowledge(query) {
  const queryEmbedding = await createEmbedding(query);

  const collection = await chroma.getCollection({
    name: "hyplap_knowledge",
    embeddingFunction: null,
  });

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: 10,
    include: ["documents", "metadatas", "distances"],
  });

  console.log("context used to give response" , JSON.stringify(results, null, 2));

  const documents = results.documents?.[0] || [];

  return documents;
}

export async function generateAnswer(question, knowledge) {
  const context = knowledge.join("\n\n---\n\n");
  //   console.log('context',context);

  const systemInstruction = `
You are the AI assistant for HYPLAP.

Answer the user's question using the provided HYPLAP knowledge.

Important rules:

- Use the provided knowledge as your source of truth.
- Do not invent information about HYPLAP.
- Do not invent prices, timelines, clients, technologies, services,
  certifications, or capabilities.
- If the provided knowledge does not contain enough information,
  clearly say that you don't have enough information.
- Answer naturally and professionally.
- Keep the answer reasonably concise.

HYPLAP KNOWLEDGE:
${context}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: question,
    config: {
      systemInstruction,
    },
  });

  return response.text;
}

export async function ask(question) {
  const knowledge = await searchKnowledge(question);
  const answer = await generateAnswer(question, knowledge);
  return answer;
}

async function main() {
  const question = process.argv.slice(2).join(" ");

  if (!question) {
    console.log("Please provide a question.");
    process.exit(1);
  }

  console.log(`\nQuestion: ${question}`);
  console.log("\nSearching Hyplap knowledge...");

  const knowledge = await searchKnowledge(question);

  console.log(`Found ${knowledge.length} relevant chunks.`);

  const answer = await generateAnswer(question, knowledge);

  console.log("\n==============================");
  console.log("HYPLAP AI:");
  console.log("==============================\n");

  console.log(answer);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}