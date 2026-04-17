// ============================================================================
// Forecast Logic
// ============================================================================
// Deterministic text generation for the Journey forecast card.
// No LLM or randomness — purely rule-based from progress data.
// ============================================================================

import { TrainingProgress, CEFRLevelId } from '../types/journey';

export interface ForecastMessage {
  /** Primary headline text */
  readonly headline: string;
  /** Supporting detail text */
  readonly subtext: string;
  /** Sentiment for styling hints */
  readonly sentiment: 'motivating' | 'encouraging' | 'warning' | 'celebrating';
}

/**
 * Generate a deterministic forecast message from training progress data.
 *
 * Rules (evaluated in priority order):
 * 1. Progress >= 90%  → celebration / almost there
 * 2. Progress >= 70%  → close, keep pushing
 * 3. Streak >= 7      → streak-focused motivation
 * 4. Streak === 0     → gentle warning to restart
 * 5. Months estimate  → time-based forecast
 * 6. Default          → generic encouragement
 */
export function generateForecast(progress: TrainingProgress): ForecastMessage {
  const { progressPercent, currentStreak, estimatedMonthsToNextLevel, targetLevel, currentLevel } = progress;

  // Rule 1: Almost there
  if (progressPercent >= 90) {
    return {
      headline: `You are almost at ${targetLevel}!`,
      subtext: `Just ${100 - progressPercent}% to go. A few more focused sessions and you'll reach your goal.`,
      sentiment: 'celebrating',
    };
  }

  // Rule 2: Close
  if (progressPercent >= 70) {
    return {
      headline: `You're getting close to ${targetLevel}.`,
      subtext: `At ${progressPercent}% progress, you're well on your way. Keep the momentum going.`,
      sentiment: 'motivating',
    };
  }

  // Rule 3: Strong streak
  if (currentStreak >= 7) {
    return {
      headline: `${currentStreak}-day streak! Keep it going.`,
      subtext: `Your consistency is accelerating your path to ${targetLevel}. Don't break the chain.`,
      sentiment: 'motivating',
    };
  }

  // Rule 4: Broken streak
  if (currentStreak === 0) {
    return {
      headline: `Start a new streak today.`,
      subtext: `One session today puts you back on track toward ${targetLevel}. You've got this.`,
      sentiment: 'warning',
    };
  }

  // Rule 5: Time-based
  if (estimatedMonthsToNextLevel > 0 && progressPercent >= 40) {
    return {
      headline: `You are halfway to ${targetLevel}.`,
      subtext: `At your current pace, you'll reach ${targetLevel} in about ${estimatedMonthsToNextLevel} month${estimatedMonthsToNextLevel > 1 ? 's' : ''}.`,
      sentiment: 'encouraging',
    };
  }

  if (estimatedMonthsToNextLevel > 0) {
    return {
      headline: `In ${estimatedMonthsToNextLevel} months, you could reach ${targetLevel}.`,
      subtext: `You're at ${progressPercent}% right now. Regular practice will get you there.`,
      sentiment: 'encouraging',
    };
  }

  // Rule 6: Default
  return {
    headline: `Working toward ${targetLevel}.`,
    subtext: `You're currently at ${currentLevel} with ${progressPercent}% progress. Every session counts.`,
    sentiment: 'encouraging',
  };
}

/** Human-friendly level label */
export function levelLabel(level: CEFRLevelId): string {
  const labels: Record<CEFRLevelId, string> = {
    A1: 'Beginner',
    A2: 'Elementary',
    B1: 'Intermediate',
    B2: 'Upper Intermediate',
    C1: 'Advanced',
    C2: 'Mastery',
  };
  return labels[level];
}
