import { SessionTask, TaskEvaluationResult, TaskFeedbackPayload } from '../types/runtime';
import { AssessmentSessionResult, SkillName } from '../types/assessment';
import { SemanticEvaluator } from './SemanticEvaluator';
import { ReviewExplanationBuilder } from '../engine/review/ReviewExplanationBuilder';
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

export class RuntimeService {
  /**
   * Returns structured session tasks based on the deterministic assessment result.
   * Now fetches dynamic tasks from the backend AI engine.
   */
  public static async generateSessionTasks(result: AssessmentSessionResult, skillFilter?: string): Promise<SessionTask[]> {
    if (!result || !result.overall) {
      console.warn('[RuntimeService] Attempted to generate tasks without a valid result object.');
      return [];
    }

    const taskCount = 5;
    const tasks: SessionTask[] = [];

    // Map skillFilter to backend expected types
    const typeMap: Record<string, string> = {
        'listening': 'AUDIO_CHOICE',
        'speaking': 'ORAL_PROMPT',
        'writing': 'OPEN_RESPONSE',
        'reading': 'TEXT_ANALYSIS'
    };

    const targetType = skillFilter ? typeMap[skillFilter] || 'SCRAMBLED_SENTENCE' : 'SCRAMBLED_SENTENCE';

    console.log(`[RuntimeService] 🧠 Requesting ${taskCount} dynamic tasks for: ${targetType}`);

    try {
        for (let i = 0; i < taskCount; i++) {
            const dynamicTask = await this.fetchDynamicTask(targetType);
            if (dynamicTask) {
                tasks.push(dynamicTask);
            }
        }
        
        if (tasks.length > 0) return tasks;
    } catch (err) {
        console.error('[RuntimeService] Failed to fetch dynamic tasks, using fallbacks:', err);
    }

    // Fallback to one static task if everything fails
    return [{
        taskId: `fallback_${Date.now()}`,
        taskType: 'writing',
        targetSkill: 'writing',
        learningObjective: 'Syntactic consistency',
        prompt: 'The system is temporarily using a fallback task. Please describe your professional background in two sentences.',
        supportSettings: { allowHints: true, allowReplay: false, maxRetries: 3 },
        difficultyTarget: result.overall.estimatedLevel,
        completionCondition: 'Two complete sentences'
    }];
  }

