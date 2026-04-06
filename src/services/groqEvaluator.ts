import { LLMConfig, ClientCircuitBreaker } from '../config/backend-config';

import { LLMSignal } from '../types/efset';

export type DifficultyBand = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type EvaluationPayload = {
  assessmentId: string; // Add assessment ID
  skill: "reading" | "writing" | "listening" | "speaking" | "vocabulary" | "grammar";
  currentBand: DifficultyBand;
  question: {
    id: string;
    prompt: string;
    type: string;
    subskills: string[];
    semanticIntent?: string;
    requiredContentPoints?: string[];
    target_cefr?: DifficultyBand; // Added to map back to original question level
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
/**
 * Ensures all 10 linguistic signals are present in the result.
 * Fills missing keys with 0.0 to prevent engine failures.
 */
/**
 * Ensures all linguistic signals are present and mapped to the EF SET contract.
 * Fills missing keys with 0.0 to prevent engine failures.
 */
function sanitizeLinguisticResult(data: any): LLMSignal {
  const clamp01 = (v: any) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return isNaN(n) ? 0 : Math.max(0, Math.min(1, n));
  };

  return {
    content_accuracy: clamp01(data.content_accuracy ?? data.semantic_accuracy ?? 0.0),
    task_completion: clamp01(data.task_completion ?? 1.0),
    grammar_control: clamp01(data.grammar_control ?? 0.0),
    lexical_range: clamp01(data.lexical_range ?? data.lexical_sophistication ?? 0.0),
    syntactic_complexity: clamp01(data.syntactic_complexity ?? 0.0),
    coherence: clamp01(data.coherence ?? 0.0),
    typo_severity: clamp01(data.typo_severity ?? 0.0),
    confidence: clamp01(data.confidence ?? 0.0)
  };
}

/**
 * Calls the backend Groq evaluator with full circuit-breaker and timeout protection.
 */
export async function evaluateWithGroq(
  payload: EvaluationPayload
): Promise<LLMSignal | null> {
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

    const rawData = await res.json();
    const data = sanitizeLinguisticResult(rawData);

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
