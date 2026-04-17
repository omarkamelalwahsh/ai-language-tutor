/**
 * CEFR to Numerical Mapping Utility
 * Converts CEFR string levels (A1, B1, etc.) to numerical values for charts.
 * 
 * Linear Scale:
 * A1: 1.0 | A2: 2.0
 * B1: 3.0 | B2: 4.0
 * C1: 5.0 | C2: 6.0
 * 
 * Mid-points (e.g. B1+) map to .5 steps.
 */

export const cefrToNumeric = (level: string | null | undefined): number => {
  if (!level) return 0;
  
  const normalized = level.toUpperCase().trim();
  
  const mapping: Record<string, number> = {
    'A1': 1.0, 'A1+': 1.5,
    'A2': 2.0, 'A2+': 2.5,
    'B1': 3.0, 'B1+': 3.5,
    'B2': 4.0, 'B2+': 4.5,
    'C1': 5.0, 'C1+': 5.5,
    'C2': 6.0, 'C2+': 6.5
  };
  
  return mapping[normalized] || 0;
};

/**
 * Converts a numerical score back to the nearest CEFR level.
 */
export const numericToCefr = (score: number): string => {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const index = Math.round(score) - 1;
  return levels[index] || 'N/A';
};
