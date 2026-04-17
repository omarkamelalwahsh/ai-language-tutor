// ============================================================================
// Skill & Subskill Registry
// ============================================================================
// Central registry of all skills and subskills in the system.
// Skill frameworks are defined individually and registered here.
// This module also provides factory functions to initialize skill/subskill state.
// ============================================================================

import { CEFRLevel, scoreToCEFRBand } from '../domain/cefr';
import {
  SkillId, SubskillId, SkillState, SubskillState,
  SkillFramework, SubskillDefinition, SubskillParentMapping,
  LearnerModel, LearnerGoal, ALL_SKILL_IDS,
} from '../domain/types';
import { ConfidenceProfile } from '../domain/types';
import { READING_FRAMEWORK } from './reading';
import { WRITING_FRAMEWORK } from './writing';
import { LISTENING_FRAMEWORK } from './listening';
import { SPEAKING_FRAMEWORK } from './speaking';

// ─── Shared Subskill Definitions ────────────────────────────────────────────

/**
 * Shared subskills contribute to multiple skills with different weights.
 * These represent cross-cutting language competencies.
 */
export const SHARED_SUBSKILL_DEFINITIONS: readonly SubskillDefinition[] = [
  {
    subskillId: 'shared.grammar_control',
    name: 'Grammar Control',
    description: 'Ability to use grammatical structures correctly and appropriately.',
    isShared: true,
    weightInParent: 0, // Set per-skill in parent mappings
    relevanceFloor: null,
    indicators: [
      'Uses basic sentence patterns correctly',
      'Controls tense system within familiar contexts',
      'Handles complex subordination',
    ],
  },
  {
    subskillId: 'shared.verb_system',
    name: 'Verb System Mastery',
    description: 'Command of tenses, aspects, modals, and verb forms.',
    isShared: true,
    weightInParent: 0,
    relevanceFloor: null,
    indicators: [
      'Uses present simple/continuous correctly',
      'Differentiates past simple from present perfect',
      'Uses conditional and subjunctive forms',
    ],
  },
  {
    subskillId: 'shared.vocabulary_range',
    name: 'Vocabulary Range',
    description: 'Breadth of vocabulary available for reception and production.',
    isShared: true,
    weightInParent: 0,
    relevanceFloor: null,
    indicators: [
      'Knows high-frequency everyday words',
      'Uses topic-specific vocabulary',
      'Has broad abstract and idiomatic vocabulary',
    ],
  },
  {
    subskillId: 'shared.vocabulary_precision',
    name: 'Vocabulary Precision',
    description: 'Accuracy and appropriateness of word choice.',
    isShared: true,
    weightInParent: 0,
    relevanceFloor: null,
    indicators: [
      'Chooses correct words for basic meanings',
      'Distinguishes near-synonyms appropriately',
      'Uses precise collocations and register-appropriate vocabulary',
    ],
  },
  {
    subskillId: 'shared.discourse_coherence',
    name: 'Discourse Coherence',
    description: 'Ability to organize ideas logically and use cohesive devices.',
    isShared: true,
    weightInParent: 0,
    relevanceFloor: null,
    indicators: [
      'Links sentences with basic connectors (and, but, so)',
      'Uses paragraph structure and topic sentences',
      'Creates sophisticated argumentative flow',
    ],
  },
  {
    subskillId: 'shared.task_completion',
    name: 'Task Completion',
    description: 'Ability to understand and fulfill task requirements fully.',
    isShared: true,
    weightInParent: 0,
    relevanceFloor: null,
    indicators: [
      'Addresses the basic prompt',
      'Covers all required aspects of the task',
      'Exceeds task requirements with elaboration',
    ],
  },
] as const;

// ─── Parent Mapping Registry ────────────────────────────────────────────────

/**
 * Defines how each shared subskill maps to its parent skills with weights.
 * These weights determine how much a shared subskill contributes to each skill.
 *
 * ASSUMPTION: Weights are based on linguistic theory and CEFR descriptors.
 * They should be validated against learner data and refined over time.
 */
export const SHARED_SUBSKILL_PARENT_MAPPINGS: Record<string, readonly SubskillParentMapping[]> = {
  'shared.grammar_control': [
    { skillId: 'writing', weight: 0.20 },
    { skillId: 'speaking', weight: 0.15 },
    { skillId: 'reading', weight: 0.10 },
    { skillId: 'listening', weight: 0.05 },
  ],
  'shared.verb_system': [
    { skillId: 'writing', weight: 0.10 },
    { skillId: 'speaking', weight: 0.10 },
    { skillId: 'reading', weight: 0.05 },
    { skillId: 'listening', weight: 0.05 },
  ],
  'shared.vocabulary_range': [
    { skillId: 'reading', weight: 0.20 },
    { skillId: 'writing', weight: 0.10 },
    { skillId: 'listening', weight: 0.15 },
    { skillId: 'speaking', weight: 0.10 },
  ],
  'shared.vocabulary_precision': [
    { skillId: 'writing', weight: 0.10 },
    { skillId: 'speaking', weight: 0.10 },
    { skillId: 'reading', weight: 0.05 },
  ],
  'shared.discourse_coherence': [
    { skillId: 'writing', weight: 0.15 },
    { skillId: 'speaking', weight: 0.10 },
    { skillId: 'reading', weight: 0.05 },
  ],
  'shared.task_completion': [
    { skillId: 'writing', weight: 0.05 },
    { skillId: 'speaking', weight: 0.05 },
    { skillId: 'reading', weight: 0.05 },
    { skillId: 'listening', weight: 0.05 },
  ],
};

