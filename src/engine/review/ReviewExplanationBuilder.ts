import { SessionTask, TaskEvaluationResult, AnswerReviewItem } from '../../types/runtime';

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
   * Core generation logic for review items
   */
  public static build(
    task: SessionTask,
    result: TaskEvaluationResult,
    userAnswer: string
  ): AnswerReviewItem {
    
    // 1. Establish Levels
    const questionLevel = task.difficultyTarget || "B1"; 
    const answerLevel = this.estimateAnswerLevel(result.successScore, questionLevel);

    // 2. Establish Correctness
    let correctness: "correct" | "incorrect" | "partial" = "incorrect";
    if (result.successScore >= 80) correctness = "correct";
    else if (result.successScore >= 50) correctness = "partial";
    else correctness = "incorrect";

    // Build base item
    const review: AnswerReviewItem = {
      questionId: task.taskId,
      skill: task.targetSkill,
      taskType: task.taskType,
      questionLevel,
      answerLevel,
      result: correctness,
      prompt: task.prompt,
      userAnswer: userAnswer || "(No answer provided)",
      explanation: {}
    };

    // 3. Task Type Routing
    switch (task.taskType) {
      case 'vocabulary':
        this.populateVocabularyReview(review, task, result);
        break;
      case 'writing':
        this.populateWritingReview(review, task, result);
        break;
      case 'speaking':
        this.populateSpeakingReview(review, task, result);
        break;
      case 'listening':
        this.populateListeningReview(review, task, result);
        break;
      default:
        // Generic fallback
        if (correctness === 'correct') review.explanation.whyCorrect = "Your answer successfully met the task requirements.";
        else review.explanation.whatWentWrong = "Your answer did not fully address the requirements.";
    }

    // 4. Global Overrides based on answer vs question level
    if (correctness === "correct" && answerLevel !== questionLevel) {
      review.explanation.levelNote = `Your answer was correct in meaning, but written using simpler language than expected for a ${questionLevel} task.`;
      if (!review.explanation.improvementTip) {
        review.explanation.improvementTip = `To push towards ${questionLevel}, try incorporating more complex vocabulary and linking words.`;
      }
    }

    return review;
  }

  // --- Specific Strategies ---

  private static populateVocabularyReview(review: AnswerReviewItem, task: SessionTask, result: TaskEvaluationResult) {
    const targetWord = task.payload?.targetWord || "the correct vocabulary word";
    review.correctAnswer = targetWord;

    if (review.result === "correct") {
      review.explanation.whyCorrect = `You successfully identified "${targetWord}" as the correct vocabulary in this context.`;
    } else {
      if (result.meaningSuccess) {
        review.explanation.whyIncorrect = `You got the general meaning right, but we were looking for a specific advanced phrase.`;
        review.explanation.whatWentWrong = `Your answer "${review.userAnswer}" does not precisely match the target phrase or its correct grammatical form.`;
      } else {
        review.explanation.whyIncorrect = `The intended meaning requires a specific piece of vocabulary that was missing.`;
        review.explanation.whatWentWrong = `Your choice did not fit the sentence structure or semantic context of the prompt.`;
      }
      review.explanation.improvementTip = `Review the usage of "${targetWord}" in similar full sentences.`;
    }
  }

  private static populateWritingReview(review: AnswerReviewItem, task: SessionTask, result: TaskEvaluationResult) {
    if (review.result === "correct") {
      review.explanation.whyCorrect = "Your written response was well-structured, coherent, and directly answered the prompt.";
      if (result.dimensions?.complexity > 70) {
        review.explanation.improvementTip = "Great use of complex sentence structures and connectors!";
      }
    } else if (review.result === "partial") {
      review.explanation.whyIncorrect = "Your response addressed the prompt but lacked structural complexity or depth.";
      review.explanation.whatWentWrong = "You might have missed using connectors (like 'however', 'therefore') or wrote very short, disconnected sentences.";
      review.explanation.modelAnswer = "A strong response would use at least 2 complete sentences connected smoothly with introductory phrases.";
      review.explanation.improvementTip = "Try to connect your ideas using linking words next time.";
    } else {
      review.explanation.whyIncorrect = "The response was too short, grammatically incomplete, or didn't address the main prompt.";
      review.explanation.whatWentWrong = "A complete sentence with a subject, verb, and object was expected.";
    }
  }

  private static populateSpeakingReview(review: AnswerReviewItem, task: SessionTask, result: TaskEvaluationResult) {
    if (result.responseMode === 'typed_fallback') {
      review.explanation.levelNote = "Note: You typed your answer in a speaking task, which limits our ability to measure pronunciation and fluency.";
    }

    if (review.result === "correct") {
      review.explanation.whyCorrect = "You communicated your ideas clearly and achieved the communicative goal.";
    } else if (review.result === "partial") {
      review.explanation.whyIncorrect = "We understood your main point, but the delivery could be more natural.";
      review.explanation.whatWentWrong = "You might have hesitated frequently, or used overly simple vocabulary for the situation.";
      review.explanation.improvementTip = "Practice speaking this response a few times out loud until it flows without long pauses.";
    } else {
      review.explanation.whyIncorrect = "The core message was unclear or task instructions were not followed.";
    }
  }

  private static populateListeningReview(review: AnswerReviewItem, task: SessionTask, result: TaskEvaluationResult) {
    if (review.result === "correct") {
      review.explanation.whyCorrect = "Excellent comprehension. You captured the key points from the audio clip.";
    } else {
      review.explanation.whyIncorrect = "You missed the main gist or specific detail required by the prompt.";
      if (task.payload?.audioSrc) {
        review.explanation.improvementTip = "Try listening to the audio again at a slower speed and focus on stressed keywords.";
      }
    }
  }
}
