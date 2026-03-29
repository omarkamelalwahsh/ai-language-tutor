// ============================================================================
// MVP Assessment Engine Types
// ============================================================================
// Core types for the deterministic text evaluation engine.
// Limits CEFR output to B2 max for believable MVP results.
// ============================================================================

import { CEFRLevel, SkillId } from '../domain/types';

/** The target domain skills evaluated. We proxy speaking through text for MVP. */
export type EvalSkillId = 'writing' | 'speaking_proxy' | 'listening_proxy' | 'visual_description';

/** Task types determine the specific scoring rubric. */
export type EvalTaskType = 
  | 'self_introduction'
  | 'personal_routine'
  | 'picture_description'
  | 'past_narrative'
  | 'opinion_essay'
  | 'listening_summary';

/** The raw features deterministically extracted from the text. */
export interface ExtractedFeatures {
  wordCount: number;
  sentenceCount: number;
  averageSentenceLength: number;
  uniqueWordRatio: number; // lexical diversity
  
  // Discourse markers
  connectorCount: number;
  advancedConnectorCount: number;
  argumentMarkerCount: number;
  narrativeMarkerCount: number;
  descriptiveMarkerCount: number;
  
  // Complexity & mechanics
  paragraphCount: number;
  repetitionRatio: number; // ratio of consecutive/nearby repeated identical words
  
  // Heuristic approximations (0-1 metric, 1 is perfect)
  grammarIntegrity: number; 
  spellingIntegrity: number;
  
  // Task specific (if promptContext provided target words)
  targetKeywordHitRatio?: number;
}

/** 
 * Final MVP output: Explainable, deterministic score.
 */
export interface AssessmentResult {
  taskType: EvalTaskType;
  skill: SkillId; // Maps back to the main domain
  
  rawFeatures: ExtractedFeatures;
  
  // Normalized 0-100 scores based on task rubric
  dimensionScores: Record<string, number>;
  
  // Overall 0-100 composite score 
  weightedScore: number;
  
  // MVP CEFR bands (A1, A2, B1, B2)
  estimatedBand: CEFRLevel;
  
  // 0.0 to 1.0 based on response length and signal clarity
  confidence: number;
  
  // Human readable label based on score proximity and confidence
  bandLabel: string; // e.g. "likely B1", "A2/B1 emerging"
  
  // Explainability
  reasons: string[];
  weaknesses: string[];
  strengths: string[];
}

/** Context provided to the scorer for task-specific heuristics. */
export interface PromptContext {
  targetKeywords?: string[]; // e.g., observable details in a picture, key points in audio
  promptText?: string;       // the original prompt
}
