// ============================================================================
// Subskill Updater
// ============================================================================
// Step 5: updateSubskills — applies evidence to subskill scores.
// Returns new immutable state. This is the ONLY place scores change.
// ============================================================================

import { EvidenceUnit, SubskillState, SubskillId } from '../domain/types';
import { scoreToCEFRBand } from '../domain/cefr';
import { computeNewConfidence } from './confidence';

export interface SubskillUpdateResult {
  readonly updatedSubskills: Record<SubskillId, SubskillState>;
  readonly changes: Record<SubskillId, SubskillChange>;
}

export interface SubskillChange {
  readonly previousScore: number;
  readonly newScore: number;
  readonly delta: number;
  readonly previousConfidence: number;
  readonly newConfidence: number;
}

/**
 * Apply evidence units to subskill states.
 * For each unit: apply modulatedDelta, clamp, update confidence, recompute band.
 * Returns a NEW state map (immutable).
 */
export function updateSubskills(
  currentStates: Record<SubskillId, SubskillState>,
  evidenceUnits: readonly EvidenceUnit[],
): SubskillUpdateResult {
  const updated: Record<SubskillId, SubskillState> = {};
  for (const [id, state] of Object.entries(currentStates)) {
    updated[id] = { ...state };
  }

  const changes: Record<SubskillId, SubskillChange> = {};
  const now = new Date().toISOString();

  for (const unit of evidenceUnits) {
    const state = updated[unit.targetSubskillId];
    if (!state) continue;

    const previousScore = state.score;
    const previousConfidence = state.confidence;
    const newScore = Math.max(0, Math.min(100, state.score + unit.modulatedDelta));
    const sourceCount = unit.sourceObservationIds.length;
    const newConfidence = computeNewConfidence(state.evidenceCount, sourceCount);
    const newEvidenceCount = state.evidenceCount + sourceCount;
    const newBand = scoreToCEFRBand(newScore, newConfidence);

    updated[unit.targetSubskillId] = {
      ...state,
      score: Number(newScore.toFixed(2)),
      band: newBand,
      confidence: newConfidence,
      evidenceCount: newEvidenceCount,
      lastUpdated: now,
    };

    changes[unit.targetSubskillId] = {
      previousScore,
      newScore: Number(newScore.toFixed(2)),
      delta: Number((newScore - previousScore).toFixed(2)),
      previousConfidence,
      newConfidence,
    };
  }

  return { updatedSubskills: updated, changes };
}
