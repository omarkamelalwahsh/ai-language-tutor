/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 40-Question Fixed-Length Adaptive Assessment Engine
 * 
 * Block Order: Reading+Grammar(15) → Writing(5) → Listening(15) → Speaking(5)
 * Skill Quotas: Reading(8) Grammar(7) Listening(15) Writing(5) Speaking(5)
 * Scoring: CEFR-weighted (A1=0.1 → C2=1.0)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  AssessmentQuestion,
  AnswerRecord,
  AssessmentOutcome,
  TaskEvaluation,
  CefrLevel,
  ResponseMode,
  SpeakingSubmissionMeta,
  LearnerContextProfile,
} from '../types/assessment';
import { supabase } from '../lib/supabaseClient';
import { GroqScoringService } from './GroqScoringService';
import {
  CEFRLevel, 
  QuestionBankItem, 
} from '../types/efset';
import { BatterySelector, BatteryQuestion } from '../engine/selector/AdaptiveSelector';
import { CEFREngine } from '../engine/cefr/CEFREngine';
import { ASSESSMENT_CONFIG, DifficultyZone } from '../config/assessment-config';
import { AssessmentSaveService } from './AssessmentSaveService';
import { extractOptions, extractAnswerMetadata } from '../lib/utils';

// CEFR → numeric difficulty (mirrors ASSESSMENT_CONFIG.CEFR_DIFFICULTY_MAP)
const DIFF_MAP: Record<string, number> = {
  'a1': 0.1, 'a2': 0.2,
  'b1': 0.4, 'b2': 0.6,
  'c1': 0.8, 'c2': 1.0
};

export interface BatteryProgress {
  answered: number;
  total: number;
  percentage: number;
  currentBlock: number;
  currentSkill: string | null;
  currentZone: DifficultyZone | null;
  completed: boolean;
}

export class AdaptiveAssessmentEngine {
  private battery: BatteryQuestion[] = [];
  private currentIndex: number = 0;
  private skillScores: Record<string, { earned: number; total: number }> = {};
  
  private answerHistory: AnswerRecord[] = [];
  private taskEvaluations: TaskEvaluation[] = [];
  private completed: boolean = false;
  private levelCapReached: boolean = false;

  
  public assessmentId: string;
  private userId: string | null = null;
  private STORAGE_KEY: string;
  public isStaticBattery: boolean = false;

  constructor(
    _startingLevel: CEFRLevel = 'B1', 
    _context?: LearnerContextProfile, 
    userId: string | null = null,
    initialBattery?: BatteryQuestion[]
  ) {
    this.userId = userId || (typeof window !== 'undefined' ? localStorage.getItem('auth_user_id') : null);
    // Initialize with a temporary ID, will be replaced by initialize()
    this.assessmentId = "pending-sync";
    
    this.STORAGE_KEY = `asmt_state_${this.userId || 'guest'}`;

    if (initialBattery && initialBattery.length > 0) {
      this.battery = initialBattery;
      this.isStaticBattery = true;
      console.log(`[Engine] Initialized with pre-fetched static battery (${this.battery.length} questions).`);
    }

    // Fixed-Length quotas: reading=8, grammar=7, listening=15, writing=5, speaking=5
    const SKILL_TOTALS: Record<string, number> = {
      reading: 8, grammar: 7, listening: 15, writing: 5, speaking: 5
    };
    Object.entries(SKILL_TOTALS).forEach(([s, total]) => {
      this.skillScores[s] = { earned: 0, total };
    });

    // Only recover if we don't have a static battery or if we need to resume
    this.tryRecoverState();
  }

  public hasBattery(): boolean {
    return this.battery && this.battery.length > 0;
  }

