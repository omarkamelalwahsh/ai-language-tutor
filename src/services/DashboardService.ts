import { AssessmentSessionResult, SkillName } from '../types/assessment';
import { AdvancedDashboardPayload } from '../types/dashboard';
import { JourneyService } from './JourneyService';
import { getNextBand } from '../lib/cefr-utils';

export class DashboardService {
  public static buildPayload(result: AssessmentSessionResult | null): AdvancedDashboardPayload {
    const currentLevel = result?.overall?.estimatedLevel || 'A1';
    const targetLevel = getNextBand(currentLevel);

    return {
      isNewLearner: !result,
      primaryGoalText: result?.overall?.rationale?.[0] || result?.overallBand || `Building toward ${targetLevel}.`,
      recommendedNextAction: {
        label: result?.recommendedNextTasks?.[0] || 'Start Practice',
        actionId: 'practice_1',
        reason: 'Based on your diagnostic evidence.'
      },
      journey: {
        ...(result?.overall ? JourneyService.buildJourney(result) : {
          currentStage: 'A1',
          targetStage: 'A2',
          journeyTitle: 'Initial Path',
          nodes: []
        }),
        currentCapabilitiesSummary: result?.overall?.rationale?.join('. ') || 'Beginning your path.',
        targetCapabilitiesSummary: `Progressing towards ${targetLevel} benchmarks.`,
      },
      skillAnalytics: result?.skills 
        ? (Object.keys(result.skills) as SkillName[])
            .filter(s => ['speaking', 'writing', 'listening', 'vocabulary'].includes(s))
            .map(skillId => {
              const res = result.skills[skillId];
              return {
                skillId: skillId as any,
                currentScore: Math.round(((res?.masteryScore ?? res?.confidence?.score) || 0) * 100),
                progressDirection: 'up' as const,
                stability: res?.status === 'stable' ? 'stable' : 'fragile',
                isPriority: res?.status === 'fragile' || res?.status === 'insufficient_data',
                hasReviewPressure: (res?.weaknesses?.length || 0) > 0,
                confidenceBand: res?.confidence?.band || 'low',
              };
            })
        : [],
      focusAreas: result?.skills ? Object.values(result.skills).flatMap(s => s?.weaknesses || []).slice(0, 5) : [],
      reviewQueue: result?.skills ? Object.values(result.skills).flatMap(s => s?.weaknesses || []).map((w, i) => ({
        itemId: `w${i}`,
        type: 'grammar' as const,
        label: w,
        dueStatus: 'due' as const,
        fragility: 'medium' as const,
      })) : [],
      weeklyRhythm: { streakDays: 0, sessionsThisWeek: 0, momentumState: 'building' },
      achievements: []
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
