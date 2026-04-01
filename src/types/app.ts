import { TopicId } from '../data/topics';

export type ViewState = 'LANDING' | 'AUTH' | 'ONBOARDING' | 'PRE_ASSESSMENT_INTRO' | 'DIAGNOSTIC' | 'ANALYZING' | 'RESULT_ANALYSIS' | 'ASSESSMENT_REVIEW' | 'LEARNING_JOURNEY' | 'DASHBOARD' | 'LEARNING_LOOP' | 'ADMIN_DASHBOARD' | 'ADMIN_LEADERBOARD' | 'USER_LEADERBOARD';

export type UserRole = 'user' | 'admin';

export interface OnboardingState {
  goal: 'casual' | 'serious' | 'professional' | null;
  nativeLanguage: string;
  targetLanguage: string;
  focusSkills: string[];
  topics: TopicId[];
  sessionIntensity?: 'light' | 'regular' | 'intensive' | null;
  goalContext?: string | null;
}

export interface TaskModel {
  taskId: string;
  taskType: 'speaking' | 'writing' | 'visual_description' | 'vocabulary_in_context' | 'listening_comprehension';
  targetSkill: string;
  title: string;
  prompt: string;
  targetSubskills?: string[];
  difficultyTarget?: string;
}

export interface TaskResult {
  taskId: string;
  answer: string;
  responseTime: number;
  wordCount: number;
  hintUsage: number;
}

export interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  isHint?: boolean;
}
