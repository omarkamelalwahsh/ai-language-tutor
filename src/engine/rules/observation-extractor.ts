// ============================================================================
// Observation Extractor
// ============================================================================
// Step 2 of the pipeline: extractObservations
//
// Takes a ScoredResult and converts it into Observations.
// Each observation says: "based on [this error/correct element],
// we have [positive/negative] evidence about [this subskill]."
//
// Observations are the semantic bridge between raw scoring and subskill updates.
// ============================================================================

import { ScoredResult, Observation, DetectedError, CorrectElement } from '../domain/types';
import { ErrorCode, ERROR_ATTRIBUTION_REGISTRY } from '../domain/errors';

let observationCounter = 0;

function nextObservationId(): string {
  return `obs_${Date.now()}_${++observationCounter}`;
}

/**
 * Extract observations from a scored result.
 *
 * For each detected error:
 *   - Look up its attribution rule
 *   - Generate one observation per directly-affected subskill
 *   - Set polarity to 'negative'
 *   - Strength = error's weight for that subskill
 *
 * For each correct element:
 *   - Map the dimension to relevant subskills
 *   - Generate one observation per subskill
 *   - Set polarity to 'positive'
 *   - Strength based on dimensional score
 *
 * Additionally:
 *   - Generate task-behavior observations (completion, timing)
 */
export function extractObservations(scored: ScoredResult): Observation[] {
  const observations: Observation[] = [];

  // 1. Error-based observations
  for (const error of scored.detectedErrors) {
    const rule = ERROR_ATTRIBUTION_REGISTRY[error.errorCode];
    if (!rule) continue;

    for (const impact of rule.directImpact) {
      observations.push({
        observationId: nextObservationId(),
        targetSubskillId: impact.subskillId,
        polarity: 'negative',
        strength: impact.weight,
        description: `Error detected: ${rule.label}. ${error.context || ''} (${error.fragment} → ${error.expected})`,
        source: {
          type: 'error',
          reference: error.errorCode,
        },
      });
    }
  }

  // 2. Correct-element-based observations
  for (const correct of scored.correctElements) {
    const subskillMappings = mapDimensionToSubskills(correct.dimensionId);
    for (const mapping of subskillMappings) {
      observations.push({
        observationId: nextObservationId(),
        targetSubskillId: mapping.subskillId,
        polarity: 'positive',
        strength: mapping.weight,
        description: `Correct: ${correct.description}`,
        source: {
          type: 'correct_element',
          reference: correct.dimensionId,
        },
      });
    }
  }

  // 3. Task-behavior observations
  const blueprint = scored.challengeResult.blueprint;
  const challengeType = blueprint.challengeType;

  // Task completion observation
  if (scored.overallScore >= 50) {
    observations.push({
      observationId: nextObservationId(),
      targetSubskillId: 'shared.task_completion',
      polarity: 'positive',
      strength: Math.min(1, scored.overallScore / 100),
      description: `Task completed with overall score ${scored.overallScore}/100.`,
      source: { type: 'task_behavior', reference: 'task_completion' },
    });
  } else if (scored.overallScore < 30) {
    observations.push({
      observationId: nextObservationId(),
      targetSubskillId: 'shared.task_completion',
      polarity: 'negative',
      strength: 0.5,
      description: `Low task score: ${scored.overallScore}/100.`,
      source: { type: 'task_behavior', reference: 'task_completion' },
    });
  }

  // Integrated task: generate cross-skill observations
  // For listen_and_write: if spelling was correct, positive for listening
  if (challengeType === 'listen_and_write' || challengeType === 'dictation') {
    const spellingDim = scored.dimensionScores['spelling'] ?? 100;
    const accuracyDim = scored.dimensionScores['accuracy'] ?? 0;

    // If accuracy is high but spelling is low → heard correctly, spelling issue
    if (accuracyDim >= 70 && spellingDim < 60) {
      observations.push({
        observationId: nextObservationId(),
        targetSubskillId: 'listening.detail_extraction',
        polarity: 'positive',
        strength: 0.6,
        description: 'Heard words correctly but misspelled them — listening is intact.',
        source: { type: 'task_behavior', reference: 'integrated_attribution' },
      });
    }

    // If completeness is high → full listening capture
    const completeness = scored.dimensionScores['completeness'] ?? 0;
    if (completeness >= 80) {
      observations.push({
        observationId: nextObservationId(),
        targetSubskillId: 'listening.gist_comprehension',
        polarity: 'positive',
        strength: 0.8,
        description: 'Captured all or nearly all words from audio — strong listening.',
        source: { type: 'task_behavior', reference: 'integrated_attribution' },
      });
    }
  }

  return observations;
}

// ─── Dimension → Subskill Mapping ───────────────────────────────────────────

/**
 * Maps a scoring dimension ID to the subskills it provides evidence for.
 * This is the "semantic link" between what was scored and what competency it reflects.
 */
function mapDimensionToSubskills(
  dimensionId: string,
): { subskillId: string; weight: number }[] {
  const MAPPING: Record<string, { subskillId: string; weight: number }[]> = {
    accuracy: [
      { subskillId: 'shared.grammar_control', weight: 0.5 },
      { subskillId: 'shared.vocabulary_precision', weight: 0.3 },
    ],
    listening_accuracy: [
      { subskillId: 'listening.detail_extraction', weight: 0.7 },
      { subskillId: 'listening.phonemic_discrimination', weight: 0.5 },
    ],
    spelling: [
      { subskillId: 'writing.spelling', weight: 0.9 },
    ],
    grammar: [
      { subskillId: 'shared.grammar_control', weight: 0.8 },
      { subskillId: 'shared.verb_system', weight: 0.5 },
    ],
    completeness: [
      { subskillId: 'shared.task_completion', weight: 0.6 },
      { subskillId: 'listening.detail_extraction', weight: 0.4 },
    ],
    comprehension: [
      { subskillId: 'listening.gist_comprehension', weight: 0.6 },
      { subskillId: 'listening.detail_extraction', weight: 0.5 },
      { subskillId: 'reading.detail_comprehension', weight: 0.4 },
    ],
    vocabulary: [
      { subskillId: 'shared.vocabulary_range', weight: 0.7 },
      { subskillId: 'shared.vocabulary_precision', weight: 0.8 },
    ],
    vocabulary_accuracy: [
      { subskillId: 'shared.vocabulary_precision', weight: 0.9 },
      { subskillId: 'shared.vocabulary_range', weight: 0.5 },
    ],
    coherence: [
      { subskillId: 'shared.discourse_coherence', weight: 0.8 },
    ],
    lexical_diversity: [
      { subskillId: 'shared.vocabulary_range', weight: 0.7 },
    ],
    length: [
      { subskillId: 'shared.task_completion', weight: 0.3 },
    ],
    complexity: [
      { subskillId: 'writing.sentence_construction', weight: 0.6 },
      { subskillId: 'shared.grammar_control', weight: 0.3 },
    ],
    keyword_coverage: [
      { subskillId: 'listening.detail_extraction', weight: 0.6 },
      { subskillId: 'reading.detail_comprehension', weight: 0.5 },
    ],
    response_length: [
      { subskillId: 'shared.task_completion', weight: 0.3 },
    ],
  };

  return MAPPING[dimensionId] || [];
}
