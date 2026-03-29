// ============================================================================
// Mock Journey Data
// ============================================================================
// Isolated mock data source for the Progress / Level Journey feature.
// Replace this module's export with a real backend fetch when ready.
// ============================================================================

import { TrainingProgress, DayActivity } from '../types/journey';

/**
 * Generate mock monthly activity for the current month.
 * Simulates a learner who has been training semi-regularly.
 */
function generateCurrentMonthActivity(): DayActivity[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const activity: DayActivity[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (day > today) {
      // Future days: not yet completed
      activity.push({ date: dateStr, completed: false });
      continue;
    }

    // Semi-realistic pattern: train ~5 days/week, skip some weekends
    const dayOfWeek = new Date(year, month, day).getDay(); // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const rand = pseudoRandom(day + month * 31);

    if (isWeekend) {
      // 30% chance of training on weekends
      const completed = rand < 0.3;
      activity.push({
        date: dateStr,
        completed,
        sessionCount: completed ? 1 : 0,
      });
    } else {
      // 80% chance of training on weekdays
      const completed = rand < 0.8;
      const sessionCount = completed ? (rand < 0.2 ? 2 : 1) : 0;
      activity.push({
        date: dateStr,
        completed,
        sessionCount,
      });
    }
  }

  return activity;
}

/** Deterministic pseudo-random for consistent mock data between renders. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function generateCompletedDates(activity: DayActivity[]): string[] {
  return activity.filter(d => d.completed).map(d => d.date);
}

const monthlyActivity = generateCurrentMonthActivity();
const completedDates = generateCompletedDates(monthlyActivity);

export const mockTrainingProgress: TrainingProgress = {
  currentLevel: 'A2',
  targetLevel: 'B1',
  estimatedMonthsToNextLevel: 3,
  progressPercent: 62,
  totalTrainingDays: completedDates.length + 38, // simulate prior months too
  currentStreak: 5,
  longestStreak: 12,
  completedDates,
  monthlyActivity,
};
