import { AssessmentSessionResult, SkillName } from '../types/assessment';
import { AdvancedDashboardPayload } from '../types/dashboard';
import { JourneyService } from './JourneyService';
import { getNextBand } from '../lib/cefr-utils';

export class DashboardService {
  public static buildPayload(result: AssessmentSessionResult): AdvancedDashboardPayload {
    const currentLevel = result.overall.estimatedLevel;
    const targetLevel = getNextBand(currentLevel);

    return {
      isNewLearner: true, // Typically true after first assessment
      primaryGoalText: result.overall.rationale[0] || `Building toward ${targetLevel}.`,
      recommendedNextAction: {
        label: result.recommendedNextTasks[0] || 'Start Practice',
        actionId: 'practice_1',
        reason: 'Based on your diagnostic evidence.'
      },
      journey: {
        ...JourneyService.buildJourney(result),
        currentCapabilitiesSummary: result.overall.rationale.join('. '),
        targetCapabilitiesSummary: `Progressing towards ${targetLevel} benchmarks.`,
      },
      skillAnalytics: (Object.keys(result.skills) as SkillName[])
        .filter(s => ['speaking', 'writing', 'listening', 'vocabulary'].includes(s))
        .map(skillId => {
          const res = result.skills[skillId];
          return {
            skillId: skillId as any,
            currentScore: Math.round(res.confidence.score * 100), // Use confidence as a proxy for 'mastery' in UI
            progressDirection: 'up' as const,
            stability: res.status === 'stable' ? 'stable' : 'fragile',
            isPriority: res.status === 'fragile' || res.status === 'insufficient_data',
            hasReviewPressure: res.weaknesses.length > 0,
            confidenceBand: res.confidence.band,
          };
        }),
      focusAreas: Object.values(result.skills).flatMap(s => s.weaknesses).slice(0, 5),
      reviewQueue: Object.values(result.skills).flatMap(s => s.weaknesses).map((w, i) => ({
        itemId: `w${i}`,
        type: 'grammar' as const,
        label: w,
        dueStatus: 'due' as const,
        fragility: 'medium' as const,
      })),
      weeklyRhythm: { streakDays: 0, sessionsThisWeek: 0, momentumState: 'building' }
    };
  }

  /** Returns subskill data from the real assessment results */
  public static getSubskills(skillId: string, result: AssessmentSessionResult): { name: string; value: number }[] {
    const skillRes = result.skills[skillId as SkillName];
    if (!skillRes) return [];
    
    return skillRes.subscores.map(s => ({
      name: s.name,
      value: Math.round(s.value * 100)
    }));
  }
}
