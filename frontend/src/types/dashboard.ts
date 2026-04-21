export interface JourneyNode {
  id: string;
  type: 'task' | 'checkpoint' | 'milestone';
  status: 'completed' | 'current' | 'locked';
  title: string;
  description: string;
  iconType: 'speaking' | 'writing' | 'listening' | 'vocabulary' | 'assessment' | 'grammar';
  estimatedDuration?: string;
  skillFocus?: 'remediation' | 'progression';
}

export interface LearnerJourneyPayload {
  currentStage: string;
  targetStage: string;
  journeyTitle: string;
  currentCapabilitiesSummary: string;
  targetCapabilitiesSummary: string;
  nodes: JourneyNode[];
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

export interface AchievementPayload {
  id: string;
  badgeId: string;
  name: string;
  type: 'milestone' | 'skill_mastery' | 'streak' | 'challenge';
  earnedAt: string;
  description: string;
}

export interface AdvancedDashboardPayload {
  isNewLearner: boolean;
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
  achievements: AchievementPayload[];
  error_profile?: {
    weakness_areas: string[];
    error_rates: any[];
  };
  intelligence_feed?: {
    action_plan: string;
    recent_insights?: any[];
  };
  trends?: any[];
  isSyncing?: boolean; // Circuit Breaker state
  lastFullSync?: string;
  weeklyRhythm: {
    streakDays: number;
    sessionsThisWeek: number;
    momentumState: 'building' | 'steady' | 'recovering';
  };
}
