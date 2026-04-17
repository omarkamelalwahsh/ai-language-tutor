// ============================================================================
// Evidence Builder
// ============================================================================
// Step 4 of the pipeline: buildEvidenceUnits
//
// Converts attributed observations into concrete EvidenceUnits.
// Each EvidenceUnit specifies a rawDelta, a modulatedDelta (after
// confidence modulation), and a confidenceDelta for a specific subskill.
//
// This is where the system decides "how much should this subskill score change?"
// ============================================================================

import {
  EvidenceUnit, SubskillState, SubskillId,
} from '../domain/types';
import { AttributedObservation } from './error-attribution';
import { computeConfidenceMultiplier, computeConfidenceDelta } from './confidence';

/**
 * Configuration for evidence building.
 */
export interface EvidenceBuildConfig {
  /**
   * Maximum absolute delta per evidence unit.
   * Prevents any single observation from causing extreme score changes.
   * ASSUMPTION: 8 points is a reasonable max swing per observation.
   */
  readonly maxDeltaPerUnit: number;

  /**
   * Minimum absolute delta. Below this, the evidence is noise and ignored.
   */
  readonly minDeltaThreshold: number;

  /**
   * Base positive delta for fully-strong positive evidence.
   */
  readonly basePositiveDelta: number;

  /**
   * Base negative delta for fully-strong negative evidence.
   */
  readonly baseNegativeDelta: number;
}

export const DEFAULT_EVIDENCE_CONFIG: EvidenceBuildConfig = {
  maxDeltaPerUnit: 8,
  minDeltaThreshold: 0.3,
  basePositiveDelta: 5,
  baseNegativeDelta: -6, // Negative evidence has slightly more impact (learning from errors)
};

/**
 * Build evidence units from attributed observations.
 *
 * Logic:
 * 1. Group observations by target subskill
 * 2. For each group, aggregate evidence:
 *    - Sum positive observations (capped)
 *    - Sum negative observations (capped)
 *    - Net delta = positive + negative
 * 3. Apply confidence modulation to get modulatedDelta
 * 4. Compute confidence delta
 *
 * Single observations can also generate units — grouping is for
 * when multiple observations target the same subskill.
 */
export function buildEvidenceUnits(
  observations: readonly AttributedObservation[],
  subskillStates: Record<SubskillId, SubskillState>,
  config: EvidenceBuildConfig = DEFAULT_EVIDENCE_CONFIG,
): EvidenceUnit[] {
  // Group observations by target subskill
  const groups = new Map<SubskillId, AttributedObservation[]>();
  for (const obs of observations) {
    const existing = groups.get(obs.targetSubskillId) || [];
    existing.push(obs);
    groups.set(obs.targetSubskillId, existing);
  }

  const units: EvidenceUnit[] = [];

  for (const [subskillId, obsGroup] of groups) {
    const subskill = subskillStates[subskillId];
    if (!subskill) {
      // Subskill not tracked — skip (could be a framework extension point)
      continue;
    }

    // Separate positive and negative observations
    const positives = obsGroup.filter(o => o.polarity === 'positive');
    const negatives = obsGroup.filter(o => o.polarity === 'negative');

    // Compute raw deltas
    let positiveDelta = 0;
    for (const pos of positives) {
      positiveDelta += config.basePositiveDelta * pos.strength;
    }

    let negativeDelta = 0;
    for (const neg of negatives) {
      // Use effectiveSeverity if available, otherwise use strength
      const impactWeight = neg.effectiveSeverity > 0 ? neg.effectiveSeverity : neg.strength;
      negativeDelta += config.baseNegativeDelta * impactWeight;
    }

    // Cap individual contributions
    positiveDelta = Math.min(positiveDelta, config.maxDeltaPerUnit);
    negativeDelta = Math.max(negativeDelta, -config.maxDeltaPerUnit);

    // Net raw delta
    const rawDelta = positiveDelta + negativeDelta;

    // Skip if below minimum threshold
    if (Math.abs(rawDelta) < config.minDeltaThreshold) {
      continue;
    }

    // Apply confidence modulation
    const confidenceMultiplier = computeConfidenceMultiplier(subskill);
    const modulatedDelta = rawDelta * confidenceMultiplier;

    // Clamp modulated delta
    const clampedDelta = Math.max(-config.maxDeltaPerUnit, Math.min(config.maxDeltaPerUnit, modulatedDelta));

    // Compute confidence delta (new evidence always increases confidence)
    const confDelta = computeConfidenceDelta(
      subskill.confidence,
      subskill.evidenceCount,
      obsGroup.length,
    );

    // Build reasoning
    const reasoning = buildReasoning(subskillId, positives, negatives, rawDelta, clampedDelta, confidenceMultiplier);

    units.push({
      targetSubskillId: subskillId,
      rawDelta: Number(rawDelta.toFixed(4)),
      modulatedDelta: Number(clampedDelta.toFixed(4)),
      confidenceDelta: confDelta,
      sourceObservationIds: obsGroup.map(o => o.observationId),
      reasoning,
    });
  }

  return units;
}

/**
 * Build a human-readable reasoning string for the evidence unit.
 */
function buildReasoning(
  subskillId: SubskillId,
  positives: AttributedObservation[],
  negatives: AttributedObservation[],
  rawDelta: number,
  modulatedDelta: number,
  confidenceMultiplier: number,
): string {
  const parts: string[] = [];

  if (positives.length > 0) {
    parts.push(`${positives.length} positive signal(s)`);
  }
  if (negatives.length > 0) {
    parts.push(`${negatives.length} negative signal(s)`);
  }

  const direction = modulatedDelta > 0 ? 'increase' : modulatedDelta < 0 ? 'decrease' : 'no change';

  parts.push(`Raw Δ=${rawDelta.toFixed(2)}, confidence multiplier=${confidenceMultiplier.toFixed(2)}, modulated Δ=${modulatedDelta.toFixed(2)}`);
  parts.push(`Net effect: ${direction} for ${subskillId}`);

  if (negatives.some(n => n.isRecurring)) {
    parts.push('(includes recurring error — higher impact)');
  }

  return parts.join('. ') + '.';
}
