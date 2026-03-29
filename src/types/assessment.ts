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
