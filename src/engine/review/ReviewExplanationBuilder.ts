import { SessionTask, TaskEvaluationResult } from '../../types/runtime';
import { AnswerReviewItem, TaskEvaluation, AssessmentQuestion } from '../../types/assessment';

export class ReviewExplanationBuilder {
  /**
   * Translates a score out of 100 to an approximate CEFR answer level,
   * bounded by the question's target difficulty.
   */
  private static estimateAnswerLevel(score: number, questionLevel: string): string {
    const qLevel = questionLevel.replace('+',''); // e.g. "B2"

    // If score is perfect or near perfect, they matched the target
    if (score >= 85) return qLevel;
    // Approaching the level
    if (score >= 60) return `${this.levelBelow(qLevel)}-${qLevel}`;
    // Way below the level
    return this.levelBelow(qLevel);
  }

  private static levelBelow(level: string): string {
    const order = ["A1", "A2", "B1", "B2", "C1", "C2"];
    const idx = order.indexOf(level);
    if (idx <= 0) return "Pre-A1";
    return order[idx - 1];
  }

  /**
   * Builds from Practice Session data
   */
  public static build(
    task: SessionTask,
    result: TaskEvaluationResult,
    userAnswer: string
  ): AnswerReviewItem {
    return this.internalBuild({
      id: task.taskId,
      skill: task.targetSkill,
      type: task.taskType,
      level: task.difficultyTarget || "B1",
      prompt: task.prompt,
      userAnswer,
      score: result.successScore,
      meaningSuccess: result.meaningSuccess,
      responseMode: result.responseMode,
      complexity: result.dimensions?.complexity,
      targetWord: task.payload?.targetWord,
      audioSrc: task.payload?.audioSrc
    });
  }

  /**
   * Builds from Diagnostic Assessment data
   */
  public static buildFromAssessment(
    question: AssessmentQuestion,
    evaluation: TaskEvaluation,
    userAnswer: string
  ): AnswerReviewItem {
    // Map diagnostic channels to meaning success
    const meaningSuccess = (evaluation.channels?.comprehension ?? 0) >= 0.8;
    const score = Math.round((evaluation.channels?.comprehension || 0) * 100);

    // Extract correct answer if available
    let correctAnswer: string | undefined;
    const key = evaluation.rawSignals?.answerKey as any;
    if (typeof key === 'string') correctAnswer = key;
    else if (key?.value?.options && key?.value?.correct_index !== undefined) {
      correctAnswer = key.value.options[key.value.correct_index];
    } else if (key?.correct_answer) {
      correctAnswer = key.correct_answer;
    }

    return this.internalBuild({
      id: question.id,
      skill: question.primarySkill,
      type: question.type,
      level: question.difficulty,
      prompt: question.prompt,
      userAnswer,
      score: score,
      meaningSuccess,
      responseMode: evaluation.responseMode,
      complexity: (evaluation.channels?.lexicalRange || 0) * 100,
      targetWord: correctAnswer,
      audioSrc: question.audioUrl
    });
  }

