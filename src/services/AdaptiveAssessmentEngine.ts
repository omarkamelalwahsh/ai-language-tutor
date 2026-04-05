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
import { ASSESSMENT_CONFIG } from '../config/assessment-config';
import { ReviewExplanationBuilder } from '../engine/review/ReviewExplanationBuilder';

// Dynamic Loader for Question Banks to optimize bundle size
const BANK_LOADERS: Record<CEFRLevel, () => Promise<any>> = {
  'A1': () => import('../data/banks/A1.json'),
  'A2': () => import('../data/banks/A2.json'),
  'B1': () => import('../data/banks/B1.json'),
  'B2': () => import('../data/banks/B2.json'),
  'C1': () => import('../data/banks/C1.json'),
  'C2': () => import('../data/banks/C2.json'),
};

// ============================================================================
// Constants
// ============================================================================

const ALL_SKILLS: AssessmentSkill[] = ['reading', 'writing', 'listening', 'speaking', 'vocabulary', 'grammar'];
const BAND_VALUE: Record<DifficultyBand, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

export class AdaptiveAssessmentEngine {
  private state: AdaptiveAssessmentState;
  private efsetSkills: Record<EFSETSkillName, SkillState>;
  private efsetOverall: OverallState;
  private selector: AdaptiveSelector;
  private askedQuestionIds: Set<string> = new Set();
  
  private banks: Record<CEFRLevel, QuestionBankItem[]> = {
    'A1': [], 'A2': [], 'B1': [], 'B2': [], 'C1': [], 'C2': []
  };
  private loadedLevels = new Set<CEFRLevel>();

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

