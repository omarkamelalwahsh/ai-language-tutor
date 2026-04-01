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
/**
 * Ensures all 10 linguistic signals are present in the result.
 * Fills missing keys with 0.0 to prevent engine failures.
 */
function sanitizeLinguisticResult(data: any): DescriptorEvaluationResult {
  return {
    semantic_accuracy: data.semantic_accuracy ?? 0.0,
    task_completion: data.task_completion ?? 0.0,
    lexical_sophistication: data.lexical_sophistication ?? 0.0,
    syntactic_complexity: data.syntactic_complexity ?? 0.0,
    coherence: data.coherence ?? 0.0,
    grammar_control: data.grammar_control ?? 0.0,
    typo_severity: data.typo_severity ?? 0.0,
    idiomatic_usage: data.idiomatic_usage ?? 0.0,
    register_control: data.register_control ?? 0.0,
    estimated_band: data.estimated_band ?? 'A1',
    confidence: data.confidence ?? 0.0,
    rationale: data.rationale ?? 'No rationale provided.',
    _fallback: data._fallback ?? false
  };
}

/**
 * Calls the backend Groq evaluator with full circuit-breaker and timeout protection.
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

    const rawData = await res.json();
    const data = sanitizeLinguisticResult(rawData);

    // If backend returned a fallback, we still return it (with zeroed signals)
    if (data._fallback) {
      console.log('[groqEvaluator] Backend returned a fallback result. Using zeroed signals.');
      ClientCircuitBreaker.recordSuccess(); // Success at protocol level
      return data;
    }

    // Validate essential fields (sanitizer handles most, but we check semantic_accuracy/estimated_band)
    if (rawData.semantic_accuracy === undefined || !rawData.estimated_band) {
      console.warn('[groqEvaluator] Response missing core fields. Sanitizing but recording failure.');
      ClientCircuitBreaker.recordFailure('Incomplete signal schema from backend.');
      return data; // Return sanitized anyway to avoid engine crash
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
