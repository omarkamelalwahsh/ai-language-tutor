/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Progressive 40-Question Hybrid Ordered Architecture Engine
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  AssessmentQuestion,
  AssessmentSkill,
  DifficultyBand,
  BandLabel,
  AnswerRecord,
  AdaptiveAssessmentState,
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
  SkillState, 
  OverallState, 
  SkillName as EFSETSkillName,
} from '../types/efset';
import { BatterySelector, BatteryQuestion } from '../engine/selector/AdaptiveSelector';
import { CEFREngine } from '../engine/cefr/CEFREngine';
import { ASSESSMENT_CONFIG, DifficultyZone, BatterySkill } from '../config/assessment-config';

interface BlockScoreState {
  earnedPoints: number;
  totalPossible: number;
}

export interface BatteryProgress {
  answered: number;
  total: number;
  percentage: number;
  currentBlock: number;
  currentSkill: string | null;
  currentZone: DifficultyZone | null;
  completed: boolean;
}

const BAND_VALUE: Record<DifficultyBand, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

export class AdaptiveAssessmentEngine {
  private battery: BatteryQuestion[] = [];
  private currentIndex: number = 0;
  private blockScores: BlockScoreState[];
  private skillScores: Record<string, { earned: number; total: number; easyCorrect: number; easyTotal: number; hardCorrect: number; hardTotal: number }>;
  
  private state: AdaptiveAssessmentState;
  private efsetSkills: Record<EFSETSkillName, SkillState>;
  private efsetOverall: OverallState;

  private banks: Record<CEFRLevel, QuestionBankItem[]> = {
    'A1': [], 'A2': [], 'B1': [], 'B2': [], 'C1': [], 'C2': []
  };
  private loadedLevels: Set<CEFRLevel> = new Set();
  private seenQuestionIds: Set<string> = new Set();
  public assessmentId: string;
  private userId: string | null = null;

  constructor(
    _startingBand: DifficultyBand = 'B1', 
    contextProfile?: LearnerContextProfile, 
    userId: string | null = null
  ) {
    this.userId = userId || (typeof window !== 'undefined' ? localStorage.getItem('auth_user_id') : null);
    this.assessmentId = "hybrid-" + Math.random().toString(36).substr(2, 9);

    this.blockScores = [0, 1, 2, 3].map(() => ({ earnedPoints: 0, totalPossible: 20 }));
    
    const ALL_SKILLS = ["listening", "reading", "writing", "speaking", "vocabulary", "grammar"];
    this.skillScores = {};
    ALL_SKILLS.forEach(s => {
      this.skillScores[s] = { earned: 0, total: 20, easyCorrect: 0, easyTotal: 0, hardCorrect: 0, hardTotal: 0 };
    });

    this.efsetSkills = {} as any;
    this.efsetOverall = {} as any;
    
    this.state = {
      askedQuestionIds: [],
      answerHistory: [],
      taskEvaluations: [],
      overallConfidence: 0,
      questionsAnswered: 0,
      completed: false,
      speakingAudit: {
        micCheckPassed: false, voiceRecordingsAttempted: 0, voiceRecordingsValid: 0,
        typedFallbacksUsed: 0, speakingTasksTotal: 0, hasAnySpeakingEvidence: false,
        speakingFallbackApplied: false
      },
      contextProfile,
      topicPerformance: {},
      domainPerformance: {}
    };
  }

  private async ensureBankLoaded(): Promise<void> {
    if (this.loadedLevels.size > 0) return;
    
    // Fetch seen question IDs if user is logged in
    if (this.userId) {
      try {
        const { data } = await supabase
          .from('assessment_logs')
          .select('question_id')
          .eq('user_id', this.userId);
        
        if (data) {
          data.forEach(row => this.seenQuestionIds.add(row.question_id));
          console.log(`[Engine] Filtered ${this.seenQuestionIds.size} already-seen questions.`);
        }
      } catch (e) {
        console.warn("[Engine] Failed to fetch seen questions history:", e);
      }
    }

    try {
      const res = await fetch('/api/questions');
      const allItems: QuestionBankItem[] = await res.json();
      allItems.forEach(item => {
        const level = (item.target_cefr || 'A1') as CEFRLevel;
        if (this.banks[level]) this.banks[level].push(item);
      });
      Object.keys(this.banks).forEach(l => this.loadedLevels.add(l as any));
    } catch {
      console.warn("Failed to load hybrid bank. Using offline fallback...");
    }
  }