// ─── Registry ───────────────────────────────────────────────────────────────

/**
 * All skill frameworks indexed by skill ID.
 */
export const SKILL_FRAMEWORKS: Record<SkillId, SkillFramework> = {
  reading: READING_FRAMEWORK,
  writing: WRITING_FRAMEWORK,
  listening: LISTENING_FRAMEWORK,
  speaking: SPEAKING_FRAMEWORK,
};

/**
 * Get all subskill IDs that contribute to a given skill.
 * Includes both skill-specific and shared subskills.
 */
export function getSubskillsForSkill(skillId: SkillId): SubskillId[] {
  const framework = SKILL_FRAMEWORKS[skillId];
  const skillSpecific = framework.subskills.map(s => s.subskillId);

  const shared = SHARED_SUBSKILL_DEFINITIONS
    .filter(sd => {
      const mappings = SHARED_SUBSKILL_PARENT_MAPPINGS[sd.subskillId];
      return mappings?.some(m => m.skillId === skillId);
    })
    .map(sd => sd.subskillId);

  return [...skillSpecific, ...shared];
}

/**
 * Get all subskill definitions (skill-specific + shared).
 */
export function getAllSubskillDefinitions(): SubskillDefinition[] {
  const skillSpecific = ALL_SKILL_IDS.flatMap(
    skillId => SKILL_FRAMEWORKS[skillId].subskills
  );
  return [...skillSpecific, ...SHARED_SUBSKILL_DEFINITIONS];
}

/**
 * Get the parent mappings for a subskill.
 * For skill-specific subskills, returns a single mapping to the owning skill.
 * For shared subskills, returns mappings to all parent skills.
 */
export function getParentMappings(subskillId: SubskillId): SubskillParentMapping[] {
  // Check shared first
  const sharedMappings = SHARED_SUBSKILL_PARENT_MAPPINGS[subskillId];
  if (sharedMappings) {
    return [...sharedMappings];
  }

  // Skill-specific: extract skill from prefix
  const prefix = subskillId.split('.')[0] as SkillId;
  if (ALL_SKILL_IDS.includes(prefix)) {
    const framework = SKILL_FRAMEWORKS[prefix];
    const def = framework.subskills.find(s => s.subskillId === subskillId);
    if (def) {
      return [{ skillId: prefix, weight: def.weightInParent }];
    }
  }

  return [];
}

/**
 * Get the weight of a subskill within a specific parent skill.
 */
export function getSubskillWeight(subskillId: SubskillId, skillId: SkillId): number {
  const mappings = getParentMappings(subskillId);
  const mapping = mappings.find(m => m.skillId === skillId);
  return mapping?.weight ?? 0;
}

// ─── Factory Functions ──────────────────────────────────────────────────────

/**
 * Create an initial SubskillState with default values.
 */
export function createInitialSubskillState(
  subskillId: SubskillId,
  initialScore: number = 30,
): SubskillState {
  const parentMappings = getParentMappings(subskillId);
  const allDefs = getAllSubskillDefinitions();
  const def = allDefs.find(d => d.subskillId === subskillId);

  return {
    subskillId,
    score: initialScore,
    band: scoreToCEFRBand(initialScore, 0.2), // Low confidence initially
    confidence: 0.2,
    evidenceCount: 0,
    lastUpdated: new Date().toISOString(),
    parentSkills: parentMappings,
    relevanceFloor: def?.relevanceFloor ?? null,
  };
}

/**
 * Create an initial SkillState from its framework definition.
 */
export function createInitialSkillState(skillId: SkillId, initialScore: number = 30): SkillState {
  const subskillIds = getSubskillsForSkill(skillId);

  return {
    skillId,
    score: initialScore,
    band: scoreToCEFRBand(initialScore, 0.2),
    confidence: 0.2,
    evidenceCount: 0,
    lastUpdated: new Date().toISOString(),
    subskillIds,
  };
}

/**
 * Create a fully initialized LearnerModel with default values.
 * All subskills start at the provided initial score (default 30 = low A2).
 */
export function createInitialLearnerModel(
  learnerId: string,
  goal: LearnerGoal,
  initialScore: number = 30,
): LearnerModel {
  const now = new Date().toISOString();

  // Initialize all subskill states
  const allSubskillDefs = getAllSubskillDefinitions();
  const subskills: Record<SubskillId, SubskillState> = {};
  for (const def of allSubskillDefs) {
    subskills[def.subskillId] = createInitialSubskillState(def.subskillId, initialScore);
  }

  // Initialize skill states
  const skills: Record<SkillId, SkillState> = {} as Record<SkillId, SkillState>;
  for (const skillId of ALL_SKILL_IDS) {
    skills[skillId] = createInitialSkillState(skillId, initialScore);
  }

  const confidence: ConfidenceProfile = {
    state: 'cautious',
    selfCorrectionRate: 0,
    avgResponseLatencyMs: 0,
    supportDependence: 0.5,
    unassistedSuccessStreak: 0,
  };

  return {
    version: '2.0.0',
    learnerId,
    createdAt: now,
    lastUpdated: now,
    overallBand: scoreToCEFRBand(initialScore, 0.2),
    overallScore: initialScore,
    skills,
    subskills,
    errorProfiles: [],
    confidence,
    learnerGoal: goal,
    totalTasksCompleted: 0,
    totalEvidenceAbsorbed: 0,
  };
}
