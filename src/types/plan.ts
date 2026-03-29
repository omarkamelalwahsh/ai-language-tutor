import { SkillType } from './assessment';
import { CEFRLevel } from './learner-model';

export interface ModuleDefinition {
  id: string;
  title: string;
  skill: SkillType;
  estimatedMinutes: number;
  priority: number;
  type: 'core' | 'reinforcement' | 'challenge';
}

export interface LearningSchedule {
  dailyMinutes: number;
  sessionsPerWeek: number;
  weeklyMomentum: string;
}

export interface LearningPlan {
  planId: string;
  generatedAt: string;
  levelTarget: CEFRLevel;
  primarySkillFocus: SkillType;
  secondarySkillFocus: SkillType | null;
  moduleSequence: ModuleDefinition[];
  supportProfile: 'scaffolded' | 'guided' | 'independent';
  reviewPriorities: string[];
  schedule: LearningSchedule;
}
