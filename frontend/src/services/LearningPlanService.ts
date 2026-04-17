import { LearnerModelSnapshot, LearningPlan, CEFRLevel, SessionBlueprint } from '../types/learner-model';
import { AssessmentSessionResult, SkillAssessmentResult } from '../types/assessment';

/**
 * Generates a structured first learning plan from the LearnerModel or AssessmentOutcome.
 * Adapts by learner segment (casual/serious/professional), confidence, and skill profile.
 */
export class LearningPlanService {

  public static generatePlanFromAssessment(
    result: AssessmentSessionResult,
    segment: 'casual' | 'serious' | 'professional' | null = 'serious'
  ): LearningPlan {
    const focusSkill = this.selectFocusSkill(result);
    const supportProfile = this.getSupportProfileFromResult(result);
    const segmentLabel = segment || 'serious';

    return {
      primaryObjective: this.getPrimaryObjective(result.overall.estimatedLevel as CEFRLevel, focusSkill, segmentLabel),
      secondaryObjective: `Bridge specific gaps in ${focusSkill} identified during assessment.`,
      targetSkills: Object.keys(result.skills),
      initialSupportProfile: supportProfile,
      recommendedSessionBlueprint: {
        focusSkill,
        taskSequence: this.buildTaskSequence(focusSkill, supportProfile),
        estimatedMinutes: segmentLabel === 'casual' ? 10 : 20,
        supportLevel: supportProfile === 'scaffolded' ? 'high' : 'medium',
      },
      earlyReviewTargets: result.skills[focusSkill as any]?.weaknesses || [],
      motivationStyleHint: 'progress-driven',
      pacingHint: 'Standard pacing based on assessment result.',
      confidenceSupportHint: this.getConfidenceHintFromResult(result),
      suggestedDashboardPriorities: this.getPrioritiesFromResult(result)
    };
  }

  private static selectFocusSkill(result: AssessmentSessionResult): string {
    const priorities = ['fragile', 'emerging', 'insufficient_data'];
    for (const p of priorities) {
      const match = Object.values(result.skills).find(s => s.status === p);
      if (match) return match.skill;
    }
    return 'writing';
  }

  private static getSupportProfileFromResult(result: AssessmentSessionResult): 'scaffolded' | 'guided' | 'independent' {
    const hasFragile = Object.values(result.skills).some(s => s.status === 'fragile');
    if (hasFragile) return 'scaffolded';
    return 'guided';
  }

  private static getConfidenceHintFromResult(result: AssessmentSessionResult): string {
    const fragileSkills = Object.values(result.skills).filter(s => s.status === 'fragile').map(s => s.skill);
    if (fragileSkills.length > 0) {
      return `Confidence is fragile in ${fragileSkills.join(', ')}. Use scaffolded tasks.`;
    }
    return 'Confidence is steady. Ready for independent practice.';
  }

  private static getPrioritiesFromResult(result: AssessmentSessionResult): string[] {
    const priorities: string[] = [];
    Object.values(result.skills).forEach(({ status, skill }) => {
        if (status === 'fragile') priorities.push(`Urgent: Stabilize ${skill}`);
        if (status === 'emerging') priorities.push(`Explore: Grow ${skill}`);
    });
    return priorities.slice(0, 3);
  }

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
    const { skills } = model;
    let weakest = 'speaking';
    let lowestScore = 100;
    for (const [key, { score }] of Object.entries(skills)) {
      if (score < lowestScore) { lowestScore = score; weakest = key; }
    }
    return weakest;
  }

  private static findStrongestSkill(model: LearnerModelSnapshot): string {
    const { skills } = model;
    let strongest = 'speaking';
    let highestScore = 0;
    for (const [key, { score }] of Object.entries(skills)) {
      if (score > highestScore) { highestScore = score; strongest = key; }
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
    const { confidence, pacing } = model;
    if (confidence.state === 'fragile' || pacing.profile === 'fragile') return 'scaffolded';
    if (confidence.state === 'resilient' && pacing.profile === 'fast') return 'independent';
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
