// ============================================================================
// Journey Planner
// ============================================================================
// Step 8 of the pipeline: generateNextDecision
//
// Examines the updated LearnerModel and the latest challenge result
// to decide what the learner should do next.
// ============================================================================

import {
  LearnerModel, ScoredResult, SkillUpdate,
  PedagogicalDecision, SubskillId,
} from '../domain/types';

/**
 * Generate a pedagogical decision based on the latest update.
 *
 * Deterministic rules:
 * 1. If confidence is fragile OR recent score was very low (<30) → remediate/rest
 * 2. If recent score was perfect (>90) AND confidence is resilient → challenge
 * 3. If there are recurring high-severity errors → remediate focus area
 * 4. Otherwise → continue sequence or reinforce weakest subskill
 */
export function generateNextDecision(
  model: LearnerModel,
  lastResult: ScoredResult,
  skillUpdates: SkillUpdate[],
): PedagogicalDecision {
  const score = lastResult.overallScore;
  const confState = model.confidence.state;

  // Rule 1: Struggle / Fragility
  if (score < 30 || confState === 'fragile') {
    return {
      action: score < 20 ? 'rest' : 'remediate',
      reasoning: score < 30
        ? 'Learner struggled significantly with the last task.'
        : 'Learner confidence is fragile; needs structured scaffolding.',
      suggestedBlueprintIds: ['guided_writing_scaffold', 'vocab_matching'],
      focusAreas: getWeakestSubskills(model, 2),
      urgency: 'high',
      supportingData: { lastScore: score, confidenceState: confState },
    };
  }

  // Rule 2: Mastery / Challenge readiness
  if (score >= 90 && (confState === 'resilient' || confState === 'steady')) {
    return {
      action: 'challenge',
      reasoning: 'Learner performed exceptionally well and has stable confidence. Ready for stretch material.',
      suggestedBlueprintIds: ['open_speaking_prompt', 'complex_inferential_reading'],
      focusAreas: getWeakestSubskills(model, 1),
      urgency: 'low',
      supportingData: { lastScore: score, streak: model.confidence.unassistedSuccessStreak },
    };
  }

  // Rule 3: Recurring severe errors
  const severeErrors = model.errorProfiles.filter(
    e => e.trend === 'increasing' && e.severityAtCurrentLevel === 'high'
  );
  if (severeErrors.length > 0) {
    const focusE = severeErrors[0];
    return {
      action: 'remediate',
      reasoning: `Recurring high-severity error detected: ${focusE.errorCode}. Immediate targeted practice needed.`,
      suggestedBlueprintIds: ['grammar_drill', 'targeted_dictation'],
      focusAreas: focusE.affectedSubskills,
      urgency: 'high',
      supportingData: { recurringError: focusE.errorCode, occurrences: focusE.occurrenceCount },
    };
  }

  // Rule 4: Normal progression
  // Check if we just leveled up a skill
  const leveledUpSkill = skillUpdates.find(u => u.previousBand.primary !== u.newBand.primary && u.delta > 0);
  if (leveledUpSkill) {
    return {
      action: 'transfer',
      reasoning: `Learner just leveled up in ${leveledUpSkill.skillId}. Apply new competence in a cross-skill task.`,
      suggestedBlueprintIds: ['integrated_read_write'],
      focusAreas: [],
      urgency: 'medium',
      supportingData: { leveledUpSkill: leveledUpSkill.skillId },
    };
  }

  // Default: Continue or reinforce
  const weakest = getWeakestSubskills(model, 1)[0] || 'shared.vocabulary_range';

  return {
    action: score < 60 ? 'reinforce' : 'continue_sequence',
    reasoning: score < 60
      ? 'Moderate performance. Reinforce weakest subskill before advancing.'
      : 'Good performance. Continue with planned curriculum sequence.',
    suggestedBlueprintIds: ['standard_lesson_next'],
    focusAreas: [weakest],
    urgency: 'low',
    supportingData: { lastScore: score, weakestSubskill: weakest },
  };
}

/**
 * Helper: find the N weakest subskills by current score.
 */
function getWeakestSubskills(model: LearnerModel, count: number): SubskillId[] {
  const entries = Object.entries(model.subskills);
  // Sort by score ascending
  entries.sort((a, b) => a[1].score - b[1].score);
  return entries.slice(0, count).map(e => e[0] as SubskillId);
}
