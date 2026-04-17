// ============================================================================
// Update Pipeline Orchestrator
// ============================================================================
// The single entry point for processing a challenge result.
// Chains all 8 pipeline steps in deterministic order.
// ============================================================================

import {
  ChallengeResult, LearnerModel, PipelineResult,
  PedagogicalDecision, SubskillId,
} from '../domain/types';
import { ErrorCode } from '../domain/errors';
import { scoreChallengeResult } from '../rules/scoring';
import { extractObservations } from '../rules/observation-extractor';
import { attributeErrors, AttributionContext } from '../rules/error-attribution';
import { buildEvidenceUnits } from '../rules/evidence-builder';
import { updateSubskills } from '../rules/subskill-updater';
import { propagateSkillUpdates } from '../rules/skill-propagator';
import { recomputeOverallLevel } from '../rules/level-recomputer';
import { updateConfidenceProfile } from '../rules/confidence';
import { generateNextDecision } from '../planners/journey-planner';

/**
 * Run the full deterministic update pipeline on a challenge result.
 *
 * Pipeline steps:
 * 1. scoreChallengeResult    — raw scoring
 * 2. extractObservations     — observations from scores/errors
 * 3. attributeErrors         — root cause disambiguation
 * 4. buildEvidenceUnits      — concrete deltas per subskill
 * 5. updateSubskills         — apply deltas
 * 6. propagateSkillUpdates   — aggregate to skills
 * 7. recomputeOverallLevel   — aggregate to overall
 * 8. generateNextDecision    — pedagogical planning
 *
 * Returns a full PipelineResult with audit trail.
 */
export function runUpdatePipeline(
  challengeResult: ChallengeResult,
  currentModel: LearnerModel,
): PipelineResult {

  // ── Step 1: Score the challenge result ──
  const scoredResult = scoreChallengeResult(challengeResult);

  // ── Step 2: Extract observations ──
  const rawObservations = extractObservations(scoredResult);

  // ── Step 3: Attribute errors (disambiguate integrated tasks) ──
  const attributionContext: AttributionContext = {
    scoredResult,
    currentLevel: currentModel.overallBand.primary,
    existingErrorCodes: currentModel.errorProfiles.map(
      ep => ep.errorCode
    ),
  };
  const attributedObs = attributeErrors(rawObservations, attributionContext);

  // ── Step 4: Build evidence units ──
  const evidenceUnits = buildEvidenceUnits(attributedObs, currentModel.subskills);

  // ── Step 5: Update subskills ──
  const { updatedSubskills, changes: subskillChanges } = updateSubskills(
    currentModel.subskills,
    evidenceUnits,
  );

  // ── Step 6: Propagate to skills ──
  const { skills: updatedSkills, updates: skillUpdates } = propagateSkillUpdates(
    currentModel.skills,
    updatedSubskills,
  );

  // ── Step 7: Recompute overall level ──
  const previousOverall = {
    score: currentModel.overallScore,
    band: currentModel.overallBand,
  };
  const newOverall = recomputeOverallLevel(updatedSkills);

  // ── Update error profiles ──
  const updatedErrors = updateErrorProfiles(
    currentModel.errorProfiles,
    scoredResult.detectedErrors.map(e => e.errorCode),
    currentModel.overallBand.primary,
    attributedObs,
  );

  // ── Update confidence profile ──
  const updatedConfidence = updateConfidenceProfile(
    currentModel.confidence,
    {
      usedHints: challengeResult.hintsUsed > 0,
      succeeded: scoredResult.overallScore >= 50,
      responseTimeMs: challengeResult.responseTimeMs,
      selfCorrected: challengeResult.retryCount > 0 && scoredResult.overallScore >= 50,
    },
  );

  // ── Build updated model ──
  const updatedModel: LearnerModel = {
    ...currentModel,
    lastUpdated: new Date().toISOString(),
    overallBand: newOverall.band,
    overallScore: newOverall.score,
    skills: updatedSkills,
    subskills: updatedSubskills,
    errorProfiles: updatedErrors,
    confidence: updatedConfidence,
    totalTasksCompleted: currentModel.totalTasksCompleted + 1,
    totalEvidenceAbsorbed: currentModel.totalEvidenceAbsorbed + evidenceUnits.length,
  };

  // ── Step 8: Generate next decision ──
  const nextPlan = generateNextDecision(updatedModel, scoredResult, skillUpdates);

  return {
    scoredResult,
    observations: attributedObs,
    evidenceUnits,
    subskillUpdates: subskillChanges,
    skillUpdates,
    overallUpdate: {
      previousScore: previousOverall.score,
      newScore: newOverall.score,
      previousBand: previousOverall.band,
      newBand: newOverall.band,
    },
    updatedModel,
    nextPlan,
  };
}

// ─── Error Profile Management ───────────────────────────────────────────────

import { ErrorProfile } from '../domain/types';
import { CEFRLevel } from '../domain/cefr';
import { getEffectiveSeverity } from '../domain/errors';
import { AttributedObservation } from '../rules/error-attribution';

function updateErrorProfiles(
  existing: ErrorProfile[],
  newErrorCodes: ErrorCode[],
  currentLevel: CEFRLevel,
  attributed: AttributedObservation[],
): ErrorProfile[] {
  const profiles = [...existing];
  const now = new Date().toISOString();

  for (const code of newErrorCodes) {
    const existingIdx = profiles.findIndex(p => p.errorCode === code);
    const severity = getEffectiveSeverity(code, currentLevel);
    const sevLabel: 'low' | 'medium' | 'high' =
      severity < 0.3 ? 'low' : severity < 0.7 ? 'medium' : 'high';

    const affectedSubskills = attributed
      .filter(a => a.source.reference === code)
      .map(a => a.targetSubskillId);
    const uniqueSubskills = [...new Set(affectedSubskills)];

    if (existingIdx >= 0) {
      const prev = profiles[existingIdx];
      profiles[existingIdx] = {
        ...prev,
        occurrenceCount: prev.occurrenceCount + 1,
        trend: prev.occurrenceCount >= 3 ? 'increasing' : 'stable',
        severityAtCurrentLevel: sevLabel,
        lastSeen: now,
      };
    } else {
      profiles.push({
        errorCode: code,
        occurrenceCount: 1,
        trend: 'stable',
        severityAtCurrentLevel: sevLabel,
        firstSeen: now,
        lastSeen: now,
        affectedSubskills: uniqueSubskills,
      });
    }
  }

  return profiles;
}
