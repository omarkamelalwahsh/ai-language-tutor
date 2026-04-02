import { 
  SkillEstimate, 
  SkillAssessmentStatus, 
  BandLabel, 
  DifficultyBand,
  AssessmentSkill,
  CefrLevel
} from '../../types/assessment';

const BAND_ORDER: DifficultyBand[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const BAND_VALUE: Record<DifficultyBand, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

/**
 * Layer 6: Final CEFR Inference Engine
 * Implements conservative, evidence-based rules to determine the final CEFR state.
 */
export class CefrInferenceEngine {
  
  public static inferSkillStatus(est: SkillEstimate): { 
    status: SkillAssessmentStatus, 
    level: BandLabel,
    isCapped?: boolean,
    cappedReason?: string
  } {
    if (est.evidenceCount < 2) {
      return { status: 'insufficient_data', level: est.band };
    }

    const bands = [...BAND_ORDER].reverse();
    let highestStable: DifficultyBand | null = null;
    let highestEmerging: DifficultyBand | null = null;
    let highestFragile: DifficultyBand | null = null;

    for (const band of bands) {
      const perf = est.bandPerformance[band];
      if (!perf || perf.total === 0) continue;

      const accuracy = perf.correct / perf.total;
      const isConsistent = accuracy >= 0.8 || accuracy <= 0.2;
      
      const descriptorIdsAtBand = est.accumulatedEvidence
        .filter(e => e.level === band)
        .map(e => e.descriptorId);
      const uniqueDescriptors = new Set(descriptorIdsAtBand).size;

      if (accuracy >= 0.75 && uniqueDescriptors >= 1) {
        if (est.confidence >= 0.8 || isConsistent) { // Lowered confidence requirement slightly (0.85 -> 0.8)
          highestStable = highestStable || band;
        } else {
          highestFragile = highestFragile || band;
        }
      } else if (accuracy >= 0.6 || (perf.total >= 2 && accuracy >= 0.5)) { // Adjusting threshold
        highestEmerging = highestEmerging || band;
      }
    }

    // NEW RULE: Sequential Mastery. 
    // If we have strong evidence for a band, but it's not "stable" yet, 
    // we should still allow it to be the base if it's consistently successful.
    if (highestStable) {
      return { status: est.stability, level: highestStable };
    }
    if (highestFragile) {
      return { status: 'fragile', level: highestFragile };
    }
    if (highestEmerging) {
      return { status: 'emerging', level: highestEmerging };
    }

    return { status: 'insufficient_data', level: est.band };
  }

  /**
   * Applies cross-skill capping logic.
   * e.g. Productive skills (Writing/Speaking) cannot be 2 levels above Vocabulary/Grammar.
   */
  public static applyLevelCaps(
    skill: AssessmentSkill, 
    inferredLevel: DifficultyBand,
    allEstimates: Record<AssessmentSkill, SkillEstimate>
  ): { level: DifficultyBand, isCapped: boolean, reason?: string } {
    
    if (skill !== 'speaking' && skill !== 'writing') return { level: inferredLevel, isCapped: false };

    const vocabLevel = this.bandToValue(allEstimates['vocabulary'].band as DifficultyBand);
    const gramLevel = this.bandToValue(allEstimates['grammar'].band as DifficultyBand);
    const currentVal = this.bandToValue(inferredLevel);
    
    const anchorLevel = Math.max(vocabLevel, gramLevel);

    // Rule: Dynamic Capping. 
    // Usually productive skills are within 1 band of linguistic level.
    // If evidence is extremely strong (confidence > 0.9), allow a 2-band gap (e.g. C1 Speaking with B1 Grammar)
    const skillEst = allEstimates[skill];
    const maxGap = (skillEst.confidence >= 0.9 && skillEst.evidenceCount >= 3) ? 2 : 1;

    if (currentVal > anchorLevel + maxGap) {
      const cappedVal = anchorLevel + maxGap;
      const cappedBand = this.valueToBand(cappedVal);
      return { 
        level: cappedBand, 
        isCapped: true, 
        reason: `Capped by linguistic competence (Vocabulary/Grammar at ${this.valueToBand(anchorLevel)}). Max allowed gap is ${maxGap} bands.` 
      };
    }

    return { level: inferredLevel, isCapped: false };
  }

  private static bandToValue(band: DifficultyBand): number {
    return BAND_VALUE[band] || 1;
  }

  private static valueToBand(val: number): DifficultyBand {
    const clamped = Math.max(1, Math.min(6, Math.round(val)));
    const mapping: Record<number, DifficultyBand> = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' };
    return mapping[clamped];
  }
}
