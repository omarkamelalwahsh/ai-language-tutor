// ============================================================================
// Core Domain Types
// ============================================================================
// These types define the entire domain model for the CEFR-aligned
// deterministic learning engine. Every type here is used in the update
// pipeline and is designed for explainability and strong typing.
// ============================================================================

import { CEFRLevel, CEFRBand } from './cefr';
import { ErrorCode } from './errors';

// ─── Identifiers ────────────────────────────────────────────────────────────

/**
 * The 4 core language skills aligned with CEFR.
 * We use 'reading' instead of 'vocabulary' to stay CEFR-canonical.
 * Vocabulary is modeled as a shared subskill across all 4 skills.
 */
export type SkillId = 'reading' | 'writing' | 'listening' | 'speaking';

/**
 * All skill IDs as an iterable array.
 */
export const ALL_SKILL_IDS: readonly SkillId[] = ['reading', 'writing', 'listening', 'speaking'] as const;

/**
 * Subskill identifiers follow a dot-notation convention:
 * - Skill-specific: "listening.detail_extraction", "writing.spelling"
 * - Shared (cross-skill): "shared.grammar_control", "shared.vocabulary_range"
 *
 * The prefix determines ownership. "shared." subskills contribute to
 * multiple parent skills with individual weights.
 */
export type SubskillId = string;

// ─── Skill State ────────────────────────────────────────────────────────────

/**
 * The state of a single language skill (e.g., writing).
 * Skills are NOT updated directly from task results.
 * They are aggregated from their constituent subskills.
 */
export interface SkillState {
  readonly skillId: SkillId;

  /** Internal score (0–100). Derived from subskill aggregation. */
  score: number;

  /** Confidence-aware CEFR band. */
  band: CEFRBand;

  /**
   * How confident we are in this skill score.
   * 0.0 = no evidence, 1.0 = strong, sustained evidence.
   * Grows with evidence count; decays slowly with time.
   */
  confidence: number;

  /** Total number of evidence units that have contributed to this skill. */
  evidenceCount: number;

  /** ISO timestamp of the last update. */
  lastUpdated: string;

  /** IDs of subskills that feed into this skill. */
  readonly subskillIds: readonly SubskillId[];
}

// ─── Subskill State ─────────────────────────────────────────────────────────

/**
 * The state of a single subskill (e.g., "writing.spelling" or "shared.grammar_control").
 *
 * Subskills are the atomic unit of competence. All evidence targets subskills.
 * Skills are derived. This is the core modeling insight.
 */
export interface SubskillState {
  readonly subskillId: SubskillId;

  /** Internal score (0–100). Updated by evidence. */
  score: number;

  /** Confidence-aware CEFR band. */
  band: CEFRBand;

  /**
   * Confidence in this subskill score.
   * Affects how much new evidence changes the score.
   * Low confidence → larger updates (we don't know much yet).
   * High confidence → smaller updates (score is well-established).
   */
  confidence: number;

  /** Total evidence units applied to this subskill. */
  evidenceCount: number;

  /** ISO timestamp of last update. */
  lastUpdated: string;

  /**
   * Which skills this subskill contributes to.
   * For skill-specific subskills: exactly one skill.
   * For shared subskills: multiple skills with individual weights.
   */
  readonly parentSkills: readonly SubskillParentMapping[];

  /**
   * CEFR level at which this subskill becomes relevant.
   * For example, "writing.academic_register" only matters at B2+.
   * null means relevant at all levels.
   */
  readonly relevanceFloor: CEFRLevel | null;
}

/**
 * Maps a subskill to a parent skill with a contribution weight.
 * The weight determines how much this subskill influences the parent skill score.
 */
export interface SubskillParentMapping {
  readonly skillId: SkillId;

  /**
   * How much this subskill contributes to the parent skill score.
   * Weights within a skill should sum to ~1.0 for normalization,
   * but the system normalizes dynamically to handle partial data.
   */
  readonly weight: number;
}

// ─── Error & Confidence Profiles ────────────────────────────────────────────

/**
 * Tracks a specific, recurring error pattern for a learner.
 * Errors are not just "mistakes" — they're diagnostic signals
 * that map to specific subskills.
 */
export interface ErrorProfile {
  /** The structured error code (from error taxonomy). */
  readonly errorCode: ErrorCode;

  /** How many times this error has been observed. */
  occurrenceCount: number;

