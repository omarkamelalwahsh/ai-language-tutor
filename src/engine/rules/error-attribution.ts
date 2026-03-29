// ============================================================================
// Error Attribution
// ============================================================================
// Step 3 of the pipeline: attributeErrors
//
// Takes observations (especially negative ones) and determines
// the ROOT CAUSE of each error. In integrated tasks, one symptom
// may have multiple candidate causes.
//
// Example: In a listen-and-write task, "scool" could be:
//   - A spelling error (writing.spelling) — most likely
//   - A listening error (listening.phonemic_discrimination) — less likely
//   - A vocabulary gap (shared.vocabulary_range) — unlikely for "school"
//
// This module applies deterministic disambiguation rules.
// ============================================================================

import { Observation, ScoredResult, ChallengeBlueprint, SubskillId } from '../domain/types';
import { ErrorCode, ERROR_ATTRIBUTION_REGISTRY } from '../domain/errors';
import { CEFRLevel } from '../domain/cefr';

/**
 * Attribution context: additional data needed for disambiguation.
 */
export interface AttributionContext {
  /** The scored result that generated these observations. */
  readonly scoredResult: ScoredResult;

  /** The learner's current CEFR level (for severity modulation). */
  readonly currentLevel: CEFRLevel;

  /** Existing error profiles to detect recurring patterns. */
  readonly existingErrorCodes: readonly ErrorCode[];
}

/**
 * An attributed observation has adjusted strength based on root-cause analysis.
 */
export interface AttributedObservation extends Observation {
  /** The original strength before attribution adjustments. */
  readonly originalStrength: number;

  /** Explanation of attribution reasoning. */
  readonly attributionReasoning: string;

  /** Whether this is a recurring error. */
  readonly isRecurring: boolean;

  /** Effective severity at learner's current level. */
  readonly effectiveSeverity: number;
}

/**
 * Attribute errors in observations using deterministic disambiguation rules.
 *
 * For each negative observation:
 * 1. Check if the error source is from an integrated task
 * 2. Apply disambiguation rules to adjust strength
 * 3. Check for recurrence (boosts severity)
 * 4. Apply level-dependent severity
 *
 * For positive observations:
 * - Pass through with minor adjustments
 */
export function attributeErrors(
  observations: Observation[],
  context: AttributionContext,
): AttributedObservation[] {
  const blueprint = context.scoredResult.challengeResult.blueprint;
  const isIntegratedTask = blueprint.secondarySkills.length > 0;

  return observations.map(obs => {
    if (obs.polarity === 'positive' || obs.polarity === 'neutral') {
      return attributePositiveObservation(obs, context);
    }
    return attributeNegativeObservation(obs, context, isIntegratedTask, blueprint);
  });
}

/**
 * Attribute a negative observation (error).
 */
function attributeNegativeObservation(
  obs: Observation,
  context: AttributionContext,
  isIntegratedTask: boolean,
  blueprint: ChallengeBlueprint,
): AttributedObservation {
  let adjustedStrength = obs.strength;
  let reasoning = '';

  const errorCode = obs.source.type === 'error' ? obs.source.reference as ErrorCode : null;

  // 1. Integrated task disambiguation
  if (isIntegratedTask && errorCode) {
    const adjustments = disambiguateIntegratedError(obs, blueprint, context);
    adjustedStrength *= adjustments.multiplier;
    reasoning += adjustments.reasoning + ' ';
  }

  // 2. Recurrence check
  const isRecurring = errorCode
    ? context.existingErrorCodes.includes(errorCode)
    : false;

  if (isRecurring) {
    // Recurring errors are MORE impactful — they indicate a persistent gap
    adjustedStrength = Math.min(1.0, adjustedStrength * 1.2);
    reasoning += `Recurring error (seen before) — severity boosted. `;
  }

  // 3. Level-dependent severity
  let effectiveSeverity = obs.strength;
  if (errorCode) {
    const rule = ERROR_ATTRIBUTION_REGISTRY[errorCode];
    if (rule) {
      const levelMultiplier = rule.severityByLevel[context.currentLevel] ?? 1.0;
      effectiveSeverity = rule.baseSeverity * levelMultiplier;
      reasoning += `Severity at ${context.currentLevel}: ${effectiveSeverity.toFixed(2)}. `;
    }
  }

  // 4. Clamp
  adjustedStrength = Math.max(0.05, Math.min(1.0, adjustedStrength));

  return {
    ...obs,
    strength: Number(adjustedStrength.toFixed(4)),
    originalStrength: obs.strength,
    attributionReasoning: reasoning.trim() || 'Direct attribution from error detection.',
    isRecurring,
    effectiveSeverity: Number(effectiveSeverity.toFixed(4)),
  };
}

/**
 * Attribute a positive observation.
 */
function attributePositiveObservation(
  obs: Observation,
  context: AttributionContext,
): AttributedObservation {
  return {
    ...obs,
    originalStrength: obs.strength,
    attributionReasoning: 'Positive evidence — direct attribution.',
    isRecurring: false,
    effectiveSeverity: 0,
  };
}

