import "dotenv/config";
import express from "express";
import Groq from "groq-sdk";
import fs from "fs";
import path from "path";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json({ limit: "100kb" }));

const PORT = process.env.PORT || 3001;

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Liquid AI Helper API",
      version: "1.0.0",
      description: "API for the browser extension (selection → AI response).",
    },
    servers: [{ url: `http://localhost:${PORT}` }],
  },
  apis: ["./extension/server.js"],
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/openapi.json", (req, res) => res.json(swaggerSpec));

if (!process.env.GROQ_API_KEY) {
  console.error("❌ Missing GROQ_API_KEY in .env");
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROMPT_TEMPLATE = fs.readFileSync(
  path.join(__dirname, "prompt.txt"),
  "utf-8",
);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  model: process.env.MODEL_NAME,
});

/**
 * @openapi
 * /ask:
 *   post:
 *     summary: Ask the AI helper about selected text
 *     description: Returns answer.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 example: "What is 2 + 2?"
 *     responses:
 *       200:
 *         description: AI result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answer:
 *                   type: string
 *       400:
 *         description: Bad request
 */
app.post("/ask", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (text.length < 3) {
      return res.status(400).json({ error: "Text is too short." });
    }

    const prompt = PROMPT_TEMPLATE.replace("{{TEXT}}", text);

    const completion = await groq.chat.completions.create({
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: "You must output ONLY raw JSON. No markdown. No extra text.",
        },
        { role: "user", content: prompt },
      ],
    });

    const modelText = completion?.choices?.[0]?.message?.content?.trim() || "";

    let parsed;
    try {
      parsed = JSON.parse(modelText);
    } catch {
      const match = modelText.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    if (!parsed || typeof parsed !== "object") {
      return res.status(500).json({ answer: "—" });
    }

    return res.json({
      answer: String(parsed.answer ?? "—"),
    });
  } catch (err) {
    return res.status(500).json({
      error: String(err.message || err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
