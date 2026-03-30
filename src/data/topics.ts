// ============================================================================
// Topic Definitions
// ============================================================================
// Centralized topic config for onboarding and future personalization.
// Used by: onboarding flow, lesson planner, challenge selection, dashboard.
// ============================================================================

export type TopicId =
  | 'travel'
  | 'technology'
  | 'business'
  | 'daily_life'
  | 'culture'
  | 'sports'
  | 'education'
  | 'entertainment'
  | 'health'
  | 'science';

export interface TopicDefinition {
  readonly id: TopicId;
  readonly label: string;
  readonly emoji: string;
  readonly description: string;
}

export const TOPIC_DEFINITIONS: readonly TopicDefinition[] = [
  { id: 'daily_life',     label: 'Daily Life',     emoji: '🏠', description: 'Routines, shopping, cooking, and everyday situations' },
  { id: 'travel',         label: 'Travel',         emoji: '✈️', description: 'Airports, hotels, navigation, and travel experiences' },
  { id: 'business',       label: 'Business',       emoji: '💼', description: 'Meetings, emails, negotiation, and professional topics' },
  { id: 'technology',     label: 'Technology',      emoji: '💻', description: 'Digital tools, software, internet, and innovation' },
  { id: 'culture',        label: 'Culture',         emoji: '🎭', description: 'Art, traditions, festivals, and cultural exchange' },
  { id: 'education',      label: 'Education',       emoji: '📚', description: 'School, studying, exams, and academic life' },
  { id: 'health',         label: 'Health',          emoji: '🏥', description: 'Fitness, wellness, medical situations, and nutrition' },
  { id: 'entertainment',  label: 'Entertainment',   emoji: '🎬', description: 'Movies, music, games, and social media' },
  { id: 'sports',         label: 'Sports',          emoji: '⚽', description: 'Competitions, fitness activities, and team sports' },
  { id: 'science',        label: 'Science',         emoji: '🔬', description: 'Nature, discoveries, experiments, and environment' },
] as const;

/** Get topic definitions by IDs */
export function getTopicsByIds(ids: readonly TopicId[]): TopicDefinition[] {
  return TOPIC_DEFINITIONS.filter(t => ids.includes(t.id));
}

/** All topic IDs for validation */
export const ALL_TOPIC_IDS: readonly TopicId[] = TOPIC_DEFINITIONS.map(t => t.id);

export type GoalId = 'casual' | 'serious' | 'professional';

export const GOAL_TOPIC_MAPPING: Record<GoalId, readonly TopicId[]> = {
  casual: ['daily_life', 'travel', 'culture', 'entertainment', 'sports'],
  serious: ['education', 'science', 'technology', 'culture', 'health'],
  professional: ['business', 'technology', 'education', 'daily_life', 'travel'],
} as const;

/** Sort topics prioritizing recommended topics for a given goal */
export function getSortedTopicsForGoal(goal: GoalId | null): { recommended: TopicDefinition[], other: TopicDefinition[] } {
  if (!goal) return { recommended: [], other: [...TOPIC_DEFINITIONS] };
  
  const recommendedIds = GOAL_TOPIC_MAPPING[goal];
  const recommended = TOPIC_DEFINITIONS.filter(t => recommendedIds.includes(t.id))
    .sort((a, b) => recommendedIds.indexOf(a.id) - recommendedIds.indexOf(b.id));
    
  const other = TOPIC_DEFINITIONS.filter(t => !recommendedIds.includes(t.id));
  
  return { recommended, other };
}