  /** Recent trend: is this error becoming more or less frequent? */
  trend: 'increasing' | 'stable' | 'decreasing';

  /**
   * Severity of this error at the learner's current level.
   * The same error has different severity at different CEFR levels.
   * For example, article_error is 'low' at A1 but 'high' at B2.
   */
  severityAtCurrentLevel: 'low' | 'medium' | 'high';

  /** ISO timestamp of the first observation. */
  firstSeen: string;

  /** ISO timestamp of the most recent observation. */
  lastSeen: string;

  /** Which subskills this error directly affects. */
  readonly affectedSubskills: readonly SubskillId[];
}

/**
 * The overall confidence profile of the learner.
 * This is a meta-signal about learning behavior, not skill level.
 */
export interface ConfidenceProfile {
  /**
   * Overall behavioral state:
   * - 'fragile': easily discouraged, needs scaffolding
   * - 'cautious': engages but avoids risk
   * - 'steady': consistent engagement
   * - 'resilient': recovers well from mistakes, embraces challenge
   */
  state: 'fragile' | 'cautious' | 'steady' | 'resilient';

  /** Rate of self-correction (0–1). Higher = learner catches own mistakes. */
  selfCorrectionRate: number;

  /** Average response latency in ms. Proxy for cognitive load. */
  avgResponseLatencyMs: number;

  /** How dependent the learner is on hints/support (0–1). */
  supportDependence: number;

  /** Number of tasks completed without hint usage (building confidence). */
  unassistedSuccessStreak: number;
}

// ─── Learner Model ──────────────────────────────────────────────────────────

/**
 * The complete learner model. This is the central data structure.
 *
 * IMPORTANT: This model is never updated directly from task scores.
 * All updates flow through the deterministic pipeline:
 *   score → observe → attribute → evidence → subskills → skills → overall
 */
export interface LearnerModel {
  /** Schema version for forward-compatibility. */
  readonly version: string;

  /** Unique learner identifier. */
  readonly learnerId: string;

  /** ISO timestamp of model creation. */
  readonly createdAt: string;

  /** ISO timestamp of last update. */
  lastUpdated: string;

  /** Confidence-aware overall CEFR band. */
  overallBand: CEFRBand;

  /** Overall numeric score (0–100). Derived from skill aggregation. */
  overallScore: number;

  /** State of each of the 4 core skills. */
  skills: Record<SkillId, SkillState>;

  /** State of every tracked subskill. */
  subskills: Record<SubskillId, SubskillState>;

  /** Recurring error patterns. */
  errorProfiles: ErrorProfile[];

  /** Behavioral confidence profile. */
  confidence: ConfidenceProfile;

  /** The learner's declared goal. Affects planning priority. */
  learnerGoal: LearnerGoal;

  /** Total tasks completed. */
  totalTasksCompleted: number;

  /** Total evidence units absorbed. */
  totalEvidenceAbsorbed: number;
}

/**
 * The learner's declared learning goal.
 * This is set during onboarding and can be updated.
 */
export interface LearnerGoal {
  /** General category of goal. */
  readonly type: 'conversational' | 'academic' | 'professional' | 'exam_prep' | 'general';

  /** Target CEFR level the learner wants to reach. */
  readonly targetLevel: CEFRLevel;

  /** Which skills the learner explicitly wants to focus on (may be empty). */
  readonly focusSkills: readonly SkillId[];

  /** Free-text description of the goal (optional). */
  readonly description?: string;
}

// ─── Challenge Types ────────────────────────────────────────────────────────

/**
 * A challenge blueprint defines what a task looks like before a learner interacts with it.
 * Blueprints are templates; results are instances of a learner doing one.
 */
export interface ChallengeBlueprint {
  /** Unique identifier for this blueprint. */
  readonly blueprintId: string;

  /** Human-readable name for this challenge type. */
  readonly name: string;

  /** Brief description of what this challenge tests. */
  readonly description: string;

  /** The primary skill this challenge targets. */
  readonly primarySkill: SkillId;

  /** Additional skills tested (for integrated tasks). */
  readonly secondarySkills: readonly SkillId[];

  /**
   * Subskills targeted by this challenge, with relative weights.
   * The weights express how much of the challenge focuses on each subskill.
   * Weights should sum to 1.0 within each skill group.
   */
  readonly targetedSubskills: readonly SubskillTarget[];

