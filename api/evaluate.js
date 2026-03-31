import OpenAI from "openai";

const CONFIG = {
  model: "llama-3.1-8b-instant",
  temperature: 0.1,
  maxTokens: 512,
  requestTimeoutMs: 8000,
};

let client = null;
if (process.env.GROQ_API_KEY) {
  client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return "Missing payload";
  if (!payload.skill) return "Missing skill";
  if (!payload.currentBand) return "Missing currentBand";
  if (!payload.question) return "Missing question";
  if (!payload.learnerAnswer) return "Missing learnerAnswer";
  if (!payload.descriptors || typeof payload.descriptors !== "object") {
    return "Missing descriptors";
  }
  return null;
}

function fallbackResult(currentBand, reason = "Deterministic fallback used.") {
  return {
    isMatch: false,
    matchedBand: currentBand || "A2",
    confidence: 0.3,
    confidenceLabel: "low",
    difficultyAction: "stay",
    strengths: [],
    weaknesses: [],
    reasons: [reason],
    _fallback: true,
  };
}

const SYSTEM_PROMPT = `You are a strict CEFR-aligned assessment evaluator.

Return JSON only with this exact schema:
{
  "isMatch": boolean,
  "matchedBand": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "confidence": number,
  "confidenceLabel": "high" | "medium" | "low",
  "difficultyAction": "increase" | "stay" | "decrease",
  "strengths": string[],
  "weaknesses": string[],
  "reasons": string[]
}

Rules:
- Judge only from the supplied question, learner answer, and CEFR descriptors.
- Do not overestimate.
- If the learner fully matches a lower band and only partially matches a higher band, choose the lower band.
- If the answer is too short or incomplete, reduce confidence.
- Return valid JSON only. No markdown, no preamble.`;


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const payload = req.body;
  const validationError = validatePayload(payload);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  if (!client) {
    return res.status(200).json(fallbackResult(payload.currentBand, "No API key configured on Vercel."));
  }

  try {
    const response = await client.chat.completions.create(
      {
        model: CONFIG.model,
        temperature: CONFIG.temperature,
        max_tokens: CONFIG.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }
    );

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(200).json(fallbackResult(payload.currentBand, "Empty LLM response."));
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(200).json(fallbackResult(payload.currentBand, "LLM returned invalid JSON."));
    }

    if (!parsed.matchedBand || !parsed.difficultyAction) {
      return res.status(200).json(fallbackResult(payload.currentBand, "LLM returned incomplete schema."));
    }

    return res.status(200).json(parsed);
  } catch (err) {
    const message = err?.message || String(err);
    return res.status(200).json(fallbackResult(payload.currentBand, `LLM error: ${message}`));
  }
}
