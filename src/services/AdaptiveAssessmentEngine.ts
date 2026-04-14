/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 40-Question IELTS-Inspired Adaptive Assessment Engine
 * Skill Quotas: Grammar(12) Listening(8) Reading(8) Vocab(4) Writing(4) Speaking(4)
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

// Fallback Difficulty Constants
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
    this.assessmentId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : "battery-" + Math.random().toString(36).substr(2, 9);
    
    this.STORAGE_KEY = `asmt_state_${this.userId || 'guest'}`;

    if (initialBattery && initialBattery.length > 0) {
      this.battery = initialBattery;
      this.isStaticBattery = true;
      console.log(`[Engine] Initialized with pre-fetched static battery (${this.battery.length} questions).`);
    }

    // IELTS quotas: grammar=12, listening=8, reading=8, vocab=4, writing=4, speaking=4
    const SKILL_TOTALS: Record<string, number> = {
      grammar: 12, listening: 8, reading: 8, vocabulary: 4, writing: 4, speaking: 4
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
    const levelOrDiff = item.target_cefr || (item as any).level || 'b1';
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
    
    if (isMCQTask) {
      const isCorrect = this.checkMCQ(item, answer);
      evaluation = { 
        score: isCorrect ? 1.0 : 0.0, 
        is_correct: isCorrect, 
        feedback: isCorrect ? "Correct!" : "Incorrect." 
      };
    } else if (isProductionTask) {
      // AI evaluation for Writing/Speaking (open-ended production tasks)
      console.log(`[Engine] 🤖 Evaluating ${item.skill} (${itemMode}) via AI...`);
      evaluation = await GroqScoringService.getScoringResultFromAPI(question, answer, canonicalLevel);
      // Ensure is_correct is derived from score for production tasks
      if (evaluation.is_correct === undefined) {
        evaluation.is_correct = (evaluation.score || 0) >= 0.5;
      }
    } else {
      // Fallback: MCQ skill without options — attempt AI evaluation
      console.log(`[Engine] ⚠️ ${item.skill} MCQ missing options, falling back to AI evaluation...`);
      evaluation = await GroqScoringService.getScoringResultFromAPI(question, answer, canonicalLevel);
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

    this.answerHistory.push({
      taskId: item.id, 
      questionId: item.id, 
      skill: item.skill as any,
      difficulty: difficultyVal,
      level: canonicalLevel,
      correct: isCorrect,
      score: evaluation.score, 
      answer, 
      correctAnswer: this.getCorrectAnswer(item),
      responseTimeMs, 
      taskType: item.task_type as any
    });

    this.taskEvaluations.push(evaluation);
    this.currentIndex++;
    
    if (this.currentIndex >= this.battery.length) {
      this.completed = true;
      this.clearState();
    } else {
      // 🚀 ADAPTIVITY SPEED (Re-ordering battery)
      // If the user got it right, move harder questions of this skill/level earlier
      if (isCorrect) {
        this.reorderRemainingBattery(difficultyVal);
      }
      this.saveState();
    }

    return { 
      correct: isCorrect, 
      score: evaluation.score, 
      evaluation 
    };
  }

  private reorderRemainingBattery(currentDifficulty: number) {
    const remaining = this.battery.slice(this.currentIndex);
    // Separate production and receptive to preserve interleaving
    const production = remaining.filter(q => ['writing', 'speaking'].includes(q.skill.toLowerCase()));
    const receptive = remaining.filter(q => !['writing', 'speaking'].includes(q.skill.toLowerCase()));
    
    // Sort receptive items so that higher difficulty comes first if we are doing well
    receptive.sort((a, b) => {
      const diffA = a.item.difficulty || DIFF_MAP[a.item.target_cefr?.toLowerCase() || 'b1'] || 0.4;
      const diffB = b.item.difficulty || DIFF_MAP[b.item.target_cefr?.toLowerCase() || 'b1'] || 0.4;
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
    const { options, correctIndex } = this.extractMCQData(item);
    if (!options || correctIndex === null || correctIndex === undefined) return false;
    const correctText = options[correctIndex];
    return answer.trim() === correctText?.trim();
  }

  private getCorrectAnswer(item: any): string {
    // Production tasks (writing/speaking) don't have a single "correct" answer
    const mode = (item.response_mode || 'mcq') as string;
    if (mode === 'typed' || mode === 'audio') {
      // Return rubric hint or empty — AI evaluation handles scoring
      return item.rubric || item.model_answer || '';
    }
    const { options, correctIndex } = this.extractMCQData(item);
    if (!options || correctIndex === null || correctIndex === undefined) return "";
    return options[correctIndex] || "";
  }

  /**
   * Exhaustively extracts MCQ options and correct_index from any answer_key structure.
   */
  private extractMCQData(item: any): { options: string[] | null; correctIndex: number | null } {
    // First check top-level options (hoisted by BatterySelector)
    if (item.options && item.options.length > 0) {
      // Find correct_index from answer_key
      let correctIndex: number | null = null;
      const ak = item.answer_key as any;
      if (ak) {
        let parsed = typeof ak === 'string' ? (() => { try { return JSON.parse(ak); } catch { return null; } })() : ak;
        if (parsed?.value?.correct_index !== undefined) correctIndex = parsed.value.correct_index;
        else if (parsed?.correct_index !== undefined) correctIndex = parsed.correct_index;
      }
      return { options: item.options, correctIndex };
    }

    // Fallback: extract from answer_key directly
    const ak = item.answer_key as any;
    if (!ak) return { options: null, correctIndex: null };

    let parsed = ak;
    if (typeof ak === 'string') {
      try { parsed = JSON.parse(ak); } catch { return { options: null, correctIndex: null }; }
    }

    // Path 1: answer_key.value.options
    if (parsed?.value && typeof parsed.value === 'object' && Array.isArray(parsed.value.options)) {
      return { options: parsed.value.options, correctIndex: parsed.value.correct_index ?? null };
    }
    // Path 2: answer_key.options
    if (Array.isArray(parsed?.options)) {
      return { options: parsed.options, correctIndex: parsed.correct_index ?? null };
    }

    return { options: null, correctIndex: null };
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
    const cefr = CEFREngine.mapPercentageToLevel(percentage);

    const breakdown: any = {};
    Object.entries(this.skillScores).forEach(([skill, data]) => {
      const skillPct = data.total > 0 ? Math.round((data.earned / data.total) * 100) : 0;
      breakdown[skill] = {
        band: CEFREngine.mapPercentageToLevel(skillPct),
        score: skillPct,
        confidence: 0.9,
        evidenceCount: this.answerHistory.filter(a => a.skill === skill).length,
        status: 'stable'
      };
    });

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
      speakingAudit: { 
        micCheckPassed: true, voiceRecordingsAttempted: 0, voiceRecordingsValid: 0,
        typedFallbacksUsed: 0, speakingTasksTotal: 4, hasAnySpeakingEvidence: true,
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
    
    return {
      id: item.id, 
      prompt: item.prompt, 
      skill: item.skill as any,
      difficulty: item.target_cefr as any, 
      type: item.task_type as any,
      response_mode: item.response_mode as any, 
      stimulus: item.stimulus,
      options: item.options, 
      audioUrl: audioSource,
      _battery: batteryQ,
    } as any;
  }
}
