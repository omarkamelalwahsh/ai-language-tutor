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
} from '../types/assessment';
import { TaskResult } from '../types/app';
import { QUESTION_BANK } from '../data/assessment-questions';
import { DescriptorService } from './DescriptorService';
import { evaluateWithGroq, DescriptorEvaluationResult, DifficultyBand as GroqBand } from './groqEvaluator';
import { decideNextBand } from './adaptiveDecision';
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
  MAX_QUESTIONS: 15,
  CONFIDENCE_STOP_THRESHOLD: 0.82,
  STABILITY_WINDOW: 4,        // last N answers to check for stability
  PROMOTE_THRESHOLD: 2,        // correct answers needed near current band to consider promotion
  DEMOTE_THRESHOLD: 2,         // wrong answers needed near current band to consider demotion
  MIN_SKILLS_TESTED: 3,        // minimum different skills before stopping
  SKILL_EVIDENCE_TARGET: 2,    // target evidence count per skill
} as const;

// ============================================================================
// Scoring Module
// ============================================================================

export function scoreResponse(question: AssessmentQuestion, answer: string): number {
  const normAnswer = answer.trim().toLowerCase();

  // --- MCQ / fill_blank / reading_mcq / listening_mcq ---
  if (['mcq', 'fill_blank', 'reading_mcq', 'listening_mcq'].includes(question.type)) {
    if (!question.correctAnswer) return 0;
    const correct = Array.isArray(question.correctAnswer)
      ? question.correctAnswer[0]
      : question.correctAnswer;
    return normAnswer === correct.toLowerCase() ? 1.0 : 0.0;
  }

  // --- Listening summary (keyword inclusion) ---
  if (question.type === 'listening_summary') {
    const keywords = question.acceptedAnswers || 
      (Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer || '']);
    const matched = keywords.filter(kw => normAnswer.includes(kw.toLowerCase()));
    if (keywords.length === 0) return normAnswer.length > 5 ? 0.5 : 0;
    return Math.min(1.0, matched.length / Math.max(1, Math.ceil(keywords.length * 0.5)));
  }

  // --- Short text / picture_description (production scoring) ---
  if (['short_text', 'picture_description'].includes(question.type)) {
    // If there are accepted answers / correct answers, use keyword matching
    if (question.correctAnswer || question.acceptedAnswers) {
      const keywords = question.acceptedAnswers ||
        (Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer || '']);
      const matched = keywords.filter(kw => normAnswer.includes(kw.toLowerCase()));
      if (matched.length > 0) return 1.0;
    }

    // Otherwise, use production quality heuristics
    const words = normAnswer.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    
    // Minimum word thresholds by difficulty
    const minWords: Record<DifficultyBand, number> = { A1: 3, A2: 5, B1: 8, B2: 12, C1: 15, C2: 20 };
    const targetWords: Record<DifficultyBand, number> = { A1: 8, A2: 15, B1: 25, B2: 40, C1: 50, C2: 60 };
    
    const min = minWords[question.difficulty];
    const target = targetWords[question.difficulty];
    
    if (wordCount < min) return 0.2;
    
    // Base length score
    let lengthScore = Math.min(1.0, wordCount / target);
    
    // Bonus for connectors (cohesion signal)
    const connectors = ['because', 'however', 'although', 'therefore', 'moreover', 'but', 'and', 'so', 'while', 'since', 'furthermore', 'nevertheless'];
    const connectorCount = connectors.filter(c => normAnswer.includes(c)).length;
    const connectorBonus = Math.min(0.2, connectorCount * 0.05);
    
    // Lexical diversity (unique words / total words)
    const uniqueWords = new Set(words);
    const diversity = uniqueWords.size / wordCount;
    const diversityScore = diversity > 0.6 ? 0.15 : diversity > 0.4 ? 0.1 : 0;
    
    return Math.min(1.0, Math.max(0.2, lengthScore * 0.65 + connectorBonus + diversityScore + 0.1));
  }

  return 0;
}

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
        evidenceCount: 0,
        bandPerformance: {},
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
   * 1. Deterministic scoring (scoreResponse) is the SOLE source of truth.
   * 2. LLM enrichment is optional metadata — it informs adaptive band
   *    movement but NEVER overrides the deterministic score.
   * 3. If LLM returns null, the engine proceeds with zero impact.
   */
  public async submitAnswer(
    question: AssessmentQuestion,
    answer: string,
    responseTimeMs: number
  ): Promise<{ correct: boolean; score: number }> {
    // ── Step 1: DETERMINISTIC SCORING (immutable source of truth) ──
    const score = scoreResponse(question, answer);
    const correct = score >= 0.7;

    const record: AnswerRecord = {
      questionId: question.id,
      skill: question.primarySkill,
      difficulty: question.difficulty,
      correct,
      score,
      answer,
      responseTimeMs,
    };

    this.state.answerHistory.push(record);
    this.state.askedQuestionIds.push(question.id);
    this.state.questionsAnswered++;

    // ── Step 2: Update skill estimates from DETERMINISTIC data only ──
    this.updateSkillEstimate(question, record);

    // ── Step 3: OPTIONAL LLM enrichment (non-blocking to scoring) ──
    // This call may return null. That is expected and handled.
    const evaluation = await this.evaluateWithBackend(question, answer);

    // ── Step 4: Adaptive band movement ──
    if (evaluation) {
      // LLM result informs band movement as a SECONDARY signal.
      // It does NOT change the score or correctness that was recorded.
      const recentStrong = this.countRecentStrongResults();
      this.state.currentTargetBand = decideNextBand(
        this.state.currentTargetBand as GroqBand,
        evaluation,
        recentStrong
      ) as DifficultyBand;
    } else {
      // No LLM data — use deterministic heuristic for band movement.
      this.updateTargetBand();
    }

    // ── Step 5: Task evaluation recording ──
    const taskEval: TaskEvaluation = {
      taskId: question.id,
      skill: question.primarySkill as SkillName,
      validAttempt: responseTimeMs > 2000,
      rawSignals: {
        responseTimeMs,
        score,
        isCorrect: correct,
        difficulty: question.difficulty,
        answerLength: answer.length,
      },
      rubricScores: [
        { criterion: 'correctness', score: correct ? 1 : 0, maxScore: 1 },
        { criterion: 'quality', score: Math.round(score * 10), maxScore: 10 }
      ],
      matchedDescriptors: evaluation ? [
        { 
          descriptorId: `${question.primarySkill}_${evaluation.matchedBand}`, 
          support: evaluation.confidence 
        }
      ] : []
    };
    this.state.taskEvaluations.push(taskEval);

    this.state.overallConfidence = this.computeOverallConfidence();

    return { correct, score };
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
      const bands = ['Pre-A1', 'A1', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C2'];
      const idx = bands.indexOf(currentBand);
      const targetBands: string[] = [currentBand];
      if (idx > 0) targetBands.push(bands[idx - 1]);
      if (idx < bands.length - 1 && bands[idx] !== 'B2') targetBands.push(bands[idx + 1]);

      let skillIdentifier = question.skill;
      if (skillIdentifier === 'grammar' || skillIdentifier === 'vocabulary') {
          skillIdentifier = question.primarySkill || question.skill; 
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const relevantDescriptors = descriptorService.getRelevantDescriptors(skillIdentifier, targetBands);

      if (relevantDescriptors.length === 0) return null;

      // Group by band for the payload
      const descriptorsMap: Partial<Record<GroqBand, string[]>> = {};
      for (const d of relevantDescriptors) {
        const b = d.level as GroqBand;
        if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(b)) {
          if (!descriptorsMap[b]) descriptorsMap[b] = [];
          descriptorsMap[b]!.push(d.descriptor);
        }
      }

      return await evaluateWithGroq({
        skill: skillIdentifier as "reading" | "writing" | "listening" | "speaking" | "vocabulary" | "grammar",
        currentBand: currentBand as GroqBand,
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
    const overallBand = this.estimateOverallBand();
    const skillBreakdown = {} as AssessmentOutcome['skillBreakdown'];

    for (const skill of ALL_SKILLS) {
      const est = this.state.skillEstimates[skill];
      skillBreakdown[skill] = {
        band: est.band,
        score: Math.round(est.score),
        confidence: Math.round(est.confidence * 100) / 100,
        evidenceCount: est.evidenceCount,
      };
    }

    return {
      overallBand,
      overallConfidence: Math.round(this.state.overallConfidence * 100) / 100,
      skillBreakdown,
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
          difficulty: record.difficulty,
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

  private updateSkillEstimate(question: AssessmentQuestion, record: AnswerRecord): void {
    // Update primary skill
    this.updateSingleSkillEstimate(question.primarySkill, record);

    // Update secondary skills with reduced weight
    if (question.secondarySkills) {
      for (const secondary of question.secondarySkills) {
        const reducedRecord = { ...record, score: record.score * 0.5 };
        this.updateSingleSkillEstimate(secondary, reducedRecord);
      }
    }
  }

  private updateSingleSkillEstimate(skill: AssessmentSkill, record: AnswerRecord): void {
    const est = this.state.skillEstimates[skill];
    est.evidenceCount++;

    // Track band-specific performance
    if (!est.bandPerformance[record.difficulty]) {
      est.bandPerformance[record.difficulty] = { correct: 0, total: 0 };
    }
    est.bandPerformance[record.difficulty]!.total++;
    if (record.correct) {
      est.bandPerformance[record.difficulty]!.correct++;
    }

    // Compute skill score from band performance evidence
    est.score = this.computeSkillScore(est);
    est.band = this.scoreToBand(est.score);
    est.confidence = this.computeSkillConfidence(est);
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
    const evidenceFactor = Math.min(1, est.evidenceCount / 4); // max out at 4 pieces of evidence

    // Check consistency: are answers at the same level consistent?
    let consistency = 1.0;
    const perfs = Object.values(est.bandPerformance).filter(p => p !== undefined && p.total > 0) as { correct: number; total: number }[];
    if (perfs.length > 0) {
      // Consistency = how many bands have clear pass/fail (not mixed)
      const clearBands = perfs.filter(p => {
        const acc = p.correct / p.total;
        return acc >= 0.8 || acc <= 0.2; // clearly passing or failing
      }).length;
      consistency = perfs.length > 0 ? clearBands / perfs.length : 0.5;
    }

    return Math.min(1.0, evidenceFactor * 0.7 + consistency * 0.3);
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
      const ansVal = BAND_VALUE[a.difficulty];
      return Math.abs(ansVal - currentVal) <= 1;
    });

    if (nearBandAnswers.length < 2) return;

    const recentCorrect = nearBandAnswers.filter(a => a.correct).length;
    const recentIncorrect = nearBandAnswers.length - recentCorrect;

    // Check for consistent strong performance → promote
    if (recentCorrect >= CONFIG.PROMOTE_THRESHOLD && recentIncorrect <= 1) {
      this.stepBandUp();
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

    // Score each candidate
    const scored = available.map(q => ({
      question: q,
      score: this.scoreCandidate(q),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Take the highest scoring candidate
    return scored[0].question;
  }

  /**
   * Scores a candidate question for selection priority.
   * Higher score = better candidate.
   */
  private scoreCandidate(q: AssessmentQuestion): number {
    let score = 0;

    // ── Factor 1: Difficulty proximity (weight: 40) ──
    const targetVal = BAND_VALUE[this.state.currentTargetBand];
    const qVal = BAND_VALUE[q.difficulty];
    const distance = Math.abs(targetVal - qVal);
    
    // Exact match = 40, 1 away = 25, 2 away = 10, 3+ away = 0
    // Moderate preference for questions one step above (probing ceiling)
    if (qVal === targetVal + 1) score += 12;
    // Slight preference for questions matching target exact
    if (qVal === targetVal) score += 10;
    
    // Penalize large gaps unless desperate
    if (distance > 1) score -= distance * 5;

    // ── Factor 2: Skill coverage (weight: 30) ──
    const { evidenceCount, confidence } = this.state.skillEstimates[q.primarySkill];

    // Under-tested skills get huge priority
    if (evidenceCount === 0) score += 30;
    else if (evidenceCount === 1) score += 20;
    else if (evidenceCount < CONFIG.SKILL_EVIDENCE_TARGET) score += 10;
    else score += 0; // well-tested

    // ── Factor 3: Weak/uncertain skill priority (weight: 20) ──
    if (confidence < 0.3) score += 20;
    else if (confidence < 0.5) score += 12;
    else if (confidence < 0.7) score += 5;

    // ── Factor 4: Question type variety (weight: 10) ──
    // Prefer question types we haven't seen much
    const typeCounts = this.state.answerHistory.reduce((acc, r) => {
      const rq = this.questionPool.find(x => x.id === r.questionId);
      if (rq) acc[rq.type] = (acc[rq.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const typeCount = typeCounts[q.type] || 0;
    if (typeCount === 0) score += 10;
    else if (typeCount === 1) score += 5;

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

    // 1. Hard cap
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

    // Count tested skills
    const testedSkills = ALL_SKILLS.filter(s => this.state.skillEstimates[s].evidenceCount > 0);
    if (testedSkills.length < CONFIG.MIN_SKILLS_TESTED) return false;

    // 3. Confidence threshold
    if (this.state.overallConfidence >= CONFIG.CONFIDENCE_STOP_THRESHOLD) {
      this.state.stopReason = 'confidence_threshold';
      return true;
    }

    // 4. Level stability (after target questions)
    if (n >= CONFIG.TARGET_QUESTIONS) {
      const recentBands = this.state.answerHistory
        .slice(-CONFIG.STABILITY_WINDOW)
        .map(a => a.difficulty);
      
      // If the band hasn't changed in the window, we've stabilized
      const uniqueBands = new Set(recentBands);
      if (uniqueBands.size <= 2) { // answers from at most 2 adjacent bands
        this.state.stopReason = 'level_stabilized';
        return true;
      }
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
      const recentBands = recent.map(a => BAND_VALUE[a.difficulty]);
      const variance = this.computeVariance(recentBands);
      stabilityFactor = Math.max(0, 1 - variance * 0.5); // lower variance → higher stability
    }

    // Weighted combination
    return (
      countFactor * 0.25 +
      coverageFactor * 0.2 +
      avgSkillConfidence * 0.35 +
      stabilityFactor * 0.2
    );
  }

  private computeVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => (v - mean) ** 2);
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
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
      a => a.correct && (a.difficulty === 'B2' || a.difficulty === 'C1')
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

    // Check for failed high-frequency questions
    const lowBandErrors = this.state.answerHistory.filter(
      a => !a.correct && (a.difficulty === 'A1' || a.difficulty === 'A2')
    );
    if (lowBandErrors.length >= 2) {
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
}
