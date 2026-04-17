/**
 * CEFR level utility functions to manage progression and normalization strictly.
 */

export const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type BaseCEFRLevel = typeof CEFR_ORDER[number];

/**
 * Normalizes a plus-level to its base band.
 * Examples: 'B1+' -> 'B1', 'Pre-A1' -> 'A1', 'A2' -> 'A2'
 */
export function normalizeBand(level: string): BaseCEFRLevel {
  if (!level) return 'A1';
  
  // Handle ranges like B1_B2 or B2-C1 by taking the first part
  const firstPart = level.split(/[_-]/)[0];
  const normalized = firstPart.toUpperCase().replace('+', '') as BaseCEFRLevel;
  
  if (normalized === 'PRE-A1' as any) return 'A1';
  if (CEFR_ORDER.includes(normalized)) return (normalized as any);
  return 'A1'; // Fallback
}

/**
 * Returns the index of the base band in the canonical order.
 */
export function getBandOrder(level: string): number {
  return CEFR_ORDER.indexOf(normalizeBand(level));
}

/**
 * Returns the next logical CEFR progression target.
 * Always returns a strictly higher valid level unless currently at C2.
 * Examples: 'A2+' -> 'B1', 'B1' -> 'B2', 'C2' -> 'C2'
 */
export function getNextBand(level: string): BaseCEFRLevel {
  const currentIndex = getBandOrder(level);
  if (currentIndex < 0) return 'A2'; // Default fallback step
  if (currentIndex >= CEFR_ORDER.length - 1) return 'C2'; // Top cap
  return CEFR_ORDER[currentIndex + 1];
}

/**
 * Returns true if bandA is logically higher than bandB.
 */
export function isHigherBand(bandA: string, bandB: string): boolean {
  return getBandOrder(bandA) > getBandOrder(bandB);
}
