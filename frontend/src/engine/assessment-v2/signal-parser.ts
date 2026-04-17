// ============================================================================
// Layer 2: Signal Schema + Parser
// ============================================================================
// Validates and sanitizes raw LLM output into the strict LinguisticSignals
// shape. Clamps all values to valid ranges, fills missing fields with safe
// defaults. The LLM MUST NOT decide final CEFR — only report signals.
// ============================================================================

import { LinguisticSignals, CEFRLevel, CEFR_ORDER } from './types';

/**
 * Clamp a value to [0, 1]. Returns fallback for NaN/undefined/null.
 */
function clamp01(x: unknown, fallback: number = 0): number {
  if (x === undefined || x === null) return fallback;
  const n = Number(x);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

/**
 * Validate a CEFR level string. Returns fallback if invalid.
 */
function validCefr(x: unknown, fallback: CEFRLevel = 'A1'): CEFRLevel {
  if (typeof x === 'string' && CEFR_ORDER.includes(x as CEFRLevel)) {
    return x as CEFRLevel;
  }
  return fallback;
}

/**
 * Parse raw LLM output (or any object) into a guaranteed-valid LinguisticSignals.
 *
 * Every field is clamped/defaulted independently — partial or malformed input
 * will never crash the pipeline.
 *
 * @param raw - The raw object from the LLM response
 * @returns A fully validated LinguisticSignals object
 */
export function parseLinguisticSignals(raw: Record<string, unknown> | null | undefined): LinguisticSignals {
  if (!raw || typeof raw !== 'object') {
    return createDefaultSignals();
  }

  return {
    content_accuracy:     clamp01(raw.content_accuracy ?? raw.semantic_accuracy, 0),
    task_completion:      clamp01(raw.task_completion, 0),
    grammar_control:      clamp01(raw.grammar_control, 0),
    lexical_range:        clamp01(raw.lexical_range ?? raw.lexical_sophistication, 0),
    syntactic_complexity: clamp01(raw.syntactic_complexity, 0),
    coherence:            clamp01(raw.coherence, 0),
    register_control:     clamp01(raw.register_control, 0),
    idiomatic_usage:      clamp01(raw.idiomatic_usage, 0),
    typo_severity:        clamp01(raw.typo_severity, 0),
    estimated_output_band: validCefr(raw.estimated_output_band ?? raw.estimated_band, 'A1'),
    confidence:           clamp01(raw.confidence, 0),
    flags:                Array.isArray(raw.flags) ? raw.flags.filter((f): f is string => typeof f === 'string') : [],
    rationale:            typeof raw.rationale === 'string' ? raw.rationale : '',
  };
}

/**
 * Creates a zeroed-out default signals object.
 * Used when the LLM is unavailable or returns garbage.
 */
export function createDefaultSignals(): LinguisticSignals {
  return {
    content_accuracy: 0,
    task_completion: 0,
    grammar_control: 0,
    lexical_range: 0,
    syntactic_complexity: 0,
    coherence: 0,
    register_control: 0,
    idiomatic_usage: 0,
    typo_severity: 0,
    estimated_output_band: 'A1',
    confidence: 0,
    flags: [],
    rationale: '',
  };
}

/**
 * Build LinguisticSignals from local heuristic features (no LLM).
 * Maps the existing FeatureExtractor output into the signal schema.
 */
export function buildSignalsFromHeuristics(features: {
  correctness?: number;
  lexicalDiversity?: number;
  sentenceComplexity?: number;
  connectorUsage?: number;
  wordCount?: number;
}): LinguisticSignals {
  const correctness = clamp01(features.correctness);
  const diversity = clamp01(features.lexicalDiversity);
  const complexity = clamp01(features.sentenceComplexity);
  const hasConnectors = (features.connectorUsage ?? 0) > 0;

  return {
    content_accuracy: correctness,
    task_completion: correctness > 0.3 ? Math.min(1, correctness + 0.1) : correctness,
    grammar_control: correctness * 0.7 + complexity * 0.3,
    lexical_range: diversity,
    syntactic_complexity: complexity,
    coherence: hasConnectors ? Math.min(1, 0.5 + diversity * 0.5) : diversity * 0.6,
    register_control: 0.5, // neutral — heuristic cannot detect register
    idiomatic_usage: 0.3,  // conservative default
    typo_severity: 0,      // no typo detection in heuristics
    estimated_output_band: 'A1', // heuristic does not estimate band
    confidence: 0.5,       // moderate confidence for heuristic path
    flags: ['heuristic_only'],
    rationale: 'Evaluated via local heuristics (no LLM available).',
  };
}
