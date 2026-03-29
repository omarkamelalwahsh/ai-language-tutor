// ============================================================================
// Confidence Logic
// ============================================================================
// Confidence modulates how strongly new evidence changes subskill scores.
// Low confidence = larger updates (we're still learning about the learner).
// High confidence = smaller updates (score is well-established).
//
// This is NOT "learner self-confidence". It's the system's confidence
// in its own estimate of the learner's ability.
// ============================================================================

import { SubskillState, ConfidenceProfile } from '../domain/types';

/**
 * Compute a confidence multiplier that modulates evidence deltas.
 *
 * The idea: when we have little evidence, we should update aggressively
 * (each new data point is very informative). As evidence accumulates,
 * updates should shrink (the estimate stabilizes).
 *
 * Formula: multiplier = BASE + DECAY / (1 + evidenceCount * RATE)
 *
 * At 0 evidence: multiplier ≈ 1.4 (very responsive)
 * At 5 evidence: multiplier ≈ 1.05
 * At 20 evidence: multiplier ≈ 0.85
 * At 50+ evidence: multiplier ≈ 0.7 (stable, hard to move)
 *
 * ASSUMPTION: These constants are tuned for feel. They should be
 * validated against learner data and adjusted.
 */
export function computeConfidenceMultiplier(subskill: SubskillState): number {
  const BASE = 0.6;
  const DECAY_RANGE = 0.8;
  const RATE = 0.08;

  const multiplier = BASE + DECAY_RANGE / (1 + subskill.evidenceCount * RATE);
  return Math.max(0.5, Math.min(1.5, multiplier));
}

/**
 * Compute the new confidence value for a subskill after new evidence.
 *
 * Confidence increases with each evidence unit but with diminishing returns.
 * Formula: newConfidence = 1 - 1 / (1 + totalEvidence * GROWTH_RATE)
 *
 * At 0 evidence: confidence = 0.0
 * At 1 evidence: confidence ≈ 0.13
 * At 5 evidence: confidence ≈ 0.45
 * At 10 evidence: confidence ≈ 0.625
 * At 20 evidence: confidence ≈ 0.77
 * At 50 evidence: confidence ≈ 0.88
 */
export function computeNewConfidence(currentEvidenceCount: number, newEvidenceUnits: number): number {
  const GROWTH_RATE = 0.15;
  const totalEvidence = currentEvidenceCount + newEvidenceUnits;
  const confidence = 1 - 1 / (1 + totalEvidence * GROWTH_RATE);
  return Math.max(0, Math.min(1, Number(confidence.toFixed(4))));
}

/**
 * Compute the confidence delta (how much confidence changes).
 */
export function computeConfidenceDelta(
  currentConfidence: number,
  currentEvidenceCount: number,
  newEvidenceUnits: number,
): number {
  const newConfidence = computeNewConfidence(currentEvidenceCount, newEvidenceUnits);
  return Number((newConfidence - currentConfidence).toFixed(4));
}

/**
 * Update the behavioral confidence profile based on task behavior signals.
 *
 * DETERMINISTIC RULES:
 * - If unassisted success streak > 5 and support dependence < 0.3 → resilient
 * - If unassisted success streak > 2 and support dependence < 0.5 → steady
 * - If support dependence > 0.7 or self-correction < 0.1 → fragile
 * - Otherwise → cautious
 */
export function updateConfidenceProfile(
  current: ConfidenceProfile,
  taskSignals: {
    usedHints: boolean;
    succeeded: boolean;
    responseTimeMs: number;
    selfCorrected: boolean;
  },
): ConfidenceProfile {
  // Update running averages
  const newLatency = current.avgResponseLatencyMs === 0
    ? taskSignals.responseTimeMs
    : current.avgResponseLatencyMs * 0.8 + taskSignals.responseTimeMs * 0.2; // EMA

  const newSelfCorrectionRate = taskSignals.selfCorrected
    ? Math.min(1, current.selfCorrectionRate + 0.05)
    : Math.max(0, current.selfCorrectionRate - 0.02);

  const newSupportDependence = taskSignals.usedHints
    ? Math.min(1, current.supportDependence + 0.05)
    : Math.max(0, current.supportDependence - 0.03);

  const newStreak = taskSignals.succeeded && !taskSignals.usedHints
    ? current.unassistedSuccessStreak + 1
    : 0; // Reset on failure or hint usage

  // Determine state
  let state: ConfidenceProfile['state'];
  if (newStreak >= 5 && newSupportDependence < 0.3) {
    state = 'resilient';
  } else if (newStreak >= 2 && newSupportDependence < 0.5) {
    state = 'steady';
  } else if (newSupportDependence > 0.7 || newSelfCorrectionRate < 0.1) {
    state = 'fragile';
  } else {
    state = 'cautious';
  }

  return {
    state,
    selfCorrectionRate: Number(newSelfCorrectionRate.toFixed(4)),
    avgResponseLatencyMs: Math.round(newLatency),
    supportDependence: Number(newSupportDependence.toFixed(4)),
    unassistedSuccessStreak: newStreak,
  };
}
