import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const CONFIG = {
  model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
  temperature: 0.1,
  maxTokens: 700,
  requestTimeoutMs: 8000,
};

const circuitBreaker = {
  failureCount: 0,
  lastFailureTime: 0,
  cooldownMs: 5 * 60 * 1000,
  maxFailures: 2,

  isOpen() {
    if (this.failureCount < this.maxFailures) return false;
    const elapsed = Date.now() - this.lastFailureTime;
    if (elapsed > this.cooldownMs) {
      this.failureCount = 0;
      console.log("[CircuitBreaker] Cooldown expired. Resetting.");
      return false;
    }
    return true;
  },

  recordFailure(reason) {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();
    console.error(`[CircuitBreaker] Failure #${this.failureCount}: ${reason}`);
    if (this.failureCount >= this.maxFailures) {
      console.warn("[CircuitBreaker] OPEN — skipping LLM calls temporarily.");
    }
  },

  recordSuccess() {
    if (this.failureCount > 0) {
      console.log("[CircuitBreaker] Success recorded. Resetting failure count.");
    }
    this.failureCount = 0;
  },
};

let client = null;
if (process.env.GROQ_API_KEY) {
  client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
  console.log(`[Evaluator] Groq client initialized. Model: ${CONFIG.model}`);
} else {
  console.warn("[Evaluator] GROQ_API_KEY not set. Deterministic fallback only.");
}

const SYSTEM_PROMPT = `
You are a CEFR-aligned linguistic signal extractor.

Your job is NOT to assign the final CEFR result.
Your job is to extract structured linguistic signals from the learner response.

Evaluate the USER_RESPONSE using these dimensions:
1. relevance (Is it on-topic?)
2. task_completion (Did it meet the requirements?)
3. semantic_accuracy
4. lexical_sophistication
5. syntactic_complexity
6. coherence
7. grammar_control
8. typo_severity
9. idiomatic_usage
10. register_control

Scoring rules:
- All scores must be numbers between 0.0 and 1.0
- CORE GATING RULE: If the USER_RESPONSE is COMPLETELY unrelated to the question, "is_off_topic" MUST be true and "relevance" < 0.3.
- If response misses specific metadata points (requiredContentPoints), reflect in "missing_content_points" and "task_completion".
- Language quality must NOT rescue an off-topic answer.

Return ONLY valid JSON with this exact schema:
{
  "relevance": number,
  "task_completion": number,
  "is_off_topic": boolean,
  "missing_content_points": string[],
  "semantic_accuracy": number,
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

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return "Missing payload";
  if (!payload.skill) return "Missing skill";
  if (!payload.currentBand) return "Missing currentBand";
  if (!payload.question) return "Missing question";
  if (!payload.learnerAnswer) return "Missing learnerAnswer";
  return null;
}

  return {
    relevance: 1.0,
    task_completion: 0.5,
    is_off_topic: false,
    missing_content_points: [],
    semantic_accuracy: 0.5,
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

function isValidBand(value) {
  return ["A1", "A2", "B1", "B2", "C1", "C2"].includes(value);
}

function sanitizeSignalResult(parsed, currentBand) {
  return {
    relevance: clamp01(parsed.relevance ?? 1.0),
    task_completion: clamp01(parsed.task_completion ?? 1.0),
    is_off_topic: Boolean(parsed.is_off_topic),
    missing_content_points: Array.isArray(parsed.missing_content_points) ? parsed.missing_content_points : [],
    semantic_accuracy: clamp01(parsed.semantic_accuracy),
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

function hasRequiredSignalSchema(parsed) {
  if (!parsed || typeof parsed !== "object") return false;

  const requiredNumericFields = [
    "relevance",
    "task_completion",
    "semantic_accuracy",
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

app.get("/", (_req, res) => {
  const status = circuitBreaker.isOpen() ? "DEGRADED" : "HEALTHY";
  res.json({
    status,
    model: CONFIG.model,
    hasApiKey: !!client,
    circuitBreaker: {
      failures: circuitBreaker.failureCount,
      isOpen: circuitBreaker.isOpen(),
    },
  });
});

app.get("/health", (_req, res) => {
  res.json({
    healthy: !circuitBreaker.isOpen() && !!client,
    model: CONFIG.model,
    circuitOpen: circuitBreaker.isOpen(),
  });
});

const AUDIT_SYSTEM_PROMPT = `
You are a Senior CEFR Assessor and Linguistic Auditor.

