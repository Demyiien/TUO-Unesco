// Need to change source searches so that the original website won't be called again.
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

// INITIALIZE express server
const app = express();
const PORT = 3000;

// INITIALIZE openrouter api with openAI module
const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// INITIALIZE express dependencies
app.use(cors());
app.use(bodyParser.json());

// INITIALIZE search API using SerperAPI
async function fetchSerperLinks(query, limit = 3) {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query }),
    });

    const data = await res.json();

    return data.organic ? data.organic.slice(0, limit).map((r) => r.link) : [];
  } catch (err) {
    console.error("Serper fetch error:", err);
    return [];
  }
}

// OPEN AI: Verification
// DO we need to feed our search api in here to add weight into validity?
// OR is it too resource extensive for us rn, so we add an option where the user would counter AI verdict?
app.post("/analyze", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "No content provided" });
    }

    // OPENAI returns json schema with appropriate params
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a strict fact-checking assistant. Identify statements that are likely false or misleading. Return JSON with phrase, aiVerdict (true/false), and credibility (0-10)",
        },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "misinfo_result",
          schema: {
            type: "object",
            properties: {
              suspiciousPhrases: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    phrase: { type: "string" },
                    aiVerdict: { type: "boolean" },
                    credibility: { type: "number" },
                  },
                  required: ["phrase", "aiVerdict", "credibility"],
                },
              },
            },
            required: ["suspiciousPhrases"],
          },
        },
      },
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    // Call serper API to get search query results
    for (const item of analysis.suspiciousPhrases) {
      item.sources = await fetchSerperLinks(item.phrase, 3);
    }

    res.json(analysis);
  } catch (err) {
    console.error("Error analyzing text:", err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
