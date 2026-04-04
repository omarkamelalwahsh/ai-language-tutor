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
  ResponseMode,
  SpeakingSubmissionMeta,
  SpeakingAuditTrail,
  LearnerContextProfile,
} from '../types/assessment';
import { TaskResult } from '../types/app';
import { evaluateWithGroq } from './groqEvaluator';
import { clamp01 } from '../lib/numeric-guards';

// EF SET Architecture Imports
import { 
  CEFRLevel, 
  QuestionBankItem, 
  SkillState, 
  OverallState, 
  SkillName as EFSETSkillName,
  SkillStatus,
  LLMSignal
} from '../types/efset';
import { AdaptiveSelector, SelectorState } from '../engine/selector/AdaptiveSelector';
import { SignalExtractor } from '../engine/scoring/SignalExtractor';
import { EvidenceMapper } from '../engine/scoring/EvidenceMapper';
import { SkillAggregator } from '../engine/cefr/SkillAggregator';
import { CEFREngine } from '../engine/cefr/CEFREngine';
import { BankValidator } from './BankValidator';
import { FinalReportBuilder } from '../engine/cefr/FinalReportBuilder';

// Import Banks
import A1_BANK from '../data/banks/A1.json';
import A2_BANK from '../data/banks/A2.json';
import B1_BANK from '../data/banks/B1.json';
import B2_BANK from '../data/banks/B2.json';
import C1_BANK from '../data/banks/C1.json';
import C2_BANK from '../data/banks/C2.json';

// ============================================================================
// Constants
// ============================================================================

const ALL_SKILLS: AssessmentSkill[] = ['reading', 'writing', 'listening', 'speaking', 'vocabulary', 'grammar'];
const BAND_VALUE: Record<DifficultyBand, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

const CONFIG = {
  MIN_QUESTIONS: 8,
  MAX_QUESTIONS: 20, // Reduced to 20 for tighter session
  CONFIDENCE_STOP_THRESHOLD: 0.75, 
} as const;

export class AdaptiveAssessmentEngine {
  private state: AdaptiveAssessmentState;
  private efsetSkills: Record<EFSETSkillName, SkillState>;
  private efsetOverall: OverallState;
  private selector: AdaptiveSelector;
  private askedQuestionIds: Set<string> = new Set();
  
  private banks: Record<CEFRLevel, QuestionBankItem[]> = {
    'A1': A1_BANK as any,
    'A2': A2_BANK as any,
    'B1': B1_BANK as any,
    'B2': B2_BANK as any,
    'C1': C1_BANK as any,
    'C2': C2_BANK as any
  };

  constructor(startingBand: DifficultyBand = 'B1', contextProfile?: LearnerContextProfile) {
    // 1. Validate Banks
    const report = BankValidator.validate(this.banks);
    if (!report.isValid) {
       console.error('[BankValidator] Errors found in banks:', report.errors);
       // In production, we might want to throw or fallback, but here we log and continue
    } else {
       console.log(`[BankValidator] Banks valid! Items: ${report.stats.totalItems}`);
    }

    this.selector = new AdaptiveSelector(this.banks);
    
    const skillsList: EFSETSkillName[] = ['listening', 'reading', 'writing', 'speaking', 'grammar', 'vocabulary'];
    this.efsetSkills = {} as Record<EFSETSkillName, SkillState>;
    
    for (const skill of skillsList) {
      this.efsetSkills[skill] = {
        score: 0.5, 
        levelRange: [startingBand as CEFRLevel, startingBand as CEFRLevel],
        confidence: 0,
        directEvidenceCount: 0,
        consistency: 1.0,
        status: 'insufficient_data',
        history: []
      };
    }

    this.efsetOverall = {
      levelRange: [startingBand as CEFRLevel, startingBand as CEFRLevel],
      confidence: 0,
      status: 'insufficient_data'
    };

    // Initialize state (Legacy Compatibility)
    this.state = {
      currentTargetBand: startingBand,
      askedQuestionIds: [],
      answerHistory: [],
      taskEvaluations: [],
      skillEstimates: {} as any,
      overallConfidence: 0,
      questionsAnswered: 0,
      completed: false,
      speakingAudit: {
        micCheckPassed: false,
        voiceRecordingsAttempted: 0,
        voiceRecordingsValid: 0,
        typedFallbacksUsed: 0,
        speakingTasksTotal: 0,
        hasAnySpeakingEvidence: false,
        speakingFallbackApplied: false,
      },
      contextProfile,
      topicPerformance: {},
      domainPerformance: {},
    };
  }

