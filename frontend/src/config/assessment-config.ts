/**
 * Fixed-Length Adaptive Assessment Configuration
 * 
 * 40-Question CEFR-Tiered Architecture:
 * Block 1: Reading & Grammar (15 Qs - MCQ - Mega-Passage Split Layout)
 * Block 2: Writing (5 Qs - Open-Ended - Same Mega-Passage)
 * Block 3: Listening (15 Qs - MCQ - Audio Player)
 * Block 4: Speaking (5 Qs - Audio Recording)
 * 
 * Each skill distributes items across 3 CEFR Tiers for learning-curve analysis.
 * Scoring: Difficulty-weighted by CEFR level (A1=0.1 → C2=1.0).
 */

export type AssessmentBlock = 
  | 'block1_reading_grammar' 
  | 'block2_writing' 
  | 'block3_listening' 
  | 'block4_speaking';

export type BatterySkill = 'reading' | 'grammar' | 'listening' | 'writing' | 'speaking';

export type DifficultyZone = 'EASY' | 'MEDIUM' | 'HARD';

export type CEFRTier = 'tier1' | 'tier2' | 'tier3';

export interface TierConfig {
  readonly tier: CEFRTier;
  readonly zone: DifficultyZone;
  readonly levels: readonly string[];
}

export interface BlockConfig {
  readonly name: string;
  readonly skills: readonly BatterySkill[];
  readonly itemCount: number;
  readonly responseMode: 'mcq' | 'typed' | 'audio';
  readonly useSplitLayout: boolean;
}

export interface CEFRScaleEntry {
  readonly min: number;
  readonly max: number;
  readonly level: string;
}

/**
 * Per-skill item distribution across CEFR tiers.
 * Total must match the block's itemCount.
 */
export interface SkillTierDistribution {
  readonly skill: BatterySkill;
  readonly tier1: number; // A1-A2
  readonly tier2: number; // B1-B2
  readonly tier3: number; // C1-C2
}

export const ASSESSMENT_CONFIG = {
  TOTAL_QUESTIONS: 40,

  /** Sequential block order — determines assessment flow */
  BLOCKS: [
    'block1_reading_grammar',
    'block2_writing',
    'block3_listening',
    'block4_speaking'
  ] as const,

  /** Per-block configuration */
  BLOCK_CONFIG: {
    block1_reading_grammar: {
      name: 'Reading & Grammar',
      skills: ['reading', 'grammar'] as const,
      itemCount: 15,
      responseMode: 'mcq' as const,
      useSplitLayout: true,
    },
    block2_writing: {
      name: 'Writing',
      skills: ['writing'] as const,
      itemCount: 5,
      responseMode: 'typed' as const,
      useSplitLayout: true, // Same passage from Block 1
    },
    block3_listening: {
      name: 'Listening',
      skills: ['listening'] as const,
      itemCount: 15,
      responseMode: 'mcq' as const,
      useSplitLayout: false,
    },
    block4_speaking: {
      name: 'Speaking',
      skills: ['speaking'] as const,
      itemCount: 5,
      responseMode: 'audio' as const,
      useSplitLayout: false,
    },
  } satisfies Record<AssessmentBlock, BlockConfig>,

  /** CEFR tier → difficulty zone mapping */
  TIERS: {
    tier1: { tier: 'tier1', zone: 'EASY',   levels: ['A1', 'A2'] as const },
    tier2: { tier: 'tier2', zone: 'MEDIUM', levels: ['B1', 'B2'] as const },
    tier3: { tier: 'tier3', zone: 'HARD',   levels: ['C1', 'C2'] as const },
  } satisfies Record<CEFRTier, TierConfig>,

  /** Per-skill tier distribution */
  SKILL_DISTRIBUTION: [
    { skill: 'reading',   tier1: 3, tier2: 3, tier3: 2 }, // 8 total
    { skill: 'grammar',   tier1: 2, tier2: 3, tier3: 2 }, // 7 total
    { skill: 'writing',   tier1: 1, tier2: 2, tier3: 2 }, // 5 total
    { skill: 'listening', tier1: 5, tier2: 5, tier3: 5 }, // 15 total
    { skill: 'speaking',  tier1: 1, tier2: 2, tier3: 2 }, // 5 total
  ] as const satisfies readonly SkillTierDistribution[],

  /** CEFR level → numeric difficulty for weighted scoring */
  CEFR_DIFFICULTY_MAP: {
    'A1': 0.1, 'A2': 0.2,
    'B1': 0.4, 'B2': 0.6,
    'C1': 0.8, 'C2': 1.0,
  } as const,

  /** Percentage → CEFR level scale (Professional International Thresholds) */
  CEFR_SCALE: [
    { min: 0,  max: 20,  level: 'A1' },
    { min: 21, max: 40,  level: 'A2' },
    { min: 41, max: 54,  level: 'B1' },
    // B1+ (55-60%) is handled explicitly in CEFREngine.mapPercentageToLevel
    { min: 55, max: 60,  level: 'B1+' },
    { min: 61, max: 75,  level: 'B2' },
    { min: 76, max: 85,  level: 'C1' },
    { min: 86, max: 100, level: 'C2' },
  ] as const satisfies readonly CEFRScaleEntry[],
};
