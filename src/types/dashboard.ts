export interface MilestoneBlock {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'current' | 'locked';
  estimatedDuration: string;
}

export interface LearnerJourneyPayload {
  currentStage: string;
  targetStage: string;
  journeyTitle: string;
  currentCapabilitiesSummary: string;
  targetCapabilitiesSummary: string;
  milestones: MilestoneBlock[];
}

export interface SkillAnalyticsPayload {
  skillId: 'speaking' | 'writing' | 'listening' | 'vocabulary';
  currentScore: number;
  progressDirection: 'up' | 'flat' | 'down';
  stability: 'stable' | 'fragile';
  isPriority: boolean;
  hasReviewPressure: boolean;
  confidenceBand: 'high' | 'medium' | 'low';
}

export interface ReviewItemPayload {
  itemId: string;
  type: 'word' | 'grammar' | 'pronunciation';
  label: string;
  dueStatus: 'due' | 'overdue' | 'monitoring';
  fragility: 'high' | 'medium' | 'low';
}

export interface AdvancedDashboardPayload {
  primaryGoalText: string;
  recommendedNextAction: {
    label: string;
    actionId: string;
    reason: string;
  };
  journey: LearnerJourneyPayload;
  skillAnalytics: SkillAnalyticsPayload[];
  focusAreas: string[];
  reviewQueue: ReviewItemPayload[];
  weeklyRhythm: {
    streakDays: number;
    sessionsThisWeek: number;
    momentumState: 'building' | 'steady' | 'recovering';
  };
}
