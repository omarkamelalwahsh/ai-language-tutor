import { CEFRLevel } from './learner-model';

export type CefrLevel = "Pre-A1" | "A1" | "A1+" | "A2" | "A2+" | "B1" | "B1+" | "B2" | "B2+" | "C1" | "C2";

// Add support for the user's proposed types
export type SkillName = "listening" | "reading" | "writing" | "speaking" | "vocabulary" | "grammar";

export type ConfidenceBand = "low" | "medium" | "high";

export type DescriptorEvidence = {
  descriptorId: string;
  descriptorText: string;
  level: CefrLevel;
  supported: boolean;
  strength: number; // 0..1
  sourceTaskIds: string[];
};

export type AssessmentMetadata = {
  selfAssessmentLevel?: CefrLevel;
  initialTargetLevel?: CefrLevel;
  assessmentReason?: string;
  nativeLanguage?: string;
};

export type SkillAssessmentResult = {
  skill: SkillName;
  estimatedLevel: CefrLevel;
  confidence: {
    band: ConfidenceBand;
    score: number; // 0..1
    reasons: string[];
  };
  evidenceCount: number;
  descriptors: DescriptorEvidence[];
  strengths: string[];
  weaknesses: string[];
  taskCoverage: {
    total: number;
    completed: number;
    valid: number;
  };
  subscores: {
    name: string;
    value: number; // 0..1
    label?: string;
  }[];
  status: "insufficient_data" | "emerging" | "stable" | "fragile";
  isCapped?: boolean;
};

export type AssessmentSessionResult = {
  learnerId: string;
  sessionId: string;
  overall: {
    estimatedLevel: CefrLevel;
    confidence: number;
    rationale: string[];
  };
  skills: Record<SkillName, SkillAssessmentResult>;
  behavioralProfile: {
    pace: "slow" | "moderate" | "fast";
    confidenceStyle: "hesitant" | "balanced" | "confident";
    selfCorrectionRate: number;
  };
  metadata: AssessmentMetadata;
  recommendedNextTasks: string[];
  generatedAt: string;
};

export type TaskEvaluation = {
  taskId: string;
  skill: SkillName;
  validAttempt: boolean;
  rawSignals: Record<string, number | string | boolean>;
  rubricScores: {
    criterion: string;
    score: number;
    maxScore: number;
  }[];
  matchedDescriptors: {
    descriptorId: string;
    support: number; // 0..1
  }[];
};

// ============================================================================
// Legacy Types (preserved for backward compatibility)
// ============================================================================

export type TaskType =
  | 'speaking'
  | 'writing'
  | 'visual_description'
  | 'vocabulary_in_context'
  | 'listening_comprehension';

export type SkillType = 'speaking' | 'writing' | 'listening' | 'vocabulary';

export interface TaskDefinition {
  taskId: string;
  taskType: TaskType;
  targetSkill: SkillType;
  title: string;
  prompt: string;
  targetSubskills: string[];
  difficultyTarget: CEFRLevel | 'adaptive';
}

export interface TaskResponse {
  taskId: string;
  answer: string;
  responseTime: number;
  wordCount: number;
  hintUsage: number;
  metadata?: Record<string, any>;
}

export interface AssessmentSignals {
  wordCount: number;
  sentenceComplexity: number;
  grammarEfficiency: number;
  lexicalDiversity: number;
  connectorsCount: number;
  keywordMatch: number;
  accuracy: number;
  latencyMs: number;
}

// ============================================================================
// Adaptive Assessment Types
// ============================================================================

/** CEFR difficulty bands used within the adaptive engine */
export type DifficultyBand = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/** Intermediate band labels for uncertain level estimates */
export type IntermediateBand = 'A1_A2' | 'A2_B1' | 'B1_B2' | 'B2_C1' | 'C1_C2';

/** All possible band labels including intermediate */
export type BandLabel = DifficultyBand | IntermediateBand;

/** The six assessment skills */
export type AssessmentSkill =
  | 'reading'
  | 'writing'
  | 'listening'
  | 'speaking'
  | 'vocabulary'
  | 'grammar';

/** Supported question formats */
export type QuestionType =
  | 'mcq'
  | 'fill_blank'
  | 'reading_mcq'
  | 'listening_mcq'
  | 'short_text'
  | 'picture_description'
  | 'listening_summary';

/** A single assessment question with full metadata */
export type AssessmentQuestion = {
  id: string;
  skill: AssessmentSkill;
  primarySkill: AssessmentSkill;
  secondarySkills?: AssessmentSkill[];
  difficulty: DifficultyBand;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctAnswer?: string | string[];
  acceptedAnswers?: string[];
  rubricId?: string;
  subskills: string[];
};

/** Record of a single answered question */
export type AnswerRecord = {
  questionId: string;
  skill: AssessmentSkill;
  difficulty: DifficultyBand;
  correct: boolean;
  /** 0-1 normalized score (1 = fully correct) */
  score: number;
  answer: string;
  responseTimeMs: number;
};

/** Per-skill level estimate with evidence tracking */
export type SkillEstimate = {
  band: BandLabel;
  /** 0-100 normalized score */
  score: number;
  /** 0-1 confidence in this estimate */
  confidence: number;
  /** Number of questions contributing to this estimate */
  evidenceCount: number;
  /** History of correct answers at each difficulty for this skill */
  bandPerformance: Partial<Record<DifficultyBand, { correct: number; total: number }>>;
};

/** Full adaptive state maintained during the assessment */
export type AdaptiveAssessmentState = {
  currentTargetBand: DifficultyBand;
  askedQuestionIds: string[];
  answerHistory: AnswerRecord[];
  taskEvaluations: TaskEvaluation[];
  skillEstimates: Record<AssessmentSkill, SkillEstimate>;
  overallConfidence: number;
  questionsAnswered: number;
  completed: boolean;
  /** Reason the assessment stopped */
  stopReason?: 'max_reached' | 'confidence_threshold' | 'level_stabilized' | 'pool_exhausted';
};

/** Final structured output from the adaptive assessment */
export type AssessmentOutcome = {
  overallBand: BandLabel;
  overallConfidence: number;
  skillBreakdown: Record<AssessmentSkill, {
    band: BandLabel;
    score: number;
    confidence: number;
    evidenceCount: number;
  }>;
  strengths: string[];
  weaknesses: string[];
  answerHistory: AnswerRecord[];
  totalQuestions: number;
  stopReason: string;
};

/** Legacy QuestionResult type (backward compat) */
export type QuestionResult = {
  questionId: string;
  isCorrect: boolean;
  score: number;
  answer: string;
  responseTimeMs: number;
};

/** Legacy AdaptiveState type (backward compat) */
export type AdaptiveState = {
  currentBand: DifficultyBand;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  questionsAnswered: number;
  history: QuestionResult[];
};