  public getNextQuestion(): AssessmentQuestion | null {
    if (this.state.completed) return null;
    
    const uniqueAnsweredCount = this.askedQuestionIds.size;

    // 1. Final Stop Condition Check
    const isConfidenceTargetReached = this.efsetOverall.confidence >= CONFIG.CONFIDENCE_STOP_THRESHOLD;
    const isMinQuestionsMet = uniqueAnsweredCount >= CONFIG.MIN_QUESTIONS;
    const isStable = this.efsetOverall.status === 'stable';

    if (uniqueAnsweredCount >= CONFIG.MAX_QUESTIONS || (isConfidenceTargetReached && isMinQuestionsMet && isStable)) {
      this.state.completed = true;
      console.log(`[Engine] Stopping. Confidence: ${this.efsetOverall.confidence}, Questions: ${uniqueAnsweredCount}`);
      return null;
    }

    // 2. Select Next Item
    const nextItem = this.selector.selectNext({
      skills: this.efsetSkills,
      askedQuestionIds: this.askedQuestionIds,
      currentOverallLevel: this.efsetOverall.levelRange[0]
    });

    if (!nextItem) {
      this.state.completed = true;
      console.warn('[Engine] No more questions available in bank. Stopping.');
      return null;
    }

    // 3. CRITICAL: Mark as asked BEFORE returning to prevent rapid-fire repetition
    this.askedQuestionIds.add(nextItem.id);
    if (!this.state.askedQuestionIds.includes(nextItem.id)) {
      this.state.askedQuestionIds.push(nextItem.id);
    }

    return {
      id: nextItem.id,
      prompt: nextItem.prompt,
      skill: nextItem.skill as any,
      primarySkill: nextItem.skill as any,
      difficulty: nextItem.target_cefr as DifficultyBand,
      type: nextItem.task_type as any,
      responseMode: nextItem.response_mode as any,
      audioUrl: nextItem.audio_url, // Fixed: pass audio_url from bank
      _efset: nextItem 
    } as any;
  }

