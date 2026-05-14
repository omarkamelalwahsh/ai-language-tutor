export const DB_SCHEMA = {
  TABLES: {
    PROFILES: 'learner_profiles',
    SKILLS: 'skill_states',
    LOGS: 'assessment_logs'
  },
  COLUMNS: {
    LEVEL: 'overall_level',
    ONBOARDING: 'onboarding_complete', // المسمى المعتمد
    POINTS: 'xp_points',
    SKILL_SCORE: 'current_score',
    HAS_COMPLETED: 'has_completed_assessment',
    STREAK: 'current_streak'
  }
} as const;