  /** Difficulty range this blueprint is designed for. */
  readonly difficultyRange: {
    readonly min: CEFRLevel;
    readonly max: CEFRLevel;
  };

  /** The type of challenge (determines scoring logic). */
  readonly challengeType: ChallengeType;

  /** Expected time to complete, in seconds. */
  readonly expectedDurationSec: number;

  /**
   * What the challenge provides as stimulus.
   * E.g., for listen-and-write: { audioText: "She goes to school every day." }
   */
  readonly stimulus: Record<string, string>;

  /**
   * Scoring dimensions and their weights for this specific challenge.
   * Used by the scorer to produce dimensional scores.
   */
  readonly scoringDimensions: readonly ScoringDimension[];
}

/** Types of challenges the system supports. */
export type ChallengeType =
  | 'listen_and_write'     // Integrated: listening + writing
  | 'read_and_answer'      // Integrated: reading + writing
  | 'read_and_summarize'   // Integrated: reading + writing
  | 'listen_and_answer'    // Integrated: listening + writing/speaking
  | 'free_writing'         // Writing-focused
  | 'guided_writing'       // Writing-focused with scaffold
  | 'dictation'            // Listening + spelling focus
  | 'vocabulary_in_context'// Reading/writing + vocabulary
  | 'grammar_transformation' // Grammar-focused
  | 'speaking_monologue'   // Speaking-focused
  | 'speaking_roleplay'    // Speaking-focused
  | 'reading_comprehension'; // Reading-focused

/** A subskill targeted by a challenge with a relative weight. */
export interface SubskillTarget {
  readonly subskillId: SubskillId;
  readonly weight: number; // 0–1, relative importance in this challenge
}

/** A scoring dimension with weight for a specific challenge. */
export interface ScoringDimension {
  readonly dimensionId: string;
  readonly label: string;
  readonly weight: number; // How much this dimension contributes to the total score
}

// ─── Challenge Results ──────────────────────────────────────────────────────

/**
 * The raw result of a learner completing a challenge.
 * This is input to the update pipeline.
 */
export interface ChallengeResult {
  /** Reference to the blueprint. */
  readonly blueprintId: string;

  /** The actual challenge blueprint (resolved). */
  readonly blueprint: ChallengeBlueprint;

  /** Unique ID for this specific attempt. */
  readonly attemptId: string;

  /** The learner's raw response. */
  readonly learnerResponse: string;

  /** Time taken in milliseconds. */
  readonly responseTimeMs: number;

  /** Number of hints the learner used. */
  readonly hintsUsed: number;

  /** Number of retries before this final submission. */
  readonly retryCount: number;

  /** ISO timestamp of completion. */
  readonly completedAt: string;

  /**
   * Structured response data for multi-part challenges.
   * E.g., { transcription: "She go to scool every day." }
   */
  readonly responseData: Record<string, string>;
}

// ─── Pipeline Types ─────────────────────────────────────────────────────────

/**
 * Scored output from step 1 of the pipeline.
 * Assigns dimensional scores to a challenge result.
 */
export interface ScoredResult {
  readonly challengeResult: ChallengeResult;

  /** Overall score (0–100) for the task. */
  readonly overallScore: number;

  /** Dimensional scores (e.g., { accuracy: 70, spelling: 40, grammar: 60 }). */
  readonly dimensionScores: Record<string, number>;

  /** List of specific errors detected. */
  readonly detectedErrors: readonly DetectedError[];

  /** List of specifically correct elements. */
  readonly correctElements: readonly CorrectElement[];
}

/** A specific error detected during scoring. */
export interface DetectedError {
  /** The error code from the taxonomy. */
  readonly errorCode: ErrorCode;

  /** The fragment of the response where the error was found. */
  readonly fragment: string;

  /** What was expected. */
  readonly expected: string;

  /** Additional context (e.g., rule description). */
  readonly context?: string;
}

/** A specifically correct element detected during scoring. */
export interface CorrectElement {
  /** Which dimension this correct element relates to. */
  readonly dimensionId: string;

  /** The correct fragment. */
  readonly fragment: string;

  /** Brief explanation. */
  readonly description: string;
}

/**
 * An observation extracted from a scored result.
 * Observations are the bridge between raw scoring and subskill attribution.
 *
 * Each observation says: "We observed [this behavior] which is evidence
 * [for/against] [this subskill]."
 */