  /**
   * Unified internal builder
   */
  private static internalBuild(data: {
    id: string;
    skill: string;
    type: string;
    level: string;
    prompt: string;
    userAnswer: string;
    score: number;
    meaningSuccess: boolean;
    responseMode?: string;
    complexity?: number;
    targetWord?: string;
    audioSrc?: string;
  }): AnswerReviewItem {
    const questionLevel = data.level; 
    const answerLevel = this.estimateAnswerLevel(data.score, questionLevel);

    let correctness: "correct" | "incorrect" | "partial" = "incorrect";
    if (data.score >= 80) correctness = "correct";
    else if (data.score >= 50) correctness = "partial";

    const review: AnswerReviewItem = {
      questionId: data.id,
      skill: data.skill,
      taskType: data.type,
      questionLevel,
      answerLevel,
      result: correctness,
      prompt: data.prompt,
      userAnswer: data.userAnswer || "(No answer provided)",
      explanation: {}
    };

    // Task Type Routing
    const normalizedType = data.type.toLowerCase();
    
    if (normalizedType.includes('vocabulary') || normalizedType === 'mcq' || normalizedType === 'fill_blank') {
       this.applyVocabLogic(review, data.targetWord, data.meaningSuccess);
    } else if (normalizedType.includes('write')) {
       this.applyWritingLogic(review, data.complexity || 0);
    } else if (normalizedType.includes('speak') || normalizedType === 'picture_description') {
       this.applySpeakingLogic(review, data.responseMode, data.score);
    } else if (normalizedType.includes('listen')) {
       this.applyListeningLogic(review, data.audioSrc);
    } else if (correctness === 'correct') {
       review.explanation.whyCorrect = "Your answer successfully met the task requirements.";
    } else {
       review.explanation.whatWentWrong = "Your answer did not fully address the requirements.";
    }

    // Global Overrides
    if (correctness === "correct" && answerLevel !== questionLevel) {
      review.explanation.levelNote = `Your answer was correct in meaning, but written using simpler language than expected for a ${questionLevel} task.`;
      if (!review.explanation.improvementTip) {
        review.explanation.improvementTip = `To push towards ${questionLevel}, try incorporating more complex vocabulary and linking words.`;
      }
    }

    return review;
  }

  private static applyVocabLogic(review: AnswerReviewItem, targetWord: string | undefined, meaningSuccess: boolean) {
    const word = targetWord || "the target word";
    review.correctAnswer = word;
    if (review.result === "correct") {
      review.explanation.whyCorrect = `Correct! "${word}" is the precise term required by the context.`;
    } else if (meaningSuccess) {
      review.explanation.whyIncorrect = "Good attempt! You understood the meaning, but the specific term was slightly different.";
      review.explanation.whatWentWrong = `We were looking for "${word}".`;
      review.explanation.improvementTip = `Recall synonyms or specific phrasal verbs for "${review.userAnswer}".`;
    } else {
      review.explanation.whyIncorrect = "The choice of word didn't quite capture the intended meaning or fit the structure.";
      review.explanation.improvementTip = `Look at how "${word}" functions in this specific type of sentence.`;
    }
  }

  private static applyWritingLogic(review: AnswerReviewItem, complexity: number) {
    if (review.result === "correct") {
      review.explanation.whyCorrect = "Excellent structure. You used varied sentence forms and clear logic.";
    } else if (review.result === "partial") {
      review.explanation.whyIncorrect = "The sentences are correct but could be more connected.";
      review.explanation.improvementTip = "Try using connectors like 'although', 'furthermore', or 'consequently'.";
    } else {
      review.explanation.whyIncorrect = "The response lacks the required depth or grammatical range.";
    }
  }

  private static applySpeakingLogic(review: AnswerReviewItem, mode: string | undefined, score: number) {
    if (mode === 'typed_fallback') {
      review.explanation.levelNote = "⚠️ Speaking Mastery was NOT assessed because you typed your response. To receive a Speaking grade, you must use the microphone.";
      review.explanation.improvementTip = "بناءً على طلبك، لم يتم احتساب هذه المحاولة في مهارة التحدث لأنها كتبت نصياً. يرجى إعادة المحاولة باستخدام الميكروفون لتقييم نطقك وطلاقتك.";
      review.answerLevel = "N/A (Typed)";
    }
    
    if (review.result === "correct") {
      review.explanation.whyCorrect = "Your response is natural and captures the prompt's requirements well.";
    } else {
      review.explanation.whyIncorrect = "The communication was a bit disjointed or the response was too brief.";
      if (!review.explanation.improvementTip && mode !== 'typed_fallback') {
         review.explanation.improvementTip = "Try to elaborate more on your ideas to show higher fluency.";
      }
    }
  }

  private static applyListeningLogic(review: AnswerReviewItem, audioSrc: string | undefined) {
    if (review.result === "correct") {
      review.explanation.whyCorrect = "Great! You accurately identified the key information from the audio.";
    } else {
      review.explanation.whyIncorrect = "Some details from the audio were missed or misinterpreted.";
      review.explanation.improvementTip = "Focus on the main stressed words when listening next time.";
    }
  }
}
