// ============================================================================
// Layer 3: Signal Normalizer
// ============================================================================
// Deterministic normalizer that takes raw LinguisticSignals and produces
// composite scores: contentScore, languageScore, taskFitScore.
//
// All logic here is pure functions with no side effects.
// ============================================================================

import { LinguisticSignals, NormalizedSignals, TaskType } from './types';
import { getScoringWeights } from './item-policy';

/**
 * Clamp value to [0, 1].
 */
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
}

/**
 * Normalize linguistic signals into composite scores.
 *
 * @param signals - Validated linguistic signals from the parser
 * @param taskType - The task type (used to look up scoring weights)
 * @param responseWordCount - Word count of the learner's response
 * @param expectedMinWords - Minimum expected words for this task type
 * @returns NormalizedSignals with contentScore, languageScore, taskFitScore
 */
export function normalizeSignals(
  signals: LinguisticSignals,
  taskType: TaskType,
  responseWordCount: number = 0,
  expectedMinWords: number = 5,
): NormalizedSignals {
  // ── Content Score ────────────────────────────────────────────────────
  // Measures: Did the learner answer correctly and completely?
  const contentScore = clamp01(
    0.6 * signals.content_accuracy +
    0.4 * signals.task_completion
  );

  // ── Typo Penalty ─────────────────────────────────────────────────────
  // Convert typo_severity (higher = worse) into a penalty factor (0..1)
  const typoPenalty = clamp01(signals.typo_severity);

  // ── Language Score ───────────────────────────────────────────────────
  // Measures: How proficient is the learner's language use?
  // Typo severity acts as a penalty rather than a positive contributor.
  const rawLanguageScore =
    0.25 * signals.grammar_control +
    0.20 * signals.lexical_range +
    0.15 * signals.syntactic_complexity +
    0.15 * signals.coherence +
    0.10 * signals.register_control +
    0.10 * signals.idiomatic_usage +
    0.05 * (1 - typoPenalty);

  const languageScore = clamp01(rawLanguageScore);

  // ── Task Fit Score ───────────────────────────────────────────────────
  // Measures: Did the response fit the task requirements?
  const responseValidity = clamp01(
    expectedMinWords > 0
      ? Math.min(1, responseWordCount / expectedMinWords)
      : 1.0
  );

  // Instruction compliance approximated from task_completion + content_accuracy
  const instructionCompliance = clamp01(
    0.6 * signals.task_completion +
    0.4 * signals.content_accuracy
  );

  const taskFitScore = clamp01(
    0.5 * signals.task_completion +
    0.3 * responseValidity +
    0.2 * instructionCompliance
  );

  return {
    contentScore,
    languageScore,
    taskFitScore,
    typoPenalty,
    raw: signals,
  };
}

/**
 * Compute the final item score by blending content and language scores
 * according to the task type's scoring policy.
 *
 * @param normalized - The normalized signals
 * @param taskType - The task type for scoring weight lookup
 * @returns A single 0..1 score representing overall item performance
 */
export function computeItemScore(
  normalized: NormalizedSignals,
  taskType: TaskType,
): number {
  const weights = getScoringWeights(taskType);
  return clamp01(
    weights.contentWeight * normalized.contentScore +
    weights.languageWeight * normalized.languageScore
  );
}

/**
 * Compute a skill-specific score from normalized signals.
 * Different skills care about different composites.
 *
 * @param skill - The target skill
 * @param normalized - The normalized signals
 * @returns A 0..1 score tailored for the given skill
 */
export function computeSkillSpecificScore(
  skill: string,
  normalized: NormalizedSignals,
): number {
  switch (skill) {
    case 'listening':
    case 'reading':
      // Receptive skills: content accuracy dominates
      return clamp01(0.7 * normalized.contentScore + 0.3 * normalized.languageScore);

    case 'writing':
    case 'speaking':
      // Productive skills: language quality dominates
      return clamp01(0.3 * normalized.contentScore + 0.7 * normalized.languageScore);

    case 'grammar':
      // Grammar: heavily weighted to grammar_control signal
      return clamp01(
        0.6 * normalized.raw.grammar_control +
        0.2 * normalized.raw.syntactic_complexity +
        0.1 * normalized.contentScore +
        0.1 * (1 - normalized.typoPenalty)
      );

    case 'vocabulary':
      // Vocabulary: heavily weighted to lexical signals
      return clamp01(
        0.5 * normalized.raw.lexical_range +
        0.2 * normalized.raw.idiomatic_usage +
        0.2 * normalized.contentScore +
        0.1 * normalized.raw.register_control
      );

    default:
      // Fallback: balanced blend
      return clamp01(0.5 * normalized.contentScore + 0.5 * normalized.languageScore);
  }
}
