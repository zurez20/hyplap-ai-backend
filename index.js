import express from "express";
import { ask } from "./chat.js";
import cors from "cors"; 

const app = express();
app.use(cors());

app.use(express.json());

app.post("/api/chat", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: "prompt is required",
      });
    }

    const response = await ask(prompt);

    return res.json({ response });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Something went wrong",
    });
  }
});

// use npm start then
// ./chroma-env/bin/chroma run --path ./chroma-data --port 8000
// to run the project

app.listen(3000, () => {
  console.log("AI server running on http://localhost:3000");
});
