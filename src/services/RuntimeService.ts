import { SessionTask, TaskEvaluationResult, TaskFeedbackPayload } from '../types/runtime';

/** Text analysis helper (mirrors AnalysisService.analyzeText logic) */
function analyzeResponse(text: string): {
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  uniqueWordRatio: number;
  hasConnectors: boolean;
  complexityScore: number;
} {
  const cleaned = text.trim();
  if (!cleaned) {
    return { wordCount: 0, sentenceCount: 0, avgWordsPerSentence: 0, uniqueWordRatio: 0, hasConnectors: false, complexityScore: 0 };
  }

  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = Math.max(sentences.length, 1);
  const avgWordsPerSentence = wordCount / sentenceCount;

  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-zA-Z]/g, '')));
  const uniqueWordRatio = uniqueWords.size / Math.max(wordCount, 1);

  const connectors = ['however', 'therefore', 'because', 'although', 'furthermore', 'moreover',
    'nevertheless', 'consequently', 'despite', 'while', 'since', 'for example', 'in addition',
    'on the other hand', 'as a result', 'in fact', 'such as', 'firstly', 'secondly', 'finally',
    'but', 'and', 'so', 'then', 'also', 'too', 'yet', 'still'];
  const lowerText = cleaned.toLowerCase();
  const hasConnectors = connectors.some(c => lowerText.includes(c));

  // Composite complexity: mix of length, variety, sentence structure
  const lengthScore = Math.min(wordCount / 30, 1.0) * 30;          // max 30 at 30+ words
  const varietyScore = Math.min(uniqueWordRatio / 0.7, 1.0) * 25;  // max 25
  const structureScore = Math.min(avgWordsPerSentence / 12, 1.0) * 20; // max 20
  const connectorBonus = hasConnectors ? 15 : 0;                    // max 15
  const multiSentenceBonus = sentenceCount >= 2 ? 10 : 0;           // max 10
  const complexityScore = Math.min(100, Math.round(lengthScore + varietyScore + structureScore + connectorBonus + multiSentenceBonus));

  return { wordCount, sentenceCount, avgWordsPerSentence, uniqueWordRatio, hasConnectors, complexityScore };
}

/**
 * Orchestrates the lifecycle of learning tasks and generates feedback states.
 */
export class RuntimeService {
  /**
   * Returns structured session tasks. In production, this would pull from
   * LearnerModel state to identify what needs review, focus, or challenge.
   */
  public static generateSessionTasks(): SessionTask[] {
    return [
      {
        taskId: 'v1',
        taskType: 'vocabulary',
        targetSkill: 'vocabulary',
        learningObjective: 'Contextual Use of Target Phrasal Verbs',
        prompt: 'Fill in the blank with the correct form of "Look forward to".\n"I really ____ the meeting next week."',
        supportSettings: { allowHints: true, allowReplay: false, maxRetries: 2 },
        difficultyTarget: 'B1',
        completionCondition: 'Correct answer provided or max retries hit',
        payload: { targetWord: 'look forward to', distractors: ['look for', 'look after'] }
      },
      {
        taskId: 'l1',
        taskType: 'listening',
        targetSkill: 'listening',
        learningObjective: 'Identify speaker intent',
        prompt: 'Listen to the audio. Why is the speaker calling?',
        supportSettings: { allowHints: false, allowReplay: true, allowSlowAudio: true, maxRetries: 1 },
        difficultyTarget: 'A2+',
        completionCondition: 'Identify the gist successfully',
        payload: { audioSrc: 'https://cdn.pixabay.com/audio/2022/10/25/audio_24911f32a6.mp3' }
      },
      {
        taskId: 's1',
        taskType: 'speaking',
        targetSkill: 'speaking',
        learningObjective: 'Roleplay a real-life scenario',
        prompt: 'You are at a coffee shop. Order a large cappuccino and ask if they have oat milk.',
        supportSettings: { allowHints: true, allowReplay: false, maxRetries: 3 },
        difficultyTarget: 'A2',
        completionCondition: 'Communicated meaning successfully'
      },
      {
        taskId: 'w1',
        taskType: 'writing',
        targetSkill: 'writing',
        learningObjective: 'Rewrite for formal tone',
        prompt: 'Rewrite this message to be appropriate for a professional email to your boss:\n"Hey, I\'m gonna be late today cuz my car broke down."',
        supportSettings: { allowHints: true, allowReplay: false, maxRetries: 3 },
        difficultyTarget: 'B1',
        completionCondition: 'Register matches professional workplace standard'
      }
    ];
  }

