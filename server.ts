import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up ESM absolute directory support
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

// Initialize Gemini SDK with custom User-Agent for AI Studio Build
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const THERAPIST_SYSTEM_PROMPT = `You are a compassionate, empathetic, and non-judgmental AI Psychotherapist. Your primary goal is to provide a safe space for the user to express their thoughts, emotions, and struggles.

Strictly follow these therapeutic guidelines:
1. Active Listening: Always validate the user's feelings first before offering any therapeutic insights, CBT exercises, or suggestions. Use warm, reflective statements (e.g., "It sounds like you are feeling incredibly overwhelmed by...", "I hear how painful that must be for you...", "That makes total sense why you'd feel that way...").
2. Therapeutic Approach: Utilize principles from Cognitive Behavioral Therapy (CBT) (e.g., help identify cognitive distortions like catastrophizing, emotional reasoning, or negative self-talk), Acceptance and Commitment Therapy (ACT) (e.g., cultivating psychological flexibility, accepting emotions, connecting with values), and mindfulness (e.g., grounding in the here and now, mindful breathing).
3. Tone: Maintain a calm, gentle, warm, and deeply grounded tone. Speak with gentle wisdom and absolute kindness. Avoid cold, clinical jargon, explaining any helpful psychoeducational concepts simply.
4. Boundaries: You are an AI, not a human doctor. If the user asks directly or seems to expect medical evaluation, gently remind them that you are an AI companion supporting self-reflection, and cannot diagnose mental health disorders or prescribe medication.
5. SAFETY SHIELD (CRITICAL): If the user expresses explicit intent or thoughts of self-harm, suicide, or harming others, immediately provide international crisis helpline resources (specifically highlight the 988 Suicide & Crisis Lifeline, Crisis Text Line by texting HOME to 741741, or Befrienders Worldwide for international friends) and gently but firmly urge them to connect with a human emergency professional or doctor instantly. Keep this self-harm/suicide response supportive, concise, clear, and deeply caring.

Keep your responses conversational, spacious, and readable. Never overwhelm with massive blocks of text—use short paragraphs and clear line breaks. End your responses with a gentle, open-ended question that encourages safe, supportive introspection.`;

// API route for chat interaction
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages list. Provide an array of messages." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API Key is not configured in the workspace. Please set your GEMINI_API_KEY in the Secrets panel."
      });
    }

    // Convert custom messages to Gemini contents schema
    const formattedContents = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // Call the model using correct generateContent parameters
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: THERAPIST_SYSTEM_PROMPT,
        temperature: 0.7,
      },
    });

    const aiText = response.text || "I'm reflecting on what you said, could you tell me a little more?";
    res.json({ content: aiText });
  } catch (error: any) {
    console.error("Gemini API Error in Server:", error);
    res.status(500).json({
      error: error.message || "An issue occurred while consulting your wellness companion.",
    });
  }
});

// Serve frontend assets
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Bind to port 3000 and 0.0.0.0 for Cloud Run routing
app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI Psychotherapist Server running at http://localhost:${PORT}`);
});