export interface Observation {
  /** Unique ID for tracing. */
  readonly observationId: string;

  /** The subskill this observation is evidence for/against. */
  readonly targetSubskillId: SubskillId;

  /** Whether this is positive evidence (correct) or negative (error). */
  readonly polarity: 'positive' | 'negative' | 'neutral';

  /**
   * Strength of this observation (0–1).
   * 1.0 = unambiguous, clear evidence.
   * 0.3 = weak or ambiguous signal (e.g., could be memory issue, not skill gap).
   */
  readonly strength: number;

  /** Human-readable description. */
  readonly description: string;

  /** Source error or correct element. */
  readonly source: {
    readonly type: 'error' | 'correct_element' | 'task_behavior';
    readonly reference: string; // ErrorCode or element description
  };
}

/**
 * An evidence unit is a concrete delta to apply to a subskill.
 * Built from observations after error attribution.
 */
export interface EvidenceUnit {
  /** The target subskill to update. */
  readonly targetSubskillId: SubskillId;

  /**
   * The score delta to apply. Can be positive or negative.
   * This is the RAW delta before confidence modulation.
   */
  readonly rawDelta: number;

  /**
   * The actual delta after confidence modulation.
   * High existing confidence → smaller delta (harder to move).
   * Low existing confidence → larger delta (more responsive).
   */
  readonly modulatedDelta: number;

  /** Confidence change for this subskill. */
  readonly confidenceDelta: number;

  /** Which observation(s) generated this evidence unit. */
  readonly sourceObservationIds: readonly string[];

  /** Explanation of why this delta was computed. */
  readonly reasoning: string;
}

/**
 * A skill update records how a skill changed after subskill propagation.
 * Used for logging, explanation, and journey decisions.
 */
export interface SkillUpdate {
  readonly skillId: SkillId;
  readonly previousScore: number;
  readonly newScore: number;
  readonly previousBand: CEFRBand;
  readonly newBand: CEFRBand;
  readonly delta: number;
  readonly contributingSubskills: readonly {
    readonly subskillId: SubskillId;
    readonly contribution: number;
  }[];
}

/**
 * The full result of running the pipeline on a single challenge result.
 * This is a complete audit trail.
 */
export interface PipelineResult {
  /** The scored result from step 1. */
  readonly scoredResult: ScoredResult;

  /** Observations extracted from the scored result. */
  readonly observations: readonly Observation[];

  /** Evidence units built from observations. */
  readonly evidenceUnits: readonly EvidenceUnit[];

  /** Subskill updates that were applied. */
  readonly subskillUpdates: Record<SubskillId, {
    readonly previousScore: number;
    readonly newScore: number;
    readonly delta: number;
  }>;

  /** Skill updates that were applied. */
  readonly skillUpdates: readonly SkillUpdate[];

  /** Overall level before and after. */
  readonly overallUpdate: {
    readonly previousScore: number;
    readonly newScore: number;
    readonly previousBand: CEFRBand;
    readonly newBand: CEFRBand;
  };

  /** Updated learner model (immutable — returns a new copy). */
  readonly updatedModel: LearnerModel;

  /** Next planning decision. */
  readonly nextPlan: PedagogicalDecision;
}

// ─── Journey & Planning Types ───────────────────────────────────────────────

/**
 * A node in the learning journey graph.
 * The journey is a directed acyclic graph of learning objectives.
 */
export interface JourneyNode {
  /** Unique node ID. */
  readonly nodeId: string;

  /** Human-readable title. */
  readonly title: string;

  /** Description of the learning objective. */
  readonly description: string;

  /** Primary skill this node develops. */
  readonly targetSkill: SkillId;

  /** Subskills addressed by this node. */
  readonly targetSubskills: readonly SubskillId[];

  /** CEFR range this node operates within. */
  readonly cefrRange: { readonly min: CEFRLevel; readonly max: CEFRLevel };

  /** Prerequisite node IDs (must be completed/mastered first). */
  readonly prerequisites: readonly string[];

  /**
   * Node status.
   * - 'locked': prerequisites not met
   * - 'available': ready to tackle
   * - 'active': currently being worked on
   * - 'mastered': sufficient evidence of competence
   * - 'remediation': previously mastered but regression detected
   */
  status: 'locked' | 'available' | 'active' | 'mastered' | 'remediation';

  /** Mastery score (0–100). Set to 0 when locked. */
  masteryScore: number;

