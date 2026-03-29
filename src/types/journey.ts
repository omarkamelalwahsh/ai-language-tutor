// ============================================================================
// Journey / Progress Types
// ============================================================================
// Data model for the Progress / Level Journey experience.
// Designed as a clean interface so mock data can be swapped for backend data.
// ============================================================================

export type CEFRLevelId = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface DayActivity {
  /** ISO date string (YYYY-MM-DD) */
  readonly date: string;
  readonly completed: boolean;
  /** Number of sessions on this day. 0 or undefined = inactive. */
  readonly sessionCount?: number;
}

export interface TrainingProgress {
  readonly currentLevel: CEFRLevelId;
  readonly targetLevel: CEFRLevelId;
  readonly estimatedMonthsToNextLevel: number;
  /** 0-100 progress toward the next level */
  readonly progressPercent: number;
  readonly totalTrainingDays: number;
  readonly currentStreak: number;
  readonly longestStreak?: number;
  /** ISO date strings of all completed training days */
  readonly completedDates: readonly string[];
  /** Activity data for the current month view */
  readonly monthlyActivity: readonly DayActivity[];
}
