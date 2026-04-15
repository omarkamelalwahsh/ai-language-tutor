import { CEFRLevel } from './learner-model';

export type CefrLevel = "Pre-A1" | "A1" | "A1+" | "A2" | "A2+" | "B1" | "B1+" | "B2" | "B2+" | "C1" | "C2";

// Add support for the user's proposed types
export type SkillName = "listening" | "reading" | "writing" | "speaking" | "vocabulary" | "grammar";

export type ConfidenceBand = "low" | "medium" | "high";

// ============================================================================
// Speaking Response Mode & Submission Metadata
// ============================================================================

/** How the learner responded to a speaking task */
export type ResponseMode = 'voice' | 'typed_fallback';

/** Metadata attached to every speaking task submission */
export type SpeakingSubmissionMeta = {
  responseMode: ResponseMode;
  hasValidAudio: boolean;
  audioDurationSec?: number;
  micCheckPassed?: boolean;
  transcriptionAvailable?: boolean;
  audioUrl?: string;
};

/** Session-level audit trail for speaking evidence integrity */
export type SpeakingAuditTrail = {
  micCheckPassed: boolean;
  voiceRecordingsAttempted: number;
  voiceRecordingsValid: number;
  typedFallbacksUsed: number;
  speakingTasksTotal: number;
  /** Deterministic: true if ANY valid voice submission exists */
  hasAnySpeakingEvidence: boolean;
  /** If true, the final speaking level was forced to A1 */
  speakingFallbackApplied: boolean;
  fallbackReason?: string;
};

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

export type SkillAssessmentStatus = "insufficient_data" | "emerging" | "stable" | "fragile" | "provisional" | "unstable";

