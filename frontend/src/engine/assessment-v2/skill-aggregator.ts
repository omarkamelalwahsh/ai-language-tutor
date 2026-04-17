// ============================================================================
// Layer 5: Skill Aggregator
// ============================================================================
// Aggregates all EvidenceRecords for each skill into a SkillAggregation.
// Uses weighted averaging with directness factors and item confidence.
//
// Formula:
//   finalSkillScore = Σ(itemScore × evidenceWeight × directnessFactor × itemConfidence)
//                   / Σ(evidenceWeight × directnessFactor × itemConfidence)
//
// Consistency = % of evidence items performing at candidate band or above.
// ============================================================================

import {
  EvidenceRecord,
  SkillAggregation,
  SkillName,
  CEFRLevel,
  ALL_SKILLS,
  PipelineConfig,
  DEFAULT_PIPELINE_CONFIG,
  cefrToIndex,
  indexToCefr,
} from './types';

/**
 * Aggregate all evidence records into per-skill aggregations.
 *
 * @param allEvidence - All evidence records from all items in the assessment
 * @param config - Pipeline configuration (for thresholds)
 * @returns Map of skill → SkillAggregation
 */
export function aggregateSkills(
  allEvidence: readonly EvidenceRecord[],
  config: PipelineConfig = DEFAULT_PIPELINE_CONFIG,
): Record<SkillName, SkillAggregation> {
  const result = {} as Record<SkillName, SkillAggregation>;

  for (const skill of ALL_SKILLS) {
    const skillEvidence = allEvidence.filter(e => e.skill === skill);
    result[skill] = aggregateSingleSkill(skill, skillEvidence, config);
  }

  return result;
}

/**
 * Aggregate evidence for a single skill.
 */
function aggregateSingleSkill(
  skill: SkillName,
  evidence: readonly EvidenceRecord[],
  config: PipelineConfig,
): SkillAggregation {
  if (evidence.length === 0) {
    return {
      skill,
      score: 0,
      score100: 0,
      directEvidenceCount: 0,
      indirectEvidenceCount: 0,
      totalEvidenceCount: 0,
      directRatio: 0,
      consistency: 0,
      levelRange: null,
      flags: ['no_evidence'],
    };
  }

  // ── Weighted average score ───────────────────────────────────────────
  let weightedScoreSum = 0;
  let weightDenominator = 0;

  for (const e of evidence) {
    const weight = e.evidenceWeight * e.directnessFactor * Math.max(0.1, e.itemConfidence);
    weightedScoreSum += e.itemScore * weight;
    weightDenominator += weight;
  }

  const score = weightDenominator > 0 ? weightedScoreSum / weightDenominator : 0;

  // ── Evidence counts ─────────────────────────────────────────────────
  const directEvidenceCount = evidence.filter(e => e.isDirect).length;
  const indirectEvidenceCount = evidence.filter(e => !e.isDirect).length;
  const totalEvidenceCount = evidence.length;
  const directRatio = totalEvidenceCount > 0 ? directEvidenceCount / totalEvidenceCount : 0;

  // ── Candidate band ──────────────────────────────────────────────────
  const candidateBand = scoreToCefrLevel(score, config);

  // ── Consistency ─────────────────────────────────────────────────────
  // % of evidence items performing at the candidate band or above
  const candidateIndex = cefrToIndex(candidateBand);
  const performingAtOrAbove = evidence.filter(e => {
    const itemBand = scoreToCefrLevel(e.itemScore, config);
    return cefrToIndex(itemBand) >= candidateIndex;
  });
  const consistency = evidence.length > 0 ? performingAtOrAbove.length / evidence.length : 0;

  // ── Level range ──────────────────────────────────────────────────────
  // Floor = lowest band seen in evidence, Ceiling = highest
  const bandIndices = evidence.map(e => cefrToIndex(scoreToCefrLevel(e.itemScore, config)));
  const minBandIndex = Math.min(...bandIndices);
  const maxBandIndex = Math.max(...bandIndices);
  const levelRange: [CEFRLevel, CEFRLevel] = [indexToCefr(minBandIndex), indexToCefr(maxBandIndex)];

  // ── Flags ────────────────────────────────────────────────────────────
  const flags: string[] = [];
  if (directEvidenceCount === 0) flags.push('no_direct_evidence');
  if (directRatio < config.directRatioThreshold) flags.push('low_direct_ratio');
  if (consistency < config.consistencyThreshold) flags.push('low_consistency');
  if (totalEvidenceCount < 3) flags.push('sparse_evidence');

  return {
    skill,
    score: clamp01(score),
    score100: Math.round(clamp01(score) * 100),
    directEvidenceCount,
    indirectEvidenceCount,
    totalEvidenceCount,
    directRatio: round4(directRatio),
    consistency: round4(consistency),
    levelRange,
    flags,
  };
}

/**
 * Map a 0..1 score to a CEFR level using centralized thresholds.
 */
export function scoreToCefrLevel(
  score: number,
  config: PipelineConfig = DEFAULT_PIPELINE_CONFIG,
): CEFRLevel {
  const clamped = clamp01(score);
  const thresholds = config.cefrThresholds;

  // Walk from highest to lowest
  if (clamped >= thresholds.C2.min) return 'C2';
  if (clamped >= thresholds.C1.min) return 'C1';
  if (clamped >= thresholds.B2.min) return 'B2';
  if (clamped >= thresholds.B1.min) return 'B1';
  if (clamped >= thresholds.A2.min) return 'A2';
  return 'A1';
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}
