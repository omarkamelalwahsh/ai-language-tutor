// ============================================================================
// Skill Propagator
// ============================================================================
// Step 6: propagateSkillUpdates
// Aggregates subskill scores into skill scores using weighted averages.
// Skills are NEVER updated directly — only through subskill propagation.
// ============================================================================

import {
  SkillId, SubskillId, SkillState, SubskillState,
  SkillUpdate, ALL_SKILL_IDS,
} from '../domain/types';
import { scoreToCEFRBand } from '../domain/cefr';
import { getSubskillsForSkill, getSubskillWeight } from '../frameworks/skill-registry';

/**
 * Propagate subskill scores to skill scores.
 *
 * For each skill:
 * 1. Get all contributing subskills
 * 2. Compute weighted average of subskill scores
 * 3. Normalize weights (handle missing subskills)
 * 4. Compute new skill confidence as weighted average of subskill confidences
 * 5. Update skill state
 *
 * Returns new skill states and change records.
 */
export function propagateSkillUpdates(
  currentSkills: Record<SkillId, SkillState>,
  updatedSubskills: Record<SubskillId, SubskillState>,
): { skills: Record<SkillId, SkillState>; updates: SkillUpdate[] } {
  const newSkills: Record<SkillId, SkillState> = {} as Record<SkillId, SkillState>;
  const updates: SkillUpdate[] = [];
  const now = new Date().toISOString();

  for (const skillId of ALL_SKILL_IDS) {
    const current = currentSkills[skillId];
    const subskillIds = getSubskillsForSkill(skillId);

    // Collect weights and scores
    let totalWeight = 0;
    let weightedScoreSum = 0;
    let weightedConfidenceSum = 0;
    let totalEvidenceCount = 0;
    const contributions: { subskillId: SubskillId; contribution: number }[] = [];

    for (const ssId of subskillIds) {
      const ssState = updatedSubskills[ssId];
      if (!ssState) continue;

      const weight = getSubskillWeight(ssId, skillId);
      if (weight <= 0) continue;

      totalWeight += weight;
      weightedScoreSum += ssState.score * weight;
      weightedConfidenceSum += ssState.confidence * weight;
      totalEvidenceCount += ssState.evidenceCount;

      contributions.push({
        subskillId: ssId,
        contribution: Number((ssState.score * weight).toFixed(2)),
      });
    }

    // Normalize
    const newScore = totalWeight > 0
      ? Number((weightedScoreSum / totalWeight).toFixed(2))
      : current.score;

    const newConfidence = totalWeight > 0
      ? Number((weightedConfidenceSum / totalWeight).toFixed(4))
      : current.confidence;

    const newBand = scoreToCEFRBand(newScore, newConfidence);

    newSkills[skillId] = {
      ...current,
      score: newScore,
      band: newBand,
      confidence: newConfidence,
      evidenceCount: totalEvidenceCount,
      lastUpdated: now,
    };

    const delta = Number((newScore - current.score).toFixed(2));
    if (delta !== 0 || current.band.primary !== newBand.primary) {
      updates.push({
        skillId,
        previousScore: current.score,
        newScore,
        previousBand: current.band,
        newBand,
        delta,
        contributingSubskills: contributions,
      });
    }
  }

  return { skills: newSkills, updates };
}
