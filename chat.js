import { ChromaClient } from "chromadb";
import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from "url";
import "dotenv/config";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const chroma = new ChromaClient({
  host: "localhost",
  port: 8000,
  ssl: false,
});

// const ai = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY,
// });

async function createEmbedding(text) {
  const response = await groq.models.embedContent({
    model: "openai/gpt-oss-20b",
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

  console.log("context used to give response", JSON.stringify(results, null, 2));

  const documents = results.documents?.[0] || [];

  return documents;
}

async function rewriteQuery(question, history) {
  if (history.length === 0) return question;

  const transcript = history
    .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
    .join("\n");

  const response = await groq.models.generateContent({
    model: "openai/gpt-oss-20b",

    contents: `Conversation so far:\n${transcript}\n\nFollow-up question: ${question}`,
    config: {
      systemInstruction:
        "Rewrite the follow-up question as one standalone question that makes sense without the conversation. Resolve pronouns and missing subjects. If it is already standalone, return it unchanged. Output only the question.",
    },
  });

  return response.text.trim();
}

export async function generateAnswer(question, knowledge, history = []) {
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

  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: question }] },
  ];

  const response = await groq.models.generateContent({
    model: "openai/gpt-oss-20b",
    contents,
    config: { systemInstruction },
  });

  return response.text;
}

const MAX_HISTORY = 6;

export async function ask(question, history = []) {
  const cleanHistory = history
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .slice(-MAX_HISTORY);

  const standalone = await rewriteQuery(question, cleanHistory);
  console.log("Standalone query:", standalone);

  const knowledge = await searchKnowledge(standalone);
  const answer = await generateAnswer(question, knowledge, cleanHistory);
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