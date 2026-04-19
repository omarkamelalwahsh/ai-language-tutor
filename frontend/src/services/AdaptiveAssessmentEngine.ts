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
  private syncAttempts: Set<string> = new Set(); // Track synced question IDs

  constructor(
    _startingLevel: CEFRLevel = 'B1', 
    _context?: LearnerContextProfile, 
    userId: string | null = null,
    initialBattery?: BatteryQuestion[]
  ) {
    this.userId = userId; // Preferred from props
    // 🛡️ MUST BE A VALID UUID: 'fresh-start' is invalid in Supabase UUID columns
    this.assessmentId = initialBattery ? crypto.randomUUID() : crypto.randomUUID(); 

    this.STORAGE_KEY = `asmt_state_${this.userId || 'guest'}`;

    if (initialBattery && initialBattery.length > 0) {
      console.log(`[Engine] 🆕 New Battery Detected. Purging previous state...`);
      this.clearState(); // 🛡️ PURGE ON START
      this.battery = initialBattery;
      this.isStaticBattery = true;
    }

    // Fixed-Length quotas are used for battery selection, but scoring totals 
    // must strictly accumulate difficulty weights starting from 0.
    const SKILLS = ['reading', 'grammar', 'listening', 'writing', 'speaking', 'vocabulary'];
    SKILLS.forEach((s) => {
      this.skillScores[s] = { earned: 0, total: 0 };
    });

    // Only recover if we don't have a static battery or if we need to resume
    this.tryRecoverState();
  }


  public hasBattery(): boolean {
    return this.battery && this.battery.length > 0;
  }

  /**
   * 🎯 AUTH SYNC: Allows the engine to receive a User ID after initialization.
   * This is critical for new signups where the Auth context might be delayed.
   */
  public setUserId(userId: string) {
    if (this.userId === userId) return;
    
    console.log(`[Engine] 🔐 Auth Sync: Updating UserID from ${this.userId || 'guest'} to ${userId}`);
    this.userId = userId;
    this.STORAGE_KEY = `asmt_state_${this.userId}`;
    this.saveState();

    // 🚀 RETROACTIVE SYNC: Flush any previously answered questions to the DB
    if (this.answerHistory.length > 0) {
      console.log(`[Engine] 🔄 Flushing ${this.answerHistory.length} historical answers to remote DB...`);
      this.flushPendingSyncs();
    }
  }

  private async flushPendingSyncs() {
    if (!this.userId) return;

    for (const record of this.answerHistory) {
      const qid = record.questionId || record.taskId;
      if (this.syncAttempts.has(qid)) continue;

      // Find the corresponding item in the battery
      const batteryQ = this.battery.find(bq => bq.item.id === qid);
      if (!batteryQ) continue;

      try {
        await AssessmentSaveService.log_and_update_assessment(
          {
            ...batteryQ.item,
            assessmentId: this.assessmentId,
            difficulty_numeric: record.difficulty
          },
          { score: record.score, is_correct: record.correct, feedback: "" },
          record.answer || "",
          this.userId,
          record.responseTimeMs || 0
        );
        this.syncAttempts.add(qid);
      } catch (err) {
        console.warn(`[Engine] ⚠️ Retroactive sync failed for question ${qid}:`, err);
      }
    }
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
    // assessmentId is always a valid UUID from crypto.randomUUID() set in constructor

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const sessionUserId = session?.user?.id;

      // Update userId if it was null or different
      if (sessionUserId) this.userId = sessionUserId;

      if (!token) {
        console.warn("[Engine] No auth session found. Using local flow.");
      }

      console.log(`[Engine] Initializing assessment on backend...`);
      const response = await fetch("/api/assessments/start", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: this.userId,
          starting_level: 'B1'
        })
      });

      if (!response.ok) throw new Error("Failed to start assessment on backend");
      
      const data = await response.json();
      this.assessmentId = data.assessment_id;
      console.log(`[Engine] Initialization successful (Assessment ID: ${this.assessmentId}) 🚀🔥`);
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
        
        // 🚀 IMMEDIATE LOCKDOWN: Sync the entire battery to remote state
        this.saveState();
        
        await AssessmentSaveService.createSession(
          this.assessmentId, 
          this.userId, 
          this.battery.length, 
          { prediction: "B1", status: "architected", source: "engine_init", battery: this.battery }
        );
        
        // Final sync of the full state blob
        await this.syncStateToRemote();
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
    const batteryQ = (question as any)._battery as BatteryQuestion | undefined;
    const item = batteryQ ? batteryQ.item : (question as any);
    
    // Determine numerical difficulty and level (strictly lowercase)
    const levelOrDiff = item.level || item.difficulty || question.difficulty || 'b1';
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
    
    // 🛡️ Robust MCQ Check: Look at both the raw options AND the extracted options in the question object
    const questionOptions = (question as any).options;
    const isMCQTask = !isProductionTask && ((item.options && item.options.length > 0) || (questionOptions && questionOptions.length > 0));
    
    const isLastQuestion = this.currentIndex === this.battery.length - 1;

    try {
      if (isMCQTask) {
        const isCorrect = this.checkMCQ(item, answer);
        evaluation = { 
          score: isCorrect ? 1.0 : 0.0, 
          is_correct: isCorrect, 
          feedback: isCorrect ? "Correct!" : "Incorrect." 
        };
        
        if (isLastQuestion) {
          console.log(`[Engine] ⚡ Flagging last question to backend evaluate...`);
          GroqScoringService.getScoringResultFromAPI(question, answer, canonicalLevel, this.assessmentId, true).catch(e => console.warn(e));
        }
      } else if (isProductionTask) {
        console.log(`[Engine] 🤖 Evaluating ${item.skill} (${itemMode}) via AI...`);
        evaluation = await GroqScoringService.getScoringResultFromAPI(question, answer, canonicalLevel, this.assessmentId, isLastQuestion);
        if (evaluation.is_correct === undefined) {
          evaluation.is_correct = (evaluation.score || 0) >= 0.5;
        }
      } else {
        console.log(`[Engine] ⚠️ ${item.skill} MCQ missing options, falling back to AI evaluation...`);
        evaluation = await GroqScoringService.getScoringResultFromAPI(question, answer, canonicalLevel, this.assessmentId, isLastQuestion);
        if (evaluation.is_correct === undefined) {
          evaluation.is_correct = (evaluation.score || 0) >= 0.5;
        }
      }

      // 🏋️ WEIGHTED PROFICIENCY SCORING: score * difficulty
      const primarySkill = item.skill.toLowerCase();
      
      // Accumulate for Primary Skill
      if (this.skillScores[primarySkill]) {
        this.skillScores[primarySkill].earned += (evaluation.score || 0) * difficultyVal;
        this.skillScores[primarySkill].total += difficultyVal;
      }

      // 🧠 INFERRED SKILLS (Vocabulary & Grammar)
      // If the AI evaluation provides deep-dive sub-scores, sync them too.
      const inferredScores: Record<string, number> = {
        'vocabulary': evaluation.vocabulary_score,
        'grammar': evaluation.grammar_score
      };

      Object.entries(inferredScores).forEach(([sName, sScore]) => {
        if (sScore !== undefined && this.skillScores[sName]) {
          console.log(`[Engine] 🧠 Inferred ${sName} contribution: ${sScore}`);
          this.skillScores[sName].earned += sScore * difficultyVal;
          this.skillScores[sName].total += difficultyVal;
        }
      });

      // 🚀 REAL-TIME PERSISTENCE: Push this answer to the DB immediately
      if (this.userId) {
        AssessmentSaveService.log_and_update_assessment(
          {
            ...item,
            assessmentId: this.assessmentId,
            difficulty_numeric: difficultyVal
          },
          evaluation,
          answer,
          this.userId,
          responseTimeMs
        );
        this.syncAttempts.add(item.id);
      } else {
        console.warn(`[Engine] ⏳ No UserID yet. Question ${item.id} queued for Retroactive Sync.`);
      }

      const isCorrect = evaluation.is_correct || evaluation.score >= 0.5;
      
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
        taskType: (item.task_type || item.type) as any
      });

      this.taskEvaluations.push(evaluation);

      return { 
        correct: isCorrect, 
        score: evaluation.score, 
        evaluation 
      };
    } finally {
      this.currentIndex++;
      
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
    }
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
    
    // Calculate percentage based on strictly attempted weighted difficulty
    const percentage = maxBasePoints > 0 ? Math.round((totalScore / maxBasePoints) * 100) : 0;
    const cefr = CEFREngine.mapPercentageToLevel(percentage) || "A1";

    // ── Full 6-Skill Matrix (Strict Isolation) ──
    const breakdown: Record<string, any> = {};
    const ALL_SKILLS = ['reading', 'listening', 'grammar', 'vocabulary', 'writing', 'speaking'];
    ALL_SKILLS.forEach((skill) => {
      let data = { ...this.skillScores[skill] } || { earned: 0, total: 0 };
      
      const skillPct = data.total > 0 ? Math.round((data.earned / data.total) * 100) : 0;
      
      // 🎯 Evidence-Weighted Confidence: Increases as evidence mounts, capped at 0.95
      const evidenceCount = this.answerHistory.filter(a => a.skill === skill).length;
      const confidence = data.total > 0 
        ? Math.min(0.95, (evidenceCount / (skill === 'listening' ? 15 : 5)) * 0.9) 
        : 0;

      breakdown[skill] = {
        band: CEFREngine.mapPercentageToLevel(skillPct) || "A1",
        score: skillPct || 0,
        confidence: Number(confidence.toFixed(2)),
        evidenceCount,
        status: evidenceCount >= 3 ? 'stable' : 'insufficient_data'
      };
    });

    // ── Computed Metrics ──
    const totalAnswered = this.answerHistory.length;
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
        confidence: 0.92,
        rationale: [`Weighted Score: ${totalScore.toFixed(2)}/ ${maxBasePoints.toFixed(2)} (${percentage}%)`]
      },
      overallBand: cefr as any,
      overallConfidence: 0.92,
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
    const currentQ = this.battery[this.currentIndex];
    if (currentQ) {
      const item = currentQ.item;
      const canonicalLevel = (item.level || 'b1').toLowerCase();
      const difficultyVal = item.difficulty || DIFF_MAP[canonicalLevel] || 0.4;

      // Ensure skipped question is recorded with 0 score
      this.answerHistory.push({
        taskId: item.id,
        questionId: item.id,
        skill: item.skill as any,
        difficulty: difficultyVal,
        questionLevel: canonicalLevel,
        answerLevel: 'A1', // Minimum level assigned for skips
        category: item.skill,
        correct: false,
        score: 0,
        answer: "[SKIPPED]",
        correctAnswer: this.getCorrectAnswer(item),
        responseTimeMs: 0,
        taskType: (item.task_type || item.type) as any
      });
      
      // Also update skill scores to reflect the failure (add difficulty to total but 0 to earned)
      const skill = item.skill.toLowerCase();
      if (this.skillScores[skill]) {
        this.skillScores[skill].total += difficultyVal;
      }
    }

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
      question_number: this.currentIndex + 1
    } as any;
  }
}
