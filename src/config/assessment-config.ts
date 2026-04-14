/**
 * Progressive 40-Question Hybrid Ordered Architecture
 * 
 * Deterministic assessment organized into 4 sequential blocks:
 * 1. Listening & Language Use (10 Qs - MCQ)
 * 2. Reading (10 Qs - MCQ - Big Stimulus)
 * 3. Writing (10 Qs - Open Ended - Same Stimulus)
 * 4. Speaking (10 Qs - Audio - Progressive difficulty)
 * 
 * Scoring: Easy=1pt, Medium=2pt, Hard=3pt → Max 20pts/block, 80pts total.
 */

export type AssessmentBlock = 'block1_listening_use' | 'block2_reading' | 'block3_writing' | 'block4_speaking';
export type BatterySkill = 'reading' | 'listening' | 'grammar' | 'vocabulary' | 'writing' | 'speaking';

export type DifficultyZone = 'EASY' | 'MEDIUM' | 'HARD';

export interface ZoneConfig {
  readonly count: number;
  readonly levels: readonly string[];
  readonly pointsPerQuestion: number;
}

export interface CEFRScaleEntry {
  readonly min: number;
  readonly max: number;
  readonly level: string;
}

export const ASSESSMENT_CONFIG = {
  TOTAL_QUESTIONS: 40,
  
  BLOCKS: [
    'block1_listening_use',
    'block2_reading',
    'block3_writing',
    'block4_speaking'
  ] as const,

  QUESTIONS_PER_BLOCK: 10,

  ZONES: {
    EASY: { count: 3, levels: ['A1', 'A2'] as const, pointsPerQuestion: 1 },
    MEDIUM: { count: 4, levels: ['B1', 'B2'] as const, pointsPerQuestion: 2 },
    HARD: { count: 3, levels: ['C1', 'C2'] as const, pointsPerQuestion: 3 },
  } satisfies Record<DifficultyZone, ZoneConfig>,

  MAX_POINTS_PER_BLOCK: 20,
  MAX_POINTS_TOTAL: 80,

  CEFR_SCALE: [
    { min: 0,  max: 20,  level: 'A1' },
    { min: 21, max: 40,  level: 'A2' },
    { min: 41, max: 60,  level: 'B1' },
    { min: 61, max: 80,  level: 'B2' },
    { min: 81, max: 90,  level: 'C1' },
    { min: 91, max: 100, level: 'C2' },
  ] as const satisfies readonly CEFRScaleEntry[],
};
