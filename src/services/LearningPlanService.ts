import { LearnerModelSnapshot, LearningPlan, CEFRLevel } from '../types/learner-model';

/**
 * Generates a structured first learning plan from the LearnerModel.
 * Adapts by learner segment (casual/serious/professional), confidence, and skill profile.
 */
export class LearningPlanService {

  public static generatePlan(
    model: LearnerModelSnapshot,
    segment: 'casual' | 'serious' | 'professional' | null
  ): LearningPlan {

    const weakestSkill = this.findWeakestSkill(model);
    const strongestSkill = this.findStrongestSkill(model);
    const prioritySkills = this.getPrioritySkills(model);
    const segmentLabel = segment || 'serious';

    const motivationHint = this.getMotivationHint(segmentLabel, model.confidence.state);
    const supportProfile = this.getSupportProfile(model);

    return {
      primaryObjective: this.getPrimaryObjective(model.overallLevel, weakestSkill, segmentLabel),
      secondaryObjective: `Reinforce existing strength in ${strongestSkill} to maintain momentum.`,
      targetSkills: prioritySkills,
      initialSupportProfile: supportProfile,
      recommendedSessionBlueprint: {
        focusSkill: weakestSkill,
        secondarySkill: prioritySkills.length > 1 ? prioritySkills[1] : undefined,
        taskSequence: this.buildTaskSequence(weakestSkill, supportProfile),
        estimatedMinutes: segmentLabel === 'casual' ? 10 : segmentLabel === 'professional' ? 20 : 15,
        supportLevel: supportProfile === 'scaffolded' ? 'high' : supportProfile === 'guided' ? 'medium' : 'low',
      },
      earlyReviewTargets: model.retention.initialReviewQueue.slice(0, 4),
      motivationStyleHint: motivationHint,
      pacingHint: this.getPacingHint(model),
      confidenceSupportHint: this.getConfidenceSupportHint(model.confidence.state),
      suggestedDashboardPriorities: [
        `Focus on ${weakestSkill} improvement`,
        ...model.interpretation.growthZones.slice(0, 2),
        `Review: ${model.errors.length > 0 ? model.errors[0].type : 'General vocabulary'}`,
      ]
    };
  }

  private static findWeakestSkill(model: LearnerModelSnapshot): string {
    const skills = model.skills;
    let weakest = 'speaking';
    let lowestScore = 100;
    for (const [key, val] of Object.entries(skills)) {
      if (val.score < lowestScore) { lowestScore = val.score; weakest = key; }
    }
    return weakest;
  }

  private static findStrongestSkill(model: LearnerModelSnapshot): string {
    const skills = model.skills;
    let strongest = 'speaking';
    let highestScore = 0;
    for (const [key, val] of Object.entries(skills)) {
      if (val.score > highestScore) { highestScore = val.score; strongest = key; }
    }
    return strongest;
  }

  private static getPrioritySkills(model: LearnerModelSnapshot): string[] {
    return Object.entries(model.skills)
      .sort(([, a], [, b]) => a.score - b.score)
      .map(([k]) => k)
      .slice(0, 2);
  }

  private static getPrimaryObjective(level: CEFRLevel, weakest: string, segment: string): string {
    const levelGoals: Record<string, string> = {
      'casual': `Build comfortable, everyday ${weakest} ability at the ${level} level.`,
      'serious': `Systematically strengthen ${weakest} to advance beyond ${level}.`,
      'professional': `Develop confident professional ${weakest} competence at ${level} and above.`,
    };
    return levelGoals[segment] || levelGoals['serious'];
  }

  private static getSupportProfile(model: LearnerModelSnapshot): 'scaffolded' | 'guided' | 'independent' {
    if (model.confidence.state === 'fragile' || model.pacing.profile === 'fragile') return 'scaffolded';
    if (model.confidence.state === 'resilient' && model.pacing.profile === 'fast') return 'independent';
    return 'guided';
  }

  private static buildTaskSequence(focusSkill: string, support: string): string[] {
    if (support === 'scaffolded') {
      return ['vocabulary_warmup', `${focusSkill}_guided`, 'review_consolidation'];
    }
    return [`${focusSkill}_practice`, 'cross_skill_challenge', 'review_consolidation'];
  }

  private static getMotivationHint(segment: string, confidence: string): 'encouragement-heavy' | 'progress-driven' | 'challenge-seeking' {
    if (confidence === 'fragile' || segment === 'casual') return 'encouragement-heavy';
    if (segment === 'professional') return 'challenge-seeking';
    return 'progress-driven';
  }

  private static getPacingHint(model: LearnerModelSnapshot): string {
    const p = model.pacing.profile;
    if (p === 'slow' || p === 'fragile') return 'Shorter tasks with more support. Build rhythm gradually.';
    if (p === 'fast') return 'Lean sessions with less scaffolding. Challenge early.';
    return 'Balanced pacing with a mix of guided and independent tasks.';
  }

  private static getConfidenceSupportHint(state: string): string {
    const map: Record<string, string> = {
      'fragile': 'Start with confidence-building tasks. Celebrate small wins. Avoid overwhelming open-ended prompts.',
      'steady': 'Mix guided and exploratory tasks. Provide encouragement after difficult tasks.',
      'resilient': 'Challenge freely. This learner recovers well from mistakes.',
      'stable-beginner': 'Keep tasks short and well-defined. Build foundational confidence first.',
    };
    return map[state] || map['steady'];
  }
}
