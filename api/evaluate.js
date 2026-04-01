import OpenAI from "openai";

const CONFIG = {
  model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
  temperature: 0.1,
  maxTokens: 700,
};

const SYSTEM_PROMPT = `
You are a CEFR-aligned linguistic signal extractor.

Your job is NOT to assign the final CEFR result.
Your job is to extract structured linguistic signals from the learner response.

Evaluate the USER_RESPONSE using these dimensions:
1. semantic_accuracy
2. task_completion
3. lexical_sophistication
4. syntactic_complexity
5. coherence
6. grammar_control
7. typo_severity
8. idiomatic_usage
9. register_control

Scoring rules:
- All scores must be numbers between 0.0 and 1.0
- Minor typos must NOT heavily reduce scores if meaning is preserved
- Short answers may still score well if they are precise and high-quality
- Distinguish meaning accuracy from language quality
- estimated_band is only an approximate linguistic estimate, not the final placement
- confidence must reflect confidence in the extracted signals, not final CEFR certification

Return ONLY valid JSON with this exact schema:
{
  "semantic_accuracy": number,
  "task_completion": number,
  "lexical_sophistication": number,
  "syntactic_complexity": number,
  "coherence": number,
  "grammar_control": number,
  "typo_severity": number,
  "idiomatic_usage": number,
  "register_control": number,
  "estimated_band": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "confidence": number,
  "rationale": string
}
`.trim();

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

function isValidBand(value) {
  return ["A1", "A2", "B1", "B2", "C1", "C2"].includes(value);
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return "Missing payload";
  if (!payload.skill) return "Missing skill";
  if (!payload.currentBand) return "Missing currentBand";
  if (!payload.question) return "Missing question";
  if (!payload.learnerAnswer) return "Missing learnerAnswer";
  return null;
}

function fallbackResult(currentBand, reason = "Deterministic fallback used.") {
  return {
    semantic_accuracy: 0.5,
    task_completion: 0.5,
    lexical_sophistication: 0.35,
    syntactic_complexity: 0.35,
    coherence: 0.4,
    grammar_control: 0.4,
    typo_severity: 0.1,
    idiomatic_usage: 0.1,
    register_control: 0.3,
    estimated_band: currentBand || "A2",
    confidence: 0.2,
    rationale: reason,
    _fallback: true,
  };
}

function hasRequiredSignalSchema(parsed) {
  if (!parsed || typeof parsed !== "object") return false;

  const requiredNumericFields = [
    "semantic_accuracy",
    "task_completion",
    "lexical_sophistication",
    "syntactic_complexity",
    "coherence",
    "grammar_control",
    "typo_severity",
    "idiomatic_usage",
    "register_control",
    "confidence",
  ];

  for (const field of requiredNumericFields) {
    if (parsed[field] === undefined || !Number.isFinite(Number(parsed[field]))) {
      return false;
    }
  }

  if (!isValidBand(parsed.estimated_band)) return false;
  if (typeof parsed.rationale !== "string") return false;

  return true;
}

function sanitizeSignalResult(parsed, currentBand) {
  return {
    semantic_accuracy: clamp01(parsed.semantic_accuracy),
    task_completion: clamp01(parsed.task_completion),
    lexical_sophistication: clamp01(parsed.lexical_sophistication),
    syntactic_complexity: clamp01(parsed.syntactic_complexity),
    coherence: clamp01(parsed.coherence),
    grammar_control: clamp01(parsed.grammar_control),
    typo_severity: clamp01(parsed.typo_severity),
    idiomatic_usage: clamp01(parsed.idiomatic_usage),
    register_control: clamp01(parsed.register_control),
    estimated_band: isValidBand(parsed.estimated_band) ? parsed.estimated_band : (currentBand || "A2"),
    confidence: clamp01(parsed.confidence),
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "No rationale provided.",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const validationError = validatePayload(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(200).json(
      fallbackResult(req.body.currentBand, "No API key configured.")
    );
  }

  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });

  try {
    const response = await client.chat.completions.create({
      model: CONFIG.model,
      temperature: CONFIG.temperature,
      max_tokens: CONFIG.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            skill: req.body.skill,
            currentBand: req.body.currentBand,
            question: req.body.question,
            learnerAnswer: req.body.learnerAnswer,
            descriptors: req.body.descriptors,
          }),
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(200).json(
        fallbackResult(req.body.currentBand, "Empty LLM response.")
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(200).json(
        fallbackResult(req.body.currentBand, "Invalid JSON from LLM.")
      );
    }

    if (!hasRequiredSignalSchema(parsed)) {
      return res.status(200).json(
        fallbackResult(req.body.currentBand, "Incomplete signal schema from LLM.")
      );
    }

    return res.status(200).json(
      sanitizeSignalResult(parsed, req.body.currentBand)
    );
  } catch (err) {
    const message = err?.message || String(err);
    return res.status(200).json(
      fallbackResult(req.body.currentBand, `LLM error: ${message}`)
    );
  }
}
