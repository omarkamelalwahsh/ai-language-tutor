export type CEFRLevel = 'Pre-A1' | 'A1' | 'A1+' | 'A2' | 'A2+' | 'B1' | 'B1+' | 'B2' | 'B2+' | 'C1' | 'C2';

export interface SkillDimension {
  level: CEFRLevel;
  score: number; // 0-100 normalized
  confidence: number; // 0-1 (certainty based on evidence volume)
  subskills?: Record<string, number>;
}

export interface ErrorPattern {
  type: string;
  evidenceStrength: number; // 0-1
  severity: 'low' | 'medium' | 'high';
  affectedSkills: string[];
  remediationPriority: number;
}

export interface LearnerModelSnapshot {
  version: string;
  timestamp: string;
  overallLevel: CEFRLevel;
  
  // The 5 Core Sub-models
  skills: {
    speaking: SkillDimension;
    writing: SkillDimension;
    listening: SkillDimension;
    vocabulary: SkillDimension;
  };
  errors: ErrorPattern[];
  retention: {
    initialReviewQueue: string[];
    itemStrengthDefault: number;
  };
  pacing: {
    profile: 'slow' | 'moderate' | 'fast' | 'support-sensitive' | 'fragile';
    avgLatencyMs: number;
    hesitationIndex: number; 
  };
  confidence: {
    state: 'fragile' | 'steady' | 'resilient' | 'stable-beginner';
    selfCorrectionRate: number;
  };

  interpretation: {
    currentCapacities: string[];
    growthZones: string[];
    recommendedPathId: string;
  };
}

// ---- Learning Plan (Prompt 03) ---- //
export interface LearningPlan {
  primaryObjective: string;
  secondaryObjective?: string;
  targetSkills: string[];
  initialSupportProfile: 'scaffolded' | 'guided' | 'independent';
  recommendedSessionBlueprint: SessionBlueprint;
  earlyReviewTargets: string[];
  motivationStyleHint: 'encouragement-heavy' | 'progress-driven' | 'challenge-seeking';
  pacingHint: string;
  confidenceSupportHint: string;
  suggestedDashboardPriorities: string[];
}

export interface SessionBlueprint {
  focusSkill: string;
  secondarySkill?: string;
  taskSequence: string[];
  estimatedMinutes: number;
  supportLevel: 'high' | 'medium' | 'low';
}

// ---- Writeback (Prompt 05) ---- //
export interface WritebackPayload {
  skillDeltas: Partial<Record<'speaking' | 'writing' | 'listening' | 'vocabulary', number>>;
  newErrorPatterns: Partial<ErrorPattern>[];
  retentionUpdates: { itemId: string; newStrength: number }[];
  behavioralSignals: {
    avgResponseTimeMs: number;
    totalHintsUsed: number;
    totalRetries: number;
    skipCount: number;
    supportDependenceLevel: 'high' | 'medium' | 'low';
  };
}

// ---- Session History (Prompt 04) ---- //
export interface SessionHistoryEntry {
  sessionId: string;
  timestamp: string;
  focusSkill: string;
  tasksCompleted: number;
  avgScore: number;
  notableOutcome: string;
  confidenceImpact: 'increased' | 'decreased' | 'stable';
}
