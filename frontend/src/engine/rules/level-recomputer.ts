// ============================================================================
// Level Recomputer
// ============================================================================
// Step 7: recomputeOverallLevel
// Computes the learner's overall CEFR band from skill scores.
// NOT a simple average — uses a floor-gated weighted approach.
// ============================================================================

import { SkillId, SkillState, ALL_SKILL_IDS } from '../domain/types';
import { CEFRBand, scoreToCEFR, scoreToCEFRBand, cefrToIndex, CEFR_ORDER } from '../domain/cefr';

/**
 * Skill weights for overall level computation.
 *
 * These are NOT equal. We weight productive skills slightly higher
 * because they provide stronger evidence of active competence.
 *
 * ASSUMPTION: These weights should be validated and may differ by learner goal.
 */
const OVERALL_SKILL_WEIGHTS: Record<SkillId, number> = {
  writing: 0.28,
  speaking: 0.28,
  reading: 0.22,
  listening: 0.22,
};

/**
 * Essential skills that GATE the overall level.
 * If any essential skill is more than one CEFR level below the
 * weighted average, the overall level is capped.
 *
 * Rationale: A learner who speaks at C1 but can't read at all
 * should not be rated B2+ overall.
 */
const ESSENTIAL_SKILLS: readonly SkillId[] = ['reading', 'listening', 'writing', 'speaking'];

/**
 * Minimum evidence count before we upgrade qualifier to 'confident'.
 */
const MIN_EVIDENCE_FOR_CONFIDENT = 10;

/**
 * Recompute the overall CEFR band from skill states.
 *
 * Algorithm:
 * 1. Compute weighted average score from all skills
 * 2. Apply floor gating: if any essential skill is >1 level below,
 *    cap the overall to at most 1 level above the weakest essential skill
 * 3. Compute confidence as the minimum confidence across skills
 *    (conservative: overall confidence limited by least-evidenced skill)
 * 4. Build the CEFR band with appropriate qualifier
 */
export function recomputeOverallLevel(
  skills: Record<SkillId, SkillState>,
): { score: number; band: CEFRBand } {
  // Step 1: Weighted average
  let weightedSum = 0;
  let totalWeight = 0;

  for (const skillId of ALL_SKILL_IDS) {
    const skill = skills[skillId];
    const weight = OVERALL_SKILL_WEIGHTS[skillId];
    weightedSum += skill.score * weight;
    totalWeight += weight;
  }

  let overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Step 2: Floor gating
  const overallLevel = scoreToCEFR(overallScore);
  const overallIdx = cefrToIndex(overallLevel);

  let weakestEssentialIdx = 5; // Start at C2
  for (const skillId of ESSENTIAL_SKILLS) {
    const skillLevel = skills[skillId].band.primary;
    const skillIdx = cefrToIndex(skillLevel);
    if (skillIdx < weakestEssentialIdx) {
      weakestEssentialIdx = skillIdx;
    }
  }

  // If overall is more than 1 level above weakest essential, cap it
  if (overallIdx > weakestEssentialIdx + 1) {
    const cappedLevel = CEFR_ORDER[weakestEssentialIdx + 1];
    const cappedThreshold = (weakestEssentialIdx + 1) * 20; // Approximate
    overallScore = Math.min(overallScore, cappedThreshold + 5);
  }

  // Step 3: Conservative confidence
  let minConfidence = 1;
  let totalEvidence = 0;
  for (const skillId of ALL_SKILL_IDS) {
    const skill = skills[skillId];
    if (skill.confidence < minConfidence) {
      minConfidence = skill.confidence;
    }
    totalEvidence += skill.evidenceCount;
  }

  // If total evidence is low, further reduce confidence
  if (totalEvidence < MIN_EVIDENCE_FOR_CONFIDENT * ALL_SKILL_IDS.length) {
    minConfidence = Math.min(minConfidence, 0.5);
  }

  // Step 4: Build band
  const band = scoreToCEFRBand(overallScore, minConfidence);

  return {
    score: Number(overallScore.toFixed(2)),
    band,
  };
}
