import {
  AssessmentQuestion,
  AssessmentSkill,
  DifficultyBand,
  BandLabel,
  AnswerRecord,
  SkillEstimate,
  AdaptiveAssessmentState,
  AssessmentOutcome,
  SkillName,
  TaskEvaluation,
  CefrLevel,
  AssessmentFeatures,
  DescriptorEvidence,
  QuestionType,
} from '../types/assessment';
import { TaskResult } from '../types/app';
import { QUESTION_BANK } from '../data/assessment-questions';
import { DescriptorService } from './DescriptorService';
import { evaluateWithGroq, DescriptorEvaluationResult, DifficultyBand as GroqBand } from './groqEvaluator';
import { FeatureExtractor } from './evaluation/FeatureExtractor';
import { CefrInferenceEngine } from './inference/CefrInferenceEngine';
import { clamp01, safeDivide, finiteOr } from '../lib/numeric-guards';
// ============================================================================
// Constants
// ============================================================================

const BAND_ORDER: DifficultyBand[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const ALL_SKILLS: AssessmentSkill[] = ['reading', 'writing', 'listening', 'speaking', 'vocabulary', 'grammar'];

/** Band numeric values for arithmetic comparisons */
const BAND_VALUE: Record<DifficultyBand, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
const VALUE_TO_BAND: Record<number, DifficultyBand> = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' };

/** Assessment configuration */
const CONFIG = {
  MIN_QUESTIONS: 8,
  TARGET_QUESTIONS: 12,
  MAX_QUESTIONS: 30, // Increased to support adaptive long-tales
  CONFIDENCE_STOP_THRESHOLD: 0.95, // Increased from 0.82 to 0.95
  STABILITY_WINDOW: 4,
  PROMOTE_THRESHOLD: 2,
  DEMOTE_THRESHOLD: 2,
  MIN_SKILLS_TESTED: 3,
  SKILL_EVIDENCE_TARGET: 2,
} as const;

// ============================================================================
// Adaptive Assessment Engine
// ============================================================================

// ============================================================================
// Adaptive Assessment Engine
// ============================================================================

export class AdaptiveAssessmentEngine {
  private state: AdaptiveAssessmentState;
  private questionPool: AssessmentQuestion[];

  constructor(startingBand: DifficultyBand = 'A2') {
    this.questionPool = [...QUESTION_BANK];

    // Initialize skill estimates
    const initialSkillEstimates = {} as Record<AssessmentSkill, SkillEstimate>;
    for (const skill of ALL_SKILLS) {
      initialSkillEstimates[skill] = {
        band: startingBand,
        score: BAND_VALUE[startingBand] * 20, // normalized: A1=20, A2=40, B1=60, B2=80, C1=100
        confidence: 0,
        stability: 'insufficient_data',
        uncertainty: 1.0,
        evidenceCount: 0,
        answeredTaskIds: [],
        bandPerformance: {},
        accumulatedEvidence: [],
        descriptorSupport: {}
      };
    }

    this.state = {
      currentTargetBand: startingBand,
      askedQuestionIds: [],
      answerHistory: [],
      taskEvaluations: [],
      skillEstimates: initialSkillEstimates,
      overallConfidence: 0,
      questionsAnswered: 0,
      completed: false,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // Public API
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Get the next question to present, or null if the assessment is complete.
   */
  public getNextQuestion(): AssessmentQuestion | null {
    if (this.state.completed) return null;
    if (this.shouldStopAssessment()) {
      this.state.completed = true;
      return null;
    }
    return this.selectNextQuestion();
  }

  /**
   * Submit an answer and get back whether it was correct + the score.
   * 
   * ARCHITECTURE:
   * 3. State update (Layer 4) persists signals.
   */
  public async submitAnswer(
    question: AssessmentQuestion,
    answer: string,
    responseTimeMs: number
  ): Promise<{ correct: boolean; score: number }> {
    const features = FeatureExtractor.extract(question, answer, responseTimeMs);
    
    // ── Step 3: DETERMINISTIC Descriptor Matching (Layer 3) ──
    const matched = DescriptorService.getInstance().matchFeatures(
      question.targetDescriptorIds || [],
      features
    );
    
    // ── Step 4: OPTIONAL LLM enrichment (Layer 5) ──
    const llmResult = await this.evaluateWithBackend(question, answer);
    
    // ── Step 5: Synthesize Evidence (Synthesizer Layer) ──
    const finalMatches = this.synthesizeEvidence(matched, llmResult);
    
    // ── Step 6: Update State & Accumulate Evidence (Layer 4) ──
    const deterministicScore = this.calculateDeterministicScore(features as any, finalMatches, question.type);
    
    // UNIFIED SAFETY NET: Decouple 'isPass' from LLM-only judgment.
    // If the LLM understands it (>=0.3) OR the deterministic matcher found it (>=0.7), it's a PASS.
    const llmPassScore = llmResult 
      ? (llmResult.semantic_accuracy * 0.8 + llmResult.task_completion * 0.2)
      : 0;
    
    const isPass = (llmPassScore >= 0.3) || (features.correctness >= 0.7);

    // Weighted aggregation of LLM signals (0.0 - 1.0) for Level Tracking
    const llmSignalScore = llmResult ? (
      llmResult.semantic_accuracy * 0.3 +
      llmResult.task_completion * 0.1 +
      llmResult.grammar_control * 0.3 +
      llmResult.lexical_sophistication * 0.3
    ) : 0;

    // Final score uses the full qualitative depth to determine "Proficiency" (CEFR band)
    const finalScore = llmResult ? (deterministicScore * 0.3 + llmSignalScore * 0.7) : deterministicScore;

    const record: AnswerRecord = {
      taskId: question.id,
      questionId: question.id,
      skill: question.primarySkill as AssessmentSkill,
      difficulty: BAND_VALUE[question.difficulty],
      correct: isPass,
      score: finalScore,
      answer,
      responseTimeMs,
      taskType: question.type,
    };

    this.state.answerHistory.push(record);
    this.updateSkillEstimate(question, record, finalMatches);

    // ── Step 7: Divergence Detection & Dynamic Branching ──
    const outputBand = llmResult?.estimated_band;
    if (outputBand && this.detectOutputDivergence(question.difficulty, outputBand)) {
      record.outputBandOverride = outputBand as DifficultyBand;
      this.jumpWithValidation(outputBand as DifficultyBand);
    } else if (this.state.pendingValidationBand) {
      // If we were in validation and user passed, clear the flag
      if (isPass) {
        console.log(`[Validation] User PASSED validation for ${this.state.pendingValidationBand}.`);
        this.state.pendingValidationBand = undefined;
      } else {
        console.log(`[Validation] User FAILED validation for ${this.state.pendingValidationBand}. Dropping back.`);
        this.state.pendingValidationBand = undefined;
        this.state.currentTargetBand = this.demoteBand(this.state.currentTargetBand);
      }
      this.updateTargetBand();
    } else {
      this.updateTargetBand();
    }

    // ── Step 8: Task evaluation recording (High Fidelity) ──
    const taskEval: TaskEvaluation = {
      taskId: question.id,
      primarySkill: question.primarySkill,
      skill: question.primarySkill as SkillName,
      validAttempt: responseTimeMs > 1500,
      channels: {
        comprehension: isPass ? 1.0 : 0.0, // Base proxy until Layer 2 is fully implemented
        taskCompletion: isPass ? 1.0 : 0.0,
      },
      skillEvidence: {
        [question.primarySkill]: isPass ? 1.0 : 0.0
      },
      descriptorEvidence: finalMatches.map(m => ({
        descriptorId: m.descriptorId,
        support: m.strength,
        sourceSkill: question.primarySkill,
        weight: 1.0
      })),
      notes: [],
      rawSignals: {
        ...features,
        responseTimeMs,
        isCorrect: isPass,
        difficulty: question.difficulty,
      },
      rubricScores: [
        { criterion: 'accuracy', score: isPass ? 1 : 0, maxScore: 1 },
        { criterion: 'complexity', score: features.complexityScore || 0, maxScore: 1 }
      ],
      matchedDescriptors: finalMatches.map(m => ({
        descriptorId: m.descriptorId,
        support: m.strength
      }))
    };
    this.state.taskEvaluations.push(taskEval);
    this.state.overallConfidence = clamp01(this.computeOverallConfidence());
    this.state.questionsAnswered++;

    return { correct: isPass, score: finalScore };
  }

  /**
   * Detects if the learner's output CEFR level is significantly higher than the question's difficulty.
   * "Significant" means a gap of 2 or more bands (e.g., A1 question, B2 output).
   */
  private detectOutputDivergence(questionBand: DifficultyBand, outputBand: string): boolean {
    const qVal = BAND_VALUE[questionBand];
    const oVal = BAND_VALUE[outputBand as DifficultyBand] || 0;
    
    // Gap of 1.5+ bands is high divergence (e.g. A2 question, B2/C1 output)
    return (oVal - qVal) >= 1.5;
  }

  /**
   * Jumps to a higher band but sets a validation flag.
   */
  private jumpWithValidation(targetBand: DifficultyBand): void {
    const currentVal = BAND_VALUE[this.state.currentTargetBand];
    const targetVal = BAND_VALUE[targetBand];
    
    if (targetVal > currentVal + 1) {
      this.state.pendingValidationBand = targetBand;
      // Jump to a slightly safer level first
      const safeJumpVal = Math.min(6, currentVal + 2);
      const safeBand = Object.keys(BAND_VALUE).find(k => BAND_VALUE[k as DifficultyBand] === safeJumpVal) as DifficultyBand;
      this.state.currentTargetBand = safeBand || targetBand;
      console.log(`[Divergence] High proficiency detected. Jumping to ${this.state.currentTargetBand} with validation pending for ${targetBand}.`);
    } else {
      this.state.currentTargetBand = targetBand;
      console.log(`[Divergence] Moderate divergence. Jumping to ${targetBand}.`);
    }
  }

  private demoteBand(band: DifficultyBand): DifficultyBand {
    const idx = BAND_ORDER.indexOf(band);
    return idx > 0 ? BAND_ORDER[idx - 1] : band;
  }

  private countRecentStrongResults(): number {
    const window = this.state.answerHistory.slice(-2);
    return window.filter(a => a.correct).length;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Groq Descriptor Evaluation
  // ══════════════════════════════════════════════════════════════════════

  private async evaluateWithBackend(question: AssessmentQuestion, answer: string): Promise<DescriptorEvaluationResult | null> {
    try {
      const descriptorService = DescriptorService.getInstance();
      await descriptorService.initialize();

      const currentBand = this.state.currentTargetBand;
      const bands = ['Pre-A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as DifficultyBand[];
      const idx = bands.indexOf(currentBand);
      const targetBands: string[] = [currentBand];
      if (idx > 0) targetBands.push(bands[idx - 1]);
      if (idx < bands.length - 1) targetBands.push(bands[idx + 1]);

      let skillIdentifier = question.skill;
      if (skillIdentifier === 'grammar' || skillIdentifier === 'vocabulary') {
          skillIdentifier = question.primarySkill || question.skill; 
      }

      const relevantDescriptors = descriptorService.getRelevantDescriptors(skillIdentifier as any, targetBands);

      const descriptorsMap: Partial<Record<DifficultyBand, string[]>> = {};
      for (const d of relevantDescriptors) {
        const b = d.level as DifficultyBand;
        if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(b)) {
          if (!descriptorsMap[b]) descriptorsMap[b] = [];
          descriptorsMap[b]!.push(d.descriptor);
        }
      }

      return await evaluateWithGroq({
        skill: skillIdentifier as any,
        currentBand: currentBand as DifficultyBand,
        question: {
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          subskills: question.subskills || []
        },
        learnerAnswer: answer,
        descriptors: descriptorsMap
      });

    } catch (error) {
      console.error('[AdaptiveEngine] Groq evaluation error, falling back to heuristic:', error);
      return null;
    }
  }


  /**
   * Get current progress information for UI display.
   */
  public getProgress() {
    const estimatedTotal = this.estimateRemainingQuestions();
    return {
      answered: this.state.questionsAnswered,
      total: estimatedTotal,
      percentage: Math.min(100, (this.state.questionsAnswered / estimatedTotal) * 100),
      currentBand: this.state.currentTargetBand,
      confidence: this.state.overallConfidence,
      completed: this.state.completed,
    };
  }

  /**
   * Force-complete the assessment (e.g., if questions run out).
   */
  public forceComplete(): void {
    this.state.completed = true;
    this.state.stopReason = 'pool_exhausted';
  }

  /**
   * Produce the final structured AssessmentOutcome.
   */
  public getOutcome(): AssessmentOutcome {
    const skillResults = {} as AssessmentOutcome['skillBreakdown'];

    // Layer 6: Inference & Capping
    for (const skill of ALL_SKILLS) {
      const est = this.state.skillEstimates[skill];
      const { status, level: inferredLevel } = CefrInferenceEngine.inferSkillStatus(est);
      const { level: cappedLevel, isCapped, reason } = CefrInferenceEngine.applyLevelCaps(
        skill, 
        inferredLevel as DifficultyBand, 
        this.state.skillEstimates
      );

      const matchedDescriptors = est.accumulatedEvidence.filter(e => e.supported);
      const missingDescriptors = Object.entries(est.descriptorSupport)
        .filter(([_, s]) => s.contradiction > s.support)
        .map(([id]) => id);

      skillResults[skill] = {
        band: cappedLevel,
        score: Math.round(est.score),
        confidence: Math.round(est.confidence * 100) / 100,
        evidenceCount: est.evidenceCount,
        status,
        matchedDescriptors,
        missingDescriptors,
        isCapped,
        cappedReason: reason
      };
    }

    const overallBand = this.estimateOverallBand();

    return {
      overallBand,
      overallConfidence: Math.round(this.state.overallConfidence * 100) / 100,
      skillBreakdown: skillResults,
      strengths: this.identifyStrengths(),
      weaknesses: this.identifyWeaknesses(),
      answerHistory: [...this.state.answerHistory],
      totalQuestions: this.state.questionsAnswered,
      stopReason: this.state.stopReason || 'max_reached',
    };
  }

  /**
   * Export results in legacy TaskResult[] format for AnalysisService compatibility.
   */
  public exportResultsForLegacyAnalysis(): TaskResult[] {
    return this.state.answerHistory.map(record => {
      const q = this.questionPool.find(x => x.id === record.questionId);
      const skillToTaskType = (s: AssessmentSkill): string => {
        switch (s) {
          case 'writing': return 'writing';
          case 'speaking': return 'speaking';
          case 'listening': return 'listening_comprehension';
          case 'vocabulary': return 'vocabulary_in_context';
          case 'grammar': return 'writing';
          case 'reading': return 'writing';
          default: return 'writing';
        }
      };

      return {
        taskId: record.questionId,
        answer: record.answer,
        responseTime: record.responseTimeMs,
        wordCount: record.answer.trim().split(/\s+/).length,
        hintUsage: 0,
        taskType: skillToTaskType(record.skill),
        metadata: {
          difficulty: VALUE_TO_BAND[record.difficulty as 1|2|3|4|5|6],
          isCorrect: record.correct,
          skill: q?.skill || record.skill,
          score: record.score,
        },
      } as TaskResult;
    });
  }

  public getTaskEvaluations(): TaskEvaluation[] {
    return [...this.state.taskEvaluations];
  }

  // ══════════════════════════════════════════════════════════════════════
  // Skill Estimation
  // ══════════════════════════════════════════════════════════════════════

  private updateSkillEstimate(
    question: AssessmentQuestion, 
    record: AnswerRecord,
    evidence: DescriptorEvidence[] = []
  ): void {
    // Determine primary weight
    const primaryWeight = question.skillWeights?.[question.primarySkill] ?? 1.0;
    const primaryRecord = { ...record, score: record.score * primaryWeight };
    const primaryEvidence = evidence.map(e => ({ ...e, strength: e.strength * primaryWeight }));
    
    // Update primary skill
    this.updateSingleSkillEstimate(question.primarySkill, primaryRecord, primaryEvidence);

    // Update secondary skills with explicit weights
    if (question.skillWeights) {
      for (const [s, w] of Object.entries(question.skillWeights)) {
        if (s === question.primarySkill) continue;
        
        const secondary = s as AssessmentSkill;
        const weight = w as number;
        
        const secondaryRecord = { ...record, score: record.score * weight };
        const secondaryEvidence = evidence.map(e => ({ ...e, strength: e.strength * weight }));
        this.updateSingleSkillEstimate(secondary, secondaryRecord, secondaryEvidence);
      }
    } else if (question.secondarySkills) {
      // Fallback for legacy tasks without weights
      for (const secondary of question.secondarySkills) {
        const reducedRecord = { ...record, score: record.score * 0.5 };
        const reducedEvidence = evidence.map(e => ({ ...e, strength: e.strength * 0.5 }));
        this.updateSingleSkillEstimate(secondary, reducedRecord, reducedEvidence);
      }
    }
  }

  private updateSingleSkillEstimate(
    skill: AssessmentSkill, 
    record: AnswerRecord,
    evidence: DescriptorEvidence[] = []
  ): void {
    const est = this.state.skillEstimates[skill];
    est.evidenceCount++;

    // Track band-specific performance with continuous weighting
    const bandLabel = VALUE_TO_BAND[record.difficulty as 1|2|3|4|5|6];
    if (!est.bandPerformance[bandLabel]) {
      est.bandPerformance[bandLabel] = { correct: 0, total: 0 };
    }
    est.bandPerformance[bandLabel]!.total++;
    // Use the raw score (0-1) to increment correctness, allowing partial credit
    est.bandPerformance[bandLabel]!.correct += record.score;

    // Layer 4: Evidence Accumulation
    for (const e of evidence) {
      est.accumulatedEvidence.push(e);
      if (!est.descriptorSupport[e.descriptorId]) {
        est.descriptorSupport[e.descriptorId] = { support: 0, contradiction: 0 };
      }
      if (e.supported) {
        // Apply evidence multiplier: Open-ended (0.7 weight) vs MCQ (0.3 weight)
        // We normalize this so open-ended is ~2.3x more impactful
        const isOpenEnded = ['short_text', 'picture_description', 'listening_summary'].includes(record.taskType || '');
        const multiplier = isOpenEnded ? 1.4 : 0.6;
        
        est.descriptorSupport[e.descriptorId].support += e.strength * multiplier;
      } else {
        est.descriptorSupport[e.descriptorId].contradiction += e.strength;
      }
    }

    est.score = this.computeSkillScore(est);
    est.band = this.scoreToBand(est.score);
    est.confidence = this.computeSkillConfidence(est);
    est.uncertainty = 1.0 - est.confidence;

    if (est.confidence >= 0.85) est.stability = "stable";
    else if (est.confidence >= 0.6) est.stability = "emerging";
    else if (est.evidenceCount > 2) est.stability = "fragile";
    else est.stability = "insufficient_data";
  }

  /**
   * Computes a 0-100 score from the skill's band performance map.
   * 
   * Logic:
   * - Each band has a base value (A1=20, A2=40, B1=60, B2=80, C1=100)
   * - For each band tested, we compute accuracy = correct/total
   * - The score is the highest band where accuracy >= 0.6, with interpolation
   */
  private computeSkillScore(est: SkillEstimate): number {
    const bands = BAND_ORDER;
    let highestPassedValue = 0;
    let highestPartialValue = 0;

    for (const band of bands) {
      const perf = est.bandPerformance[band];
      if (!perf || perf.total === 0) continue;

      const accuracy = perf.correct / perf.total;
      const bandVal = BAND_VALUE[band] * 20; // A1=20, A2=40, etc.

      // Weight evidence by task type: 0.7 for open-ended, 0.3 for MCQ
      // This is a simplified proxy since bandPerformance doesn't track task type per band.
      // We'll rely on the descriptorSupport multiplier added in updateSingleSkillEstimate.
      
      if (accuracy >= 0.6) {
        // Passed this band
        highestPassedValue = Math.max(highestPassedValue, bandVal);
      } else if (accuracy >= 0.3) {
        // Partial performance — interpolate
        const partialVal = bandVal - 10 + (accuracy * 15);
        highestPartialValue = Math.max(highestPartialValue, partialVal);
      }
    }

    // If no evidence at all, return current estimate
    if (highestPassedValue === 0 && highestPartialValue === 0) {
      return est.score;
    }

    // Use the highest signal
    return Math.max(highestPassedValue, highestPartialValue);
  }

  /**
   * Convert a 0-100 score to a BandLabel (with intermediate bands).
   */
  private scoreToBand(score: number): BandLabel {
    if (score <= 15) return 'A1';
    if (score <= 25) return 'A1_A2';
    if (score <= 35) return 'A2';
    if (score <= 45) return 'A2_B1';
    if (score <= 55) return 'B1';
    if (score <= 65) return 'B1_B2';
    if (score <= 75) return 'B2';
    if (score <= 85) return 'B2_C1';
    if (score <= 95) return 'C1';
    return 'C2';
  }

  private computeSkillConfidence(est: SkillEstimate): number {
    // Confidence grows with evidence count and consistency
    const evidenceFactor = Math.min(1, safeDivide(est.evidenceCount, 5, 0));

    // Check consistency: are answers at the same level consistent?
    let consistency = 1.0;
    const perfs = Object.values(est.bandPerformance).filter(p => p !== undefined && p.total > 0) as { correct: number; total: number }[];
    if (perfs.length > 0) {
      // Consistency = how many bands have clear pass/fail (not mixed)
      const clearBands = perfs.filter(p => {
        const acc = safeDivide(p.correct, p.total, 0);
        return acc >= 0.8 || acc <= 0.2; // clearly passing or failing
      }).length;
      consistency = safeDivide(clearBands, perfs.length, 0.5);
    }

    let contradictionPenalty = 0;
    let totalContradictions = 0;
    let totalSupport = 0;
    for (const desc of Object.values(est.descriptorSupport)) {
      totalContradictions += desc.contradiction;
      totalSupport += desc.support;
    }
    if (totalSupport + totalContradictions > 0) {
      const ratio = totalContradictions / (totalSupport + totalContradictions);
      contradictionPenalty = ratio * 0.5; 
    }

    return clamp01(evidenceFactor * 0.7 + consistency * 0.3 - contradictionPenalty);
  }

  // ══════════════════════════════════════════════════════════════════════
  // Target Band Movement
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Updates the current target band based on recent performance.
   * 
   * Rules:
   * - Look at the last STABILITY_WINDOW answers near current band
   * - If PROMOTE_THRESHOLD correct → move up (max 1 step)
   * - If DEMOTE_THRESHOLD incorrect → move down (max 1 step)
   * - Mixed → stay at current band
   * 
   * This prevents overreaction to a single answer.
   */
  private updateTargetBand(): void {
    const window = this.state.answerHistory.slice(-CONFIG.STABILITY_WINDOW);
    if (window.length < 2) return; // need at least 2 answers before adjusting

    // Only consider answers near the current target band (±1 band)
    const currentVal = BAND_VALUE[this.state.currentTargetBand];
    const nearBandAnswers = window.filter(a => {
      const ansVal = a.difficulty; // It is already numeric (BAND_VALUE)
      return Math.abs(ansVal - currentVal) <= 1;
    });

    if (nearBandAnswers.length < 2) return;

    const recentCorrect = nearBandAnswers.filter(a => a.correct).length;
    const recentIncorrect = nearBandAnswers.length - recentCorrect;

    // Check for consistent strong performance → promote
    if (recentCorrect >= CONFIG.PROMOTE_THRESHOLD && recentIncorrect === 0) {
      // AMBITIOUS: If last 2 answers were perfect (score 1.0) at or above current band, double jump
      const perfectStreak = window.slice(-2).every(a => a.score === 1.0);
      if (perfectStreak) {
        this.jumpBandUp();
      } else {
        this.stepBandUp();
      }
    }
    // Check for consistent weak performance → demote
    else if (recentIncorrect >= CONFIG.DEMOTE_THRESHOLD && recentCorrect <= 1) {
      this.stepBandDown();
    }
    // Otherwise stay — mixed signals don't move the needle
  }

  private stepBandUp(): void {
    const idx = BAND_ORDER.indexOf(this.state.currentTargetBand);
    if (idx < BAND_ORDER.length - 1) {
      this.state.currentTargetBand = BAND_ORDER[idx + 1];
    }
  }

  private jumpBandUp(): void {
    const idx = BAND_ORDER.indexOf(this.state.currentTargetBand);
    if (idx < BAND_ORDER.length - 2) {
      this.state.currentTargetBand = BAND_ORDER[idx + 2];
    } else if (idx < BAND_ORDER.length - 1) {
      this.state.currentTargetBand = BAND_ORDER[idx + 1];
    }
  }

  private stepBandDown(): void {
    const idx = BAND_ORDER.indexOf(this.state.currentTargetBand);
    if (idx > 0) {
      this.state.currentTargetBand = BAND_ORDER[idx - 1];
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Question Selection
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Selects the next question using a multi-factor scoring approach:
   * 
   * 1. Difficulty proximity to current target band (strongest weight)
   * 2. Skill coverage — prefer under-tested skills
   * 3. Weak skill priority — prefer skills with low confidence or low scores
   * 4. Avoid already-asked questions
   */
  private selectNextQuestion(): AssessmentQuestion | null {
    const available = this.questionPool.filter(
      q => !this.state.askedQuestionIds.includes(q.id)
    );

    if (available.length === 0) {
      this.forceComplete();
      return null;
    }

    let targetBand = this.state.currentTargetBand;
    let pool = available;

    // ── Step 1: Handle Validation Jumps ──
    if (this.state.pendingValidationBand) {
      targetBand = this.state.pendingValidationBand;
      // Filter for items at the target band that are "Anchor Items" (high discrimination)
      const validationPool = available.filter(q => q.difficulty === targetBand);
      if (validationPool.length > 0) {
        pool = validationPool;
        console.log(`[Selection] Validation mode: Focusing on high-discrimination ${targetBand} items.`);
      }
    }

    // Score each candidate
    const scored = pool.map(q => ({
      question: q,
      score: this.scoreCandidate(q, targetBand),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Take the highest scoring candidate
    const selected = scored[0].question;
    this.state.askedQuestionIds.push(selected.id);
    return selected;
  }

  /**
   * Scores a candidate question for selection priority.
   * Higher score = better candidate.
   */
  private scoreCandidate(q: AssessmentQuestion, overrideBand?: DifficultyBand): number {
    let score = 0;

    // ── Factor 1: Prerequisite Check (Layer 1) ──
    if (q.prerequisites && q.prerequisites.length > 0) {
      const allMet = q.prerequisites.every(id => this.state.askedQuestionIds.includes(id));
      if (!allMet) return -100; // Hard filter
    }

    // ── Factor 2: Difficulty proximity (CAT Logic) ──
    const targetBand = overrideBand || this.state.currentTargetBand;
    const targetVal = BAND_VALUE[targetBand];
    const qVal = BAND_VALUE[q.difficulty];
    const distance = Math.abs(targetVal - qVal);
    
    const currentConfidence = this.state.skillEstimates[q.primarySkill]?.confidence || 0;
    
    let difficultyScore = 0;
    if (currentConfidence < 0.4) {
      difficultyScore = qVal === targetVal ? 20 : (10 - distance * 5);
    } else {
      // Proactive probing for higher bands
      difficultyScore = (qVal >= targetVal) ? (20 - (qVal - targetVal) * 5) : (10 - distance * 5);
    }
    
    // Apply Item Discrimination (Staff Requirement)
    score += difficultyScore * (q.discriminationValue || 0.5);

    // ── Factor 3: Uncertainty Reduction (Layer 5) ──
    const est = this.state.skillEstimates[q.primarySkill];
    if (q.targetDescriptorIds) {
      for (const descId of q.targetDescriptorIds) {
        const support = est.descriptorSupport[descId];
        if (!support) {
          score += 15; // New descriptor evidence is high value
        } else {
          // High uncertainty if support and contradiction are similar
          const uncertainty = 1 - Math.abs(support.support - support.contradiction) / Math.max(1, support.support + support.contradiction);
          score += uncertainty * 10;
        }
      }
    }

    // ── Factor 4: Skill coverage ──
    if (est.evidenceCount === 0) score += 30;
    else if (est.evidenceCount < CONFIG.SKILL_EVIDENCE_TARGET) score += 15;

    // ── Factor 5: Variety ──
    const typeUsage = this.state.answerHistory.filter(r => {
        const prevQ = QUESTION_BANK.find(x => x.id === r.questionId);
        return prevQ?.type === q.type;
    }).length;
    score -= typeUsage * 5;

    return score;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Stop Conditions
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Determines whether to stop the assessment.
   * 
   * Conditions (in priority order):
   * 1. HARD CAP: >= MAX_QUESTIONS → always stop
   * 2. POOL EXHAUSTED: no more available questions
   * 3. CONFIDENT: >= MIN_QUESTIONS, confidence above threshold, enough skill variety
   * 4. STABLE: >= TARGET_QUESTIONS, level hasn't changed in STABILITY_WINDOW
   */
  private shouldStopAssessment(): boolean {
    const n = this.state.questionsAnswered;

    // 1. HARD LIMITS (Escape clauses)
    if (n >= CONFIG.MAX_QUESTIONS) {
      this.state.stopReason = 'max_reached';
      return true;
    }

    // 2. Pool check
    const available = this.questionPool.filter(
      q => !this.state.askedQuestionIds.includes(q.id)
    );
    if (available.length === 0) {
      this.state.stopReason = 'pool_exhausted';
      return true;
    }

    // Must have minimum questions
    if (n < CONFIG.MIN_QUESTIONS) return false;

    // Check Core Skills coverage
    const CORE_SKILLS: AssessmentSkill[] = ['listening', 'reading', 'writing', 'speaking'];
    const hasCoreCoverage = CORE_SKILLS.every(s => this.state.skillEstimates[s].evidenceCount >= 1);
    if (!hasCoreCoverage) return false;

    // 3. TARGET CONFIDENCE & UNCERTAINTY RULES
    this.state.overallConfidence = clamp01(this.computeOverallConfidence());
    
    if (this.state.overallConfidence >= CONFIG.CONFIDENCE_STOP_THRESHOLD) {
      // Ensure all core skills have acceptable uncertainty
      const acceptableUncertainty = CORE_SKILLS.every(s => {
        const est = this.state.skillEstimates[s];
        return est.evidenceCount > 0 && est.uncertainty <= 0.35;
      });
      
      if (acceptableUncertainty) {
        this.state.stopReason = 'confidence_threshold';
        return true;
      }
    }

    // 4. EMERGENCY FALLBACK
    // Force stop if very long and somewhat stable
    if (n >= 18 && this.state.overallConfidence >= 0.85) {
      this.state.stopReason = 'level_stabilized';
      return true;
    }

    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Overall Level Estimation
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Estimates the overall CEFR band from skill estimates.
   * 
   * Uses evidence-weighted average of all tested skills,
   * not a naive mean. Skills with more evidence contribute more.
   */
  public estimateOverallBand(): BandLabel {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const skill of ALL_SKILLS) {
      const est = this.state.skillEstimates[skill];
      if (est.evidenceCount === 0) continue;

      const weight = Math.min(est.evidenceCount, 4); // cap weight at 4
      weightedSum += est.score * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return this.state.currentTargetBand;

    const avgScore = weightedSum / totalWeight;
    return this.scoreToBand(avgScore);
  }

  // ══════════════════════════════════════════════════════════════════════
  // Confidence Computation
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Computes overall assessment confidence from multiple factors:
   * 
   * 1. Question count (more questions → higher confidence, max at ~12)
   * 2. Skill coverage (tested more skills → higher confidence)
   * 3. Per-skill confidence average
   * 4. Performance consistency (stable answers → higher confidence)
   */
  private computeOverallConfidence(): number {
    const n = this.state.questionsAnswered;

    // Factor 1: Question count (0-1, maxes at TARGET_QUESTIONS)
    const countFactor = Math.min(1, n / CONFIG.TARGET_QUESTIONS);

    // Factor 2: Skill coverage (0-1)
    const testedSkills = ALL_SKILLS.filter(s => this.state.skillEstimates[s].evidenceCount > 0);
    const coverageFactor = testedSkills.length / ALL_SKILLS.length;

    // Factor 3: Average per-skill confidence (0-1)
    const skillConfidences = testedSkills.map(s => this.state.skillEstimates[s].confidence);
    const avgSkillConfidence = skillConfidences.length > 0
      ? skillConfidences.reduce((a, b) => a + b, 0) / skillConfidences.length
      : 0;

    // Factor 4: Recent stability (0-1)
    let stabilityFactor = 0.5;
    if (n >= 4) {
      const recent = this.state.answerHistory.slice(-4);
      // Bug 2 fix: a.difficulty is already numeric (stored as BAND_VALUE[band]).
      // Using BAND_VALUE[a.difficulty] would index by number, returning undefined → NaN.
      const recentBands = recent.map(a => a.difficulty);
      const variance = this.computeVariance(recentBands);
      stabilityFactor = clamp01(1 - variance * 0.5);
    }

    // Weighted combination
    return clamp01(
      countFactor * 0.25 +
      coverageFactor * 0.2 +
      avgSkillConfidence * 0.35 +
      stabilityFactor * 0.2
    );
  }

  private computeVariance(values: number[]): number {
    const finite = values.filter(v => Number.isFinite(v));
    if (finite.length === 0) return 0;
    const mean = safeDivide(finite.reduce((a, b) => a + b, 0), finite.length, 0);
    const squaredDiffs = finite.map(v => (v - mean) ** 2);
    return finiteOr(safeDivide(squaredDiffs.reduce((a, b) => a + b, 0), finite.length, 0), 0);
  }

  // ══════════════════════════════════════════════════════════════════════
  // Strengths & Weaknesses
  // ══════════════════════════════════════════════════════════════════════

  private identifyStrengths(): string[] {
    const strengths: string[] = [];
    const overallScore = this.getWeightedOverallScore();

    // Find skills performing above average
    for (const skill of ALL_SKILLS) {
      const est = this.state.skillEstimates[skill];
      if (est.evidenceCount === 0) continue;

      if (est.score > overallScore + 10) {
        const label = skill.charAt(0).toUpperCase() + skill.slice(1);
        strengths.push(`Strong ${label.toLowerCase()} skills at ${this.formatBand(est.band)} level`);
      }
    }

    // Check for high-band correct answers
    const highBandCorrect = this.state.answerHistory.filter(
      a => a.correct && (a.difficulty >= 4) // B2 (4) or above
    );
    if (highBandCorrect.length >= 2) {
      strengths.push('Successfully handled upper-intermediate to advanced questions');
    }

    // Consistency strength
    if (this.state.overallConfidence > 0.7) {
      strengths.push('Consistent performance across tested areas');
    }

    // Connectors / production quality
    const productionAnswers = this.state.answerHistory.filter(a => {
      const q = this.questionPool.find(x => x.id === a.questionId);
      return q && ['short_text', 'picture_description', 'listening_summary'].includes(q.type);
    });
    if (productionAnswers.length > 0) {
      const avgProdScore = productionAnswers.reduce((s, a) => s + a.score, 0) / productionAnswers.length;
      if (avgProdScore > 0.7) {
        strengths.push('Good productive language skills in writing/speaking tasks');
      }
    }

    return strengths.length > 0 ? strengths : ['Completed the adaptive assessment'];
  }

  private identifyWeaknesses(): string[] {
    const weaknesses: string[] = [];
    const overallScore = this.getWeightedOverallScore();

    // Find skills performing below average
    for (const skill of ALL_SKILLS) {
      const est = this.state.skillEstimates[skill];
      if (est.evidenceCount === 0) continue;

      if (est.score < overallScore - 10) {
        const label = skill.charAt(0).toUpperCase() + skill.slice(1);
        weaknesses.push(`${label} needs strengthening (currently at ${this.formatBand(est.band)})`);
      }
    }

    // Check for untested skills
    const untested = ALL_SKILLS.filter(s => this.state.skillEstimates[s].evidenceCount === 0);
    if (untested.length > 0) {
      weaknesses.push(`${untested.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')} not yet assessed`);
    }

    // Check for lower-band incorrect answers
    const lowBandIncorrect = this.state.answerHistory.filter(
      a => !a.correct && (a.difficulty <= 2) // A2 (2) or below
    );
    if (lowBandIncorrect.length >= 2) {
      weaknesses.push('Some foundational areas need reinforcement');
    }

    return weaknesses.length > 0 ? weaknesses : ['Continue building across all skill areas'];
  }

  private getWeightedOverallScore(): number {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const skill of ALL_SKILLS) {
      const est = this.state.skillEstimates[skill];
      if (est.evidenceCount === 0) continue;
      const weight = Math.min(est.evidenceCount, 4);
      weightedSum += est.score * weight;
      totalWeight += weight;
    }
    return totalWeight > 0 ? weightedSum / totalWeight : 40;
  }

  private formatBand(band: BandLabel): string {
    return band.replace('_', '/');
  }

  // ══════════════════════════════════════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════════════════════════════════════

  private estimateRemainingQuestions(): number {
    if (this.state.completed) return this.state.questionsAnswered;
    
    // Estimate based on current confidence
    const conf = this.state.overallConfidence;
    if (conf > 0.7) return Math.max(this.state.questionsAnswered + 2, CONFIG.MIN_QUESTIONS);
    if (conf > 0.5) return CONFIG.TARGET_QUESTIONS;
    return CONFIG.MAX_QUESTIONS;
  }

  /** Expose the full internal state for debugging / dev mode */
  public getState(): Readonly<AdaptiveAssessmentState> {
    return { ...this.state };
  }

  /** Expose the structured evaluations for the analysis rule engine */
  public getEvaluations(): TaskEvaluation[] {
    return [...this.state.taskEvaluations];
  }

  private synthesizeEvidence(
    deterministic: DescriptorEvidence[],
    llm: DescriptorEvaluationResult | null
  ): DescriptorEvidence[] {
    if (!llm) return deterministic;

    const combined = [...deterministic];
    
    // Integrate LLM signals as standalone descriptors if they are strong
    if (llm.lexical_sophistication > 0.7) {
       combined.push({ 
         descriptorId: 'llm_lexical_signal_high', 
         descriptorText: 'Demonstrated sophisticated and varied vocabulary usage.',
         level: llm.estimated_band,
         supported: true,
         strength: llm.lexical_sophistication,
         sourceTaskIds: []
       });
    }

    if (llm.syntactic_complexity > 0.7) {
       combined.push({ 
         descriptorId: 'llm_syntactic_signal_high', 
         descriptorText: 'Demonstrated complex syntactic control and nested structures.',
         level: llm.estimated_band,
         supported: true,
         strength: llm.syntactic_complexity,
         sourceTaskIds: []
       });
    }

    // Boost or dampen existing descriptors based on LLM overall confidence
    for (const d of combined) {
      if (d.level === llm.estimated_band) {
        d.strength = (d.strength + llm.confidence) / 2;
      }
    }
    
    return combined;
  }

  private calculateDeterministicScore(features: AssessmentFeatures, matches: DescriptorEvidence[], taskType: QuestionType): number {
    const isOpenEnded = ['short_text', 'picture_description', 'listening_summary'].includes(taskType);
    
    if (isOpenEnded) {
      // Prioritize correctness (0.7) over complexity (0.3) for the base deterministic signal
      const correctnessSignal = (features.correctness || 0) * 0.7;
      const complexitySignal = (features.lexicalDiversity || 0) * 0.15 + (features.syntacticComplexity || 0) * 0.15;
      const matchScore = matches.length > 0 ? Math.max(...matches.map(m => m.strength)) : 0;
      
      // Return a balanced score that rewards correctness but scales with complexity
      return Math.min(1.0, correctnessSignal + complexitySignal + (matchScore * 0.2));
    } else {
      // 0.95 weight for correctness for closed-ended tasks
      const correctnessSignal = (features.correctness || 0) * 0.95;
      const lengthProxy = Math.min(0.05, (features.wordCount || 0) / 100);
      return correctnessSignal + lengthProxy;
    }
  }

  // updateSkillEvidence() was removed — it only accumulated evidence without
  // recomputing score/band/confidence, causing frozen skill estimates.
  // All its logic is now handled by updateSkillEstimate() → updateSingleSkillEstimate().

  private applyLLMDifficultyHint(action: "increase" | "stay" | "decrease") {
    // Adaptive Step Size based on action
    const current = BAND_ORDER.indexOf(this.state.currentTargetBand);
    let nextIndex = current;
    
    if (action === "increase") nextIndex++;
    if (action === "decrease") nextIndex--;
    
    nextIndex = Math.max(0, Math.min(nextIndex, BAND_ORDER.length - 1));
    this.state.currentTargetBand = BAND_ORDER[nextIndex];
  }
}