  /**
   * Deterministic evaluation of user responses using real text analysis.
   * Produces nuanced feedback based on task type and response quality.
   */
  public static evaluateResponse(task: SessionTask, response: any): { feedback: TaskFeedbackPayload; result?: TaskEvaluationResult } {
    // Extract text from response (handle different module shapes)
    const rawText: string =
      typeof response === 'string' ? response :
      response?.answer || response?.recognizedWord || '';

    const analysis = analyzeResponse(rawText);

    // ── Vocabulary task: check for correct answer ──
    if (task.taskType === 'vocabulary') {
      const target = task.payload?.targetWord?.toLowerCase() || '';
      const userAnswer = rawText.toLowerCase().trim();
      const isCorrect = userAnswer.includes(target) || target.includes(userAnswer);

      if (isCorrect) {
        return {
          feedback: {
            taskId: task.taskId,
            feedbackType: 'praise',
            primaryMessage: 'Correct! That\'s exactly the right word in this context.',
            canAdvance: true,
          },
          result: this.buildResult(task, 95, analysis, true),
        };
      } else {
        return {
          feedback: {
            taskId: task.taskId,
            feedbackType: 'hint',
            primaryMessage: `Not quite. The correct answer is "${task.payload?.targetWord}". Think about how phrasal verbs change form.`,
            suggestedRetryConstraint: `Use the phrase "${task.payload?.targetWord}" in the correct form.`,
            canAdvance: false,
          },
        };
      }
    }

    // ── Speaking / Writing / Listening: multi-signal evaluation ──
    const score = analysis.complexityScore;

    // Excellent response (score >= 65)
    if (score >= 65) {
      const praise = task.taskType === 'writing'
        ? 'Strong writing! Your sentence structure and word choice are well-developed.'
        : task.taskType === 'speaking'
          ? 'Great spoken response! You communicated your meaning clearly and naturally.'
          : 'Excellent comprehension! You captured the key points accurately.';

      return {
        feedback: {
          taskId: task.taskId,
          feedbackType: 'praise',
          primaryMessage: praise,
          canAdvance: true,
        },
        result: this.buildResult(task, score, analysis, true),
      };
    }

    // Good response (score >= 40)
    if (score >= 40) {
      const message = analysis.hasConnectors
        ? 'Good effort! You used connectors well. Try expanding your ideas for more detail.'
        : 'Decent attempt. Try using linking words like "however," "because," or "for example" to connect your ideas.';

      return {
        feedback: {
          taskId: task.taskId,
          feedbackType: 'correction',
          primaryMessage: message,
          suggestedRetryConstraint: 'Write at least 2 full sentences with a linking word.',
          canAdvance: true,
        },
        result: this.buildResult(task, score, analysis, true),
      };
    }

    // Weak response (score < 40)
    const hint = analysis.wordCount < 5
      ? 'Your response is very short. Try to write at least a full sentence with a subject, verb, and object.'
      : analysis.sentenceCount < 2
        ? 'Good start! Now try to add a second sentence to develop your answer further.'
        : 'Try to use more varied vocabulary and connect your sentences with words like "and," "but," or "because."';

    return {
      feedback: {
        taskId: task.taskId,
        feedbackType: 'hint',
        primaryMessage: hint,
        suggestedRetryConstraint: 'Write at least 2 complete sentences using a connector.',
        canAdvance: false,
      },
    };
  }

  /** Build a structured evaluation result from analysis data */
  private static buildResult(
    task: SessionTask,
    score: number,
    analysis: ReturnType<typeof analyzeResponse>,
    meaningSuccess: boolean
  ): TaskEvaluationResult {
    return {
      taskId: task.taskId,
      taskType: task.taskType,
      successScore: score,
      dimensions: {
        complexity: analysis.complexityScore,
        vocabulary: Math.round(analysis.uniqueWordRatio * 100),
        structure: Math.round(Math.min(analysis.avgWordsPerSentence / 12, 1.0) * 100),
        length: Math.min(analysis.wordCount * 3, 100),
      },
      hintUsage: 0,
      retryCount: 0,
      responseTimeMs: 3000,
      supportDependence: score >= 65 ? 'low' : score >= 40 ? 'medium' : 'high',
      meaningSuccess,
      naturalnessSuccess: score >= 50,
    };
  }
}
