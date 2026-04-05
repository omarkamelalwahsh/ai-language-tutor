import { CEFRLevel, SkillState, SkillName, SkillStatus, SkillEvidence } from '../../types/efset';
import { ASSESSMENT_CONFIG } from '../../config/assessment-config';

const LEVEL_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export class SkillAggregator {
  
  /**
   * Updates a specific skill state with new evidence.
   */
  public static update(state: SkillState, evidence: SkillEvidence): SkillState {
    const currentLevelValue = this.levelToValue(this.scoreToLevel(state.score));
    
    // Overperformance Control: If item is too easy, reduce its impact
    let effectiveWeight = evidence.weight;
    if (evidence.numericDifficulty < currentLevelValue - 1.5) {
       effectiveWeight *= 0.5; // Halve the weight of trivial tasks
    }

    const history = [...state.history, {
       taskId: '', 
       score: evidence.score,
       difficulty: evidence.numericDifficulty,
       weight: effectiveWeight,
       direct: evidence.direct
    }];

    // Recalculate properties with Recency-Weighted Exponential Decay:
    // Newer items have much higher impact than older ones.
    const RECENT_BIAS = ASSESSMENT_CONFIG.RECENCY_WEIGHT_DECAY; 
    
    let totalImpact = 0;
    let weightedSum = 0;

    // Iterate backwards from newest to oldest
    const reversedHistory = [...history].reverse();
    reversedHistory.forEach((h, index) => {
       const recencyWeight = Math.pow(RECENT_BIAS, index);
       const impact = h.difficulty * h.weight * recencyWeight;
       
       totalImpact += impact;
       weightedSum += (h.score * impact);
    });

    const score = totalImpact > 0 ? weightedSum / totalImpact : 0;
    
    const directEvidenceCount = history.filter(h => h.direct).length;

    // Consistency: standard deviation or similar.
    let consistency = 1.0;
    if (history.length > 1) {
       const deviations = history.map(h => Math.abs(h.score - score));
       const avgDev = deviations.reduce((sum, d) => sum + d, 0) / history.length;
       consistency = Math.max(0, 1 - avgDev * 2);
    }

    // Confidence Calculation: 0.4 evidence + 0.3 consistency + 0.3 directRatio
    const evidenceCountFactor = Math.min(1, history.length / 6); // Need ~6 questions for full confidence
    const directRatio = directEvidenceCount / history.length;

    const confidence = 
      (0.4 * evidenceCountFactor) + 
      (0.3 * consistency) + 
      (0.3 * directRatio);

    // Determine status
    let status: SkillStatus = 'stable';
    if (directEvidenceCount < 2) {
       status = 'insufficient_data';
    } else if (confidence < 0.75) {
       status = 'provisional';
    }

    // Level Range
    const levelRange = this.scoreToRange(score, confidence);

    return {
      score,
      levelRange,
      confidence,
      directEvidenceCount,
      consistency,
      status,
      history
    };
  }

  public static scoreToRange(score: number, confidence: number): [CEFRLevel, CEFRLevel] {
    const level = this.scoreToLevel(score);
    const idx = LEVEL_ORDER.indexOf(level);
    
    // If confidence is low, return a bracket
    if (confidence < 0.70) {
       if (score % 1 > 0.8 && idx < LEVEL_ORDER.length - 1) {
          return [level, LEVEL_ORDER[idx + 1]];
       } else if (score % 1 < 0.2 && idx > 0) {
          return [LEVEL_ORDER[idx - 1], level];
       }
       // Default range for low confidence
       const prev = idx > 0 ? LEVEL_ORDER[idx - 1] : level;
       return [prev, level];
    }
    
    return [level, level]; 
  }

  public static scoreToLevel(score: number): CEFRLevel {
    if (score < 0.40) return 'A1';
    if (score < 0.55) return 'A2';
    if (score < 0.70) return 'B1';
    if (score < 0.83) return 'B2';
    if (score < 0.93) return 'C1';
    return 'C2';
  }

  private static levelToValue(level: CEFRLevel): number {
    return LEVEL_ORDER.indexOf(level) + 1;
  }
}
