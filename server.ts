import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const isProd = process.env.NODE_ENV === "production";

interface CatalogItemInput {
  id: string;
  name: string;
  kind?: string;
  tag?: string;
  description?: string;
  details?: string[];
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractReadableError(err: unknown): { message: string; status: number; retryable: boolean } {
  const raw = err instanceof Error ? err.message : String(err ?? "Unknown error");
  let message = raw;
  let status = 500;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) {
      message = String(parsed.error.message);
    }
    if (typeof parsed?.error?.code === "number") {
      status = parsed.error.code;
    }
  } catch {
    if (raw.includes("503") || raw.includes("UNAVAILABLE")) status = 503;
    else if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED")) status = 429;
    else if (raw.includes("403") || raw.includes("PERMISSION_DENIED")) status = 403;
    else if (raw.includes("400") || raw.includes("API_KEY_INVALID")) status = 400;
  }

  const retryable =
    status === 503 ||
    status === 429 ||
    raw.includes("UNAVAILABLE") ||
    raw.includes("high demand") ||
    raw.includes("temporarily");

  return { message, status, retryable };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.post("/api/styling-advice", async (req, res) => {
    const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
    const items: CatalogItemInput[] = Array.isArray(req.body?.items) ? req.body.items : [];
    const focusId = typeof req.body?.focusId === "string" ? req.body.focusId : null;

    if (!query) {
      res.status(400).json({ error: "Please enter a styling, layering, or capsule wardrobe question." });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: "Gemini API key is not configured. Open Settings > Secrets to attach your GEMINI_API_KEY.",
      });
      return;
    }

    const catalogSummary = items
      .map(
        (item) =>
          `- id: "${item.id}" | name: "${item.name}" | category: ${item.kind ?? "garment"} | price: ${item.tag ?? "N/A"} | specs: ${(item.details ?? []).join(", ")} | notes: ${item.description ?? ""}`,
      )
      .join("\n");

    const focusNote = focusId ? `The shopper currently has "${focusId}" highlighted on the rail.` : "";
    const prompt = `Catalog on the rail:\n${catalogSummary}\n\n${focusNote}\n\nShopper request: ${query}`;

    const systemInstruction =
      "You are the head stylist and textile specialist at Meridian Atelier. Analyze the shopper's constraints (weather, layering, fabric weights in gsm, proportions, and color harmony) using ONLY the garments listed in the catalog. Return concise, practical recommendations with exact garment IDs from the catalog.";

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        headline: {
          type: Type.STRING,
          description: "Short editorial title for the recommended edit (max 10 words).",
        },
        rationale: {
          type: Type.STRING,
          description: "Clear 2-3 sentence styling and fabric-weight explanation addressing the shopper's query.",
        },
        recommendedIds: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Exact catalog item IDs recommended for this look or capsule (2 to 5 items).",
        },
        layeringOrder: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              itemId: { type: Type.STRING },
              role: { type: Type.STRING, description: "Base layer, mid layer, or outer layer." },
              note: { type: Type.STRING, description: "Why this piece fits the look in 1 concise sentence." },
            },
            required: ["itemId", "role", "note"],
          },
        },
        careNote: {
          type: Type.STRING,
          description: "One practical garment-care or packing tip tailored to the selected fabrics.",
        },
      },
      required: ["headline", "rationale", "recommendedIds", "layeringOrder", "careNote"],
    };

    const callModel = async (model: string, useHighThinking: boolean) => {
      return ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          ...(useHighThinking
            ? {
                thinkingConfig: {
                  thinkingLevel: ThinkingLevel.HIGH,
                },
              }
            : {}),
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
        },
      });
    };

    let lastError: unknown = null;

    // Attempt 1-3 with exponential backoff on gemini-4-hydrogen (ThinkingLevel.HIGH)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await callModel("gemini-4-hydrogen", true);
        const raw = (response.text ?? "{}").trim();
        res.json(JSON.parse(raw));
        return;
      } catch (err) {
        lastError = err;
        const info = extractReadableError(err);
        if (!info.retryable || attempt === 2) {
          break;
        }
        await sleep(700 * Math.pow(2, attempt) + Math.floor(Math.random() * 250));
      }
    }

    // Transient-outage fallback to gemini-3.1-flash-lite if primary model stayed 503/unavailable
    const primaryInfo = extractReadableError(lastError);
    if (primaryInfo.retryable) {
      try {
        const fallbackResponse = await callModel("gemini-3.1-flash-lite", false);
        const raw = (fallbackResponse.text ?? "{}").trim();
        res.json(JSON.parse(raw));
        return;
      } catch (fallbackErr) {
        lastError = fallbackErr;
      }
    }

    const finalInfo = extractReadableError(lastError);
    res.status(finalInfo.status).json({ error: finalInfo.message });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      const indexHtml = path.join(distPath, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send("Build artifacts not found. Run npm run build first.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
