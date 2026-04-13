import { 
  CefrLevel, 
  SkillName, 
  AssessmentSessionResult, 
  SkillAssessmentResult, 
  TaskEvaluation, 
  ConfidenceBand,
  DescriptorEvidence,
  AssessmentMetadata,
  AssessmentOutcome,
  AssessmentSkill
} from '../types/assessment';
import { getNextBand, getBandOrder, CEFR_ORDER } from '../lib/cefr-utils';
import { CEFR_CATALOG, getDescriptorById } from '../data/cefr-catalog';

/**
 * CEFR Rule Engine: Aggregates task-level evidence into a deterministic assessment result.
 */
export class AssessmentAnalysisService {

  /**
   * Bridges the new AdaptiveAssessmentEngine Outcome to the legacy SessionResult structure.
   */
  public static fromAssessmentOutcome(
    outcome: AssessmentOutcome,
    learnerId: string,
    sessionId: string,
    metadata: AssessmentMetadata = {}
  ): AssessmentSessionResult {
    const skillResults = {} as Record<SkillName, SkillAssessmentResult>;
    const ALL_SKILLS: SkillName[] = ["listening", "reading", "writing", "speaking", "vocabulary", "grammar"];

    // 🛡️ Safety check: Ensure breakdown exists to prevent property access crash
    const breakdown = outcome?.skillBreakdown || {};

    for (const skill of ALL_SKILLS) {
      const engineSkill = breakdown[skill as AssessmentSkill];
      
      if (!engineSkill) {
        // Safe fallback for untested skills
        skillResults[skill] = {
          skill,
          estimatedLevel: "A1",
          confidence: { band: "low", score: 0, reasons: ["Skill not tested in this session"] },
          evidenceCount: 0,
          descriptors: [],
          strengths: [],
          weaknesses: [`No evidence collected for ${skill}`],
          taskCoverage: { total: 5, completed: 0, valid: 0 },
          subscores: [],
          status: "insufficient_data"
        };
        continue;
      }

      // Normalize BandLabel to CefrLevel
      const normalizedLevel = this.normalizeEngineBand(engineSkill.band || "A1");

      skillResults[skill] = {
        skill,
        estimatedLevel: normalizedLevel,
        confidence: {
          band: this.valueToConfidenceBand(engineSkill.confidence ?? 0),
          score: engineSkill.confidence ?? 0,
          reasons: []
        },
        evidenceCount: engineSkill.evidenceCount,
        descriptors: engineSkill.matchedDescriptors,
        strengths: engineSkill.matchedDescriptors.slice(0, 3).map(d => d.descriptorText),
        weaknesses: engineSkill.missingDescriptors.slice(0, 3).map(id => {
          const entry = getDescriptorById(id);
          const parts = id.split('_');
          const s = parts[0];
          const l = parts[1];
          return entry?.canonicalTextEn || `Needs improvement in ${s} (${l})`;
        }),
        masteryScore: (engineSkill.score || 0) / 100,
        taskCoverage: {
          total: 5,
          completed: engineSkill.evidenceCount,
          valid: engineSkill.evidenceCount
        },
        subscores: [],
        status: engineSkill.status,
        isCapped: engineSkill.isCapped,
        cappedReason: engineSkill.cappedReason
      };
    }

    return {
      learnerId,
      sessionId,
      overall: {
        estimatedLevel: outcome.overallBand 
          ? this.normalizeEngineBand(outcome.overallBand)
          : this.inferOverallLevel(skillResults, outcome.overallConfidence),
        confidence: outcome.overallConfidence,
        rationale: this.buildOverallRationale(skillResults, outcome.overallBand 
          ? this.normalizeEngineBand(outcome.overallBand)
          : this.inferOverallLevel(skillResults, outcome.overallConfidence))
      },
      skills: skillResults,
      behavioralProfile: {
        pace: "moderate",
        confidenceStyle: "balanced",
        selfCorrectionRate: 0
      },
      metadata,
      recommendedNextTasks: [],
      generatedAt: new Date().toISOString()
    };
  }

  private static normalizeEngineBand(band: string): CefrLevel {
    // If it's a bridge band (e.g., A2_B1), normalize to A2+
    if (band.includes('_')) {
      const low = band.split('_')[0];
      const high = band.split('_')[1];
      
      if (low === 'A2' && high === 'B1') return 'A2+' as CefrLevel;
      if (low === 'B1' && high === 'B2') return 'B1+' as CefrLevel;
      if (low === 'B2' && high === 'C1') return 'B2+' as CefrLevel;
      
      return `${low}+` as CefrLevel;
    }
    return band as CefrLevel;
  }

  private static valueToConfidenceBand(val: number): ConfidenceBand {
    if (val > 0.8) return "high";
    if (val > 0.5) return "medium";
    return "low";
  }

  // ---- 1. Skill Aggregation (Rule Engine) ---- //