  /**
   * Calls the backend to generate a single dynamic task.
   */
  private static async fetchDynamicTask(type: string): Promise<SessionTask | null> {
    try {
        const response = await fetch('/api/v1/tasks/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
            },
            body: JSON.stringify({ type })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        // Map AI response to SessionTask interface
        const aiMetadata = data.task_metadata || {};
        const aiContent = data.content || {};

        // Ensure audioSrc is present if it's a listening task
        let audioSrc = aiContent.audio_url || aiContent.audioSrc;
        
        // 🔥 TTS Fallback: If it's a listening task and no audio URL provided, 
        // generate a TTS link from the stimulus text.
        if (aiMetadata.skill_category === 'LISTENING' && (!audioSrc || audioSrc === 'optional')) {
            const textToSpeak = aiContent.stimulus || aiContent.instruction || 'Please listen carefully.';
            audioSrc = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textToSpeak)}&tl=en&client=tw-ob`;
        }

        return {
            taskId: aiMetadata.id || `task_${Date.now()}`,
            taskType: this.mapAiTypeToFrontend(aiMetadata.type || type),
            targetSkill: aiMetadata.skill_category?.toLowerCase() || type.toLowerCase(),
            learningObjective: aiMetadata.objective || 'Linguistic Accuracy',
            prompt: aiContent.instruction || aiContent.stimulus || 'Complete the task',
            supportSettings: {
                allowHints: true,
                allowReplay: true,
                allowSlowAudio: true,
                maxRetries: 3
            },
            difficultyTarget: aiMetadata.difficulty_score > 0.7 ? 'Advanced' : 'Intermediate',
            completionCondition: 'Accurate completion of the task stimulus',
            payload: {
                ...aiContent,
                audioSrc
            }
        };
    } catch (err) {
        console.error('[RuntimeService] Fetch Task Error:', err);
        return null;
    }
  }

  private static mapAiTypeToFrontend(aiType: string): any {
      const type = aiType.toUpperCase();
      if (type.includes('AUDIO') || type.includes('LISTENING')) return 'listening';
      if (type.includes('ORAL') || type.includes('SPEAKING')) return 'speaking';
      if (type.includes('OPEN') || type.includes('WRITING')) return 'writing';
      return 'vocabulary'; // Default
  }

    /**
   * Deterministic evaluation of user responses using real text analysis.
   * Produces nuanced feedback based on task type and response quality.
   */
  public static async evaluateResponse(task: SessionTask, responsePayload: any): Promise<{ feedback: TaskFeedbackPayload; result?: TaskEvaluationResult }> {
    // Extract text from response (handle different module shapes)
    const rawText: string =
      typeof responsePayload === 'string' ? responsePayload :
      responsePayload?.answer || responsePayload?.recognizedWord || '';

    const responseMode = responsePayload?.responseMode || 'text'; // default
    const isSpeakingFallback = task.targetSkill === 'speaking' && responseMode === 'typed_fallback';

    const analysis = analyzeResponse(rawText);

    // ── Vocabulary task: check for correct answer ──
    if (task.taskType === 'vocabulary') {
      const target = task.payload?.targetWord?.toLowerCase() || '';
      const userAnswer = rawText.toLowerCase().trim();
      const isExactMatch = userAnswer.includes(target) || target.includes(userAnswer);

      // SBERT Semantic Check
      const similarity = await SemanticEvaluator.calculateSimilarity(userAnswer, target);
      const isSemanticMatch = similarity > 0.85;

      if (isExactMatch || isSemanticMatch) {
        // Did they get the meaning right but made a grammatical / typo error?
        const isGrammarError = !isExactMatch && isSemanticMatch;
        let primaryMessage = 'Correct! That\'s exactly the right word in this context.';
        
        if (isGrammarError) {
          primaryMessage = `Good job! You got the right meaning, but the exact word we were looking for is "${task.payload?.targetWord}".`;
        }

        return {
          feedback: {
            taskId: task.taskId,
            feedbackType: isGrammarError ? 'correction' : 'praise',
            primaryMessage,
            canAdvance: true,
          },
          result: this.buildResult(task, isGrammarError ? 85 : 95, analysis, true, responseMode, rawText),
        };
      } else if (similarity > 0.60) {
        // They are on the right track conceptually, but it's not the right word
        return {
          feedback: {
            taskId: task.taskId,
            feedbackType: 'hint',
            primaryMessage: `You're thinking in the right direction, but that's not the exact word. Think about how phrasal verbs change form.`,
            suggestedRetryConstraint: `Use the phrase "${task.payload?.targetWord}" in the correct form.`,
            canAdvance: false,
          },
        };
      } else {
        return {
          feedback: {
            taskId: task.taskId,
            feedbackType: 'hint',
            primaryMessage: `Not quite. The correct answer is "${task.payload?.targetWord}".`,
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
      let praise = task.taskType === 'writing'
        ? 'Strong writing! Your sentence structure and word choice are well-developed.'
        : task.taskType === 'speaking'
          ? 'Great spoken response! You communicated your meaning clearly and naturally.'
          : 'Excellent comprehension! You captured the key points accurately.';

      if (isSpeakingFallback) {
        praise = 'Good completion, but try to use your voice next time for a more complete assessment.';
      }

      return {
        feedback: {
          taskId: task.taskId,
          feedbackType: isSpeakingFallback ? 'correction' : 'praise',
          primaryMessage: praise,
          canAdvance: true,
        },
        result: this.buildResult(task, isSpeakingFallback ? Math.min(score, 60) : score, analysis, true, responseMode, rawText),
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
        result: this.buildResult(task, isSpeakingFallback ? Math.min(score, 50) : score, analysis, true, responseMode, rawText),
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
    meaningSuccess: boolean,
    responseMode?: string,
    rawText: string = ''
  ): TaskEvaluationResult {
    const result: TaskEvaluationResult = {
      taskId: task.taskId,
      taskType: task.taskType,
      successScore: score,
      responseMode: (responseMode as any) || 'text',
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
    
    result.reviewData = ReviewExplanationBuilder.build(task, result, rawText);
    return result;
  }
}
