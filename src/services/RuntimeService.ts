import { SessionTask, TaskEvaluationResult, TaskFeedbackPayload } from '../types/runtime';

/**
 * Orchestrates the lifecycle of learning tasks and generates feedback states.
 */
export class RuntimeService {
  /**
   * Mocks returning a generated session of tasks. In production, this pulls from
   * the LearnerModel, identifying what needs review, focus, or challenge.
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
        payload: { audioSrc: 'https://cdn.pixabay.com/audio/2022/10/25/audio_24911f32a6.mp3' } // Placeholder ambient voice
      },
      {
        taskId: 's1',
        taskType: 'speaking',
        targetSkill: 'speaking',
        learningObjective: 'Roleplay a real-life scenario',
        prompt: 'You are at a coffee shop. Order a large cappuccino and ask if they have oak milk.',
        supportSettings: { allowHints: true, allowReplay: false, maxRetries: 3 },
        difficultyTarget: 'A2',
        completionCondition: 'Communicated meaning successfully'
      },
      {
        taskId: 'w1',
        taskType: 'writing',
        targetSkill: 'writing',
        learningObjective: 'Rewrite for formal tone',
        prompt: 'Rewrite this message to be appropriate for a professional email to your boss:\n"Hey, I’m gonna be late today cuz my car broke down."',
        supportSettings: { allowHints: true, allowReplay: false, maxRetries: 3 },
        difficultyTarget: 'B1',
        completionCondition: 'Register matches professional workplace standard'
      }
    ];
  }

  /**
   * Mocks evaluation logic that responds to user input
   */
  public static evaluateResponse(task: SessionTask, response: any): { feedback: TaskFeedbackPayload, result?: TaskEvaluationResult } {
    // Depending on the task type, we provide different feedback styles.
    const isCorrectOrAcceptable = response.trim().length > 5; // extremely basic heuristic
    
    if (isCorrectOrAcceptable) {
      return {
        feedback: {
          taskId: task.taskId,
          feedbackType: 'praise',
          primaryMessage: 'Excellent job! You conveyed the meaning perfectly.',
          canAdvance: true
        },
        result: {
          taskId: task.taskId,
          taskType: task.taskType,
          successScore: 90,
          dimensions: { main: 90 },
          hintUsage: 0,
          retryCount: 0,
          responseTimeMs: 3000,
          supportDependence: 'low',
          meaningSuccess: true,
          naturalnessSuccess: true
        }
      };
    } else {
      return {
        feedback: {
          taskId: task.taskId,
          feedbackType: 'hint',
          primaryMessage: 'Not quite. Think about how to structure your sentence more fully.',
          suggestedRetryConstraint: 'Try using a complete sentence.',
          canAdvance: false
        }
      };
    }
  }
}
