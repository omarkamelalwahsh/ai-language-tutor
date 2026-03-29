// ============================================================================
// MVP Assessment Engine Orchestrator
// ============================================================================
// Combines extraction, scoring, and explaining into a single pipeline.
// ============================================================================

import { SkillId } from '../domain/types';
import { AssessmentResult, EvalSkillId, EvalTaskType, PromptContext } from './types';
import { FeatureExtractor } from './feature-extractor';
import { DimensionScorer } from './scorer';
import { CEFRMapper } from './cefr-mapper';

export * from './types';

/**
 * Main entry point for the deterministic MVP assessment engine.
 */
export function evaluateResponse(
  text: string, 
  taskType: EvalTaskType, 
  targetSkill: EvalSkillId,
  context?: PromptContext
): AssessmentResult {
  
  // 1. Extract raw linguistic signals
  const features = FeatureExtractor.extract(text, context);
  
  // 2. Score via Task Strategies
  const rawDimensionScores = DimensionScorer.scoreTask(taskType, features);
  const { dimensions, total } = DimensionScorer.calculateComposite(rawDimensionScores);
  
  // 3. Map to CEFR Limit
  const estimatedBand = CEFRMapper.mapScoreToBand(total);
  const confidence = CEFRMapper.calculateConfidence(features);
  const bandLabel = CEFRMapper.generateBandLabel(estimatedBand, total, confidence);
  
  // 4. Generate Explainability Strings
  const strengths = CEFRMapper.extractStrengths(features, taskType);
  const weaknesses = CEFRMapper.extractWeaknesses(features, taskType);
  
  const reasons = [
    `Scored ${total}/100 based on ${taskType} rubric rules.`,
    ...strengths,
    ...weaknesses
  ];

  return {
    taskType,
    skill: mapEvalSkillToDomain(targetSkill),
    rawFeatures: features,
    dimensionScores: dimensions,
    weightedScore: total,
    estimatedBand,
    confidence,
    bandLabel,
    reasons,
    weaknesses,
    strengths
  };
}

/** 
 * Maps proxy skills back to the core domain structure.
 * E.g., interpreting written-text for speaking_proxy as "speaking" 
 */
function mapEvalSkillToDomain(evalSkill: EvalSkillId): SkillId {
  switch (evalSkill) {
    case 'speaking_proxy': return 'speaking';
    case 'listening_proxy': return 'listening';
    case 'visual_description': return 'speaking'; // Often mapped to spoken production
    case 'writing': return 'writing';
  }
}
