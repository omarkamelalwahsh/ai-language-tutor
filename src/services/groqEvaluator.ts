import { LLMConfig, ClientCircuitBreaker } from '../config/backend-config';

export type DifficultyBand = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type DescriptorEvaluationResult = {
  // New Signal-Based Schema
  semantic_accuracy: number;     // 0.0-1.0
  task_completion: number;       // 0.0-1.0
  lexical_sophistication: number; // 0.0-1.0
  syntactic_complexity: number;   // 0.0-1.0
  coherence: number;             // 0.0-1.0
  grammar_control: number;       // 0.0-1.0
  typo_severity: number;         // 0.0-1.0
  idiomatic_usage: number;       // 0.0-1.0
  register_control: number;      // 0.0-1.0
  estimated_band: DifficultyBand;
  confidence: number;
  rationale: string;
  
  _fallback?: boolean;
};

export type EvaluationPayload = {
  skill: "reading" | "writing" | "listening" | "speaking" | "vocabulary" | "grammar";
  currentBand: DifficultyBand;
  question: {
    id: string;
    prompt: string;
    type: string;
    subskills: string[];
  };
  learnerAnswer: string;
  descriptors: Partial<Record<DifficultyBand, string[]>>;
};

/**
 * Calls the backend Groq evaluator with full circuit-breaker and timeout protection.
 * 
 * CONTRACT: Returns null on ANY failure. Callers MUST handle null gracefully
 * by falling back to deterministic scoring. This function will NEVER throw.
 */
export async function evaluateWithGroq(
  payload: EvaluationPayload
): Promise<DescriptorEvaluationResult | null> {
  // Gate 1: Circuit breaker
  if (ClientCircuitBreaker.isOpen()) {
    console.log('[groqEvaluator] Circuit breaker is OPEN. Skipping LLM call.');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLMConfig.requestTimeoutMs);

    const res = await fetch(`${LLMConfig.backendUrl}/api/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      ClientCircuitBreaker.recordFailure(`HTTP ${res.status} from evaluator backend.`);
      return null;
    }

    const data: DescriptorEvaluationResult = await res.json();

    // If backend returned a fallback, treat it as "no enrichment"
    if (data._fallback) {
      console.log('[groqEvaluator] Backend returned a fallback result. Treating as no enrichment.');
      // Don't record failure — the backend already handled it.
      return null;
    }

    // Validate essential fields
    if (data.semantic_accuracy === undefined || !data.estimated_band) {
      ClientCircuitBreaker.recordFailure('Incomplete signal schema from backend.');
      return null;
    }

    ClientCircuitBreaker.recordSuccess();
    return data;
  } catch (err: any) {
    const message = err?.name === 'AbortError'
      ? `Request timed out after ${LLMConfig.requestTimeoutMs}ms`
      : err?.message || String(err);

    ClientCircuitBreaker.recordFailure(message);
    console.warn(`[groqEvaluator] Call failed: ${message}`);
    return null;
  }
}
