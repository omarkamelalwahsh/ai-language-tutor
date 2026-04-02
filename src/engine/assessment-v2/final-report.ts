// ============================================================================
// Layer 9: Final Report
// ============================================================================
// Assembles the final structured AssessmentReport from skill decisions.
// Overall level uses available stable core skills — NOT a naive average.
// If major productive evidence is missing, mark overall as provisional.
// ============================================================================

import {
  CEFRDecision,
  AssessmentReport,
  SkillName,
  CEFRLevel,
  DecisionStatus,
  ALL_SKILLS,
  cefrToIndex,
  indexToCefr,
} from './types';

/** The four core CEFR skills (productive + receptive). */
const CORE_SKILLS: readonly SkillName[] = ['listening', 'reading', 'writing', 'speaking'];

/** Productive skills that need direct evidence for overall stability. */
const PRODUCTIVE_SKILLS: readonly SkillName[] = ['writing', 'speaking'];

/**
 * Build the final assessment report from skill-level decisions.
 *
 * Overall logic:
 * 1. Collect all stable/provisional skill decisions
 * 2. Use weighted floor approach: overall level = lowest among stable skills
 * 3. If any productive skill is insufficient_data → overall is provisional
 * 4. Overall confidence = weighted average of skill confidences
 *
 * @param decisions - Per-skill CEFR decisions from Layers 6+7
 * @returns The complete AssessmentReport
 */
export function buildReport(
  decisions: Record<SkillName, CEFRDecision>,
): AssessmentReport {
  const notes: string[] = [];

  // ── Collect skill statuses ──────────────────────────────────────────
  const stableSkills: CEFRDecision[] = [];
  const provisionalSkills: CEFRDecision[] = [];
  const allWithEvidence: CEFRDecision[] = [];

  for (const skill of ALL_SKILLS) {
    const d = decisions[skill];
    if (d.status === 'stable') stableSkills.push(d);
    if (d.status === 'provisional' || d.status === 'unstable') provisionalSkills.push(d);
    if (d.status !== 'insufficient_data' && d.directEvidenceCount > 0) allWithEvidence.push(d);
  }

  // ── Check for insufficient productive evidence ──────────────────────
  const hasInsufficientProductive = PRODUCTIVE_SKILLS.some(
    s => decisions[s].status === 'insufficient_data'
  );

  // ── Determine overall status ────────────────────────────────────────
  let overallStatus: DecisionStatus;

  if (allWithEvidence.length === 0) {
    overallStatus = 'insufficient_data';
    notes.push('No meaningful evidence collected for any skill.');
  } else if (hasInsufficientProductive) {
    overallStatus = 'provisional';
    const missing = PRODUCTIVE_SKILLS.filter(s => decisions[s].status === 'insufficient_data');
    notes.push(`Overall provisional: missing evidence for ${missing.join(', ')}.`);
  } else if (stableSkills.length >= CORE_SKILLS.length) {
    overallStatus = 'stable';
    notes.push('All core skills have stable assessments.');
  } else if (stableSkills.length >= 2) {
    overallStatus = 'provisional';
    notes.push(`Only ${stableSkills.length}/${CORE_SKILLS.length} core skills are stable.`);
  } else {
    overallStatus = 'provisional';
    notes.push('Insufficient stable evidence across core skills.');
  }

  // ── Compute overall level ───────────────────────────────────────────
  // Use confidence-weighted average of all skills with evidence,
  // but floor by the lowest stable skill to prevent over-estimation.
  let overallLevel: CEFRLevel | null = null;
  let overallRange: [CEFRLevel, CEFRLevel] | null = null;
  let overallConfidence = 0;

  if (allWithEvidence.length > 0) {
    // Weighted average by confidence
    let weightedSum = 0;
    let totalWeight = 0;

    for (const d of allWithEvidence) {
      const weight = Math.max(0.1, d.confidence) * (d.directEvidenceCount + d.indirectEvidenceCount * 0.3);
      weightedSum += cefrToIndex(d.level) * weight;
      totalWeight += weight;
    }

    const avgIndex = totalWeight > 0 ? weightedSum / totalWeight : 0;
    overallLevel = indexToCefr(Math.round(avgIndex));

    // Floor by lowest stable skill (conservative approach)
    if (stableSkills.length > 0) {
      const lowestStableIndex = Math.min(...stableSkills.map(d => cefrToIndex(d.level)));
      const avgRounded = Math.round(avgIndex);
      // Don't let overall be more than 1 band above the lowest stable skill
      if (avgRounded > lowestStableIndex + 1) {
        overallLevel = indexToCefr(lowestStableIndex + 1);
        notes.push(
          `Overall capped: lowest stable skill is at ${indexToCefr(lowestStableIndex)}.`
        );
      }
    }

    // Overall range
    const allIndices = allWithEvidence.map(d => cefrToIndex(d.level));
    overallRange = [
      indexToCefr(Math.min(...allIndices)),
      indexToCefr(Math.max(...allIndices)),
    ];

    // Overall confidence (weighted average)
    const confWeightedSum = allWithEvidence.reduce((sum, d) => sum + d.confidence, 0);
    overallConfidence = allWithEvidence.length > 0
      ? confWeightedSum / allWithEvidence.length
      : 0;
  }

  return {
    skills: decisions,
    overall: {
      level: overallLevel,
      levelRange: overallRange,
      confidence: Math.round(overallConfidence * 10000) / 10000,
      status: overallStatus,
      notes,
    },
  };
}
