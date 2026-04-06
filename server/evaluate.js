import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { supabase } from "./supabaseClient.js";
import { authRouter } from "./auth.js";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);

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

let llmClient = null;
if (process.env.GROQ_API_KEY) {
  llmClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
  console.log(`[Evaluator] Groq client initialized. Model: ${CONFIG.model}`);
} else {
  console.warn("[Evaluator] GROQ_API_KEY not set. Deterministic fallback only.");
}

const SYSTEM_PROMPT = `
You are a CEFR-aligned linguistic signal extractor.
Return ONLY valid JSON with linguistic scores.
`.trim();

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

function fallbackResult(currentBand, reason) {
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
    estimated_band: currentBand || "A1",
    confidence: 0.2,
    rationale: reason,
    _fallback: true,
  };
}

app.get("/api/db-status", async (_req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    if (error) throw error;
    res.json({
      status: "Connected (via SDK)",
      message: "Successfully reached Supabase API",
      userCount: data
    });
  } catch (err) {
    res.status(500).json({ status: "Disconnected", error: err.message });
  }
});

app.get("/api/questions", async (req, res) => {
  const { level } = req.query;
  
  try {
    let query = supabase
      .from('question_bank_items')
      .select('external_id, skill, task_type, target_cefr, difficulty, prompt, stimulus, answer_key');
    
    if (level) {
      query = query.eq('target_cefr', level);
    }

    const { data, error } = await query;
    if (error) throw error;

    const formattedQuestions = data.map(item => ({
        id: item.external_id,
        skill: item.skill,
        task_type: item.task_type,
        target_cefr: item.target_cefr,
        difficulty: Number(item.difficulty) || 0.5,
        response_mode: item.task_type.includes('mcq') ? 'mcq' : 'typed',
        prompt: item.prompt,
        stimulus: item.stimulus,
        answer_key: item.answer_key || {},
    }));

    res.json(formattedQuestions.sort(() => Math.random() - 0.5));
  } catch (err) {
    console.error('[API] Error fetching questions:', err);
    res.status(500).json({ error: "Failed to fetch questions from Cloud database" });
  }
});

app.post("/api/evaluate", async (req, res) => {
  const payload = req.body;
  
  // (Assuming validation happened or simplified for refactor brevity)
  if (!llmClient || circuitBreaker.isOpen()) {
    return res.json(fallbackResult(payload.currentBand, "LLM unavailable"));
  }

  try {
    const response = await llmClient.chat.completions.create({
        model: CONFIG.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(payload) },
        ],
        response_format: { type: "json_object" }
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    
    // Fire-and-forget saving to Supabase (via SDK)
    const userId = payload.userId; // Ensure userId is passed from frontend
    
    supabase.from('assessment_responses').insert([{
        assessment_id: payload.assessmentId || "session-" + Date.now(),
        user_id: userId, // CRITICAL: Link to user
        question_id: (await supabase.from('question_bank_items').select('id').eq('external_id', payload.question.id).single()).data?.id,
        skill: payload.skill,
        question_level: payload.question.target_cefr,
        answer_level: parsed.estimated_band,
        user_answer: payload.learnerAnswer,
        is_correct: parsed.task_completion > 0.7,
        score: parsed.task_completion,
        explanation: parsed
    }]).then(({ error }) => {
        if (error) console.error("❌ Failed to log result to Supabase:", error.message);
    });

    return res.json(parsed);
  } catch (err) {
    console.error("[Evaluator] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// --- NEW SYNC ENDPOINT ---
app.get("/api/user/history/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    // 1. Get latest profile (for current level etc.)
    const { data: profile } = await supabase
      .from('learner_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // 2. Get assessment responses (last 50 for performance)
    const { data: history } = await supabase
      .from('assessment_responses')
      .select('*, question_bank_items(prompt, target_cefr)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    res.json({ profile, history: history || [] });
  } catch (err) {
    console.error("[History API] Error:", err);
    res.status(500).json({ error: "Failed to fetch user history" });
  }
});

if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
  app.listen(port, () => {
    console.log(`[Evaluator] Server running locally on http://localhost:${port}`);
  });
}

// Export for Vercel
export default app;
