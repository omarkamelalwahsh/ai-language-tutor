/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Progressive 40-Question Hybrid Ordered Architecture Engine
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

    if (initialBattery && initialBattery.length === 40) {
      this.battery = initialBattery;
      this.isStaticBattery = true;
      console.log("[Engine] Initialized with pre-fetched static battery.");
    }

    const ALL_SKILLS = ["listening", "reading", "writing", "speaking", "vocabulary", "grammar"];
    ALL_SKILLS.forEach(s => {
      this.skillScores[s] = { earned: 0, total: 20 };
    });

    this.tryRecoverState();
  }

  public hasBattery(): boolean {
    return this.battery.length === 40;
  }

  private tryRecoverState() {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      if (saved.battery && saved.currentIndex < 40) {
        this.battery = saved.battery;
        this.currentIndex = saved.currentIndex;
        this.skillScores = saved.skillScores;
        this.answerHistory = saved.answerHistory;
        this.taskEvaluations = saved.taskEvaluations;
        this.assessmentId = saved.assessmentId;
        console.log(`[Engine] Recovered assessment ${this.assessmentId} at Q${this.currentIndex + 1}`);
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
        this.saveState();
        this.syncStateToRemote(); // Initial sync to secure the battery
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
    
    let evaluation: any;
    
    // MCQ Check
    if (item.response_mode === 'mcq') {
      const isCorrect = this.checkMCQ(item, answer);
      evaluation = { 
        score: isCorrect ? 1.0 : 0.0, 
        is_correct: isCorrect, 
        feedback: isCorrect ? "Correct!" : "Incorrect." 
      };
    } else {
      // AI check for Writing/Speaking
      console.log(`[Engine] Evaluating ${item.skill} via AI...`);
      evaluation = await GroqScoringService.getScoringResultFromAPI(question, answer, item.target_cefr);
    }

    const earnedPoints = (evaluation.score || 0) * batteryQ.pointValue;
    const skill = item.skill.toLowerCase();
    
    if (this.skillScores[skill]) {
      this.skillScores[skill].earned += earnedPoints;
    }

    this.answerHistory.push({
      taskId: item.id, 
      questionId: item.id, 
      skill: item.skill as any,
      difficulty: batteryQ.pointValue, 
      correct: evaluation.is_correct || evaluation.score >= 0.5,
      score: evaluation.score, 
      answer, 
      correctAnswer: this.getCorrectAnswer(item),
      responseTimeMs, 
      taskType: item.task_type as any
    });

    this.taskEvaluations.push(evaluation);
    this.currentIndex++;
    
    if (this.currentIndex >= 40) {
      this.completed = true;
      this.clearState();
    } else {
      this.saveState();
      
      // 🚀 SMART SYNC: Trigger remote save at block boundaries (e.g. Q10, Q20, Q30)
      if (this.currentIndex % 10 === 0) {
        this.syncStateToRemote();
      }
    }

    return { 
      correct: evaluation.is_correct || evaluation.score >= 0.5, 
      score: evaluation.score, 
      evaluation 
    };
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

  private checkMCQ(item: QuestionBankItem, answer: string): boolean {
    const key = item.answer_key as any;
    if (key?.value?.options && typeof key.value.correct_index === 'number') {
      const correctText = key.value.options[key.value.correct_index];
      return answer.trim() === correctText?.trim();
    }
    return false;
  }

  private getCorrectAnswer(item: QuestionBankItem): string {
    const key = item.answer_key as any;
    if (key?.value?.options && typeof key.value.correct_index === 'number') {
      return key.value.options[key.value.correct_index];
    }
    return "";
  }

  public getOutcome(): AssessmentOutcome {
    let totalPoints = 0;
    Object.values(this.skillScores).forEach(s => totalPoints += s.earned);
    
    const percentage = Math.round((totalPoints / 80) * 100);
    const cefr = CEFREngine.mapPercentageToLevel(percentage);

    const breakdown: any = {};
    Object.entries(this.skillScores).forEach(([skill, data]) => {
      const skillPct = Math.round((data.earned / 20) * 100);
      breakdown[skill] = {
        band: CEFREngine.mapPercentageToLevel(skillPct),
        score: skillPct,
        confidence: 0.9,
        evidenceCount: 10,
        status: 'stable'
      };
    });

    return {
      overall: {
        estimatedLevel: cefr as CefrLevel,
        confidence: 0.9,
        rationale: [`Total Score: ${totalPoints.toFixed(1)}/80 (${percentage}%)`]
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
        typedFallbacksUsed: 0, speakingTasksTotal: 10, hasAnySpeakingEvidence: true,
        speakingFallbackApplied: false
      }
    };
  }

  public getProgress(): BatteryProgress {
    const q = this.battery[this.currentIndex];
    return {
      answered: this.currentIndex,
      total: 40,
      percentage: (this.currentIndex / 40) * 100,
      currentBlock: q?.block || 1,
      currentSkill: q?.skill || null,
      currentZone: q?.zone || null,
      completed: this.completed
    };
  }

  public getEvaluations(): TaskEvaluation[] { return this.taskEvaluations; }
  public getAnswerHistory(): AnswerRecord[] { return this.answerHistory; }
  public getState() { return { currentIndex: this.currentIndex, completed: this.completed }; }
  
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
    return {
      id: item.id, 
      prompt: item.prompt, 
      skill: item.skill as any,
      difficulty: item.target_cefr as any, 
      type: item.task_type as any,
      response_mode: item.response_mode as any, 
      stimulus: item.stimulus,
      options: item.options, 
      _battery: batteryQ,
      audioUrl: item.audio_url
    } as any;
  }
}
