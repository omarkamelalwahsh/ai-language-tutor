/**
 * Numeric guard utilities for safe arithmetic in the scoring pipeline.
 * All functions are pure and deterministic.
 */

/** Clamp a value to [0, 1]. Returns 0 for NaN/undefined/null. */
export function clamp01(x: number | undefined | null): number {
  if (x === undefined || x === null || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/** Safe division that returns `fallback` when divisor is zero or result is non-finite. */
export function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  if (denominator === 0 || !Number.isFinite(denominator)) return fallback;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

/** Returns `x` if it is a finite number, otherwise returns `fallback`. */
export function finiteOr(x: number | undefined | null, fallback: number): number {
  if (x === undefined || x === null || !Number.isFinite(x)) return fallback;
  return x;
}

/** Returns x clamped to the range [min, max]. Handles NaN/finite guards. */
export function clamp(x: number | undefined | null, min: number, max: number): number {
  if (x === undefined || x === null || !Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}
