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
import { supabase } from '../lib/supabaseClient';
import { GroqScoringService } from './GroqScoringService';
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
import { AssessmentSaveService } from './AssessmentSaveService';


// Old static JSON bank loaders were removed in favor of dynamic API fetching

// ============================================================================
// Constants
// ============================================================================

export type EvaluationPayload = {
  userId?: string | null; // Link to user for persistence
  assessmentId: string; // Add assessment ID
  skill: "reading" | "writing" | "listening" | "speaking" | "vocabulary" | "grammar";
  currentBand: DifficultyBand;
  question: {
    id: string;
    prompt: string;
    type: string;
    subskills: string[];
    semanticIntent?: string;
    requiredContentPoints?: string[];
    target_cefr?: DifficultyBand; // Added to map back to original question level
  };
  learnerAnswer: string;
  descriptors: Partial<Record<DifficultyBand, string[]>>;
};

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
  private loadedLevels: Set<CEFRLevel> = new Set();
  
  private userId: string | null = null;
  public assessmentId: string; // Expose for routing

  // State Management for Adaptivity (Vibe Logic)
  private streakTracking = {
    consecutivePerfect: 0,
    consecutiveFailed: 0,
    currentCalibration: 'B1' as CEFRLevel,
    proctorAdvice: null as any // Stores the last ProctorOutput
  };

  private safeGetLocalStorage(key: string): string | null {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  constructor(startingBand: DifficultyBand = 'B1', contextProfile?: LearnerContextProfile, userId: string | null = null) {
    this.userId = userId || this.safeGetLocalStorage('auth_user_id');
    this.assessmentId = "session-" + Math.random().toString(36).substr(2, 9);
    
    // 🛡️ Always start at B1 for balanced diagnostic coverage unless explicitly overridden
    const finalStartingBand = startingBand || 'B1';
    this.selector = new AdaptiveSelector(this.banks);
    
    const skillsList: EFSETSkillName[] = ['listening', 'reading', 'writing', 'speaking', 'grammar', 'vocabulary'];
    this.efsetSkills = {} as Record<EFSETSkillName, SkillState>;
    
    // Determine initial numeric score based on starting band to avoid A2-anchoring
    const initialScoreMap: Record<DifficultyBand, number> = {
      'A1': 0.25, 'A2': 0.48, 'B1': 0.62, 'B2': 0.77, 'C1': 0.88, 'C2': 0.96
    };
    const initialScore = initialScoreMap[finalStartingBand] || 0.5;

    for (const skill of skillsList) {
      this.efsetSkills[skill] = {
        score: initialScore, 
        levelRange: [finalStartingBand as CEFRLevel, finalStartingBand as CEFRLevel],
        confidence: 0,
        directEvidenceCount: 0,
        consistency: 1.0,
        status: 'insufficient_data',
        history: []
      };
    }

    this.efsetOverall = {
      levelRange: [finalStartingBand as CEFRLevel, finalStartingBand as CEFRLevel],
      confidence: 0,
      status: 'insufficient_data'
    };

    console.log(`[Engine] Initialized with starting band: ${finalStartingBand}`);

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
    // If ANY level is loaded, we assume the whole DB is loaded 
    // since our API returns all questions in one go.
    if (this.loadedLevels.size > 0) return;
    
    console.log(`[Engine] Fetching randomized question bank from database...`);
    try {
      const token = this.safeGetLocalStorage('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/questions', { headers });
      if (!res.ok) throw new Error("Failed to fetch questions from API");
      
      const allItems: QuestionBankItem[] = await res.json();
      
      const normalizedItems: QuestionBankItem[] = allItems.map(item => {
        // 🛡️ Robust normalization: Extraction from multiple keys (level, target_cefr, etc.)
        const rawLevel = (item.level || item.target_cefr || (item as any).difficulty_band || 'A1');
        const cefrraw = rawLevel.toString().trim().toUpperCase().replace(/\s+/g, '');
        let cefr = (cefrraw as CEFRLevel) || 'A1';
        
        // 🎯 ID-Based Inference (Override): If ID implies a level (e.g. B1_L_01), believe the ID!
        const idLevelMatch = item.id.match(/^(A1|A2|B1|B2|C1|C2)/i);
        if (idLevelMatch) {
           cefr = idLevelMatch[1].toUpperCase() as CEFRLevel;
        }

        // 🧠 Skill Normalization: Trim and Lowercase to prevent matching errors
        const rawSkill = (item.skill || 'vocabulary').toString().trim().toLowerCase();
        
        // 🎯 response_mode consolidation: Unify legacy 'multiple_choice' to 'mcq'
        const rawMode = (item.response_mode as string || 'typed').trim().toLowerCase();
        const responseMode = rawMode === 'multiple_choice' ? 'mcq' : rawMode;

        return {
          ...item,
          target_cefr: cefr,
          level: cefr, // 🎯 Synchronized Alias Fix
          skill: rawSkill as any,
          response_mode: responseMode as any
        };
      });

      const grouped: Record<CEFRLevel, QuestionBankItem[]> = {
        'A1': [], 'A2': [], 'B1': [], 'B2': [], 'C1': [], 'C2': []
      };

      for (const item of normalizedItems) {
        if (grouped[item.level!]) {
          grouped[item.level!].push(item);
        } else {
          // Fallback: If level is invalid, put it in A1 as safety
          grouped['A1'].push(item);
        }
      }

      // 🛡️ CRITICAL REFERENCE FIX: Update this.banks in-place 
      // This ensures that the Selector (which holds a reference to this object) sees the update.
      (Object.keys(grouped) as CEFRLevel[]).forEach(level => {
        this.banks[level] = grouped[level];
      });
      
      // Mark all levels as loaded
      Object.keys(grouped).forEach(k => this.loadedLevels.add(k as CEFRLevel));
      
      console.log(`[Engine] Loaded ${allItems.length} database items successfully.`);
      if (normalizedItems.length > 0) {
        console.log("Sample Normalized Question:", normalizedItems[0]);
      }
      if (allItems.length > 0) {
        console.log("Sample Normalized Question:", allItems[0]);
      }
    } catch (err) {
      console.error(`[Engine] Failed to load database bank:`, err);
      console.log(`[Engine] Falling back to local offline question bank...`);
      try {
        const localBank = await import('../data/assessment-questions');
        const localItems = localBank.QUESTION_BANK || [];
        const normalizedFallbackItems = localItems.map(item => {
            const cefrraw = ((item as any).target_cefr || (item as any).difficulty || 'A1').toString().trim().toUpperCase().replace(/\s+/g, '');
            let cefr = (cefrraw as CEFRLevel) || 'A1';
            
            // 🎯 ID-Based Inference Override
            const idLevelMatch = (item as any).id?.match(/^(A1|A2|B1|B2|C1|C2)/i);
            if (idLevelMatch) {
               cefr = idLevelMatch[1].toUpperCase() as CEFRLevel;
            }

            // 🎯 response_mode consolidation: Unify legacy 'multiple_choice' to 'mcq'
            const rawMode = ((item as any).response_mode as string || 'typed').trim().toLowerCase();
            const responseMode = rawMode === 'multiple_choice' ? 'mcq' : rawMode;

            return {
              ...(item as any),
              target_cefr: cefr,
              level: cefr,
              skill: ((item as any).skill || 'vocabulary').toString().trim().toLowerCase(),
              response_mode: responseMode as any
            };
        });

        const grouped: Record<CEFRLevel, QuestionBankItem[]> = {
          'A1': [], 'A2': [], 'B1': [], 'B2': [], 'C1': [], 'C2': []
        };
        for (const item of normalizedFallbackItems) {
            if (grouped[item.level]) grouped[item.level].push(item as any);
        }

        // 🛡️ CRITICAL REFERENCE FIX: Update in-place
        (Object.keys(grouped) as CEFRLevel[]).forEach(level => {
          this.banks[level] = grouped[level];
        });

        Object.keys(grouped).forEach(k => this.loadedLevels.add(k as CEFRLevel));
        console.log(`[Engine] Loaded fallback offline items successfully.`);
        if (normalizedFallbackItems.length > 0) {
          console.log("Sample Normalized Offline Question:", normalizedFallbackItems[0]);
        }
        if (localItems.length > 0) {
          console.log("Sample Normalized Offline Question:", localItems[0]);
        }
      } catch (fallbackErr) {
        console.error(`[Engine] Local fallback also failed:`, fallbackErr);
      }
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
      
      // 🕵️ Final Audit Trigger (Auditor Agent)
      this.finishAssessment();
      return null;
    }

    // 2. Skill Rotation Logic (Proctor Recommendation)
    const skillsToProbe: EFSETSkillName[] = ['speaking', 'grammar', 'vocabulary']; // Rotated by Proctor
    const nextSkill = skillsToProbe[uniqueAnsweredCount % skillsToProbe.length];
    
    // 3. Hybrid Generation Support: Check if Proctor has a specific next_question
    if (this.streakTracking.proctorAdvice?.next_question) {
      console.log('[Engine] 🤖 Using Proctor Generated Question.');
      const advice = this.streakTracking.proctorAdvice;
      
      return {
        id: `gen-${Math.random().toString(36).substr(2, 5)}`,
        prompt: advice.next_question,
        skill: advice.expected_skill.toLowerCase() as any,
        primarySkill: advice.expected_skill.toLowerCase() as any,
        difficulty: advice.current_difficulty_calibration as DifficultyBand,
        type: 'short_text', // Default for generated questions
        response_mode: advice.expected_skill === 'Speaking' ? 'voice' : 'typed',
        _proctorGenerated: true
      } as any;
    }

    // 4. Select Next Item from Bank
    let nextItem = this.selector.selectNext({
      skills: this.efsetSkills,
      askedQuestionIds: this.askedQuestionIds,
      currentOverallLevel: this.efsetOverall.levelRange[0]
    });

    if (!nextItem) {
      // SMART FALLBACK: If the logic returns null, find the NEAREST question level 
      // instead of a completely random one to avoid the C2 shock.
      console.warn('[Engine] Target level empty. Finding nearest available level...');
      
      const currentLevel = this.efsetOverall.levelRange[0] as DifficultyBand;
      const bandOrder: DifficultyBand[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const currentIndex = bandOrder.indexOf(currentLevel);

      const allAvailable = Object.values(this.banks).flat().filter(q => !this.askedQuestionIds.has(q.id));
      
      if (allAvailable.length > 0) {
        // Sort by distance from current level
        allAvailable.sort((a, b) => {
          const cefrA = (a.target_cefr || 'A1').toString().trim().toUpperCase().replace(/\s+/g, '') as DifficultyBand;
          const cefrB = (b.target_cefr || 'A1').toString().trim().toUpperCase().replace(/\s+/g, '') as DifficultyBand;
          const distA = Math.abs(bandOrder.indexOf(cefrA) - currentIndex);
          const distB = Math.abs(bandOrder.indexOf(cefrB) - currentIndex);
          return distA - distB;
        });
        nextItem = allAvailable[0];
      }
    }

    if (!nextItem) {
      this.state.completed = true;
      console.warn('[Engine] TOTAL EXHAUSTION: No questions left in database.');
      return null;
    }

    // 3. Ensure level is actually loaded (it might be a neighbor level step up/down)
    const targetCefr = (nextItem.target_cefr || 'A1').toString().trim().toUpperCase().replace(/\s+/g, '') as CEFRLevel;
    await this.ensureLevelLoaded(targetCefr);

    // 3. CRITICAL: Mark as asked BEFORE returning to prevent rapid-fire repetition
    this.askedQuestionIds.add(nextItem.id);
    if (!this.state.askedQuestionIds.includes(nextItem.id)) {
      this.state.askedQuestionIds.push(nextItem.id);
    }

    let originalOptions: string[] | undefined;
    const ak = nextItem.answer_key;
    if (typeof ak === 'object' && ak !== null && typeof ak.value === 'object' && ak.value !== null && 'options' in ak.value) {
      originalOptions = ak.value.options;
    } else {
      originalOptions = nextItem.options;
    }

    return {
      id: nextItem.id,
      external_id: nextItem.external_id || nextItem.id,
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
    
    const efsetItem = ((question as any)._efset || question) as QuestionBankItem;
    if (!efsetItem || !efsetItem.prompt) {
      return { correct: false, score: 0 };
    }

    const correctAns = efsetItem.answer_key;
    let correctText = '';
    if (typeof correctAns === 'string') {
      correctText = correctAns;
    } else if (correctAns && typeof correctAns === 'object' && (correctAns as any).value) {
      correctText = String((correctAns as any).value);
    }

    // 🎯 INITIAL LOGGING (Unconfirmed state)
    this.state.answerHistory.push({
      taskId: efsetItem.id,
      questionId: efsetItem.id,
      skill: efsetItem.skill as any,
      difficulty: BAND_VALUE[efsetItem.target_cefr as any] || 1,
      correct: false,
      score: 0,
      answer,
      correctAnswer: correctText,
      responseTimeMs,
      taskType: efsetItem.task_type as any
    });

    try {
      // 🤖 PROCTOR AGENT: The single source of truth for scoring and adaptivity
      const recentHistory = this.state.answerHistory.slice(-5).map(h => ({
        q: h.questionId,
        s: h.score,
        c: h.correct
      }));
      
      const proctor = await GroqScoringService.callProctor(
        question, 
        answer, 
        this.streakTracking.currentCalibration, 
        JSON.stringify(recentHistory)
      );
      
      if (proctor) {
        this.streakTracking.proctorAdvice = proctor;
        const isCorrectResult = proctor.is_correct;
        const score = proctor.score;
        
        console.log(`[Engine] Proctor: ${proctor.detected_level} | ${proctor.expected_skill} | Score: ${score}`);

        // 1. Streak-based Difficulty Adjustment
        if (score > 0.85) {
          this.streakTracking.consecutivePerfect++;
          this.streakTracking.consecutiveFailed = 0;
          if (this.streakTracking.consecutivePerfect >= 2) {
            this.levelUp();
            this.streakTracking.consecutivePerfect = 0;
          }
        } else if (score < 0.4) {
          this.streakTracking.consecutiveFailed++;
          this.streakTracking.consecutivePerfect = 0;
          this.levelDown();
        }

        // 2. EFSET Evidence Mapping
        const signals: LLMSignal = {
          content_accuracy: score,
          task_completion: score,
          grammar_control: score,
          lexical_range: score,
          syntactic_complexity: score,
          coherence: score,
          typo_severity: isCorrectResult ? 0 : 0.5,
          confidence: score
        };

        const evidences = EvidenceMapper.mapSignalToEvidence(
          efsetItem, 
          signals, 
          isCorrectResult, 
          (responseMode as string) === 'audio' ? 'audio' : 'typed'
        );

        for (const evidence of evidences) {
          const skillName = evidence.skill as EFSETSkillName;
          this.efsetSkills[skillName] = SkillAggregator.update(this.efsetSkills[skillName], evidence);
        }
        this.efsetOverall = CEFREngine.computeOverall(this.efsetSkills);
        this.state.overallConfidence = this.efsetOverall.confidence;

        // 3. Evaluation Record
        const taskEval: TaskEvaluation = {
          taskId: efsetItem.id,
          primarySkill: efsetItem.skill as any,
          validAttempt: true,
          channels: { comprehension: score, taskCompletion: score },
          responseMode,
          speakingMeta,
          skillEvidence: evidences.reduce((acc, e) => ({ ...acc, [e.skill]: e.score }), {}),
          descriptorEvidence: evidences.map(e => ({
            descriptorId: e.skill, support: e.score, sourceSkill: e.skill as any, weight: e.weight
          })),
          notes: [proctor.reasoning],
          difficulty: efsetItem.target_cefr as any,
          skill: efsetItem.skill as any,
          errorTag: proctor.error_tag,
          briefExplanation: proctor.feedback
        };
        this.state.taskEvaluations.push(taskEval);

        // 4. Update Answer History
        const historyIdx = this.state.answerHistory.length - 1;
        if (this.state.answerHistory[historyIdx]) {
          this.state.answerHistory[historyIdx].correct = isCorrectResult;
          this.state.answerHistory[historyIdx].score = score;
          this.state.answerHistory[historyIdx].errorTag = proctor.error_tag;
          this.state.answerHistory[historyIdx].briefExplanation = proctor.feedback;
        }

        // 5. 🚩 Background Persistence (The Safe Move): No await here.
        // UI moves to next step immediately while DB saves in background.
        AssessmentSaveService.saveSingleAssessmentLog(efsetItem, proctor, answer)
          .then(() => {
            console.log(`✅ [Background Sync] Perfect data saturation for: ${efsetItem.external_id || efsetItem.id}`);
          })
          .catch(err => {
            console.error("❌ [Background Save Failed] but UI kept moving:", err);
          });

        // 6. Journey Logic: If success criteria met (e.g., mastering the current calibration)
        if (score > 0.85 && this.streakTracking.consecutivePerfect >= 1) {
          // Note: Logic to identify current journey step ID would go here
          // For now, we signal completion of the "current" context if applicable
          console.log('[Engine] 🎯 Success criteria met for potential journey step advancement.');
        }

        return { correct: isCorrectResult, score };
      }

      // 🛡️ Fallback Logic
      const deterministicCorrect = answer.trim().toLowerCase() === correctText.trim().toLowerCase();
      return { correct: deterministicCorrect, score: deterministicCorrect ? 1.0 : 0.0 };

    } catch (err) {
      console.error("[Engine] Proctor failed. Using fallback.", err);
      const isDetCorrect = answer.trim().toLowerCase() === correctText.trim().toLowerCase();
      return { correct: isDetCorrect, score: isDetCorrect ? 1.0 : 0.0 };
    }
  }

  private performCalibrationReset() {
    console.log('[Engine] 🧭 Running Calibration Reset (4-item evaluation)...');
    
    // Calculate weighted signals for each of the first 4 tasks
    const signals = this.state.taskEvaluations.slice(0, 4).map(ev => {
       const lex = ev.channels?.lexicalRange || 0;
       const gram = ev.channels?.grammarAccuracy || 0;
       const comp = ev.channels?.taskCompletion || 0;
       return (lex * 0.4 + gram * 0.4 + comp * 0.2);
    });

    // ✂️ Trimmed Mean: Sort and remove highest + lowest to eliminate outliers
    const sorted = [...signals].sort((a, b) => a - b);
    const middleTwo = sorted.slice(1, 3); 
    const avgLinguistic = middleTwo.reduce((acc, v) => acc + v, 0) / 2;
    
    console.log(`[Engine] Calibration Signature: [${signals.map(s => s.toFixed(2)).join(', ')}]`);
    console.log(`[Engine] Trimmed Mean Score: ${avgLinguistic.toFixed(2)}`);

    if (avgLinguistic > 0.85) {
       console.log('[Engine] 🚀 STABLE HIGH PROFICIENCY! Jumping to C1 (Calibration).');
       this.jumpToLevel('C1');
    } else if (avgLinguistic < 0.45) {
       console.log('[Engine] 📉 CONSISTENT STRUGGLE. Adjusting to A2 (Calibration).');
       this.jumpToLevel('A2');
    }
  }

  private jumpToLevel(level: CEFRLevel) {
    const scoreMap: Record<string, number> = { A1: 0.25, A2: 0.48, B1: 0.62, B2: 0.77, C1: 0.88, C2: 0.96 };
    const newScore = scoreMap[level] || 0.5;

    // Update all skills and overall state
    for (const skill of Object.keys(this.efsetSkills) as EFSETSkillName[]) {
       this.efsetSkills[skill].score = newScore;
       this.efsetSkills[skill].levelRange = [level, level];
    }
    this.efsetOverall.levelRange = [level, level];
    this.efsetOverall.confidence = 0.5; // Artificial boost to stabilize routing
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

    let originalOptions: string[] | undefined;
    const ak = nextItem.answer_key;
    if (typeof ak === 'object' && ak !== null && typeof ak.value === 'object' && ak.value !== null && 'options' in ak.value) {
      originalOptions = ak.value.options;
    } else {
      originalOptions = nextItem.options;
    }

    // 4. Return formatted question
    return {
      id: nextItem.id,
      external_id: nextItem.external_id || nextItem.id,
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
       speakingAudit: this.state.speakingAudit,
 
       // 🕵️ Auditor Agent Diagnosis
       finalLevel: (this.state.finalAuditor?.final_cefr_level as any) || this.rangeToLabel(report.overall.levelRange),
       bridgeDelta: String(this.state.finalAuditor?.overall_score || 0),
       errorAnalysisReport: this.state.finalAuditor?.diagnosis_report,
       auditorReport: this.state.finalAuditor
     };
  }

  private levelUp() {
    const bandOrder: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const currentIndex = bandOrder.indexOf(this.streakTracking.currentCalibration);
    if (currentIndex < bandOrder.length - 1) {
      this.streakTracking.currentCalibration = bandOrder[currentIndex + 1];
      this.jumpToLevel(this.streakTracking.currentCalibration);
    }
  }

  private levelDown() {
    const bandOrder: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const currentIndex = bandOrder.indexOf(this.streakTracking.currentCalibration);
    if (currentIndex > 0) {
      this.streakTracking.currentCalibration = bandOrder[currentIndex - 1];
      this.jumpToLevel(this.streakTracking.currentCalibration);
    }
  }

  private async finishAssessment() {
    console.log('[Engine] 🏁 Assessment Phase Complete. Generating Psychometric Audit...');
    try {
      const auditor = await GroqScoringService.callAuditor(this.state.taskEvaluations);
      if (auditor) {
        this.state.finalAuditor = auditor;
      }
    } catch (e) {
      console.error('[Engine] Auditor failed:', e);
    }
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

  /**
   * Reconstructs the internal state of the engine given previous task evaluations
   * from an interrupted session, allowing the learner to resume seamlessly.
   */
  public initializeFromHistory(evaluations: TaskEvaluation[], partialAnswerHistory: AnswerRecord[]) {
    if (!evaluations || evaluations.length === 0) return;
    
    console.log(`[Engine] Reconstructing state from ${evaluations.length} previous tasks...`);
    
    for (const task of evaluations) {
      if (!this.askedQuestionIds.has(task.taskId)) {
        this.askedQuestionIds.add(task.taskId);
        this.state.askedQuestionIds.push(task.taskId);
        this.state.taskEvaluations.push(task);
      }
      
      const skillName = task.primarySkill as EFSETSkillName;
      if (this.efsetSkills[skillName]) {
        // Approximate score recovery
        const score = task.channels?.comprehension !== undefined ? task.channels.comprehension : 0.5;
        this.efsetSkills[skillName].score = (this.efsetSkills[skillName].score + score) / 2;
        this.efsetSkills[skillName].directEvidenceCount++;
      }
    }
    
    if (partialAnswerHistory && partialAnswerHistory.length > 0) {
      this.state.answerHistory = [...partialAnswerHistory];
    }
    
    this.state.questionsAnswered = this.askedQuestionIds.size;
    this.efsetOverall = CEFREngine.computeOverall(this.efsetSkills);
    this.state.overallConfidence = this.efsetOverall.confidence;
    
    console.log(`[Engine] Restored state. Resuming at Question ${this.state.questionsAnswered + 1}`);
  }

  public getProgress() {
    return {
      answered: this.state.taskEvaluations.length,
      total: ASSESSMENT_CONFIG.MAX_QUESTIONS,
      percentage: Math.min(100, (this.state.taskEvaluations.length / ASSESSMENT_CONFIG.MAX_QUESTIONS) * 100),
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

  /**
   * Finalizes the assessment session. Saves results to Supabase and marks session complete.
   * Returns true on success, false on failure.
   */
  public async finalizeAssessment(): Promise<boolean> {
    try {
      console.log(`[Engine] Finalizing Assessment session ${this.assessmentId}...`);
      const finalOutcome = this.getOutcome();
      const userId = this.userId || this.safeGetLocalStorage('auth_user_id');
      
      if (!userId) {
        console.warn("[Engine] No userId found, skipping cloud persistence.");
        return true; // Consider local-only sessions as success for navigation purposes
      }

      // 1. Save results to Supabase via RPC (Atomic Transaction)
      await AssessmentSaveService.saveAssessmentResults(finalOutcome);
      
      // 2. Notify internal API of completion (Syncing metadata)
      const token = this.safeGetLocalStorage('auth_token');
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/assessments/complete', {
        method: 'POST',
        headers,
        body: JSON.stringify({
           assessmentId: this.assessmentId,
           overallLevel: finalOutcome.finalLevel || finalOutcome.overallBand,
           confidence: finalOutcome.overallConfidence,
           auditorReport: finalOutcome.auditorReport
        })
      });

      if (!res.ok) {
        console.warn(`[Engine] /api/assessments/complete returned status ${res.status}`);
      }

      console.log(`[Engine] Successfully committed session ${this.assessmentId} to Database.`);
      this.state.completed = true;
      return true;
    } catch (e) {
      console.error(`[Engine] Failed to finalize session:`, e);
      return false;
    }
  }

  public async completeAssessment(): Promise<void> {
    await this.finalizeAssessment();
  }

  public getState(): AdaptiveAssessmentState {
    return this.state;
  }

  /**
   * Helper for tests: Force-updates a single skill estimate.
   */
  public updateSingleSkillEstimate(skill: EFSETSkillName, evidence: { taskId: string; score: number }) {
    const numericDiff = 3; // B1 difficulty for force updates
    this.efsetSkills[skill] = SkillAggregator.update(this.efsetSkills[skill], {
      skill: skill as any,
      score: evidence.score,
      weight: 1.0,
      direct: true,
      numericDifficulty: numericDiff
    });
  }
}