export type SkillAssessmentResult = {
  skill: SkillName;
  estimatedLevel: CefrLevel;
  confidence: {
    band: ConfidenceBand;
    score: number; // 0..1
    reasons: string[];
  };
  masteryScore?: number; // 0..1 (proxy for score, separates performance from confidence)
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
  status: SkillAssessmentStatus;
  isCapped?: boolean;
  cappedReason?: string;
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

/**
 * Normalized user preference model to influence task selection content.
 */
export type LearnerContextProfile = {
  goal?: "casual" | "serious" | "professional";
  /** Specific situation or industry focus (e.g. "Travel", "IT", "Medicine") */
  goalContext?: string;
  /** IDs from TOPIC_DEFINITIONS in src/data/topics.ts */
  preferredTopics: string[];
};

export type TaskEvaluation = {
  taskId: string;
  primarySkill: AssessmentSkill; // Ensure AssessmentSkill is imported/available. (It's defined below, but TypeScript allows forward references in the same file if no circular runtime issues. We will move types if needed)
  validAttempt: boolean;
  channels: {
    comprehension?: number;
    taskCompletion?: number;
    grammarAccuracy?: number;
    lexicalRange?: number;
    coherence?: number;
    fluency?: number;
  };
  responseMode?: ResponseMode;
  speakingMeta?: SpeakingSubmissionMeta;
  skillEvidence: Partial<Record<AssessmentSkill, number>>;
  descriptorEvidence: Array<{
    descriptorId: string;
    support: number;
    sourceSkill: AssessmentSkill;
    weight: number;
  }>;
  notes: string[];
  // Legacy paths to keep UI working while we refactor
  rawSignals?: Record<string, number | string | boolean>;
  relevance?: number;
  reviewData?: AnswerReviewItem; // newly added
  taskCompletion?: number;
  isOffTopic?: boolean;
  missingContentPoints?: string[];
  rationale?: string;
  errorTag?: string; // Model A tag
  briefExplanation?: string; // Model A brief explanation
  rubricScores?: {
    criterion: string;
    score: number;
    maxScore: number;
  }[];
  matchedDescriptors?: {
    descriptorId: string;
    support: number; // 0..1
  }[];
  skill?: SkillName;
  difficulty: DifficultyBand;
  systemFlags?: string[];
  debug?: {
    taskId: string;
    appliedWeights: Partial<Record<AssessmentSkill, number>>;
    extractedSignals: Record<string, number>;
    skillUpdates: Record<string, number>;
    reason: string;
  };
};

export type AnswerReviewItem = {
  questionId: string;
  skill: string;
  taskType: string;
  questionLevel: string;
  answerLevel: string;
  result: "correct" | "incorrect" | "partial";
  prompt: string;
  stimulus?: string;
  userAnswer: string;
  correctAnswer?: string;
  explanation: {
    whyCorrect?: string;
    whyIncorrect?: string;
    whatWentWrong?: string;
    modelAnswer?: string;
    improvementTip?: string;
    levelNote?: string;
  };
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

export type AssessmentFeatures = {
  correctness: number; // 0..1
  lexicalDiversity: number; // unique/total
  sentenceComplexity: number;
  connectorUsage: number;
  cohesionScore?: number;
  complexityScore?: number;
  averageSentenceLength?: number;
  uniqueWordCount?: number;
  wordCount?: number;
  opinionPresent?: boolean;
  reasonPresent?: boolean;
  examplePresent?: boolean;
  relevance?: number; // 0..1
  timestamp: string;
  // Advanced Semantic Proficiency metrics
  rareTokenRatio?: number; // 0..1 — ratio of low-frequency tokens
  nestedClauseDepth?: number; // max nesting level detected
  gerundPhraseCount?: number;
  contentWordRatio?: number; // 0..1 — content words / total words
  linguisticDepthScore?: number; // 0..1 — composite LSP signal
  syntacticComplexity?: number;
};

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

/** Supported scoring channels for integrated tasks */
export type ScoringChannel =
  | "comprehension"
  | "relevance"
  | "task_completion"
  | "grammar_accuracy"
  | "lexical_range"
  | "coherence"
  | "fluency";

/** A single assessment question with full metadata */
export type AssessmentQuestion = {
  id: string;
  primarySkill: AssessmentSkill;
  secondarySkills?: AssessmentSkill[];
  evidenceWeights?: Partial<Record<AssessmentSkill, number>>;
  difficulty: DifficultyBand;
  type: QuestionType;
  prompt: string;
  transcript?: string; // hidden from learner during test
  audioUrl?: string; // prerecorded audio
  sourceText?: string; // For reading integrated tasks
  options?: string[];
  correctAnswer?: string | string[];
  acceptedAnswers?: string[];
  subskills: string[];
  
  scoringChannels?: ScoringChannel[];
  targetDescriptorIds?: string[]; // Linked to actual CEFR 2020 descriptors
  supportDescriptors?: string[];
  
  // High-fidelity Metadata for CAT (Computerized Adaptive Testing)
  discriminationWeight?: number; // Weight of this question in moving the baseline
  difficultyWeight?: number; // Internal calibration weight
  scaffoldingLevel?: number; // 0..3, level of help provided in the prompt
  prerequisites?: string[]; // IDs of other questions or subskills
  estimatedTimeSec?: number;
  taskTags?: string[];
  
  // Topic Personalization Tags
  topicTags?: string[]; // e.g. ["travel", "daily_life"]
  domainTags?: string[]; // e.g. ["office", "shop", "school"]
  goalTags?: string[]; // e.g. ["casual", "professional", "serious"]
  
  // Open-Ended Task Specification
  expectedResponseType?: "opinion" | "narrative" | "description" | "summary" | "explanation";
  semanticIntent?: string;
  requiredContentPoints?: string[];
  relevanceKeywords?: string[];
  
  // Backward compatibility
  skill?: AssessmentSkill;
  response_mode?: 'audio' | 'typed' | 'mcq';
  stimulus?: string;
  rubricId?: string;
  discriminationValue?: number; // Legacy
};

/** Record of a single answered question */
export type AnswerRecord = {
  taskId: string;
  questionId: string;
  skill: AssessmentSkill;
  difficulty: number;
  correct: boolean;
  score: number;
  answer: string;
  responseTimeMs: number;
  /** Question format for task-type-aware scoring */
  taskType?: QuestionType;
  /** LLM-derived output band when divergence is detected */
  outputBandOverride?: DifficultyBand;
  /** Speaking-specific: how the learner responded */
  responseMode?: ResponseMode;
  /** Speaking-specific: full submission metadata */
  speakingMeta?: SpeakingSubmissionMeta;
  /** Correct answer to be saved to db logs */
  correctAnswer?: string;
  /** Model A Analysis */
  /** Item CEFR level from question bank */
  questionLevel?: string;
  /** Estimated user CEFR level at time of answer */
  userLevel?: string;
  /** Category (synchronized with skill for now) */
  category?: string;
  /** Deprecated: use questionLevel or userLevel instead */
  level?: string;
  /** Legacy fallbacks */
  isCorrect?: boolean;
  timestamp?: string;
};

export type AssessmentStability = "stable" | "emerging" | "fragile" | "insufficient_data";

/** Per-skill level estimate with evidence tracking */
export type SkillEstimate = {
  band: BandLabel;
  /** 0-100 normalized score */
  score: number;
  /** Strict [0,1] confidence probability */
  confidence: number;
  /** Stability estimation */
  stability: AssessmentStability;
  /** Formal uncertainty parameter (1 - confidence approx) */
  uncertainty: number;
  /** Number of specific tasks/channels contributing to this skill */
  evidenceCount: number;
  /** IDs of questions answered that contributed */
  answeredTaskIds: string[];
  /** History of correct answers at each difficulty for this skill */
  bandPerformance: Partial<Record<DifficultyBand, { correct: number; total: number }>>;
  /** Evidence-based tracking */
  accumulatedEvidence: DescriptorEvidence[];
  descriptorSupport: Record<string, { support: number; contradiction: number }>;
};

/** Full adaptive state maintained during the assessment */
export type AdaptiveAssessmentState = {
  askedQuestionIds: string[];
  answerHistory: AnswerRecord[];
  taskEvaluations: TaskEvaluation[];
  overallConfidence: number;
  questionsAnswered: number;
  completed: boolean;
  /** Reason the assessment stopped */
  stopReason?: 'max_reached' | 'confidence_threshold' | 'level_stabilized' | 'pool_exhausted';
  /** Speaking evidence audit trail */
  speakingAudit: SpeakingAuditTrail;
  /** User-selected context profile for personalization */
  contextProfile?: LearnerContextProfile;
  /** Performance per topic (for feedback loops/dampening) */
  topicPerformance: Record<string, { successCount: number; failCount: number }>;
  /** Performance per domain (for feedback loops/dampening) */
  domainPerformance: Record<string, { successCount: number; failCount: number }>;
  /** Auditor Agent Deep Analysis */
  finalAuditor?: {
    final_cefr_level: string;
    overall_score: number;
    skills_breakdown: {
      Grammar: { score: number; observation: string };
      Technical_Speaking: { score: number; observation: string };
      Vocabulary: { score: number; observation: string };
    };
    diagnosis_report: string;
    is_consistent: boolean;
  };
};

/** Final structured output from the adaptive assessment */
export type AssessmentOutcome = {
  overall: {
    estimatedLevel: CefrLevel;
    confidence: number;
    rationale: string[];
  };
  overallBand: BandLabel;
  overallConfidence: number;
  skillBreakdown: Record<AssessmentSkill, {
    band: BandLabel;
    score: number;
    confidence: number;
    evidenceCount: number;
    status: SkillAssessmentStatus;
    matchedDescriptors: DescriptorEvidence[];
    missingDescriptors: string[]; // IDs of descriptors where contradiction > support
    isCapped?: boolean;
    cappedReason?: string;
    /** Speaking-only: was this skill forced to A1 due to missing voice evidence? */
    speakingFallbackApplied?: boolean;
    speakingFallbackReason?: string;
  }>;
  strengths: string[];
  weaknesses: string[];
  answerHistory: AnswerRecord[];
  totalQuestions: number;
  stopReason: string;
  /** Session-level speaking audit trail */
  speakingAudit?: SpeakingAuditTrail;
  /** AI-generated personalized recommendations */
  recommendations?: string[];
  /** Model B Deep Analysis */
  finalLevel?: CefrLevel;
  bridgeDelta?: string;
  bridgePercentage?: number;
  missingSkills?: string[];
  actionPlan?: string[];
  errorAnalysisReport?: string;
  /** Full Auditor Diagnosis */
  auditorReport?: {
    final_cefr_level: string;
    overall_score: number;
    skills_breakdown: {
      Grammar: { score: number; observation: string };
      Technical_Speaking: { score: number; observation: string };
      Vocabulary: { score: number; observation: string };
    };
    diagnosis_report: string;
    is_consistent: boolean;
  };
  aiAnalysis?: any;
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