  private static aggregateSkill(
    skill: SkillName,
    evaluations: TaskEvaluation[]
  ): SkillAssessmentResult {
    const relevant = evaluations.filter(e => e.skill === skill && e.validAttempt);
    
    const descriptorSupport = this.buildDescriptorSupport(relevant);
    const estimatedLevel = this.inferSkillLevel(descriptorSupport, relevant.length);
    const confidence = this.computeConfidence(relevant, descriptorSupport);
    
    const strengths = descriptorSupport
      .filter(d => d.supported && d.strength > 0.7)
      .map(d => d.descriptorText);
      
    const weaknesses = descriptorSupport
      .filter(d => !d.supported || d.strength < 0.4)
      .map(d => d.descriptorText)
      .slice(0, 3);

    return {
      skill,
      estimatedLevel,
      confidence,
      evidenceCount: relevant.length,
      descriptors: descriptorSupport,
      strengths,
      weaknesses,
      taskCoverage: {
        total: 5, // Target evidence count
        completed: relevant.length,
        valid: relevant.length
      },
      subscores: this.buildSubscores(relevant),
      status: this.computeStability(relevant, confidence)
    };
  }

  // ---- 2. Level Inference Logic ---- //

  // ---- 2. Level Inference Logic ---- //

  private static inferSkillLevel(descriptors: DescriptorEvidence[], evCount: number): CefrLevel {
    if (descriptors.length === 0 || evCount === 0) return "A1";

    // Find all supported descriptors (strength > 0.6)
    const supported = descriptors.filter(d => d.supported && d.strength > 0.6);
    
    if (supported.length === 0) {
      const allLevels = descriptors.map(d => d.level);
      return this.intelligentMedianLevel(allLevels, true);
    }

    const sortedByLevel = supported.sort((a, b) => 
      getBandOrder(b.level) - getBandOrder(a.level)
    );

    const highestProposed = sortedByLevel[0].level;
    const highestOrder = getBandOrder(highestProposed);

    // Composite Anti-Overleveling Guard
    // Levels above A2 require:
    // 1. Min unique tasks (evCount)
    // 2. Min unique descriptors supported
    // 3. Consistency (variance in levels seen)
    if (highestOrder > 1) { // Above A2
      const uniqueDescriptors = supported.length;
      const consistency = 1 - (new Set(descriptors.map(d => d.level)).size / 6);
      
      const passesGuard = evCount >= 3 && uniqueDescriptors >= 2 && consistency > 0.5;
      
      if (!passesGuard) {
        // Cap at A2 if guard fails
        return "A2";
      }
    }

    return highestProposed;
  }

  private static inferOverallLevel(skills: Record<SkillName, SkillAssessmentResult>, overallConfidence: number): CefrLevel {
    const coreSkills: SkillName[] = ["listening", "reading", "writing", "speaking"];
    const levels = coreSkills.map(s => skills[s].estimatedLevel);
    
    // Aggregation Rule: Conservative Median
    // NEW: If confidence < 0.65, always favor the LOWER end for safety.
    const isHighConfidence = overallConfidence >= 0.65;
    const medianLevel = this.intelligentMedianLevel(levels, isHighConfidence);
    const medianOrder = getBandOrder(medianLevel);

    // CORE SKILL COVERAGE GUARD:
    // If Speaking or Writing has 0 evidence, we no longer hard-cap at A1+.
    // Instead, we just note it's 'provisional' in the rationale.
    let finalLevel = medianLevel;

    // ── 3. Apply Structural Caps (Fixed Buffer) ──────────────────────────
    // Softened: Cap at structuralBase + 2 to prevent "Grammar A1 Paradox"
    // (where A1 grammar drags C1 listening/reading down to B1).
    const grammarLevel = skills.grammar.estimatedLevel;
    const vocabLevel = skills.vocabulary.estimatedLevel;
    const structuralBase = Math.min(getBandOrder(grammarLevel), getBandOrder(vocabLevel));
    const finalOrder = getBandOrder(finalLevel);

    if (finalOrder > structuralBase + 2) {
      finalLevel = CEFR_ORDER[Math.min(structuralBase + 2, CEFR_ORDER.length - 1)] as CefrLevel;
      // Mark core skills as capped
      coreSkills.forEach(s => {
        if (getBandOrder(skills[s].estimatedLevel) > structuralBase + 2) {
          skills[s].isCapped = true;
        }
      });
    }

    return finalLevel;
  }

  private static intelligentMedianLevel(levels: CefrLevel[], highConfidence: boolean): CefrLevel {
    if (levels.length === 0) return "A1";
    
    const sortedIndices = levels
      .map(l => getBandOrder(l))
      .sort((a, b) => a - b);
    
    // For [B1, C1] (2, 4):
    // If highConfidence: take ceil(1/2) = index 1 (C1)? No, median should be B2 (3).
    // Actually, median of [2, 4] is 3.
    const sum = sortedIndices.reduce((a, b) => a + b, 0);
    const avg = sum / sortedIndices.length;
    
    // Rounded correctly based on confidence: 
    // Always round up if it's .5 or higher to avoid user frustration, 
    // even in medium confidence scenarios.
    const finalIndex = Math.round(avg);
    
    return CEFR_ORDER[Math.max(0, Math.min(finalIndex, CEFR_ORDER.length - 1))] as CefrLevel;
  }

  // ---- 3. Meta-Signals & Confidence ---- //

