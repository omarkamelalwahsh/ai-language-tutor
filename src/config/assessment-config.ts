/**
 * Adaptive Assessment Engine Configuration
 * 
 * Central source of truth for all thresholds, limits, and behavior
 * settings for the CEFR diagnostic engine.
 */

export const ASSESSMENT_CONFIG = {
  /** Minimum number of questions to answer before the engine can stop based on confidence. */
  MIN_QUESTIONS: 8,
  
  /** Absolute maximum number of questions allowed in a single session. */
  MAX_QUESTIONS: 20,
  
  /** Overall confidence probability [0, 1] required to trigger an early "stable" stop. */
  CONFIDENCE_STOP_THRESHOLD: 0.75,

  /** Number of initial calibration items (fixed sequence) before adaptive logic takes over. */
  CALIBRATION_COUNT: 4,

  /** Starting level if none is provided via learner profile. */
  DEFAULT_STARTING_LEVEL: 'B1' as const,

  /** Recency bias factor for SkillAggregator (0.0 to 1.0). 
   * Higher = newest items have significantly more impact. 
   */
  RECENCY_WEIGHT_DECAY: 0.85,

  /** Confidence threshold for a level to be considered "stable" enough to stop early. */
  STABILITY_THRESHOLD: 0.75,
} as const;
