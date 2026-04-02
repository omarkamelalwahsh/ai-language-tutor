// ============================================================================
// Layer 8: Authenticity / Overperformance Guard
// ============================================================================
// Flags and caps for suspicious or unreliable evidence patterns:
// - Overformal register on low-level tasks
// - AI-like abstraction patterns
// - Response-task mismatch
// - Overperformance: low-level items pushing high CEFR
// - Too-short responses with inflated inferred levels
//
// Overperformance cap: An item at target level X may contribute at most
// to X + overperformanceCapBands band confidence gain.
// ============================================================================

import {
  EvidenceRecord,
  CEFRLevel,
  AuthenticityFlag,
  PipelineConfig,
  DEFAULT_PIPELINE_CONFIG,
  cefrToIndex,
  indexToCefr,
} from './types';

/**
 * Result of the authenticity guard inspection.
 */
export interface AuthenticityResult {
  /** The (possibly capped) evidence records. */
  readonly evidence: readonly EvidenceRecord[];
  /** Flags raised during inspection. */
  readonly flags: readonly AuthenticityFlag[];
  /** Human-readable notes explaining any actions taken. */
  readonly notes: readonly string[];
}

/**
 * Inspect and optionally cap evidence records for authenticity issues.
 *
 * @param evidence - All evidence records from Layer 4
 * @param config - Pipeline configuration
 * @returns Cleaned evidence with flags and notes
 */
export function guardAuthenticity(
  evidence: readonly EvidenceRecord[],
  config: PipelineConfig = DEFAULT_PIPELINE_CONFIG,
): AuthenticityResult {
  const flags: AuthenticityFlag[] = [];
  const notes: string[] = [];
  const cleaned: EvidenceRecord[] = [];

  for (const record of evidence) {
    let adjusted = record;

    // ── Check 1: Overperformance cap ──────────────────────────────────
    adjusted = applyOverperformanceCap(adjusted, config, flags, notes);

    // ── Check 2: Overformal register on low-level tasks ──────────────
    if (isOverformalOnLowLevel(adjusted)) {
      flags.push('overformal_register');
      notes.push(
        `Item ${adjusted.sourceItemId}: Overformal register detected on ` +
        `${adjusted.targetCEFR} task. Evidence dampened.`
      );
      adjusted = dampenScore(adjusted, 0.7);
    }

    // ── Check 3: Too-short inflated ──────────────────────────────────
    if (isTooShortInflated(adjusted)) {
      flags.push('too_short_inflated');
      notes.push(
        `Item ${adjusted.sourceItemId}: Very short response with high inferred level. ` +
        `Evidence dampened.`
      );
      adjusted = dampenScore(adjusted, 0.5);
    }

    // ── Check 4: AI-like flags from LLM ──────────────────────────────
    if (adjusted.flags.some(f => f.includes('ai_like') || f.includes('persona_leakage'))) {
      if (adjusted.flags.some(f => f.includes('ai_like'))) flags.push('ai_like_abstraction');
      if (adjusted.flags.some(f => f.includes('persona_leakage'))) flags.push('persona_leakage');
      notes.push(
        `Item ${adjusted.sourceItemId}: AI-like or persona leakage detected. Evidence dampened.`
      );
      adjusted = dampenScore(adjusted, 0.6);
    }

    cleaned.push(adjusted);
  }

  // Deduplicate flags
  const uniqueFlags = [...new Set(flags)];

  return { evidence: cleaned, flags: uniqueFlags, notes };
}

/**
 * Apply overperformance cap: An item at target level X may contribute
 * at most to X + capBands. If the item score implies a higher band,
 * cap the score to the threshold of (targetLevel + capBands).
 */
function applyOverperformanceCap(
  record: EvidenceRecord,
  config: PipelineConfig,
  flags: AuthenticityFlag[],
  notes: string[],
): EvidenceRecord {
  const targetIndex = cefrToIndex(record.targetCEFR);
  const maxAllowedIndex = Math.min(5, targetIndex + config.overperformanceCapBands);
  const maxAllowedLevel = indexToCefr(maxAllowedIndex);

  // What's the max score for the allowed band?
  const maxScoreForBand = config.cefrThresholds[maxAllowedLevel].max;

  if (record.itemScore > maxScoreForBand) {
    flags.push('overperformance');
    notes.push(
      `Item ${record.sourceItemId}: Score ${(record.itemScore * 100).toFixed(0)}% on ` +
      `${record.targetCEFR} task exceeds cap for ${maxAllowedLevel}. ` +
      `Capped to ${(maxScoreForBand * 100).toFixed(0)}%.`
    );
    return { ...record, itemScore: maxScoreForBand };
  }

  return record;
}

/**
 * Detect overformal register on A1/A2 tasks.
 */
function isOverformalOnLowLevel(record: EvidenceRecord): boolean {
  const isLowLevel = cefrToIndex(record.targetCEFR) <= 1; // A1 or A2
  const hasHighRegister = record.flags.some(f => f.includes('overformal'));
  // Also check if item score is suspiciously high for low-level
  const suspiciouslyHigh = isLowLevel && record.itemScore > 0.85;
  return isLowLevel && (hasHighRegister || suspiciouslyHigh);
}

/**
 * Detect too-short responses with inflated inferred levels.
 */
function isTooShortInflated(record: EvidenceRecord): boolean {
  // If the response is MCQ, length doesn't matter
  if (record.responseMode === 'mcq') return false;
  // Flag if wordcount-related signal is weak but score is high
  return record.flags.some(f => f.includes('too_short')) && record.itemScore > 0.55;
}

/**
 * Dampen an evidence record's score by a factor.
 */
function dampenScore(record: EvidenceRecord, factor: number): EvidenceRecord {
  return { ...record, itemScore: record.itemScore * factor };
}
