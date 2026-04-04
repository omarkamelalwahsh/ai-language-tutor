import { LLMSignal } from '../../types/efset';
import { ScoreWeights } from './ScoringPolicy';

export class SignalExtractor {
  
  /**
   * Safely parses LLM output into LLMSignal.
   * Ensures all values are 0-1.
   */
  public static parseLLMSignal(raw: any): LLMSignal {
    const clamp01 = (v: any) => {
        const n = typeof v === 'number' ? v : parseFloat(v);
        return isNaN(n) ? 0 : Math.max(0, Math.min(1, n));
    };

    return {
      content_accuracy: clamp01(raw.content_accuracy),
      task_completion: clamp01(raw.task_completion),
      grammar_control: clamp01(raw.grammar_control),
      lexical_range: clamp01(raw.lexical_range),
      syntactic_complexity: clamp01(raw.syntactic_complexity),
      coherence: clamp01(raw.coherence),
      typo_severity: clamp01(raw.typo_severity),
      confidence: clamp01(raw.confidence),
    };
  }

  /**
   * Computes content and language scores based on EF SET logic.
   */
  public static computeScores(signal: LLMSignal): { contentScore: number; languageScore: number } {
    const { content, language } = ScoreWeights;

    const contentScore = 
      (signal.content_accuracy * content.content_accuracy) + 
      (signal.task_completion * content.task_completion);

    const languageScore = 
      (signal.grammar_control * language.grammar_control) +
      (signal.lexical_range * language.lexical_range) +
      (signal.syntactic_complexity * language.syntactic_complexity) +
      (signal.coherence * language.coherence) +
      (Math.max(0, 1 - signal.typo_severity) * language.typo_severity);

    return { contentScore, languageScore };
  }
}
