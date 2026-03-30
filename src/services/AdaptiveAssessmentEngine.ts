import { AssessmentQuestion, DifficultyBand, QuestionResult } from '../types/assessment';
import { QUESTION_BANK } from '../data/assessment-questions';
import { TaskResult } from '../types/app';

const BAND_ORDER: DifficultyBand[] = ["A1", "A2", "B1", "B2", "C1"];

export class AdaptiveAssessmentEngine {
  private currentBand: DifficultyBand = "A2";
  private history: QuestionResult[] = [];
  private askedQuestionIds: Set<string> = new Set();
  private maxQuestions = 10;
  private consecutiveCorrect = 0;
  private consecutiveIncorrect = 0;

  constructor(startingBand: DifficultyBand = "A2", numQuestions: number = 10) {
    this.currentBand = startingBand;
    this.maxQuestions = numQuestions;
  }

  public getNextQuestion(): AssessmentQuestion | null {
    if (this.history.length >= this.maxQuestions) {
      return null;
    }

    // Attempt to find a question in the current band that hasn't been asked
    let nextQ = this.findUnusedQuestion(this.currentBand);
    
    // If we exhaust the band, expand search to adjacent bands
    if (!nextQ) {
      const idx = BAND_ORDER.indexOf(this.currentBand);
      for (let offset = 1; offset < BAND_ORDER.length; offset++) {
        const upBand = BAND_ORDER[idx + offset];
        const downBand = BAND_ORDER[idx - offset];
        
        if (upBand) {
          nextQ = this.findUnusedQuestion(upBand);
          if (nextQ) break;
        }
        if (downBand) {
          nextQ = this.findUnusedQuestion(downBand);
          if (nextQ) break;
        }
      }
    }

    if (nextQ) {
      this.askedQuestionIds.add(nextQ.id);
    }
    return nextQ || null;
  }

  public submitAnswer(question: AssessmentQuestion, answer: string, responseTimeMs: number): boolean {
    const isCorrect = this.evaluateAnswer(question, answer);
    
    this.history.push({
      questionId: question.id,
      isCorrect,
      score: isCorrect ? 1 : 0,
      answer,
      responseTimeMs
    });

    this.updateDifficulty(isCorrect);
    
    return isCorrect;
  }

  public getProgress() {
    return {
      answered: this.history.length,
      total: this.maxQuestions,
      percentage: (this.history.length / this.maxQuestions) * 100,
      currentBand: this.currentBand
    };
  }

  public exportResultsForLegacyAnalysis(): TaskResult[] {
    // Maps the adaptive history back into the format expected by AnalysisService
    return this.history.map(item => {
      const q = QUESTION_BANK.find(x => x.id === item.questionId);
      
      // Map back to legacy TaskResult format for the AnalysisService
      return {
        taskId: item.questionId,
        answer: item.answer,
        responseTime: item.responseTimeMs,
        wordCount: item.answer.trim().split(/\s+/).length,
        hintUsage: 0,
        taskType: q?.skill === 'writing' ? 'writing' :
                  q?.skill === 'vocabulary' ? 'vocabulary_in_context' :
                  q?.skill === 'grammar' ? 'writing' :
                  q?.skill === 'reading' ? 'writing' :
                  q?.skill === 'listening_proxy' ? 'listening_comprehension' : 'writing',
        metadata: {
          difficulty: q?.difficulty,
          isCorrect: item.isCorrect,
          skill: q?.skill
        }
      } as TaskResult;
    });
  }

  private findUnusedQuestion(band: DifficultyBand): AssessmentQuestion | undefined {
    // Prefer grammar, vocab, reading (more predictable for short adaptive)
    return QUESTION_BANK.find(q => q.difficulty === band && !this.askedQuestionIds.has(q.id));
  }

  private evaluateAnswer(question: AssessmentQuestion, answer: string): boolean {
    const normAns = answer.trim().toLowerCase();
    
    if (question.evaluationMode === 'exact') {
      const correct = Array.isArray(question.correctAnswer) ? question.correctAnswer[0] : (question.correctAnswer || "");
      return normAns === correct.toLowerCase();
    }
    
    if (question.evaluationMode === 'includes') {
      const allowedWords = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer || ""];
      return allowedWords.some(w => normAns.includes(w.toLowerCase()));
    }
    
    if (question.evaluationMode === 'manual_rule') {
      // Basic heuristic: check length as proxy for "tried"
      const words = normAns.split(/\s+/).filter(w => w.length > 0).length;
      if (question.difficulty === 'B2' || question.difficulty === 'C1') {
        return words >= 10;
      }
      return words >= 5;
    }
    
    return false;
  }

  private updateDifficulty(isCorrect: boolean) {
    if (isCorrect) {
      this.consecutiveCorrect++;
      this.consecutiveIncorrect = 0;
      if (this.consecutiveCorrect >= 2) {
        this.stepBandUp();
        this.consecutiveCorrect = 0; // reset momentum after promotion
      }
    } else {
      this.consecutiveIncorrect++;
      this.consecutiveCorrect = 0;
      if (this.consecutiveIncorrect >= 2) {
        this.stepBandDown();
        this.consecutiveIncorrect = 0; // reset momentum after demotion
      }
    }
  }

  private stepBandUp() {
    const idx = BAND_ORDER.indexOf(this.currentBand);
    if (idx < BAND_ORDER.length - 1) {
      this.currentBand = BAND_ORDER[idx + 1];
    }
  }

  private stepBandDown() {
    const idx = BAND_ORDER.indexOf(this.currentBand);
    if (idx > 0) {
      this.currentBand = BAND_ORDER[idx - 1];
    }
  }
}