// ─── Integrated Task Disambiguation ─────────────────────────────────────────

/**
 * Deterministic rules for disambiguating errors in integrated tasks.
 *
 * The core question: when a listen-and-write task shows "scool" instead of
 * "school", was it a listening error or a spelling error?
 *
 * DISAMBIGUATION RULES:
 *
 * 1. SPELLING_LIKELY: If the word is phonetically close to the target
 *    (sounds similar, edit distance ≤ 2), blame spelling, not listening.
 *    → Reduce listening impact, boost writing/spelling impact.
 *
 * 2. LISTENING_LIKELY: If the word is semantically different from the target
 *    (different meaning, not phonetically close), blame listening.
 *    → Reduce writing impact, boost listening impact.
 *
 * 3. GRAMMAR_RECONSTRUCTION: If the error is grammatical but the content
 *    words are correct, blame grammar, not listening.
 *    → Attribute to shared.grammar_control.
 *
 * 4. SHARED_BLAME: If the error could reasonably come from multiple sources,
 *    distribute blame proportionally based on the task's skill weights.
 */
function disambiguateIntegratedError(
  obs: Observation,
  blueprint: ChallengeBlueprint,
  context: AttributionContext,
): { multiplier: number; reasoning: string } {
  const subskillId = obs.targetSubskillId;
  const errorRef = obs.source.reference;

  // Rule 1: Spelling errors in listening tasks → blame writing, not listening
  if (errorRef === 'spelling_error') {
    if (subskillId.startsWith('listening.')) {
      return {
        multiplier: 0.2, // Heavily reduce listening impact — this is a writing issue
        reasoning: 'Spelling error in listen-and-write: word heard correctly, spelling is the issue.',
      };
    }
    if (subskillId === 'writing.spelling') {
      return {
        multiplier: 1.0, // Full impact on spelling
        reasoning: 'Spelling error attributed to writing.spelling at full weight.',
      };
    }
  }

  // Rule 2: Phoneme confusion → blame listening, reduce writing impact
  if (errorRef === 'listening_phoneme_confusion') {
    if (subskillId.startsWith('writing.')) {
      return {
        multiplier: 0.15, // Writing mechanics were fine, listening was the problem
        reasoning: 'Phoneme confusion in integrated task: listening failure, not writing.',
      };
    }
    if (subskillId.startsWith('listening.')) {
      return {
        multiplier: 1.0,
        reasoning: 'Phoneme confusion attributed to listening at full weight.',
      };
    }
  }

  // Rule 3: SV agreement in listen-and-write → grammar issue, not listening
  if (errorRef === 'grammar_sv_agreement' || errorRef === 'grammar_tense_error') {
    if (subskillId.startsWith('listening.')) {
      return {
        multiplier: 0.1,
        reasoning: 'Grammar error in listen-and-write: content was heard, grammar reconstruction failed.',
      };
    }
    if (subskillId === 'shared.grammar_control' || subskillId === 'shared.verb_system') {
      return {
        multiplier: 1.0,
        reasoning: 'Grammar error attributed to grammar control at full weight.',
      };
    }
  }

  // Rule 4: Missed detail → primarily listening
  if (errorRef === 'listening_missed_detail') {
    if (subskillId.startsWith('listening.')) {
      return {
        multiplier: 1.0,
        reasoning: 'Missed detail is a listening comprehension issue.',
      };
    }
    if (subskillId.startsWith('writing.')) {
      return {
        multiplier: 0.1,
        reasoning: 'Missed detail is not a writing issue — reduce impact.',
      };
    }
  }

  // Rule 5: Wrong word that's not phonetically similar → vocabulary or listening
  if (errorRef === 'vocabulary_wrong_word') {
    // In a listening task, wrong word could be mishearing
    if (blueprint.challengeType === 'listen_and_write' || blueprint.challengeType === 'dictation') {
      if (subskillId.startsWith('listening.')) {
        return {
          multiplier: 0.6,
          reasoning: 'Wrong word in listen-and-write: possible mishearing.',
        };
      }
    }
  }

  // Default: no adjustment
  return { multiplier: 1.0, reasoning: 'Standard attribution — no disambiguation needed.' };
}

/**
 * Compute integrated task skill weights.
 * Given a blueprint, returns how much each skill should be weighted
 * when distributing ambiguous error impact.
 */
export function computeSkillWeights(
  blueprint: ChallengeBlueprint,
): Record<string, number> {
  const weights: Record<string, number> = {};

  // Primary skill gets the largest share
  weights[blueprint.primarySkill] = 0.5;

  // Secondary skills split the remainder
  const secondaryShare = 0.5 / Math.max(1, blueprint.secondarySkills.length);
  for (const skill of blueprint.secondarySkills) {
    weights[skill] = secondaryShare;
  }

  return weights;
}
