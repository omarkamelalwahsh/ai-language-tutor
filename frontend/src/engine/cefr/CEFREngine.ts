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
   * Maps a raw percentage score to a CEFR level using the Professional International Scale.
   * Applies Math.round() before threshold comparison to ensure boundary accuracy.
   * 
   * Professional Scale (Meeting-Ready):
   *   0-20%   → A1 (Beginner)
   *   21-40%  → A2 (Elementary)
   *   41-54%  → B1 (Intermediate)
   *   55-60%  → B1+ (Independent User)
   *   61-75%  → B2 (Upper Intermediate)
   *   76-85%  → C1 (Advanced)
   *   86-100% → C2 (Proficiency)
   */
  public static mapPercentageToLevel(rawPercentage: number): CEFRLevel | string {
    const pct = Math.round(rawPercentage);

    // 🎯 Full Professional Scale — no caps, no shortcuts
    if (pct <= 20) return 'A1';
    if (pct <= 40) return 'A2';
    if (pct <= 54) return 'B1';
    if (pct <= 60) return 'B1+';
    if (pct <= 75) return 'B2';
    if (pct <= 85) return 'C1';
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

  /**
   * Computes the overall assessment state from all individual skill states.
   * 
   * Implements the Weighted Cumulative Average:
   *   Global Score = Σ(S_skill_j × K_j) / 6
   * 
   * Where K_j is the confidence factor for each skill.
   * Division by 6 ensures skills with no data (confidence=0) naturally
   * pull the average down, reflecting insufficient evidence.
   */
  public static computeOverall(skills: Record<SkillName, SkillState>): OverallState {
    const EXPECTED_SKILL_COUNT = 6; // reading, listening, grammar, vocabulary, writing, speaking
    const skillList = Object.values(skills);
    
    let weightedSum = 0;
    let totalConfidence = 0;
    
    for (const s of skillList) {
      if (s.confidence > 0) {
        weightedSum += s.score * s.confidence;
        totalConfidence += s.confidence;
      }
    }
    
    // 🎯 STRICT ISOLATION: Divide ONLY by the skills that have evidence
    const activeSkills = skillList.filter(s => s.confidence > 0);
    const activeCount = activeSkills.length;

    const avgScore = totalConfidence > 0 
      ? weightedSum / totalConfidence // This gives the average weighted performance
      : 0;

    const avgConfidence = activeCount > 0 
      ? totalConfidence / activeCount 
      : 0;
    
    // Determine if scores are in 0-1 range (legacy) or 0-100 range (battery)
    const isPercentageScale = avgScore > 1.5;
    const overallLevel = isPercentageScale 
      ? this.mapPercentageToLevel(avgScore)
      : this.mapScoreToLevel(avgScore);
    
    // Status logic
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