    // Initialize unified state
    this.state = {
      askedQuestionIds: [],
      answerHistory: [],
      taskEvaluations: [],
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

  private async ensureLevelLoaded(level: CEFRLevel): Promise<void> {
    if (this.loadedLevels.has(level)) return;
    
    console.log(`[Engine] Lazy loading bank for level: ${level}...`);
    try {
      const module = await BANK_LOADERS[level]();
      // handle either default or direct array import if needed
      const data = module.default || module;
      this.banks[level] = Array.isArray(data) ? data : [];
      this.loadedLevels.add(level);
      console.log(`[Engine] Loaded ${this.banks[level].length} items for ${level}`);
    } catch (err) {
      console.error(`[Engine] Failed to load bank for ${level}:`, err);
    }
  }

  public async getNextQuestion(): Promise<AssessmentQuestion | null> {
    if (this.state.completed) return null;
    
    const uniqueAnsweredCount = this.askedQuestionIds.size;
    
    // Ensure the current level's bank is loaded before selection
    const currentLevel = this.efsetOverall.levelRange[0];
    await this.ensureLevelLoaded(currentLevel);

    // 1. Final Stop Condition Check
    const isConfidenceTargetReached = this.efsetOverall.confidence >= ASSESSMENT_CONFIG.CONFIDENCE_STOP_THRESHOLD;
    const isMinQuestionsMet = uniqueAnsweredCount >= ASSESSMENT_CONFIG.MIN_QUESTIONS;
    const isStable = this.efsetOverall.status === 'stable';

    if (uniqueAnsweredCount >= ASSESSMENT_CONFIG.MAX_QUESTIONS || (isConfidenceTargetReached && isMinQuestionsMet && isStable)) {
      this.state.completed = true;
      console.log(`[Engine] Stopping. Confidence: ${this.efsetOverall.confidence}, Questions: ${uniqueAnsweredCount}`);
      return null;
    }

    // 2. Select Next Item
    const nextItemPre = this.selector.selectNext({
      skills: this.efsetSkills,
      askedQuestionIds: this.askedQuestionIds,
      currentOverallLevel: this.efsetOverall.levelRange[0]
    });

    if (!nextItemPre) {
      this.state.completed = true;
      console.warn('[Engine] No more questions available in current state. Stopping.');
      return null;
    }

    // 3. Ensure level is actually loaded (it might be a neighbor level step up/down)
    await this.ensureLevelLoaded(nextItemPre.target_cefr as CEFRLevel);
    
    // Select again after loading just in case (though normally nextItemPre is enough, 
    // we want to ensure we didn't just pick from an empty bank)
    const nextItem = this.selector.selectNext({
      skills: this.efsetSkills,
      askedQuestionIds: this.askedQuestionIds,
      currentOverallLevel: this.efsetOverall.levelRange[0]
    });

    if (!nextItem) {
      this.state.completed = true;
      return null;
    }

    // 3. CRITICAL: Mark as asked BEFORE returning to prevent rapid-fire repetition
    this.askedQuestionIds.add(nextItem.id);
    if (!this.state.askedQuestionIds.includes(nextItem.id)) {
      this.state.askedQuestionIds.push(nextItem.id);
    }

    const originalOptions = nextItem.answer_key?.value?.options || nextItem.options;

    return {
      id: nextItem.id,
      prompt: nextItem.prompt,
      skill: nextItem.skill as any,
      primarySkill: nextItem.skill as any,
      difficulty: nextItem.target_cefr as DifficultyBand,
      type: nextItem.task_type as any,
      response_mode: nextItem.response_mode as any,
      audioUrl: nextItem.audio_url, 
      stimulus: nextItem.stimulus, 
      options: originalOptions ? this.shuffle(originalOptions) : undefined, 
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

    const isMCQ = efsetItem.response_mode === 'multiple_choice' || efsetItem.response_mode === 'mcq';
    let isCorrect = true;

    if (isMCQ) {
       // Extract correct option text for comparison
       const key = efsetItem.answer_key;
       let correctText = '';
       
       if (typeof key === 'string') {
         correctText = key;
       } else if (key?.value?.options && key?.value?.correct_index !== undefined) {
         correctText = key.value.options[key.value.correct_index];
       } else if (key?.correct_answer) {
         correctText = key.correct_answer;
       }

       isCorrect = answer.trim() === correctText.trim();
    }

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
    // Map 'voice' -> 'audio' and 'typed_fallback' or undefined -> 'typed' for the mapper
    const actualMode = responseMode === 'voice' ? 'audio' : 'typed';
    const evidences = EvidenceMapper.mapSignalToEvidence(efsetItem, signal, isCorrect, actualMode);

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
        comprehension: isCorrect ? 1.0 : 0.0,
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
      rawSignals: {
        answer,
        prompt: efsetItem.prompt,
        skill: efsetItem.skill,
        level: efsetItem.target_cefr,
        answerKey: efsetItem.answer_key
      }
    };
    
    // Generate explanation data
    taskEval.reviewData = ReviewExplanationBuilder.buildFromAssessment(question, taskEval, answer);

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

  public async swapQuestion(currentQuestionId: string): Promise<AssessmentQuestion | null> {
    // 1. Locate the current item to identify its level and skill
    let currentItem: QuestionBankItem | undefined;
    let currentLevel: CEFRLevel | undefined;

    for (const [level, items] of Object.entries(this.banks) as [CEFRLevel, QuestionBankItem[]][]) {
      const match = items.find(i => i.id === currentQuestionId);
      if (match) {
        currentItem = match;
        currentLevel = level;
        break;
      }
    }

    if (!currentItem || !currentLevel) return null;

    // 2. Ensure bank is loaded (should be already, but just in case)
    await this.ensureLevelLoaded(currentLevel);

    // 3. Request a swap from selector (while blocking current ID)
    const nextItem = this.selector.selectSwap(
      currentLevel, 
      currentItem.skill as EFSETSkillName, 
      this.askedQuestionIds
    );

    if (!nextItem) return null;

    // 3. Update tracking: Remove old ID, add new one
    this.askedQuestionIds.delete(currentQuestionId);
    this.askedQuestionIds.add(nextItem.id);
    
    // Update legacy state tracking if relevant
    const idx = this.state.askedQuestionIds.indexOf(currentQuestionId);
    if (idx !== -1) {
      this.state.askedQuestionIds[idx] = nextItem.id;
    }

    const originalOptions = nextItem.answer_key?.value?.options || nextItem.options;

    // 4. Return formatted question
    return {
      id: nextItem.id,
      prompt: nextItem.prompt,
      skill: nextItem.skill as any,
      primarySkill: nextItem.skill as any,
      difficulty: nextItem.target_cefr as DifficultyBand,
      type: nextItem.task_type as any,
      response_mode: nextItem.response_mode as any,
      audioUrl: nextItem.audio_url,
      stimulus: nextItem.stimulus,
      options: originalOptions ? this.shuffle(originalOptions) : undefined,
      _efset: nextItem
    } as any;
  }

  public async skipQuestion(currentQuestionId: string): Promise<AssessmentQuestion | null> {
    // Treat as "asked" but not "evaluated" (neutral signal)
    // We don't remove it from askedQuestionIds so it doesn't reappear immediately
    return await this.getNextQuestion();
  }

  public getOutcome(): AssessmentOutcome {

    const report = FinalReportBuilder.build(this.efsetSkills, this.efsetOverall);
    
    const skillResults = {} as AssessmentOutcome['skillBreakdown'];
    for (const s of ALL_SKILLS) {
       const state = this.efsetSkills[s as EFSETSkillName];
       
       if (!state) {
         // Placeholder for a skill not present in the efset model (safety)
         skillResults[s] = {
           band: 'A1',
           score: 0,
           confidence: 0,
           evidenceCount: 0,
           status: 'insufficient_data',
           matchedDescriptors: [],
           missingDescriptors: [],
           isCapped: false
         };
         continue;
       }

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
      stopReason: report.overall.confidence >= ASSESSMENT_CONFIG.CONFIDENCE_STOP_THRESHOLD ? 'stable' : 'max_reached',
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

  public getProgress() {
    return {
      answered: this.state.questionsAnswered,
      total: ASSESSMENT_CONFIG.MAX_QUESTIONS,
      percentage: Math.min(100, (this.state.questionsAnswered / ASSESSMENT_CONFIG.MAX_QUESTIONS) * 100),
      currentBand: this.efsetOverall.levelRange[0] as DifficultyBand,
      confidence: this.efsetOverall.confidence,
      completed: this.state.completed,
    };
  }

  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  public forceComplete(): void {
    this.state.completed = true;
  }

  public getState(): AdaptiveAssessmentState {
    return this.state;
  }
}
