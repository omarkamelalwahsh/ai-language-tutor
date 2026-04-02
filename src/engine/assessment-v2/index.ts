// ============================================================================
// Assessment Pipeline v2 — Barrel Export
// ============================================================================

// Core types
export * from './types';

// Layer 1: Item Policy Registry
export { EVIDENCE_POLICY_MAP, SCORING_POLICY, mapLegacyQuestionType, getEvidencePolicy, getScoringWeights } from './item-policy';

// Layer 2: Signal Parser
export { parseLinguisticSignals, createDefaultSignals, buildSignalsFromHeuristics } from './signal-parser';

// Layer 3: Signal Normalizer
export { normalizeSignals, computeItemScore, computeSkillSpecificScore } from './signal-normalizer';

// Layer 4: Evidence Attribution
export { attributeEvidence } from './evidence-attribution';
export type { AttributionInput } from './evidence-attribution';

// Layer 5: Skill Aggregator
export { aggregateSkills, scoreToCefrLevel } from './skill-aggregator';

// Layer 6: CEFR Decision Engine
export { makeDecisions } from './cefr-decision-engine';
export type { SpeakingAuditInfo } from './cefr-decision-engine';

// Layer 7: Confidence Engine
export { applyConfidence } from './confidence-engine';

// Layer 8: Authenticity Guard
export { guardAuthenticity } from './authenticity-guard';
export type { AuthenticityResult } from './authenticity-guard';

// Layer 9: Final Report
export { buildReport } from './final-report';

// Pipeline Orchestrator
export { AssessmentPipelineV2 } from './pipeline';
export type { PipelineItemInput } from './pipeline';
