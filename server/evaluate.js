import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  model: "llama-3.1-8b-instant",
  temperature: 0.1,
  maxTokens: 512,
  requestTimeoutMs: 8000,
};

// ============================================================================
// Circuit Breaker
// ============================================================================

const circuitBreaker = {
  failureCount: 0,
  lastFailureTime: 0,
  cooldownMs: 5 * 60 * 1000, // 5 minutes
  maxFailures: 2,

  isOpen() {
    if (this.failureCount < this.maxFailures) return false;
    const elapsed = Date.now() - this.lastFailureTime;
    if (elapsed > this.cooldownMs) {
      // Reset after cooldown
      this.failureCount = 0;
      console.log("[CircuitBreaker] Cooldown expired. Resetting to CLOSED.");
      return false;
    }
    return true;
  },

  recordFailure(reason) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    console.error(`[CircuitBreaker] Failure #${this.failureCount}: ${reason}`);
    if (this.failureCount >= this.maxFailures) {
      console.warn(`[CircuitBreaker] OPEN — skipping LLM calls for ${this.cooldownMs / 1000}s`);
    }
  },

  recordSuccess() {
    if (this.failureCount > 0) {
      console.log("[CircuitBreaker] Success recorded. Resetting failure count.");
    }
    this.failureCount = 0;
  },
};

// ============================================================================
// Groq Client (optional — only if key is present)
// ============================================================================

let client = null;
if (process.env.GROQ_API_KEY) {
  client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
  console.log(`[Evaluator] Groq client initialized. Model: ${CONFIG.model}`);
} else {
  console.warn("[Evaluator] GROQ_API_KEY not set. Server will return deterministic fallbacks only.");
}

// ============================================================================
// Prompts & Helpers
// ============================================================================

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

// ============================================================================
// Routes
// ============================================================================

app.get("/", (_req, res) => {
  const status = circuitBreaker.isOpen() ? "DEGRADED (circuit open)" : "HEALTHY";
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

app.post("/api/evaluate", async (req, res) => {
  const payload = req.body;
  const validationError = validatePayload(payload);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  // Gate 1: No client
  if (!client) {
    return res.json(fallbackResult(payload.currentBand, "No API key configured."));
  }

  // Gate 2: Circuit breaker open
  if (circuitBreaker.isOpen()) {
    return res.json(fallbackResult(payload.currentBand, "Circuit breaker is open. Skipping LLM."));
  }

  // Gate 3: Attempt LLM call with timeout
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
          { role: "user", content: JSON.stringify(payload) },
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

    // Validate essential fields
    if (!parsed.matchedBand || !parsed.difficultyAction) {
      circuitBreaker.recordFailure("Incomplete JSON schema from LLM.");
      return res.json(fallbackResult(payload.currentBand, "LLM returned incomplete schema."));
    }

    circuitBreaker.recordSuccess();
    return res.json(parsed);
  } catch (err) {
    const message = err?.message || String(err);

    // Detect decommissioned model explicitly
    if (message.includes("decommissioned") || message.includes("not found")) {
      console.error(`[Evaluator] CRITICAL: Model "${CONFIG.model}" is decommissioned or unavailable.`);
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

// ============================================================================
// Start
// ============================================================================

app.listen(port, () => {
  console.log(`[Evaluator] Server running on http://localhost:${port}`);
  console.log(`[Evaluator] Model: ${CONFIG.model}`);
  console.log(`[Evaluator] API Key: ${client ? "Configured" : "MISSING"}`);
});
