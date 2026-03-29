// ============================================================================
// CEFR Reference Layer
// ============================================================================
// CEFR levels are a *reference framework*, not a direct scoring mechanism.
// We use numeric bands internally and map to CEFR for communication only.
// ============================================================================

/**
 * The 6 core CEFR levels.
 * We intentionally exclude "+" sublevels from the canonical type.
 * Instead, we model confidence bands to express "A2 emerging toward B1".
 */
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/**
 * A confidence-aware CEFR band.
 * Instead of saying "you are B1", we say "likely B1" or "A2/B1 emerging".
 * This prevents fake precision — we only claim a level when evidence supports it.
 */
export interface CEFRBand {
  /** The primary estimated level. */
  readonly primary: CEFRLevel;

  /**
   * If the learner is near a boundary, this indicates the adjacent level.
   * null means the primary is confident.
   * Example: primary=A2, secondary=B1 → "A2/B1 emerging"
   */
  readonly secondary: CEFRLevel | null;

  /**
   * Qualitative confidence descriptor.
   * - 'confident': strong evidence supports this level
   * - 'likely': moderate evidence, but could shift
   * - 'emerging': near boundary, could move up with slight improvement
   * - 'uncertain': insufficient evidence to claim any level firmly
   */
  readonly qualifier: 'confident' | 'likely' | 'emerging' | 'uncertain';
}

/**
 * Internal numeric score range for each CEFR level.
 * These are deterministic thresholds — not AI predictions.
 */
export interface CEFRThreshold {
  readonly level: CEFRLevel;
  readonly minScore: number; // inclusive
  readonly maxScore: number; // exclusive (except C2 which caps at 100)
}

/**
 * Canonical CEFR band thresholds.
 * Score ranges are 0–100 internal scale.
 *
 * ASSUMPTION: These thresholds are intentionally conservative at upper levels.
 * Claiming C1/C2 requires strong, sustained evidence across multiple dimensions.
 */
export const CEFR_THRESHOLDS: readonly CEFRThreshold[] = [
  { level: 'A1', minScore: 0,  maxScore: 20 },
  { level: 'A2', minScore: 20, maxScore: 40 },
  { level: 'B1', minScore: 40, maxScore: 60 },
  { level: 'B2', minScore: 60, maxScore: 78 },
  { level: 'C1', minScore: 78, maxScore: 92 },
  { level: 'C2', minScore: 92, maxScore: 100 },
] as const;

/**
 * The ordered list of CEFR levels for comparison operations.
 */
export const CEFR_ORDER: readonly CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/**
 * Convert an internal score (0–100) to a CEFR level.
 * Deterministic: same score always yields same level.
 */
export function scoreToCEFR(score: number): CEFRLevel {
  const clamped = Math.max(0, Math.min(100, score));
  for (let i = CEFR_THRESHOLDS.length - 1; i >= 0; i--) {
    if (clamped >= CEFR_THRESHOLDS[i].minScore) {
      return CEFR_THRESHOLDS[i].level;
    }
  }
  return 'A1';
}

/**
 * Build a confidence-aware CEFR band from a score and confidence value.
 *
 * Logic:
 * - If score is within 5 points of a boundary AND confidence < 0.7,
 *   we mark it as "emerging" with a secondary level.
 * - If confidence < 0.4, qualifier is "uncertain".
 * - If confidence >= 0.7 and not near boundary, qualifier is "confident".
 * - Otherwise, qualifier is "likely".
 */
export function scoreToCEFRBand(score: number, confidence: number): CEFRBand {
  const clamped = Math.max(0, Math.min(100, score));
  const primary = scoreToCEFR(clamped);
  const primaryIdx = CEFR_ORDER.indexOf(primary);

  // Boundary proximity check: within 5 points of upper threshold
  const threshold = CEFR_THRESHOLDS[primaryIdx];
  const distanceToUpper = threshold.maxScore - clamped;
  const distanceToLower = clamped - threshold.minScore;

  const nearUpperBoundary = distanceToUpper <= 5 && distanceToUpper > 0;
  const nearLowerBoundary = distanceToLower <= 5 && primaryIdx > 0;

  if (confidence < 0.4) {
    return {
      primary,
      secondary: nearUpperBoundary && primaryIdx < CEFR_ORDER.length - 1
        ? CEFR_ORDER[primaryIdx + 1]
        : nearLowerBoundary
          ? CEFR_ORDER[primaryIdx - 1]
          : null,
      qualifier: 'uncertain',
    };
  }

  if (nearUpperBoundary && confidence < 0.7 && primaryIdx < CEFR_ORDER.length - 1) {
    return {
      primary,
      secondary: CEFR_ORDER[primaryIdx + 1],
      qualifier: 'emerging',
    };
  }

  if (nearLowerBoundary && confidence < 0.7) {
    return {
      primary,
      secondary: CEFR_ORDER[primaryIdx - 1],
      qualifier: 'emerging',
    };
  }

  return {
    primary,
    secondary: null,
    qualifier: confidence >= 0.7 ? 'confident' : 'likely',
  };
}

/**
 * Compare two CEFR levels. Returns negative if a < b, 0 if equal, positive if a > b.
 */
export function compareCEFR(a: CEFRLevel, b: CEFRLevel): number {
  return CEFR_ORDER.indexOf(a) - CEFR_ORDER.indexOf(b);
}

/**
 * Get the numeric index of a CEFR level (0 = A1, 5 = C2).
 */
export function cefrToIndex(level: CEFRLevel): number {
  return CEFR_ORDER.indexOf(level);
}

/**
 * Format a CEFRBand into a human-readable string.
 * Examples: "confident B1", "A2/B1 emerging", "likely A2"
 */
export function formatCEFRBand(band: CEFRBand): string {
  if (band.secondary) {
    return `${band.primary}/${band.secondary} ${band.qualifier}`;
  }
  return `${band.qualifier} ${band.primary}`;
}
