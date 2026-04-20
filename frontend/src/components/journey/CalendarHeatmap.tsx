import React, { useMemo } from 'react';
import { DayActivity } from '../../types/journey';

interface CalendarHeatmapProps {
  /** Activity data for the month to display */
  monthlyActivity: readonly DayActivity[];
  /** Optional: override which year/month to display (defaults to current) */
  year?: number;
  month?: number; // 0-indexed (0=Jan)
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * A native React calendar grid that renders day cells aligned to correct
 * weekdays, with intensity-based coloring from `sessionCount`.
 */
export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({
  monthlyActivity,
  year: overrideYear,
  month: overrideMonth,
}) => {
  const now = new Date();
  const year = overrideYear ?? now.getFullYear();
  const month = overrideMonth ?? now.getMonth();
  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  // Build a lookup map: day number → activity
  const activityMap = useMemo(() => {
    const map = new Map<number, DayActivity>();
    for (const entry of monthlyActivity) {
      const d = new Date(entry.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        map.set(d.getDate(), entry);
      }
    }
    return map;
  }, [monthlyActivity, year, month]);

  // Calendar math
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  // Build grid cells
  const cells: (number | null)[] = [];
  // Leading empties
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  // Actual days
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      {/* Month label */}
      <p className="text-sm font-bold text-slate-700 mb-3">
        {MONTH_NAMES[month]} {year}
      </p>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map(label => (
          <div key={label} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest py-1">
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const activity = activityMap.get(day);
          const isCompleted = activity?.completed ?? false;
          const sessionCount = activity?.sessionCount ?? 0;
          const isToday = isCurrentMonth && day === today;
          const isFuture = isCurrentMonth && day > today;

          return (
            <div
              key={day}
              className={`
                aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-colors
                ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}
                ${isFuture 
                  ? 'bg-slate-50 text-slate-300' 
                  : isCompleted 
                    ? intensityClass(sessionCount) 
                    : 'bg-slate-100 text-slate-400'
                }
              `}
              title={isCompleted ? `${sessionCount} session${sessionCount > 1 ? 's' : ''}` : undefined}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-slate-100" /> Inactive
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-indigo-200" /> 1 session
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-indigo-500" /> 2+ sessions
        </div>
      </div>
    </div>
  );
};

/** Maps session count to a Tailwind intensity class. */
function intensityClass(sessionCount: number): string {
  if (sessionCount >= 3) return 'bg-blue-600 dark:bg-blue-600 text-white';
  if (sessionCount >= 2) return 'bg-indigo-500 text-white';
  return 'bg-indigo-200 text-indigo-700';
}
