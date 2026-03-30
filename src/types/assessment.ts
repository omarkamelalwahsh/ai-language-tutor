import { CEFRLevel } from './learner-model';

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
  grammarEfficiency: number; // 0-1
  lexicalDiversity: number;  // 0-1
  connectorsCount: number;
  keywordMatch: number;      // 0-1
  accuracy: number;          // 0-1
  latencyMs: number;
}

// --- NEW ADAPTIVE TYPES ---

export type DifficultyBand = "A1" | "A2" | "B1" | "B2" | "C1";

export type AssessmentSkill =
  | "grammar"
  | "vocabulary"
  | "reading"
  | "listening_proxy"
  | "writing"
  | "speaking_proxy";

export type AssessmentQuestion = {
  id: string;
  skill: AssessmentSkill;
  difficulty: DifficultyBand;
  type: "multiple_choice" | "short_text";
  prompt: string;
  options?: string[]; // strictly for multiple_choice
  correctAnswer?: string | string[]; // for exact match or includes
  evaluationMode: "exact" | "includes" | "manual_rule";
};

export type QuestionResult = {
  questionId: string;
  isCorrect: boolean;
  score: number;
  answer: string;
  responseTimeMs: number;
};

export type AdaptiveState = {
  currentBand: DifficultyBand;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  questionsAnswered: number;
  history: QuestionResult[];
};
