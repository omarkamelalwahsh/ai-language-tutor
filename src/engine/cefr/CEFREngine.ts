/**
 * CEFREngine — CEFR Level Computation
 * 
 * Provides both the legacy score-to-level mapping (for backward compat)
 * and the new percentage-based mapping for the 40-Question Battery.
 */

import { CEFRLevel, OverallState, SkillState, SkillName, SkillStatus } from '../../types/efset';
import { ASSESSMENT_CONFIG } from '../../config/assessment-config';

const LEVEL_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export class CEFREngine {
  
  // ═══════════════════════════════════════════════════════════════
  // NEW: Percentage-based CEFR mapping (40-Question Battery)
  // Uses Math.round() to handle boundaries correctly.
  // Example: 60.5% → Math.round(60.5) = 61 → B2
  // ═══════════════════════════════════════════════════════════════

  /**
   * Maps a raw percentage score to a CEFR level using the standardized scale.
   * Applies Math.round() before threshold comparison to ensure boundary accuracy.
   * 
   * Scale:
   *   0-20%  → A1
   *   21-40% → A2
   *   41-60% → B1
   *   61-80% → B2
   *   81-90% → C1
   *   91-100% → C2
   */
  public static mapPercentageToLevel(rawPercentage: number): CEFRLevel {
    const pct = Math.round(rawPercentage);

    for (const entry of ASSESSMENT_CONFIG.CEFR_SCALE) {
      if (pct >= entry.min && pct <= entry.max) {
        return entry.level as CEFRLevel;
      }
    }

    // Safety fallback
    if (pct <= 0) return 'A1';
    return 'C2';
  }

  // ═══════════════════════════════════════════════════════════════
  // LEGACY: Score-based mapping (kept for backward compat)
  // ═══════════════════════════════════════════════════════════════

  /**
   * @deprecated Use mapPercentageToLevel() for the battery scoring system.
   * Translates a numeric score (0-1) to a CEFR level based on EF SET thresholds.
   */
  public static mapScoreToLevel(score: number): CEFRLevel {
    if (isNaN(score) || score == null || score < 0.40) return 'A1';
    if (score < 0.55) return 'A2';
    if (score < 0.70) return 'B1';
    if (score < 0.83) return 'B2';
    if (score < 0.93) return 'C1';
    return 'C2';
  }

  // ═══════════════════════════════════════════════════════════════
  // Overall State Computation (Updated for Battery)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Computes the overall assessment state from all individual skill states.
   * Now uses percentage-based mapping when scores are in 0-100 range.
   */
  public static computeOverall(skills: Record<SkillName, SkillState>): OverallState {
    const skillList = Object.values(skills);
    
    let avgScore = 0;
    let avgConfidence = 0;
    
    if (skillList.length > 0) {
      avgScore = skillList.reduce((sum, s) => sum + s.score, 0) / skillList.length;
      avgConfidence = skillList.reduce((sum, s) => sum + s.confidence, 0) / skillList.length;
    }
    
    // Determine if scores are in 0-1 range (legacy) or 0-100 range (battery)
    const isPercentageScale = avgScore > 1.5; // Heuristic: if avg > 1.5, it's percentage
    const overallLevel = isPercentageScale 
      ? this.mapPercentageToLevel(avgScore)
      : this.mapScoreToLevel(avgScore);
    
    // Status logic
    const coreSkills: SkillName[] = ['listening', 'reading'];
    const batterySkills = ['listening', 'reading', 'grammar', 'vocabulary'] as SkillName[];
    const relevantSkills = batterySkills.filter(s => skills[s]);
    const isInsufficient = relevantSkills.some(s => skills[s]?.status === 'insufficient_data');
    
    let status: SkillStatus = 'stable';
    if (isInsufficient) {
      status = 'insufficient_data';
    } else if (avgConfidence < 0.75) {
      status = 'provisional';
    }

    const levelRange = this.scoreToOverallRange(avgScore, avgConfidence, isPercentageScale);

    return {
      levelRange,
      confidence: avgConfidence,
      status
    };
  }

  private static scoreToOverallRange(
    score: number, 
    confidence: number, 
    isPercentage: boolean
  ): [CEFRLevel, CEFRLevel] {
    const level = isPercentage 
      ? this.mapPercentageToLevel(score)
      : this.mapScoreToLevel(score);
    
    // High confidence: return exact level
    if (confidence >= 0.75) return [level, level];
    
    // Mid confidence: return exact level
    if (confidence >= 0.45) return [level, level];

    // Very low confidence: return conservative bracket
    const idx = LEVEL_ORDER.indexOf(level);
    const prev = idx > 0 ? LEVEL_ORDER[idx - 1] : level;
    return [prev, level];
  }
}
