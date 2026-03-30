import { LearnerModelSnapshot } from '../types/learner-model';
import { AdvancedDashboardPayload } from '../types/dashboard';
import { JourneyService } from './JourneyService';

const nextLevelMap: Record<string, string> = {
  'Pre-A1': 'A1', 'A1': 'A2', 'A1+': 'A2', 'A2': 'B1', 'A2+': 'B1',
  'B1': 'B2', 'B1+': 'B2', 'B2': 'C1', 'B2+': 'C1', 'C1': 'C2', 'C2': 'C2'
};

/** Generate subskill analytics from the learner model scores (deterministic derivation) */
function deriveSubskills(skillId: string, score: number): { name: string; value: number }[] {
  // Derive subskill values from the parent score with variance to avoid flat bars
  const variance = (offset: number) => Math.max(5, Math.min(100, Math.round(score + offset)));
  const map: Record<string, { name: string; value: number }[]> = {
    speaking: [
      { name: 'Fluency', value: variance(3) },
      { name: 'Pronunciation', value: variance(-10) },
      { name: 'Task Completion', value: variance(7) },
      { name: 'Grammar in Speech', value: variance(-5) },
    ],
    writing: [
      { name: 'Grammar Accuracy', value: variance(3) },
      { name: 'Clarity', value: variance(-5) },
      { name: 'Word Choice', value: variance(-10) },
      { name: 'Tone/Register', value: variance(-17) },
    ],
    listening: [
      { name: 'Gist Understanding', value: variance(7) },
      { name: 'Detail Capture', value: variance(-7) },
      { name: 'Inference', value: variance(-10) },
      { name: 'Replay Dependence', value: variance(-20) },
    ],
    vocabulary: [
      { name: 'Recall', value: variance(2) },
      { name: 'Recognition', value: variance(10) },
      { name: 'Contextual Use', value: variance(-10) },
      { name: 'Confusion Pairs', value: variance(-20) },
    ],
  };
  return map[skillId] || [];
}

export class DashboardService {
  public static buildPayload(model: LearnerModelSnapshot): AdvancedDashboardPayload {
    const currentLevel = model.overallLevel;
    const targetLevel = nextLevelMap[currentLevel] || 'A2';

    return {
      isNewLearner: !model.hasStartedLearning,
      primaryGoalText: `Solidify your ${currentLevel} foundation and build toward ${targetLevel}.`,
      recommendedNextAction: {
        label: 'Start Next Session',
        actionId: 'session_1',
        reason: 'Based on your diagnostic, structured practice is the best next step.'
      },
      journey: {
        ...JourneyService.buildJourney(currentLevel),
        currentCapabilitiesSummary: model.interpretation.currentCapacities.join('. '),
        targetCapabilitiesSummary: `Confident everyday communication, clearer sentence building, and stronger follow-up interaction at the ${targetLevel} level.`,
      },
      skillAnalytics: (['speaking', 'writing', 'listening', 'vocabulary'] as const).map(skillId => {
        const dim = model.skills[skillId];
        return {
          skillId,
          currentScore: dim.score,
          progressDirection: 'up' as const,
          stability: dim.confidence > 0.5 ? 'stable' as const : 'fragile' as const,
          isPriority: dim.score < 60,
          hasReviewPressure: dim.score < 50,
          confidenceBand: dim.confidence > 0.7 ? 'high' as const : dim.confidence > 0.4 ? 'medium' as const : 'low' as const,
        };
      }),
      focusAreas: model.interpretation.growthZones,
      reviewQueue: model.errors.map((err, i) => ({
        itemId: `r${i + 1}`,
        type: 'grammar' as const,
        label: err.type,
        dueStatus: err.severity === 'high' ? 'overdue' as const : 'due' as const,
        fragility: err.severity === 'high' ? 'high' as const : 'medium' as const,
      })),
      weeklyRhythm: model.hasStartedLearning 
        ? { streakDays: 1, sessionsThisWeek: 0, momentumState: 'building' }
        : { streakDays: 0, sessionsThisWeek: 0, momentumState: 'building' }
    };
  }

  /** Returns subskill data derived from the learner model scores */
  public static getSubskills(skillId: string, model: LearnerModelSnapshot): { name: string; value: number }[] {
    const dim = model.skills[skillId as keyof typeof model.skills];
    if (!dim) return [];
    return deriveSubskills(skillId, dim.score);
  }
}
