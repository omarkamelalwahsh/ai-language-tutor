// ============================================================================
// Layer 6: CEFR Decision Engine
// ============================================================================
// Single authoritative decision engine for CEFR level determination.
// ALL thresholds live here. No other module should make CEFR decisions.
//
// Decision rules (applied in order):
// 1. Map score to candidate CEFR using centralized thresholds
// 2. If min direct evidence NOT met → provisional or insufficient_data
// 3. If consistency < threshold → downgrade one band or mark unstable
// 4. If directRatio < threshold → do NOT certify as stable
// 5. Speaking with no audio → insufficient_data (hard rule)
// ============================================================================

import {
  SkillAggregation,
  CEFRDecision,
  SkillName,
  CEFRLevel,
  DecisionStatus,
  PipelineConfig,
  DEFAULT_PIPELINE_CONFIG,
  cefrToIndex,
  indexToCefr,
} from './types';
import { scoreToCefrLevel } from './skill-aggregator';

/**
 * Speaking audit information needed for the decision engine.
 */
export interface SpeakingAuditInfo {
  /** Total speaking tasks presented. */
  readonly speakingTasksTotal: number;
  /** Whether any valid audio was submitted. */
  readonly hasAnySpeakingEvidence: boolean;
}

/**
 * Make CEFR decisions for all skills.
 *
 * @param aggregations - Skill aggregations from Layer 5
 * @param speakingAudit - Speaking audit trail (for insufficient_data rule)
 * @param config - Pipeline configuration
 * @returns Map of skill → CEFRDecision
 */
export function makeDecisions(
  aggregations: Record<SkillName, SkillAggregation>,
  speakingAudit: SpeakingAuditInfo,
  config: PipelineConfig = DEFAULT_PIPELINE_CONFIG,
): Record<SkillName, CEFRDecision> {
  const decisions = {} as Record<SkillName, CEFRDecision>;

  for (const [skillStr, agg] of Object.entries(aggregations)) {
    const skill = skillStr as SkillName;
    decisions[skill] = makeSkillDecision(skill, agg, speakingAudit, config);
  }

  return decisions;
}

/**
 * Make a CEFR decision for a single skill.
 */
function makeSkillDecision(
  skill: SkillName,
  agg: SkillAggregation,
  speakingAudit: SpeakingAuditInfo,
  config: PipelineConfig,
): CEFRDecision {
  const notes: string[] = [];
  const flags: string[] = [...agg.flags];

  // ── HARD RULE: Speaking with no audio evidence ──────────────────────
  if (skill === 'speaking' && !speakingAudit.hasAnySpeakingEvidence) {
    notes.push('No spoken audio submitted. Speaking cannot be assessed without voice evidence.');
    return {
      skill,
      level: 'A1',
      levelRange: null,
      status: 'insufficient_data',
      score: agg.score,
      score100: agg.score100,
      directEvidenceCount: agg.directEvidenceCount,
      indirectEvidenceCount: agg.indirectEvidenceCount,
      directRatio: agg.directRatio,
      consistency: agg.consistency,
      confidence: 0,
      flags: [...flags, 'no_audio_evidence'],
      notes,
    };
  }

  // ── No evidence at all ──────────────────────────────────────────────
  if (agg.totalEvidenceCount === 0) {
    return {
      skill,
      level: 'A1',
      levelRange: null,
      status: 'insufficient_data',
      score: 0,
      score100: 0,
      directEvidenceCount: 0,
      indirectEvidenceCount: 0,
      directRatio: 0,
      consistency: 0,
      confidence: 0,
      flags: [...flags, 'no_evidence'],
      notes: ['No evidence collected for this skill.'],
    };
  }

  // ── Step 1: Map score to candidate CEFR ─────────────────────────────
  let candidateLevel = scoreToCefrLevel(agg.score, config);
  let status: DecisionStatus = 'stable';

  // ── Step 2: Minimum direct evidence check ───────────────────────────
  const minRequired = config.minDirectEvidence[skill];
  if (agg.directEvidenceCount < minRequired) {
    if (agg.directEvidenceCount === 0) {
      status = 'insufficient_data';
      notes.push(`No direct evidence for ${skill}. Need at least ${minRequired} direct items.`);
    } else {
      status = 'provisional';
      notes.push(`Only ${agg.directEvidenceCount}/${minRequired} direct evidence items for ${skill}.`);
    }
  }

  // ── Step 3: Consistency check ───────────────────────────────────────
  if (agg.consistency < config.consistencyThreshold) {
    if (status === 'stable') {
      // Downgrade one band
      const currentIndex = cefrToIndex(candidateLevel);
      if (currentIndex > 0) {
        const downgraded = indexToCefr(currentIndex - 1);
        notes.push(
          `Consistency (${(agg.consistency * 100).toFixed(0)}%) below threshold ` +
          `(${(config.consistencyThreshold * 100).toFixed(0)}%). ` +
          `Downgraded from ${candidateLevel} to ${downgraded}.`
        );
        candidateLevel = downgraded;
      }
      status = 'unstable';
    } else {
      flags.push('low_consistency');
      notes.push(`Consistency (${(agg.consistency * 100).toFixed(0)}%) is low.`);
    }
  }

  // ── Step 4: Direct ratio check ──────────────────────────────────────
  if (agg.directRatio < config.directRatioThreshold && status === 'stable') {
    status = 'provisional';
    notes.push(
      `Direct ratio (${(agg.directRatio * 100).toFixed(0)}%) below threshold ` +
      `(${(config.directRatioThreshold * 100).toFixed(0)}%). Cannot certify as stable.`
    );
  }

  // ── Build level range ───────────────────────────────────────────────
  const levelRange = agg.levelRange;

  return {
    skill,
    level: candidateLevel,
    levelRange,
    status,
    score: agg.score,
    score100: agg.score100,
    directEvidenceCount: agg.directEvidenceCount,
    indirectEvidenceCount: agg.indirectEvidenceCount,
    directRatio: agg.directRatio,
    consistency: agg.consistency,
    confidence: 0, // Will be filled by Layer 7
    flags,
    notes,
  };
}