Your goal is to provide a final, holistic CEFR placement for a learner based on their entire assessment history.
You will be provided with:
1. All tasks attempted, user answers, and preliminary scores.
2. Skill-by-skill estimates and confidence levels.
3. A set of relevant CEFR descriptors from the official 2020 companion volume.

Your Audit must:
- Correlate user performance against the provided descriptors.
- Look for consistency: Does the learner consistently sustain a level?
- Check for ceiling performance: Did they struggle at higher levels or breeze through them?
- Resolve contradictions: If Grammar is A2 but Listening is B2, where does the learner truly sit?

Return ONLY valid JSON with this schema:
{
  "final_band": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "overall_score": number (0-120),
  "confidence": number (0-1.0),
  "breakdown": {
    "listening": string,
    "reading": string,
    "writing": string,
    "speaking": string,
    "linguistic_quality": string
  },
  "cefr_justification": string,
  "key_strengths": string[],
  "areas_for_improvement": string[]
}
`.trim();

app.post("/api/audit", async (req, res) => {
  const { history, estimations, descriptors } = req.body;

  if (!client) {
    return res.status(500).json({ error: "LLM Not Configured" });
  }

  try {
    const response = await client.chat.completions.create({
      model: "llama-3.1-70b-versatile", // Use a larger model for the final audit if available
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: AUDIT_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            history: history.map(h => ({
              task: h.taskType,
              difficulty: h.difficulty,
              answer: h.answer,
              correct: h.correct,
              score: h.score,
              rationale: h.rationale
            })),
            estimations,
            descriptors
          })
        }
      ]
    });

    const content = response.choices?.[0]?.message?.content;
    return res.json(JSON.parse(content));
  } catch (err) {
    console.error("[Audit] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/evaluate", async (req, res) => {
  const payload = req.body;
  const validationError = validatePayload(payload);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  if (!client) {
    return res.json(fallbackResult(payload.currentBand, "No API key configured."));
  }

  if (circuitBreaker.isOpen()) {
    return res.json(fallbackResult(payload.currentBand, "Circuit breaker is open. Skipping LLM."));
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);

    const response = await client.chat.completions.create(
      {
        model: CONFIG.model,
        temperature: CONFIG.temperature,
        max_tokens: CONFIG.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              skill: payload.skill,
              currentBand: payload.currentBand,
              question: payload.question,
              learnerAnswer: payload.learnerAnswer,
              descriptors: payload.descriptors,
            }),
          },
        ],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      circuitBreaker.recordFailure("Empty response from LLM.");
      return res.json(fallbackResult(payload.currentBand, "Empty LLM response."));
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      circuitBreaker.recordFailure("Invalid JSON from LLM.");
      return res.json(fallbackResult(payload.currentBand, "LLM returned invalid JSON."));
    }

    console.log("[LLM RAW RESPONSE]", parsed);

    // Ensure only the new signal schema is validated.
    if (!hasRequiredSignalSchema(parsed)) {
      circuitBreaker.recordFailure("Incomplete signal schema from LLM.");
      return res.json(
        fallbackResult(payload.currentBand, "LLM returned incomplete signal schema.")
      );
    }

    const sanitized = sanitizeSignalResult(parsed, payload.currentBand);
    circuitBreaker.recordSuccess();
    return res.json(sanitized);
  } catch (err) {
    const message = err?.message || String(err);

    if (message.includes("decommissioned") || message.includes("not found")) {
      console.error(`[Evaluator] CRITICAL: Model "${CONFIG.model}" unavailable.`);
      circuitBreaker.recordFailure(`Model error: ${message}`);
    } else if (err.name === "AbortError") {
      console.error(`[Evaluator] Request timed out after ${CONFIG.requestTimeoutMs}ms.`);
      circuitBreaker.recordFailure("Request timeout.");
    } else {
      console.error("[Evaluator] Groq API error:", message);
      circuitBreaker.recordFailure(message);
    }

    return res.json(fallbackResult(payload.currentBand, `LLM error: ${message}`));
  }
});

app.listen(port, () => {
  console.log(`[Evaluator] Server running on http://localhost:${port}`);
  console.log(`[Evaluator] Model: ${CONFIG.model}`);
  console.log(`[Evaluator] API Key: ${client ? "Configured" : "MISSING"}`);
});