  public async getNextQuestion(): Promise<AssessmentQuestion | null> {
    if (this.state.completed) return null;
    await this.ensureBankLoaded();
    if (this.battery.length === 0) {
      this.battery = new BatterySelector(this.banks, this.seenQuestionIds).buildFullBattery();
    }
    if (this.currentIndex >= this.battery.length) {
      this.state.completed = true;
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
    if (item.answer_key?.value?.options) {
      const options = item.answer_key.value.options;
      const correctText = options[item.answer_key.value.correct_index];
      const isCorrect = answer.trim().toLowerCase() === correctText?.trim().toLowerCase();
      evaluation = { score: isCorrect ? 1.0 : 0.0, is_correct: isCorrect, feedback: isCorrect ? "Correct!" : `Incorrect. Right answer: ${correctText}` };
    } else {
      evaluation = await GroqScoringService.callProctor(question, answer, item.target_cefr);
    }

    const blockIdx = batteryQ.block - 1;
    const earnedPoints = (evaluation.score || 0) * batteryQ.pointValue;
    this.blockScores[blockIdx].earnedPoints += earnedPoints;

    // Track per-skill scores for dashboard/analysis
    const skill = item.skill.toLowerCase();
    if (this.skillScores[skill]) {
      this.skillScores[skill].earned += earnedPoints;
      if (batteryQ.zone === 'EASY') {
        this.skillScores[skill].easyTotal++;
        if (evaluation.is_correct) this.skillScores[skill].easyCorrect++;
      } else if (batteryQ.zone === 'HARD') {
        this.skillScores[skill].hardTotal++;
        if (evaluation.is_correct) this.skillScores[skill].hardCorrect++;
      }
    }

    this.state.answerHistory.push({
      taskId: item.id, questionId: item.id, skill: item.skill as any,
      difficulty: BAND_VALUE[item.target_cefr] || 1, correct: evaluation.is_correct,
      score: evaluation.score, answer, correctAnswer: (item as any).correct_answer || "",
      responseTimeMs, taskType: item.task_type as any
    });

    this.currentIndex++;
    this.state.questionsAnswered = this.currentIndex;
    this.state.overallConfidence = this.currentIndex / 40;

    return { correct: evaluation.is_correct, score: evaluation.score, evaluation };
  }

  public getOutcome(): AssessmentOutcome {
    let totalPoints = 0;
    this.blockScores.forEach(b => totalPoints += b.earnedPoints);
    const percentage = (totalPoints / 80) * 100;
    const cefr = CEFREngine.mapPercentageToLevel(Math.round(percentage));

    const breakdown: any = {};
    Object.entries(this.skillScores).forEach(([skill, data]) => {
      const skillPct = (data.earned / 20) * 100;
      const easyFail = data.easyTotal > 0 ? (data.easyTotal - data.easyCorrect) / data.easyTotal : 0;
      const hardPass = data.hardTotal > 0 ? data.hardCorrect / data.hardTotal : 0;
      const isCapped = easyFail > 0.5 && hardPass > 0.5;

      breakdown[skill] = {
        band: CEFREngine.mapPercentageToLevel(skillPct) as BandLabel,
        score: Math.round(skillPct),
        confidence: this.state.overallConfidence,
        evidenceCount: 10,
        status: 'stable',
        isCapped,
        cappedReason: isCapped ? "Foundational gap detected." : undefined
      };
    });

    return {
      overall: {
        estimatedLevel: cefr as CefrLevel,
        confidence: this.state.overallConfidence,
        rationale: [`Total Score: ${totalPoints.toFixed(1)}/80 (${Math.round(percentage)}%)`]
      },
      overallBand: cefr as BandLabel,
      overallConfidence: this.state.overallConfidence,
      skillBreakdown: breakdown,
      strengths: [], weaknesses: [],
      answerHistory: this.state.answerHistory,
      totalQuestions: this.currentIndex,
      stopReason: 'max_reached',
      speakingAudit: this.state.speakingAudit
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
      completed: this.state.completed
    };
  }

  public getEvaluations(): TaskEvaluation[] { return this.state.taskEvaluations; }
  public getAnswerHistory(): AnswerRecord[] { return this.state.answerHistory; }
  public getState() { return this.state; }
  public async finalizeAssessment(): Promise<boolean> { this.state.completed = true; return true; }
  public initializeFromHistory(evs: TaskEvaluation[], history: AnswerRecord[]) {
     this.state.taskEvaluations = evs;
     this.state.answerHistory = history;
     this.currentIndex = history.length;
  }

  private buildQuestionObject(batteryQ: BatteryQuestion): AssessmentQuestion {
    const item = batteryQ.item;
    return {
      id: item.id, prompt: item.prompt, skill: item.skill as any,
      difficulty: item.target_cefr as any, type: item.task_type as any,
      response_mode: item.response_mode as any, stimulus: item.stimulus,
      options: item.options, _battery: batteryQ,
      audioUrl: (item as any).audio_url
    } as any;
  }
}
