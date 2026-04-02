// ============================================================================
// Assessment Pipeline v2 — Shared Types
// ============================================================================
// All types for the 9-layer CEFR assessment pipeline.
// Score scale: 0..1 throughout. Legacy 0-100 only via `score100` adapters.
// ============================================================================

/** The six assessment skills tracked by the system. */
export type SkillName = 'listening' | 'reading' | 'writing' | 'speaking' | 'grammar' | 'vocabulary';

export const ALL_SKILLS: readonly SkillName[] = [
  'listening', 'reading', 'writing', 'speaking', 'grammar', 'vocabulary',
] as const;

/** Canonical CEFR levels. */
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const CEFR_ORDER: readonly CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/** Numeric value for CEFR ordering (0-indexed). */
export function cefrToIndex(level: CEFRLevel): number {
  return CEFR_ORDER.indexOf(level);
}

/** Convert numeric index back to CEFR level (clamped). */
export function indexToCefr(index: number): CEFRLevel {
  const clamped = Math.max(0, Math.min(CEFR_ORDER.length - 1, Math.round(index)));
  return CEFR_ORDER[clamped];
}

// ────────────────────────────────────────────────────────────────────────────
// Layer 1: Item Definition
// ────────────────────────────────────────────────────────────────────────────

/** Canonicalized task types across the system. */
export type TaskType =
  | 'listening_mcq'
  | 'listening_short_answer'
  | 'reading_mcq'
  | 'reading_summary'
  | 'writing_paragraph'
  | 'speaking_audio'
  | 'speaking_typed_fallback'
  | 'grammar_fill_blank'
  | 'grammar_mcq'
  | 'vocab_mcq'
  | 'picture_description'
  | 'general_short_text';

/** How directly a task measures a skill. */
export type DirectnessLevel = 'direct' | 'strong_indirect' | 'weak_indirect' | 'none';

/** Numeric factors for each directness level. */
export const DIRECTNESS_FACTOR: Record<DirectnessLevel, number> = {
  direct: 1.0,
  strong_indirect: 0.6,
  weak_indirect: 0.3,
  none: 0.0,
} as const;

/** Evidence policy entry for a single skill within an item. */
export interface SkillEvidencePolicy {
  readonly weight: number;          // 0..1 relative importance
  readonly directness: DirectnessLevel;
}

/** Full evidence policy for an item — which skills it provides evidence for. */
export type EvidencePolicy = Partial<Record<SkillName, SkillEvidencePolicy>>;

/** How the learner responded to a task. */
export type ResponseMode = 'mcq' | 'typed' | 'audio';

/** Complete item definition. */
export interface ItemDefinition {
  readonly itemId: string;
  readonly taskType: TaskType;
  readonly targetSkill: SkillName;
  readonly targetCEFR: CEFRLevel;
  readonly responseMode: ResponseMode;
  readonly evidencePolicy: EvidencePolicy;
}

// ────────────────────────────────────────────────────────────────────────────
// Layer 2: Signal Extraction
// ────────────────────────────────────────────────────────────────────────────

/**
 * The strict contract for LLM-extracted linguistic signals.
 * The LLM MUST NOT decide final CEFR. It only reports signals.
 */