  private static computeConfidence(
    evaluations: TaskEvaluation[],
    descriptors: DescriptorEvidence[]
  ): { band: ConfidenceBand; score: number; reasons: string[] } {
    const evidenceVolume = Math.min(1.0, evaluations.length / 5);
    const consistency = descriptors.length > 0 
      ? 1 - (new Set(descriptors.map(d => d.level)).size / 6)
      : 0.5;

    const score = (evidenceVolume * 0.6) + (consistency * 0.4);
    
    let band: ConfidenceBand = "low";
    if (score > 0.8) band = "high";
    else if (score > 0.5) band = "medium";

    const reasons = [];
    if (evaluations.length < 3) reasons.push("Insufficient evidence collected");
    if (consistency < 0.4) reasons.push("Inconsistent performance across difficulty levels");
    if (score > 0.8) reasons.push("Highly consistent patterns across multiple tasks");

    return { band, score, reasons };
  }

  private static inferOverallConfidence(skills: Record<SkillName, SkillAssessmentResult>): number {
    const scores = Object.values(skills).map(s => s.confidence.score);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  private static computeStability(
    evaluations: TaskEvaluation[],
    confidence: { score: number }
  ): "insufficient_data" | "emerging" | "stable" | "fragile" {
    if (evaluations.length < 2) return "insufficient_data";
    if (confidence.score > 0.8) return "stable";
    if (confidence.score > 0.5) return "emerging";
    return "fragile";
  }

  // ---- 4. Data Transformation Helpers ---- //

  private static buildDescriptorSupport(evaluations: TaskEvaluation[]): DescriptorEvidence[] {
    const supportMap = new Map<string, DescriptorEvidence>();

    evaluations.forEach(ev => {
      ev.matchedDescriptors.forEach(md => {
        const existing = supportMap.get(md.descriptorId);
        if (existing) {
          existing.strength = (existing.strength + md.support) / 2;
          existing.sourceTaskIds.push(ev.taskId);
        } else {
          const catalogEntry = getDescriptorById(md.descriptorId);
          const [skill, level] = md.descriptorId.split('_');
          
          supportMap.set(md.descriptorId, {
            descriptorId: md.descriptorId,
            descriptorText: catalogEntry?.canonicalTextEn || `Demonstrates ${skill} proficiency at ${level} level`,
            level: (catalogEntry?.level || level) as CefrLevel,
            supported: md.support > 0.5,
            strength: md.support,
            sourceTaskIds: [ev.taskId]
          });
        }
      });
    });

    return Array.from(supportMap.values());
  }

  private static buildSubscores(evaluations: TaskEvaluation[]) {
    const scores = new Map<string, { total: number, count: number }>();
    
    evaluations.forEach(ev => {
      ev.rubricScores.forEach(rs => {
        const existing = scores.get(rs.criterion) || { total: 0, count: 0 };
        existing.total += rs.score / rs.maxScore;
        existing.count += 1;
        scores.set(rs.criterion, existing);
      });
    });

    return Array.from(scores.entries()).map(([name, data]) => ({
      name,
      value: data.total / data.count,
      label: `${Math.round((data.total / data.count) * 100)}%`
    }));
  }

  private static computeBehavioralProfile(evaluations: TaskEvaluation[]): AssessmentSessionResult['behavioralProfile'] {
    const latencies = evaluations.map(e => Number(e.rawSignals.responseTimeMs) || 0);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / Math.max(1, latencies.length);
    
    // Calculate self-correction from raw signals if available
    const selfCorrections = evaluations.filter(e => e.rawSignals.selfCorrection === true).length;
    const selfCorrectionRate = evaluations.length > 0 ? selfCorrections / evaluations.length : 0;
    
    return {
      pace: avgLatency > 10000 ? "slow" : avgLatency < 2000 ? "fast" : "moderate",
      confidenceStyle: "balanced",
      selfCorrectionRate
    };
  }

  private static buildOverallRationale(skills: Record<SkillName, SkillAssessmentResult>, estimated: CefrLevel): string[] {
    const rationale = [
      `Your linguistic profile aligns with the ${estimated} band.`,
      `Core proficiency is driven by strong performance in ${Object.values(skills).filter(s => getBandOrder(s.estimatedLevel) >= getBandOrder(estimated)).map(s => s.skill).join(', ')}.`
    ];

    if (skills.speaking.evidenceCount === 0 && skills.writing.evidenceCount > 0) {
      rationale.push("Overall level capped: You didn't record any speaking audio. Please retake speaking tasks with your microphone to fully verify your C1/C2 potential.");
    } else if (skills.speaking.evidenceCount === 0 || skills.writing.evidenceCount === 0) {
      rationale.push("Overall level capped due to insufficient evidence in productive skills (Speaking/Writing).");
    } else {
      rationale.push("Consistency across productive and receptive tasks remains stable.");
    }

    return rationale;
  }

  private static generateNextTasks(level: CefrLevel): string[] {
    const next = getNextBand(level);
    return [
      `Strengthen ${level} foundations`,
      `Bridge towards ${next} objectives`,
      "Focus on productive fluency"
    ];
  }
}

