import { CEFRLevel, OverallState, SkillState, SkillName, SkillStatus } from '../../types/efset';

const LEVEL_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export class CEFREngine {
  
  /**
   * Translates a numeric score to a CEFR level based on standardized EF SET thresholds.
   */
  public static mapScoreToLevel(score: number): CEFRLevel {
    if (score < 0.40) return 'A1';
    if (score < 0.55) return 'A2';
    if (score < 0.70) return 'B1';
    if (score < 0.83) return 'B2';
    if (score < 0.93) return 'C1';
    return 'C2';
  }

  /**
   * Computes the overall assessment state from all individual skill states.
   */
  public static computeOverall(skills: Record<SkillName, SkillState>): OverallState {
    const skillList = Object.values(skills);
    
    const avgScore = skillList.reduce((sum, s) => sum + s.score, 0) / skillList.length;
    const avgConfidence = skillList.reduce((sum, s) => sum + s.confidence, 0) / skillList.length;
    
    const overallLevel = this.mapScoreToLevel(avgScore);
    
    // Status logic
    const coreSkills: SkillName[] = ['listening', 'reading', 'writing', 'speaking'];
    const isInsufficient = coreSkills.some(s => skills[s].status === 'insufficient_data');
    
    let status: SkillStatus = 'stable';
    if (isInsufficient) {
      status = 'insufficient_data';
    } else if (avgConfidence < 0.75) {
      status = 'provisional';
    }

    // Overall Range logic: same as SkillAggregator but on avg
    const levelRange = this.scoreToOverallRange(avgScore, avgConfidence);

    return {
      levelRange,
      confidence: avgConfidence,
      status
    };
  }

  private static scoreToOverallRange(score: number, confidence: number): [CEFRLevel, CEFRLevel] {
    const level = this.mapScoreToLevel(score);
    
    // High confidence: return exact level
    if (confidence >= 0.75) return [level, level];
    
    // Mid confidence: return exact level if we are deep in the band (score buffer)
    // This allows the "Overall Level" to reflect growth faster
    if (confidence >= 0.45) return [level, level];

    // Very low confidence: return conservative bracket
    const idx = LEVEL_ORDER.indexOf(level);
    const prev = idx > 0 ? LEVEL_ORDER[idx - 1] : level;
    return [prev, level];
  }
}