  public async submitAnswer(
    question: AssessmentQuestion,
    answer: string,
    responseTimeMs: number,
    responseMode?: ResponseMode,
    speakingMeta?: SpeakingSubmissionMeta
  ): Promise<{ correct: boolean; score: number }> {
    // 1. Ensure ID is tracked (should already be in askedQuestionIds from getNextQuestion)
    if (!this.askedQuestionIds.has(question.id)) {
      this.askedQuestionIds.add(question.id);
      this.state.askedQuestionIds.push(question.id);
    }
    
    this.state.questionsAnswered = this.askedQuestionIds.size;

    const efsetItem = (question as any)._efset as QuestionBankItem;
    if (!efsetItem) {
       // Graceful fallback: If metadata is missing, we don't score, but we don't repeat the question.
       return { correct: true, score: 0.5 };
    }

    // 2. LLM Signal Extraction
    let signal: LLMSignal = {
      content_accuracy: 1, task_completion: 1, grammar_control: 1, 
      lexical_range: 1, syntactic_complexity: 1, coherence: 1, 
      typo_severity: 0, confidence: 1
    };

    const isMCQ = efsetItem.response_mode === 'multiple_choice';
    const isCorrect = isMCQ ? (answer.trim() === efsetItem.answer_key) : true;

    if (!isMCQ) {
       const llmOutput = await evaluateWithGroq({
         skill: efsetItem.skill as any,
         currentBand: efsetItem.target_cefr as any,
         question: {
           id: efsetItem.id,
           prompt: efsetItem.prompt,
           type: efsetItem.task_type,
           subskills: []
         },
         learnerAnswer: answer,
         descriptors: {}
       });

       if (llmOutput) signal = llmOutput;
    }

    // 2. Score + Map to Evidence
    const evidences = EvidenceMapper.mapSignalToEvidence(efsetItem, signal, isCorrect);

    // 3. Update Skill States
    for (const evidence of evidences) {
      const skillName = evidence.skill as EFSETSkillName;
      this.efsetSkills[skillName] = SkillAggregator.update(this.efsetSkills[skillName], evidence);
    }

    // 4. Update Overall State
    this.efsetOverall = CEFREngine.computeOverall(this.efsetSkills);
    
    // Audit Trail Update
    if (efsetItem.skill === 'speaking') {
       this.state.speakingAudit.speakingTasksTotal++;
       if (responseMode === 'voice') {
          this.state.speakingAudit.voiceRecordingsAttempted++;
          if (speakingMeta?.hasValidAudio) {
             this.state.speakingAudit.voiceRecordingsValid++;
             this.state.speakingAudit.hasAnySpeakingEvidence = true;
          }
       } else if (responseMode === 'typed_fallback') {
          this.state.speakingAudit.typedFallbacksUsed++;
       }
    }

    // 4. Record Evaluation (Legacy and New)
    const taskEval: TaskEvaluation = {
      taskId: efsetItem.id,
      primarySkill: efsetItem.skill as any,
      validAttempt: true,
      channels: {
        taskCompletion: signal.task_completion,
        grammarAccuracy: signal.grammar_control,
        lexicalRange: signal.lexical_range,
        coherence: signal.coherence,
      },
      responseMode,
      speakingMeta,
      skillEvidence: evidences.reduce((acc, e) => ({ ...acc, [e.skill]: e.score }), {}),
      descriptorEvidence: evidences.map(e => ({
        descriptorId: e.skill,
        support: e.score,
        sourceSkill: e.skill as any,
        weight: e.weight
      })),
      notes: [],
      difficulty: efsetItem.target_cefr as any,
      skill: efsetItem.skill as any,
    };
    this.state.taskEvaluations.push(taskEval);

    // Record History (Legacy compatible)
    const reportVal = this.efsetSkills[efsetItem.skill as EFSETSkillName];
    this.state.answerHistory.push({
      taskId: efsetItem.id,
      questionId: efsetItem.id,
      skill: efsetItem.skill as any,
      difficulty: BAND_VALUE[efsetItem.target_cefr as any] || 1,
      correct: isCorrect,
      score: reportVal.score,
      answer,
      responseTimeMs,
      taskType: efsetItem.task_type as any
    });

    return { correct: isCorrect, score: reportVal.score };
  }

  public getOutcome(): AssessmentOutcome {
    const report = FinalReportBuilder.build(this.efsetSkills, this.efsetOverall);
    
    const skillResults = {} as AssessmentOutcome['skillBreakdown'];
    for (const s of ALL_SKILLS) {
       const state = this.efsetSkills[s as EFSETSkillName];
       skillResults[s] = {
         band: this.rangeToLabel(state.levelRange),
         score: Math.round(state.score * 100),
         confidence: state.confidence,
         evidenceCount: state.directEvidenceCount,
         status: state.status as any,
         matchedDescriptors: state.history.map(h => ({ 
           descriptorId: h.taskId,
           descriptorText: 'Signal-based evidence',
           level: this.valueToLevel(h.difficulty) as CefrLevel,
           supported: h.score > 0.5,
           strength: h.weight,
           sourceTaskIds: [h.taskId]
         })),
         missingDescriptors: [],
         isCapped: false,
         speakingFallbackApplied: s === 'speaking' && state.status === 'insufficient_data',
       };
    }

    return {
      overallBand: this.rangeToLabel(report.overall.levelRange),
      overallConfidence: report.overall.confidence,
      skillBreakdown: skillResults,
      strengths: [],
      weaknesses: [],
      answerHistory: [...this.state.answerHistory],
      totalQuestions: this.state.questionsAnswered,
      stopReason: report.overall.confidence >= CONFIG.CONFIDENCE_STOP_THRESHOLD ? 'stable' : 'max_reached',
      speakingAudit: this.state.speakingAudit
    };
  }

  private rangeToLabel(range: [CEFRLevel, CEFRLevel]): BandLabel {
    if (range[0] === range[1]) return range[0] as BandLabel;
    // Map L1, L2 to L1_L2 for IntermediateBand support
    return `${range[0]}_${range[1]}` as BandLabel;
  }

  private valueToLevel(val: number): CEFRLevel {
    const levels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    return levels[Math.max(0, Math.min(5, Math.floor(val - 1)))];
  }

  public getEvaluations(): TaskEvaluation[] {
    return this.state.taskEvaluations;
  }

  public forceComplete(): void {
    this.state.completed = true;
  }
}
