import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";
import dotenv from "dotenv";
import fetch from "node-fetch"; // Make sure to install node-fetch if needed

dotenv.config();

const app = express();
const PORT = 3000;

const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY
});

app.use(cors());
app.use(bodyParser.json());

// --- Helper: fetch top DuckDuckGo links ---
async function fetchDuckDuckGoLinks(query, limit = 3) {
    try {
        const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        const text = await res.text();

        // Simple regex to grab hrefs from results
        const linkRegex = /<a rel="nofollow" class="result__a" href="([^"]+)"/g;
        const links = [];
        let match;
        while ((match = linkRegex.exec(text)) && links.length < limit) {
            links.push(match[1]);
        }
        return links;
    } catch (err) {
        console.error("DuckDuckGo fetch error:", err);
        return [];
    }
}

// --- Analyze endpoint ---
app.post("/analyze", async (req, res) => {
    try {
        const { content } = req.body;
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: "No content provided" });
        }

        // Call OpenAI for fact-checking
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a strict fact-checking assistant. Identify statements that are likely false or misleading. Return JSON with phrase, aiVerdict (true/false), and credibility (0-10)." },
                { role: "user", content }
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
                                        credibility: { type: "number" }
                                    },
                                    required: ["phrase", "aiVerdict", "credibility"]
                                }
                            }
                        },
                        required: ["suspiciousPhrases"]
                    }
                }
            }
        });

        const analysis = JSON.parse(response.choices[0].message.content);

        // --- Fetch top 3 DuckDuckGo links for each suspicious phrase ---
        for (const item of analysis.suspiciousPhrases) {
            item.sources = await fetchDuckDuckGoLinks(item.phrase, 3);
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
