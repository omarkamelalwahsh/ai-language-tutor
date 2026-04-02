// ============================================================================
// Layer 7: Confidence Engine
// ============================================================================
// Deterministic confidence computation, completely separate from raw score.
//
// Formula:
//   confidence = 0.4 × evidenceFactor + 0.3 × consistency + 0.3 × directRatio
//
// Where evidenceFactor = min(1, directEvidence / expectedEvidence)
//
// Rule: Low confidence (< minStableConfidence) → status is NEVER 'stable'.
// ============================================================================

import {
  CEFRDecision,
  SkillName,
  DecisionStatus,
  PipelineConfig,
  DEFAULT_PIPELINE_CONFIG,
} from './types';

/**
 * Apply confidence computation to all skill decisions.
 * Mutates status if confidence is too low for 'stable'.
 *
 * @param decisions - Mutable decisions map from Layer 6
 * @param config - Pipeline configuration
 * @returns Updated decisions with confidence values filled in
 */
export function applyConfidence(
  decisions: Record<SkillName, CEFRDecision>,
  config: PipelineConfig = DEFAULT_PIPELINE_CONFIG,
): Record<SkillName, CEFRDecision> {
  const result = {} as Record<SkillName, CEFRDecision>;

  for (const [skillStr, decision] of Object.entries(decisions)) {
    const skill = skillStr as SkillName;
    result[skill] = computeSkillConfidence(decision, config);
  }

  return result;
}

/**
 * Compute confidence for a single skill decision.
 */
function computeSkillConfidence(
  decision: CEFRDecision,
  config: PipelineConfig,
): CEFRDecision {
  // If already insufficient_data, confidence stays 0
  if (decision.status === 'insufficient_data') {
    return { ...decision, confidence: 0 };
  }

  // ── Evidence factor ─────────────────────────────────────────────────
  const expectedEvidence = config.minDirectEvidence[decision.skill];
  const evidenceFactor = Math.min(1, decision.directEvidenceCount / Math.max(1, expectedEvidence));

  // ── Confidence formula ──────────────────────────────────────────────
  const rawConfidence =
    0.4 * evidenceFactor +
    0.3 * decision.consistency +
    0.3 * decision.directRatio;

  const confidence = clamp01(rawConfidence);

  // ── Stability gating ────────────────────────────────────────────────
  // Low confidence must NEVER appear as a stable result
  let status: DecisionStatus = decision.status;
  if (confidence < config.minStableConfidence && status === 'stable') {
    status = 'provisional';
  }

  const notes = [...decision.notes];
  if (status !== decision.status) {
    notes.push(
      `Confidence (${(confidence * 100).toFixed(0)}%) below stability threshold ` +
      `(${(config.minStableConfidence * 100).toFixed(0)}%). Downgraded to provisional.`
    );
  }

  return {
    ...decision,
    confidence: round4(confidence),
    status,
    notes,
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}