export interface LinguisticSignals {
  readonly content_accuracy: number;       // 0..1
  readonly task_completion: number;        // 0..1
  readonly grammar_control: number;        // 0..1
  readonly lexical_range: number;          // 0..1
  readonly syntactic_complexity: number;   // 0..1
  readonly coherence: number;              // 0..1
  readonly register_control: number;       // 0..1
  readonly idiomatic_usage: number;        // 0..1
  readonly typo_severity: number;          // 0..1 (higher = worse)
  readonly estimated_output_band: CEFRLevel; // Informational ONLY — not used for final level
  readonly confidence: number;             // 0..1
  readonly flags: readonly string[];
  readonly rationale: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Layer 3: Signal Normalization
// ────────────────────────────────────────────────────────────────────────────

/** Composite scores derived from raw signals. */
export interface NormalizedSignals {
  readonly contentScore: number;    // 0..1
  readonly languageScore: number;   // 0..1
  readonly taskFitScore: number;    // 0..1
  readonly typoPenalty: number;     // 0..1 (0 = no penalty)
  readonly raw: LinguisticSignals;  // original signals preserved for tracing
}

// ────────────────────────────────────────────────────────────────────────────
// Layer 4: Evidence Attribution
// ────────────────────────────────────────────────────────────────────────────

/** A single evidence record produced from one response for one skill. */
export interface EvidenceRecord {
  readonly skill: SkillName;
  readonly itemScore: number;           // 0..1 — skill-appropriate composite
  readonly evidenceWeight: number;      // from policy
  readonly directnessFactor: number;    // 1.0 | 0.6 | 0.3 | 0.0
  readonly isDirect: boolean;
  readonly itemConfidence: number;      // LLM confidence or 1.0 for heuristic
  readonly sourceItemId: string;
  readonly targetCEFR: CEFRLevel;       // the item's declared target level
  readonly taskType: TaskType;
  readonly responseMode: ResponseMode;
  readonly flags: readonly string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Layer 5: Skill Aggregation
// ────────────────────────────────────────────────────────────────────────────

/** Aggregated evidence state for a single skill. */
export interface SkillAggregation {
  readonly skill: SkillName;
  readonly score: number;               // 0..1 weighted average
  readonly score100: number;            // backward-compat 0..100
  readonly directEvidenceCount: number;
  readonly indirectEvidenceCount: number;
  readonly totalEvidenceCount: number;
  readonly directRatio: number;         // directCount / totalCount (0..1)
  readonly consistency: number;         // 0..1
  readonly levelRange: [CEFRLevel, CEFRLevel] | null;
  readonly flags: readonly string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Layer 6: CEFR Decision
// ────────────────────────────────────────────────────────────────────────────

/** Decision status for a skill. */
export type DecisionStatus = 'stable' | 'provisional' | 'unstable' | 'insufficient_data';

/** Output of the CEFR decision engine for one skill. */
export interface CEFRDecision {
  readonly skill: SkillName;
  readonly level: CEFRLevel;
  readonly levelRange: [CEFRLevel, CEFRLevel] | null;
  readonly status: DecisionStatus;
  readonly score: number;             // 0..1
  readonly score100: number;          // backward-compat 0..100
  readonly directEvidenceCount: number;
  readonly indirectEvidenceCount: number;
  readonly directRatio: number;
  readonly consistency: number;
  readonly confidence: number;        // filled by confidence engine
  readonly flags: readonly string[];
  readonly notes: readonly string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Layer 8: Authenticity Guard
// ────────────────────────────────────────────────────────────────────────────

/** Flags that the authenticity guard can raise. */
export type AuthenticityFlag =
  | 'overformal_register'
  | 'ai_like_abstraction'
  | 'persona_leakage'
  | 'response_task_mismatch'
  | 'overperformance'
  | 'too_short_inflated';

// ────────────────────────────────────────────────────────────────────────────
// Layer 9: Final Report
// ────────────────────────────────────────────────────────────────────────────

/** The complete assessment report — final output of the pipeline. */
export interface AssessmentReport {
  readonly skills: Record<SkillName, CEFRDecision>;
  readonly overall: {
    readonly level: CEFRLevel | null;
    readonly levelRange: [CEFRLevel, CEFRLevel] | null;
    readonly confidence: number;
    readonly status: DecisionStatus;
    readonly notes: readonly string[];
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Scoring Policy
// ────────────────────────────────────────────────────────────────────────────

/** How to blend content vs language scores for a given task type. */
export interface ScoringWeights {
  readonly contentWeight: number;   // 0..1
  readonly languageWeight: number;  // 0..1
  /** Evidence power multiplier: MCQ=0.4, open=1.0. */
  readonly evidentialPower: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Pipeline Configuration
// ────────────────────────────────────────────────────────────────────────────

/** Centralized thresholds — single source of truth, configurable. */
export interface PipelineConfig {
  /** CEFR score thresholds (0..1 boundaries). */
  readonly cefrThresholds: Record<CEFRLevel, { min: number; max: number }>;

  /** Minimum direct evidence counts per skill. */
  readonly minDirectEvidence: Record<SkillName, number>;

  /** Below this consistency, downgrade one band or mark unstable. */
  readonly consistencyThreshold: number;

  /** Below this directRatio, do not certify as stable. */
  readonly directRatioThreshold: number;

  /** Confidence below this → status is never 'stable'. */
  readonly minStableConfidence: number;

  /** Overperformance cap: max bands above target an item can contribute. */
  readonly overperformanceCapBands: number;
}

/** Default pipeline configuration — spec values. */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  cefrThresholds: {
    A1: { min: 0.00, max: 0.39 },
    A2: { min: 0.40, max: 0.54 },
    B1: { min: 0.55, max: 0.69 },
    B2: { min: 0.70, max: 0.82 },
    C1: { min: 0.83, max: 0.92 },
    C2: { min: 0.93, max: 1.00 },
  },
  minDirectEvidence: {
    listening: 5,
    reading: 5,
    writing: 2,
    speaking: 2,
    grammar: 4,
    vocabulary: 4,
  },
  consistencyThreshold: 0.70,
  directRatioThreshold: 0.60,
  minStableConfidence: 0.50,
  overperformanceCapBands: 1,
} as const;
