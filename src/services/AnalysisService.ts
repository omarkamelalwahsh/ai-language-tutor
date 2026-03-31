import { 
  CefrLevel, 
  SkillName, 
  AssessmentSessionResult, 
  SkillAssessmentResult, 
  TaskEvaluation, 
  ConfidenceBand,
  DescriptorEvidence,
  AssessmentMetadata
} from '../types/assessment';
import { getNextBand, getBandOrder, CEFR_ORDER } from '../lib/cefr-utils';
import { CEFR_CATALOG, getDescriptorById } from '../data/cefr-catalog';

/**
 * CEFR Rule Engine: Aggregates task-level evidence into a deterministic assessment result.
 */
export class AssessmentAnalysisService {

  public static initializeLearnerModel(
    learnerId: string,
    sessionId: string,
    taskEvaluations: TaskEvaluation[],
    metadata: AssessmentMetadata = {}
  ): AssessmentSessionResult {
    const skills: SkillName[] = ["listening", "reading", "writing", "speaking", "vocabulary", "grammar"];
    
    const skillResults = {} as Record<SkillName, SkillAssessmentResult>;
    
    for (const skill of skills) {
      skillResults[skill] = this.aggregateSkill(skill, taskEvaluations);
    }

    const overallLevel = this.inferOverallLevel(skillResults);
    
    return {
      learnerId,
      sessionId,
      overall: {
        estimatedLevel: overallLevel,
        confidence: this.inferOverallConfidence(skillResults),
        rationale: this.buildOverallRationale(skillResults, overallLevel)
      },
      skills: skillResults,
      behavioralProfile: this.computeBehavioralProfile(taskEvaluations),
      metadata,
      recommendedNextTasks: this.generateNextTasks(overallLevel),
      generatedAt: new Date().toISOString()
    };
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
      return this.conservativeMedianLevel(allLevels);
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

  private static inferOverallLevel(skills: Record<SkillName, SkillAssessmentResult>): CefrLevel {
    const coreSkills: SkillName[] = ["listening", "reading", "writing", "speaking"];
    const levels = coreSkills.map(s => skills[s].estimatedLevel);
    
    // Aggregation Rule: Conservative Median
    const medianLevel = this.conservativeMedianLevel(levels);
    const medianOrder = getBandOrder(medianLevel);

    // Apply Structural Caps (Grammar/Vocabulary)
    const grammarLevel = skills.grammar.estimatedLevel;
    const vocabLevel = skills.vocabulary.estimatedLevel;
    const structuralBase = Math.min(getBandOrder(grammarLevel), getBandOrder(vocabLevel));
    
    let finalLevel = medianLevel;

    // Cap at structuralBase + 1 if structures are significantly weaker
    if (medianOrder > structuralBase + 1) {
      finalLevel = CEFR_ORDER[structuralBase + 1] as CefrLevel;
      // Mark skills as capped
      coreSkills.forEach(s => {
        if (getBandOrder(skills[s].estimatedLevel) > structuralBase + 1) {
          skills[s].isCapped = true;
        }
      });
    }

    return finalLevel;
  }

  private static conservativeMedianLevel(levels: CefrLevel[]): CefrLevel {
    if (levels.length === 0) return "A1";
    
    const sortedIndices = levels
      .map(l => getBandOrder(l))
      .sort((a, b) => a - b);
    
    const midPoint = Math.floor((sortedIndices.length - 1) / 2);
    const medianIndex = sortedIndices[midPoint];
    
    return CEFR_ORDER[medianIndex] as CefrLevel;
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
      pace: avgLatency > 20000 ? "slow" : avgLatency < 8000 ? "fast" : "moderate",
      confidenceStyle: "balanced",
      selfCorrectionRate
    };
  }

  private static buildOverallRationale(skills: Record<SkillName, SkillAssessmentResult>, estimated: CefrLevel): string[] {
    return [
      `Your linguistic profile strongly aligns with the ${estimated} band.`,
      `Core proficiency is driven by strong performance in ${Object.values(skills).filter(s => getBandOrder(s.estimatedLevel) >= getBandOrder(estimated)).map(s => s.skill).join(', ')}.`,
      "Consistency across productive and receptive tasks remains stable."
    ];
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

