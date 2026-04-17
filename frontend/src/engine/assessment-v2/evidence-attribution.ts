// ============================================================================
// Layer 4: Evidence Attribution
// ============================================================================
// Maps a single response into evidence records for one or more skills.
// Uses the Item Policy Registry to determine which skills receive evidence,
// at what weight, and with what directness factor.
//
// NON-NEGOTIABLE RULES:
// - Direct evidence is ALWAYS stronger than indirect evidence.
// - Typed fallback NEVER provides speaking evidence (weight = 0).
// - MCQ tasks have reduced evidential power (via scoring policy multiplier).
// ============================================================================

import {
  EvidenceRecord,
  NormalizedSignals,
  TaskType,
  CEFRLevel,
  SkillName,
  ResponseMode,
  DIRECTNESS_FACTOR,
} from './types';
import { getEvidencePolicy, getScoringWeights } from './item-policy';
import { computeSkillSpecificScore } from './signal-normalizer';

/**
 * Input context for evidence attribution.
 */
export interface AttributionInput {
  /** Unique item identifier. */
  readonly itemId: string;
  /** Canonical task type (resolved from legacy type if needed). */
  readonly taskType: TaskType;
  /** The item's declared target CEFR level. */
  readonly targetCEFR: CEFRLevel;
  /** How the learner responded. */
  readonly responseMode: ResponseMode;
  /** Normalized signals from Layer 3. */
  readonly normalized: NormalizedSignals;
  /** Word count of the response. */
  readonly responseWordCount: number;
}

/**
 * Attribute evidence from a single response to one or more skills.
 *
 * For each skill in the item's evidence policy:
 * 1. Compute a skill-specific score from normalized signals
 * 2. Apply evidential power multiplier from scoring policy
 * 3. Look up directness factor from evidence policy
 * 4. Build the EvidenceRecord
 *
 * @param input - The attribution context
 * @returns Array of EvidenceRecords (one per affected skill)
 */
export function attributeEvidence(input: AttributionInput): EvidenceRecord[] {
  const { itemId, taskType, targetCEFR, responseMode, normalized } = input;
  const policy = getEvidencePolicy(taskType);
  const scoringWeights = getScoringWeights(taskType);
  const records: EvidenceRecord[] = [];

  for (const [skillStr, skillPolicy] of Object.entries(policy)) {
    const skill = skillStr as SkillName;

    // Skip skills with zero weight (e.g., speaking in typed_fallback)
    if (!skillPolicy || skillPolicy.weight <= 0 || skillPolicy.directness === 'none') {
      continue;
    }

    // Compute the skill-specific score (reflects learner performance, NOT task trust)
    const rawSkillScore = computeSkillSpecificScore(skill, normalized);

    // Resolve directness
    const directnessFactor = DIRECTNESS_FACTOR[skillPolicy.directness];
    const isDirect = skillPolicy.directness === 'direct';

    // Evidential power modulates WEIGHT, not score.
    // MCQ = 0.4 weight multiplier (low trust), open response = 1.0 (full trust).
    // The score itself stays unchanged — it reflects how well the learner performed.
    const adjustedWeight = skillPolicy.weight * scoringWeights.evidentialPower;

    // Collect flags
    const flags: string[] = [...normalized.raw.flags];
    if (responseMode === 'mcq') flags.push('mcq_response');
    if (!isDirect) flags.push(`indirect_${skillPolicy.directness}`);

    records.push({
      skill,
      itemScore: clamp01(rawSkillScore),
      evidenceWeight: adjustedWeight,
      directnessFactor,
      isDirect,
      itemConfidence: normalized.raw.confidence,
      sourceItemId: itemId,
      targetCEFR,
      taskType,
      responseMode,
      flags,
    });
  }

  return records;
}

/**
 * Clamp to [0, 1].
 */
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
}
