export type SupportedSkillTask = 'speaking' | 'writing' | 'listening' | 'vocabulary';

export interface SessionTask {
  taskId: string;
  taskType: SupportedSkillTask;
  targetSkill: string;
  learningObjective: string;
  prompt: string;
  supportSettings: {
    allowHints: boolean;
    allowReplay: boolean;
    allowSlowAudio?: boolean;
    allowTranscript?: boolean;
    maxRetries: number;
  };
  difficultyTarget: string;
  completionCondition: string;
  // Module-specific generic payload for details like audio URLs, vocab lists, etc.
  payload?: any; 
}

export interface TaskEvaluationResult {
  taskId: string;
  taskType: SupportedSkillTask;
  successScore: number; // 0-100
  dimensions: Record<string, number>; // e.g. { fluency: 80, pronunciation: 60 }
  hintUsage: number;
  retryCount: number;
  responseTimeMs: number;
  supportDependence: 'high' | 'medium' | 'low';
  meaningSuccess: boolean;
  naturalnessSuccess: boolean;
}

export interface TaskFeedbackPayload {
  taskId: string;
  feedbackType: 'hint' | 'correction' | 'praise' | 'remediation';
  primaryMessage: string;
  secondaryMessage?: string;
  suggestedRetryConstraint?: string; // e.g., "Use the past tense this time"
  modelAnswer?: string; // Revealed only if necessary
  canAdvance: boolean;
}
