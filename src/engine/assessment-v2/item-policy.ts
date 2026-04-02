// ============================================================================
// Layer 1: Item Policy Registry
// ============================================================================
// Central, authoritative policy map for every task type.
// Defines which skills each task type provides evidence for, with what weight,
// and at what directness level.
//
// NON-NEGOTIABLE RULES ENFORCED HERE:
// - speaking_typed_fallback has speaking weight = 0 (none)
// - listening_mcq provides NO writing evidence
// - MCQ tasks have low productive-skill evidence
// ============================================================================

import {
  TaskType,
  EvidencePolicy,
  ScoringWeights,
  type SkillName,
} from './types';

// ────────────────────────────────────────────────────────────────────────────
// Evidence Policy Matrix
// ────────────────────────────────────────────────────────────────────────────

/**
 * Master evidence policy map.
 * For each task type, defines which skills receive evidence, at what weight
 * and directness. This is the SINGLE SOURCE OF TRUTH for evidence routing.
 */
export const EVIDENCE_POLICY_MAP: Record<TaskType, EvidencePolicy> = {
  // ── Listening Tasks ──────────────────────────────────────────────────────
  listening_mcq: {
    listening: { weight: 1.0, directness: 'direct' },
    // NO writing, NO grammar, NO vocabulary evidence from MCQ
  },

  listening_short_answer: {
    listening: { weight: 1.0, directness: 'direct' },
    writing:   { weight: 0.3, directness: 'weak_indirect' },
    grammar:   { weight: 0.3, directness: 'weak_indirect' },
    vocabulary:{ weight: 0.3, directness: 'weak_indirect' },
  },

  // ── Reading Tasks ────────────────────────────────────────────────────────
  reading_mcq: {
    reading:   { weight: 1.0, directness: 'direct' },
    vocabulary:{ weight: 0.2, directness: 'weak_indirect' },
    // NO writing evidence from MCQ
  },

  reading_summary: {
    reading:   { weight: 1.0, directness: 'direct' },
    writing:   { weight: 0.7, directness: 'strong_indirect' },
    grammar:   { weight: 0.4, directness: 'weak_indirect' },
    vocabulary:{ weight: 0.4, directness: 'weak_indirect' },
  },

  // ── Writing Tasks ────────────────────────────────────────────────────────
  writing_paragraph: {
    writing:   { weight: 1.0, directness: 'direct' },
    grammar:   { weight: 0.7, directness: 'strong_indirect' },
    vocabulary:{ weight: 0.7, directness: 'strong_indirect' },
  },

  // ── Speaking Tasks ───────────────────────────────────────────────────────
  speaking_audio: {
    speaking:  { weight: 1.0, directness: 'direct' },
    grammar:   { weight: 0.5, directness: 'strong_indirect' },
    vocabulary:{ weight: 0.5, directness: 'strong_indirect' },
  },

  /** NON-NEGOTIABLE: Typed fallback NEVER provides speaking evidence. */
  speaking_typed_fallback: {
    speaking:  { weight: 0.0, directness: 'none' },    // ZERO — hard rule
    writing:   { weight: 0.3, directness: 'weak_indirect' },
    grammar:   { weight: 0.3, directness: 'weak_indirect' },
    vocabulary:{ weight: 0.3, directness: 'weak_indirect' },
  },

  // ── Grammar Tasks ────────────────────────────────────────────────────────
  grammar_mcq: {
    grammar:   { weight: 1.0, directness: 'direct' },
    vocabulary:{ weight: 0.2, directness: 'weak_indirect' },
  },

  grammar_fill_blank: {
    grammar:   { weight: 1.0, directness: 'direct' },
    vocabulary:{ weight: 0.2, directness: 'weak_indirect' },
  },

  // ── Vocabulary Tasks ─────────────────────────────────────────────────────
  vocab_mcq: {
    vocabulary:{ weight: 1.0, directness: 'direct' },
    reading:   { weight: 0.2, directness: 'weak_indirect' },
  },

  // ── Multi-Skill / General Tasks ──────────────────────────────────────────
  picture_description: {
    writing:   { weight: 1.0, directness: 'direct' },
    vocabulary:{ weight: 0.6, directness: 'strong_indirect' },
    grammar:   { weight: 0.5, directness: 'strong_indirect' },
  },

  general_short_text: {
    writing:   { weight: 0.5, directness: 'weak_indirect' },
    grammar:   { weight: 0.4, directness: 'weak_indirect' },
    vocabulary:{ weight: 0.4, directness: 'weak_indirect' },
  },
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Scoring Policy Table
// ────────────────────────────────────────────────────────────────────────────

/**
 * How to blend content accuracy vs. language quality for each task type.
 * Also sets the evidential power multiplier (MCQ = low, open = high).
 */
export const SCORING_POLICY: Record<TaskType, ScoringWeights> = {
  // MCQ tasks: mostly correctness, near-zero language signal
  listening_mcq:         { contentWeight: 0.95, languageWeight: 0.05, evidentialPower: 0.4 },
  reading_mcq:           { contentWeight: 0.95, languageWeight: 0.05, evidentialPower: 0.4 },
  vocab_mcq:             { contentWeight: 0.95, languageWeight: 0.05, evidentialPower: 0.4 },
  grammar_mcq:           { contentWeight: 0.95, languageWeight: 0.05, evidentialPower: 0.4 },

  // Short factual responses: content-heavy, some language signal
  listening_short_answer:{ contentWeight: 0.70, languageWeight: 0.30, evidentialPower: 0.6 },
  grammar_fill_blank:    { contentWeight: 0.80, languageWeight: 0.20, evidentialPower: 0.6 },
  general_short_text:    { contentWeight: 0.60, languageWeight: 0.40, evidentialPower: 0.6 },

  // Summary / explanation: balanced content + language
  reading_summary:       { contentWeight: 0.40, languageWeight: 0.60, evidentialPower: 0.8 },

  // Writing / production: language dominates
  writing_paragraph:     { contentWeight: 0.20, languageWeight: 0.80, evidentialPower: 1.0 },
  picture_description:   { contentWeight: 0.30, languageWeight: 0.70, evidentialPower: 0.9 },

  // Speaking audio: language dominates
  speaking_audio:        { contentWeight: 0.15, languageWeight: 0.85, evidentialPower: 1.0 },

  // Speaking typed fallback: content only (no productive speaking credit)
  speaking_typed_fallback:{ contentWeight: 0.80, languageWeight: 0.20, evidentialPower: 0.3 },
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Legacy Task Type Mapping
// ────────────────────────────────────────────────────────────────────────────

/**
 * Maps the existing QuestionType values to the canonical TaskType.
 * Used for backward compatibility with the adaptive engine.
 */
export function mapLegacyQuestionType(
  legacyType: string,
  primarySkill: string,
  responseMode?: string,
): TaskType {
  // Speaking typed fallback — highest priority check
  if (primarySkill === 'speaking' && responseMode === 'typed_fallback') {
    return 'speaking_typed_fallback';
  }
  if (primarySkill === 'speaking' && responseMode === 'voice') {
    return 'speaking_audio';
  }

  switch (legacyType) {
    case 'listening_mcq':
      return 'listening_mcq';
    case 'reading_mcq':
      return 'reading_mcq';
    case 'mcq':
      if (primarySkill === 'listening') return 'listening_mcq';
      if (primarySkill === 'reading') return 'reading_mcq';
      if (primarySkill === 'grammar') return 'grammar_mcq';
      if (primarySkill === 'vocabulary') return 'vocab_mcq';
      return 'vocab_mcq';
    case 'fill_blank':
      return 'grammar_fill_blank';
    case 'listening_summary':
      return primarySkill === 'reading' ? 'reading_summary' : 'listening_short_answer';
    case 'short_text':
      if (primarySkill === 'writing') return 'writing_paragraph';
      if (primarySkill === 'speaking') return responseMode === 'voice' ? 'speaking_audio' : 'speaking_typed_fallback';
      return 'general_short_text';
    case 'picture_description':
      return 'picture_description';
    default:
      return 'general_short_text';
  }
}

/**
 * Get the evidence policy for an item, resolving from the central map.
 */
export function getEvidencePolicy(taskType: TaskType): EvidencePolicy {
  return EVIDENCE_POLICY_MAP[taskType] ?? EVIDENCE_POLICY_MAP['general_short_text'];
}

/**
 * Get the scoring weights for an item.
 */
export function getScoringWeights(taskType: TaskType): ScoringWeights {
  return SCORING_POLICY[taskType] ?? SCORING_POLICY['general_short_text'];
}
