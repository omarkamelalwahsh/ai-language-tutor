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
  MAX_QUESTIONS: 30,
  CONFIDENCE_STOP_THRESHOLD: 0.75, // Refined EF SET stop threshold
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
    
    // Stop condition: Confidence threshold + Min Questions
    const canStop = this.efsetOverall.confidence >= CONFIG.CONFIDENCE_STOP_THRESHOLD && 
                    this.state.questionsAnswered >= CONFIG.MIN_QUESTIONS &&
                    this.efsetOverall.status === 'stable';

    if (this.state.questionsAnswered >= CONFIG.MAX_QUESTIONS || canStop) {
      this.state.completed = true;
      console.log(`[Engine] Stopping. Confidence: ${this.efsetOverall.confidence}, Questions: ${this.state.questionsAnswered}`);
      return null;
    }

    const nextItem = this.selector.selectNext({
      skills: this.efsetSkills,
      askedQuestionIds: this.askedQuestionIds,
      currentOverallLevel: this.efsetOverall.levelRange[0]
    });

    if (!nextItem) {
      this.state.completed = true;
      return null;
    }

    return {
      id: nextItem.id,
      prompt: nextItem.prompt,
      skill: nextItem.skill,
      primarySkill: nextItem.skill,
      difficulty: nextItem.target_cefr as DifficultyBand,
      type: nextItem.task_type as any,
      responseMode: nextItem.response_mode as any,
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
    const efsetItem = (question as any)._efset as QuestionBankItem;
    if (!efsetItem) return { correct: true, score: 0.5 };

    this.askedQuestionIds.add(efsetItem.id);

    // 1. LLM Signal Extraction
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
    this.state.questionsAnswered++;
    
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

    // Record History (Legacy)
    const skillName = efsetItem.skill as EFSETSkillName;
    const reportVal = this.efsetSkills[skillName];
    this.state.answerHistory.push({
      taskId: efsetItem.id,
      questionId: efsetItem.id,
      skill: efsetItem.skill as AssessmentSkill,
      difficulty: BAND_VALUE[efsetItem.target_cefr as DifficultyBand] || 1,
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
           support: h.score, 
           strength: h.weight, 
           supported: h.score > 0.5 
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

  public getProgress() {
    return {
      answered: this.state.questionsAnswered,
      total: CONFIG.MAX_QUESTIONS,
      percentage: Math.min(100, (this.state.questionsAnswered / CONFIG.MAX_QUESTIONS) * 100),
      currentBand: this.efsetOverall.levelRange[0] as DifficultyBand,
      confidence: this.efsetOverall.confidence,
      completed: this.state.completed,
    };
  }

  public forceComplete(): void {
    this.state.completed = true;
  }
}