  private tryRecoverState() {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      // Only recover if the saved session is later in progress or we have no battery
      if (saved.battery && saved.battery.length > 0 && (saved.currentIndex > this.currentIndex || !this.battery.length)) {
        this.battery = saved.battery;
        this.currentIndex = saved.currentIndex;
        this.skillScores = saved.skillScores;
        this.answerHistory = saved.answerHistory;
        this.taskEvaluations = saved.taskEvaluations;
        this.assessmentId = saved.assessmentId;
        console.log(`[Engine] Recovered assessment ${this.assessmentId} at Q${this.currentIndex + 1}/${this.battery.length}`);
      }
    } catch (e) {
      console.warn("[Engine] Failed to recover state:", e);
    }
  }

  private saveState() {
    if (typeof window === 'undefined') return;
    const state = {
      battery: this.battery,
      currentIndex: this.currentIndex,
      skillScores: this.skillScores,
      answerHistory: this.answerHistory,
      taskEvaluations: this.taskEvaluations,
      assessmentId: this.assessmentId
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  }

  public async initialize(): Promise<string> {
    if (this.assessmentId !== "pending-sync") return this.assessmentId;

    try {
      console.log(`[Engine] Initializing assessment on backend...`);
      const response = await fetch("/api/assessments/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: this.userId,
          starting_level: 'B1'
        })
      });

      if (!response.ok) throw new Error("Failed to start assessment on backend");
      
      const data = await response.json();
      this.assessmentId = data.assessment_id;
      console.log(`[Engine] Assessment initialized with ID: ${this.assessmentId}`);
      this.saveState();
      return this.assessmentId;
    } catch (err) {
      console.error("[Engine] Initialization failed:", err);
      // Fallback to local ID if backend is down
      this.assessmentId = "local-" + Math.random().toString(36).substr(2, 9);
      return this.assessmentId;
    }
  }

  private clearState() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.STORAGE_KEY);
  }

  public async getNextQuestion(): Promise<AssessmentQuestion | null> {
    if (this.completed) return null;
    
    // 🛡️ RECOVERY ORCHESTRATION: If battery is empty, try Remote Sync before fetching New
    if (this.battery.length === 0) {
      console.log("[Engine] Local battery empty. Attempting remote recovery...");
      
      if (this.userId) {
        const remoteState = await AssessmentSaveService.getLatestAssessmentState(this.userId);
        if (remoteState) {
          console.log(`[Engine] ✅ Recovered remote state: ${remoteState.assessmentId} at index ${remoteState.currentIndex}`);
          this.battery = remoteState.battery;
          this.currentIndex = remoteState.currentIndex;
          this.skillScores = remoteState.skillScores;
          this.answerHistory = remoteState.answerHistory;
          this.taskEvaluations = remoteState.taskEvaluations;
          this.assessmentId = remoteState.assessmentId;
          this.saveState(); // Sync back to local
        }
      }

      // If still empty after remote check, fetch BRAND NEW
      if (this.battery.length === 0) {
        console.log("[Engine] No remote session found. Fetching brand new battery...");
        this.battery = await BatterySelector.fetchAndBuild(this.userId || "");
        
        if (this.battery.length === 0) {
          console.error("[Engine] ❌ CRITICAL: BatterySelector returned 0 questions. Breaking initialization.");
          throw new Error("Failed to generate assessment battery. Please check your internet connection or try again.");
        }

        console.log(`[Engine] ✅ Fresh battery fetched with ${this.battery.length} items. Preparing to sync session...`);
        this.saveState();
        
        // 🚀 Immediate Sync: Call createSession BEFORE any complex logic
        // Using a default B1 prediction context if not pre-evaluated, ensuring we don't look for 'ready: true'
        await AssessmentSaveService.createSession(
          this.assessmentId, 
          this.userId, 
          this.battery.length, 
          { prediction: "B1", status: "architected", source: "engine_init" }
        );
        
        // Remove await from syncStateToRemote so it doesn't block UI transition
        this.syncStateToRemote();
      }
    }

    if (this.currentIndex >= this.battery.length) {
      this.completed = true;
      this.clearState();
      return null;
    }

    return this.buildQuestionObject(this.battery[this.currentIndex]);
  }

  public async submitAnswer(
    question: AssessmentQuestion,
    answer: string,
    responseTimeMs: number,
    responseMode?: ResponseMode,
    speakingMeta?: SpeakingSubmissionMeta
  ): Promise<{ correct: boolean; score: number; evaluation: any }> {
    const batteryQ = (question as any)._battery as BatteryQuestion;
    const item = batteryQ.item;
    
    // Determine numerical difficulty and level (strictly lowercase)
    const levelOrDiff = item.level || 'b1';
    const canonicalLevel = String(levelOrDiff).toLowerCase();
    const difficultyVal = item.difficulty || DIFF_MAP[canonicalLevel] || 0.4;
    
    let evaluation: any;
    
    // 🛡️ STRICT RESPONSE MODE CLASSIFICATION
    // Use response_mode as the primary discriminator:
    //   'mcq'   → deterministic MCQ check (grammar, vocab, reading, listening)
    //   'typed' → AI evaluation (writing tasks)
    //   'audio' → AI evaluation (speaking tasks)
    const itemMode = (item.response_mode || 'mcq') as string;
    const isProductionTask = itemMode === 'typed' || itemMode === 'audio';
    const isMCQTask = !isProductionTask && item.options && item.options.length > 0;
    
    const isLastQuestion = this.currentIndex === this.battery.length - 1;

    if (isMCQTask) {
      const isCorrect = this.checkMCQ(item, answer);
      evaluation = { 
        score: isCorrect ? 1.0 : 0.0, 
        is_correct: isCorrect, 
        feedback: isCorrect ? "Correct!" : "Incorrect." 
      };
      
      // FIRE MCQ TO BACKEND SO IT ALSO HITS THE ENDPOINT TO UPDATE PROFILE IF LAST
      if (isLastQuestion) {
        console.log(`[Engine] ⚡ Flagging last question to backend evaluate...`);
        // We push it asynchronously so it registers the isLastQuestion flag on the DB side
        GroqScoringService.getScoringResultFromAPI(question, answer, canonicalLevel, true).catch(e => console.warn(e));
      }
    } else if (isProductionTask) {
      // AI evaluation for Writing/Speaking (open-ended production tasks)
      console.log(`[Engine] 🤖 Evaluating ${item.skill} (${itemMode}) via AI...`);
      evaluation = await GroqScoringService.getScoringResultFromAPI(question, answer, canonicalLevel, isLastQuestion);
      // Ensure is_correct is derived from score for production tasks
      if (evaluation.is_correct === undefined) {
        evaluation.is_correct = (evaluation.score || 0) >= 0.5;
      }
    } else {
      // Fallback: MCQ skill without options — attempt AI evaluation
      console.log(`[Engine] ⚠️ ${item.skill} MCQ missing options, falling back to AI evaluation...`);
      evaluation = await GroqScoringService.getScoringResultFromAPI(question, answer, canonicalLevel, isLastQuestion);
      if (evaluation.is_correct === undefined) {
        evaluation.is_correct = (evaluation.score || 0) >= 0.5;
      }
    }

    // 🏋️ WEIGHTED PROFICIENCY SCORING: score * difficulty
    const earnedPoints = (evaluation.score || 0) * difficultyVal;
    const skill = item.skill.toLowerCase();
    
    if (this.skillScores[skill]) {
      this.skillScores[skill].earned += earnedPoints;
      this.skillScores[skill].total += difficultyVal; // Maintain relative total
    }

    // 🔍 INCONSISTENT DETECTION
    // Flag if: This is HARD, correct, and last 2 EASY questions were failed.
    const isHard = difficultyVal >= 0.7;
    const isCorrect = evaluation.is_correct || evaluation.score >= 0.5;
    
    let is_inconsistent = false;
    if (isHard && isCorrect) {
      const easyFailures = this.answerHistory
        .filter(a => a.difficulty <= 0.3)
        .slice(-2)
        .filter(a => !a.correct);
      
      if (easyFailures.length >= 2) {
        is_inconsistent = true;
        evaluation.inconsistent = true;
        evaluation.evaluation_metadata = { ...evaluation.evaluation_metadata, flagged_as: 'inconsistent' };
      }
    }

    // 🎯 Snapshot User Level calculation
    const currentOutcome = this.getOutcome();
    const snapLevel = currentOutcome.overall.estimatedLevel;

    this.answerHistory.push({
      taskId: item.id, 
      questionId: item.id, 
      skill: item.skill as any,
      difficulty: difficultyVal,
      questionLevel: canonicalLevel,
      answerLevel: snapLevel,
      category: item.skill,
      correct: isCorrect,
      score: evaluation.score, 
      answer, 
      correctAnswer: this.getCorrectAnswer(item),
      responseTimeMs, 
      taskType: item.task_type as any
    });

    this.taskEvaluations.push(evaluation);
    this.currentIndex++;

    // 🎯 STRICT BLOCK ENFORCEMENT
    // The previous 80% Rule (Level Capping) is now DISABLED.
    // The engine must strictly follow the 3-4-3 difficulty distribution.
    if (this.currentIndex === 10 && !this.levelCapReached) {
      const firstTen = this.answerHistory.slice(0, 10);
      const correctCount = firstTen.filter(a => a.correct).length;
      const successRate = (correctCount / 10) * 100;
      console.log(`[Engine] 📊 First 10 Check: ${successRate}% success rate. Proceeding with strict 3-4-3 blocks.`);
    }
    
    if (this.currentIndex >= this.battery.length) {
      this.completed = true;
      this.clearState();
    } else {
      // 🚀 Intermediate Skill Sync: Check if the current block just finished
      const nextQ = this.battery[this.currentIndex];
      const currentBlock = batteryQ.block || 1;
      const nextBlock = nextQ?.block || null;

      if (nextBlock !== null && nextBlock !== currentBlock) {
        console.log(`[Engine] 🏁 Block ${currentBlock} finished. Syncing intermediate skill states...`);
        this.syncIntermediateSkills();
      }

      this.saveState();
    }

    return { 
      correct: isCorrect, 
      score: evaluation.score, 
      evaluation 
    };
  }

  /**
   * Syncs the current skill performance to the database immediately after a block finishes.
   */
  private async syncIntermediateSkills() {
    if (!this.userId) return;
    
    const outcome = this.getOutcome();
    const currentSkill = this.battery[this.currentIndex - 1]?.skill;
    
    if (currentSkill && outcome.skillBreakdown[currentSkill]) {
      const skillData = outcome.skillBreakdown[currentSkill];
      console.log(`[Engine] 🔄 Intermediate Sync for skill: ${currentSkill} (${skillData.band})`);
      
      try {
        await AssessmentSaveService.updateSkillState(
          this.userId, 
          currentSkill, 
          skillData.confidence, 
          skillData.band
        );
      } catch (err) {
        console.warn(`[Engine] Intermediate skill sync failed for ${currentSkill}:`, err);
      }
    }
  }

  /**
   * Removes questions from the remaining battery that exceed the specified TrueDifficulty.
   */
  private applyLevelCap(maxDifficulty: number) {
    const remaining = this.battery.slice(this.currentIndex);
    const filtered = remaining.filter(q => {
        const diff = q.item.difficulty || 0.5;
        const levelWeight = this.getLevelWeight(q.item.level || 'b1');
        const trueDiff = levelWeight + (diff * 0.1);
        return trueDiff <= maxDifficulty;
    });

    console.log(`[Engine] 🛡️ Level Cap applied. Removed ${remaining.length - filtered.length} advanced questions.`);
    this.battery = [...this.battery.slice(0, this.currentIndex), ...filtered];
  }

  private getLevelWeight(cefr: string): number {
    const l = cefr.toLowerCase();
    const weights: Record<string, number> = {
      'a1': 1.0, 'a2': 2.0, 'b1': 3.0, 'b2': 4.0, 'c1': 5.0, 'c2': 6.0
    };
    return weights[l] || 3.0;
  }


  private reorderRemainingBattery(currentDifficulty: number) {
    const remaining = this.battery.slice(this.currentIndex);
    // Separate production and receptive to preserve interleaving
    const production = remaining.filter(q => ['writing', 'speaking'].includes(q.skill.toLowerCase()));
    const receptive = remaining.filter(q => !['writing', 'speaking'].includes(q.skill.toLowerCase()));
    
    // Sort receptive items so that higher difficulty comes first if we are doing well
    receptive.sort((a, b) => {
      const diffA = a.item.difficulty || DIFF_MAP[a.item.level?.toLowerCase() || 'b1'] || 0.4;
      const diffB = b.item.difficulty || DIFF_MAP[b.item.level?.toLowerCase() || 'b1'] || 0.4;
      return diffB - diffA;
    });
    
    // Re-interleave: insert production tasks at regular intervals
    const reinterleaved: typeof remaining = [];
    const interval = production.length > 0 ? Math.floor(receptive.length / (production.length + 1)) : receptive.length;
    let pIdx = 0;
    receptive.forEach((q, i) => {
      reinterleaved.push(q);
      if ((i + 1) % interval === 0 && pIdx < production.length) {
        reinterleaved.push(production[pIdx++]);
      }
    });
    // Push any remaining production tasks
    while (pIdx < production.length) reinterleaved.push(production[pIdx++]);
    
    this.battery = [...this.battery.slice(0, this.currentIndex), ...reinterleaved];
  }

  /**
   * Pushes the entire session state to Supabase for cross-device resilience.
   */
  public async syncStateToRemote() {
    if (!this.userId) return;
    
    console.log(`[Engine] 🔄 Pushing remote state sync for ${this.assessmentId}...`);
    
    const state = {
      battery: this.battery,
      currentIndex: this.currentIndex,
      skillScores: this.skillScores,
      answerHistory: this.answerHistory,
      taskEvaluations: this.taskEvaluations,
      assessmentId: this.assessmentId,
      syncedAt: new Date().toISOString()
    };

    await AssessmentSaveService.saveAssessmentState(
      this.assessmentId, 
      state, 
      this.userId
    );
  }

  /**
   * Returns a snapshot of the current engine state for UI or testing.
   */
  public getState() {
    return {
      battery: this.battery,
      currentIndex: this.currentIndex,
      skillScores: this.skillScores,
      answerHistory: this.answerHistory,
      taskEvaluations: this.taskEvaluations,
      assessmentId: this.assessmentId,
      isStaticBattery: this.isStaticBattery
    };
  }

  private checkMCQ(item: any, answer: string): boolean {
    const options = extractOptions(item.options || item.answer_key);
    const { correctValue } = extractAnswerMetadata(item.answer_key, options);
    
    // Path 1: Direct text match against correctValue
    if (correctValue && answer.trim().toLowerCase() === correctValue.trim().toLowerCase()) {
      return true;
    }
    // Note: extractAnswerMetadata already handles the index-to-text mapping if needed.
    return false;
  }

  private getCorrectAnswer(item: any): string {
    // Production tasks (writing/speaking) don't have a single "correct" answer
    const mode = (item.response_mode || 'mcq') as string;
    if (mode === 'typed' || mode === 'audio') {
      return item.rubric || item.model_answer || '';
    }
    const options = extractOptions(item.options || item.answer_key);
    const { correctValue } = extractAnswerMetadata(item.answer_key, options);
    return correctValue || '';
  }

  /**
   * Exhaustively extracts MCQ options, correct_index, and correctValue
   * from all known answer_key structures (legacy + new CEFR bank).
   * @deprecated Use extractOptions and extractAnswerMetadata from lib/utils instead.
   */
  private extractMCQData(item: any): { options: string[] | null; correctIndex: number | null; correctValue: string | null } {
    const options = extractOptions(item.options || item.answer_key);
    const { correctIndex, correctValue } = extractAnswerMetadata(item.answer_key, options);
    return { options, correctIndex, correctValue };
  }

  public getOutcome(): AssessmentOutcome {
    let totalScore = 0;
    let maxBasePoints = 0;
    
    Object.values(this.skillScores).forEach(s => {
      totalScore += s.earned;
      maxBasePoints += s.total;
    });
    
    // Calculate percentage based on weighted difficulty potential
    const percentage = maxBasePoints > 0 ? Math.round((totalScore / maxBasePoints) * 100) : 0;
    const cefr = CEFREngine.mapPercentageToLevel(percentage) || "A1";

    const breakdown: any = {};
    const ALL_SKILLS = ['reading', 'listening', 'grammar', 'vocabulary', 'writing', 'speaking'];
    ALL_SKILLS.forEach((skill) => {
      const data = this.skillScores[skill] || { earned: 0, total: 0 };
      const skillPct = data.total > 0 ? Math.round((data.earned / data.total) * 100) : 0;
      breakdown[skill] = {
        band: CEFREngine.mapPercentageToLevel(skillPct) || "A1",
        score: skillPct || 0,
        confidence: 0.9,
        evidenceCount: this.answerHistory.filter(a => a.skill === skill).length || 0,
        status: 'stable'
      };
    });

    // ── Computed Metrics (never NULL) ──
    const totalAnswered = this.answerHistory.length || this.currentIndex;
    const correctCount = this.answerHistory.filter(a => a.correct).length;
    const accuracyRate = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

    // Pacing: benchmark = 45 seconds per question
    const PACING_BENCHMARK_MS = 45_000;
    const totalTimeMs = this.answerHistory.reduce((sum, a) => sum + (a.responseTimeMs || 0), 0);
    const avgResponseTimeMs = totalAnswered > 0 ? Math.round(totalTimeMs / totalAnswered) : 0;
    // Pacing = how close to benchmark (100 = perfect, >100 = too slow, <100 = fast)
    // Clamp between 0-100 where 100 = at or under benchmark
    const rawPacing = avgResponseTimeMs > 0 ? (PACING_BENCHMARK_MS / avgResponseTimeMs) * 100 : 100;
    const pacingScore = Math.min(100, Math.max(0, Math.round(rawPacing)));

    return {
      overall: {
        estimatedLevel: cefr as CefrLevel,
        confidence: 0.9,
        rationale: [`Weighted Score: ${totalScore.toFixed(2)}/ ${maxBasePoints.toFixed(2)} (${percentage}%)`]
      },
      overallBand: cefr as any,
      overallConfidence: 0.9,
      skillBreakdown: breakdown,
      strengths: [], weaknesses: [],
      answerHistory: this.answerHistory,
      totalQuestions: this.currentIndex,
      stopReason: 'max_reached',
      // ── Profile Metrics ──
      accuracyRate: Math.min(100, Math.max(0, accuracyRate)),
      pacingScore: Math.min(100, Math.max(0, pacingScore)),
      averageResponseTimeMs: avgResponseTimeMs,
      totalQuestionsAnswered: totalAnswered,
      speakingAudit: { 
        micCheckPassed: true, voiceRecordingsAttempted: 0, voiceRecordingsValid: 0,
        typedFallbacksUsed: 0, speakingTasksTotal: 5, hasAnySpeakingEvidence: true,
        speakingFallbackApplied: false
      }
    };
  }

  public getProgress(): BatteryProgress {
    const q = this.battery[this.currentIndex];
    const total = this.battery.length || 40;
    return {
      answered: this.currentIndex,
      total: total,
      percentage: (this.currentIndex / total) * 100,
      currentBlock: q?.block || 1,
      currentSkill: q?.skill || null,
      currentZone: q?.zone || null,
      completed: this.completed
    };
  }

  public getEvaluations(): TaskEvaluation[] { return this.taskEvaluations; }
  public getAnswerHistory(): AnswerRecord[] { return this.answerHistory; }
  
  public async finalizeAssessment(): Promise<boolean> { 
    this.completed = true; 
    this.clearState();
    return true; 
  }

  public async skipQuestion(questionId: string): Promise<AssessmentQuestion | null> {
    this.currentIndex++;
    this.saveState();
    return this.getNextQuestion();
  }

  private buildQuestionObject(batteryQ: BatteryQuestion): AssessmentQuestion {
    const item = batteryQ.item;
    
    // For listening tasks: stimulus is the audio URL
    const audioSource = item.audio_url || (item.skill === 'listening' ? item.stimulus : undefined);
    
    const options = extractOptions(
      (item.options && item.options.length > 0) ? item.options : item.answer_key
    );
    
    return {
      id: item.id, 
      prompt: item.prompt, 
      skill: item.skill as any,
      difficulty: item.level as any, 
      type: item.task_type as any,
      response_mode: item.response_mode as any, 
      stimulus: item.stimulus,
      options: options, 
      audioUrl: audioSource,
      _battery: batteryQ,
    } as any;
  }
}