  /** Estimated time to complete this node, in minutes. */
  readonly estimatedMinutes: number;

  /**
   * Node type determines how the planner sequences it.
   * - 'core': essential building block, must be mastered
   * - 'reinforcement': practice node to solidify skills
   * - 'challenge': stretch node above current level
   * - 'remediation': targeted fix for regression
   * - 'transfer': apply skills in a new context
   */
  readonly nodeType: 'core' | 'reinforcement' | 'challenge' | 'remediation' | 'transfer';
}

/**
 * A complete learning plan output by the journey planner.
 * This is a structured plan, not narrative text.
 */
export interface LearningPlanV2 {
  /** Unique plan ID. */
  readonly planId: string;

  /** When this plan was generated. */
  readonly generatedAt: string;

  /** The learner's current overall band when plan was generated. */
  readonly currentBand: CEFRBand;

  /** Target band this plan aims toward. */
  readonly targetBand: CEFRBand;

  /** Prioritized sequence of journey nodes. */
  readonly sequence: readonly PlannedNode[];

  /** Why these nodes were selected (for explainability). */
  readonly rationale: readonly PlanningRationale[];

  /** Estimated total time for this plan, in minutes. */
  readonly estimatedTotalMinutes: number;

  /** How many sessions this plan spans. */
  readonly estimatedSessions: number;
}

/** A node in the plan with additional scheduling metadata. */
export interface PlannedNode {
  readonly nodeId: string;
  readonly priority: number; // 1 = highest
  readonly reason: PlanningReason;
  readonly challengeBlueprintIds: readonly string[];
  readonly estimatedMinutes: number;
}

/** Why a node was selected. */
export type PlanningReason =
  | 'weakest_subskill'
  | 'recurring_error'
  | 'low_confidence'
  | 'prerequisite'
  | 'reinforcement'
  | 'remediation'
  | 'goal_aligned'
  | 'transfer'
  | 'challenge';

/** A rationale entry explaining a planning decision. */
export interface PlanningRationale {
  readonly nodeId: string;
  readonly reason: PlanningReason;
  readonly explanation: string;
  readonly dataPoints: Record<string, number | string>;
}

/**
 * A pedagogical decision produced after each update.
 * This tells the system what to do next.
 */
export interface PedagogicalDecision {
  /** What type of action to take next. */
  readonly action:
    | 'continue_sequence'  // Proceed with current learning plan
    | 'remediate'          // Learner needs targeted fix
    | 'reinforce'          // Learner needs more practice at current level
    | 'challenge'          // Learner is ready for harder material
    | 'review'             // Revisit previously mastered material
    | 'rest'               // Learner shows fatigue/frustration signs
    | 'replan';            // Significant shift detected, generate new plan

  /** Explanation of why this decision was made. */
  readonly reasoning: string;

  /** Suggested next challenge blueprint IDs. */
  readonly suggestedBlueprintIds: readonly string[];

  /** Which skills/subskills should be focused on next. */
  readonly focusAreas: readonly SubskillId[];

  /** Urgency level. */
  readonly urgency: 'low' | 'medium' | 'high';

  /** Data supporting this decision. */
  readonly supportingData: Record<string, number | string>;
}

// ─── Skill Framework Types ──────────────────────────────────────────────────

/**
 * Defines the competency model for a single skill.
 * Used to register skills and their subskills in the system.
 */
export interface SkillFramework {
  readonly skillId: SkillId;
  readonly name: string;
  readonly description: string;

  /** The subskills that belong to this skill. */
  readonly subskills: readonly SubskillDefinition[];

  /** Scoring dimensions for this skill. */
  readonly scoringDimensions: readonly string[];

  /** Observable indicators at each CEFR level. */
  readonly observableIndicators: Partial<Record<CEFRLevel, readonly string[]>>;
}

/** Definition of a subskill (template, not state). */
export interface SubskillDefinition {
  readonly subskillId: SubskillId;
  readonly name: string;
  readonly description: string;

  /** Is this a shared subskill (contributes to multiple skills)? */
  readonly isShared: boolean;

  /** Weight of this subskill within its parent skill. */
  readonly weightInParent: number;

  /** CEFR floor: level at which this subskill becomes relevant. */
  readonly relevanceFloor: CEFRLevel | null;

  /** Observable indicators specific to this subskill. */
  readonly indicators: readonly string[];
}
