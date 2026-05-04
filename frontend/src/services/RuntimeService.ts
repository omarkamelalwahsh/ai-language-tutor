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
  /**
   * Returns structured session tasks based on the deterministic assessment result.
   * Now fetches a BATCH of dynamic tasks from the backend AI engine.
   */
  public static async generateSessionTasks(result: AssessmentSessionResult, skillFilter?: string): Promise<SessionTask[]> {
    if (!result || !result.overall) {
      console.warn('[RuntimeService] Attempted to generate tasks without a valid result object.');
      return [];
    }

    try {
        const endpoint = skillFilter ? '/api/v1/tasks/skill-practice' : '/api/v1/tasks/daily-mix';
        const body = skillFilter ? { skill: skillFilter, count: 5 } : {};

        console.log(`[RuntimeService] 🧠 Requesting BATCH tasks via: ${endpoint}`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
            },
            body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        if (data.tasks && Array.isArray(data.tasks)) {
            return data.tasks.map((t: any) => this.mapAiTaskToFrontend(t));
        }
    } catch (err) {
        console.error('[RuntimeService] Failed to fetch batch dynamic tasks, using fallbacks:', err);
    }

    // Fallback if everything fails
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
   * Maps a raw AI task payload to the frontend SessionTask interface.
   */
  private static mapAiTaskToFrontend(data: any): SessionTask {
    const aiMetadata = data.task_metadata || {};
    const aiContent = data.content || {};

    // Ensure audioSrc is present if it's a listening task
    let audioSrc = aiContent.audio_url || aiContent.audioSrc;
    
    if (aiMetadata.skill_category === 'LISTENING' && (!audioSrc || audioSrc === 'optional')) {
        const textToSpeak = aiContent.stimulus || aiContent.instruction || 'Please listen carefully.';
        audioSrc = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textToSpeak)}&tl=en&client=tw-ob`;
    }

    return {
        taskId: aiMetadata.id || `task_${Date.now()}`,
        taskType: this.mapAiTypeToFrontend(aiMetadata.type || 'OPEN_RESPONSE'),
        targetSkill: (aiMetadata.skill_category || aiMetadata.skill || 'general').toLowerCase(),
        learningObjective: aiMetadata.objective || 'Linguistic Accuracy',
        prompt: aiContent.instruction || 'Complete the task stimulus.',
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
    const rawText: string = typeof responsePayload === 'string' ? responsePayload : responsePayload?.answer || responsePayload?.recognizedWord || '';
    const responseMode = responsePayload?.responseMode || 'text';
    const analysis = analyzeResponse(rawText);

    try {
        const response = await fetch('/api/v1/tasks/evaluate-task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
            },
            body: JSON.stringify({
                task_metadata: {
                    type: task.taskType,
                    skill: task.targetSkill,
                    difficulty_score: 0.5
                },
                content: {
                    task_prompt: task.prompt,
                    target_response: task.payload?.target_response || task.payload?.answer_key?.correct_option || '',
                    stimulus: task.payload?.stimulus || '',
                    explanation: task.payload?.explanation || ''
                },
                user_response: rawText
            })
        });

        if (response.ok) {
            const aiResult = await response.json();
            
            const feedback: TaskFeedbackPayload = {
                taskId: task.taskId,
                feedbackType: aiResult.score >= 0.7 ? 'praise' : 'correction',
                primaryMessage: aiResult.reasoning_summary || 'Analysis complete.',
                suggestedRetryConstraint: aiResult.metrics?.grammar_score < 0.6 ? 'Focus on grammar structure.' : undefined,
                canAdvance: aiResult.score >= 0.6
            };

            const result: TaskEvaluationResult = {
                taskId: task.taskId,
                taskType: task.taskType,
                successScore: Math.round(aiResult.score * 100),
                responseMode: (responseMode as any),
                dimensions: {
                    complexity: Math.round((aiResult.metrics?.vocabulary_complexity || 0) * 100),
                    vocabulary: Math.round((aiResult.metrics?.vocabulary_complexity || 0) * 100),
                    structure: Math.round((aiResult.metrics?.grammar_score || 0) * 100),
                    length: Math.min(rawText.split(' ').length * 5, 100)
                },
                hintUsage: 0,
                retryCount: 0,
                responseTimeMs: 2000,
                supportDependence: aiResult.score >= 0.8 ? 'low' : aiResult.score >= 0.5 ? 'medium' : 'high',
                meaningSuccess: aiResult.score >= 0.5,
                naturalnessSuccess: (aiResult.metrics?.fluency_score || 0) >= 0.7,
                reviewData: {
                    taskId: task.taskId,
                    skill: task.targetSkill,
                    prompt: task.prompt,
                    userAnswer: rawText,
                    correctAnswer: aiResult.model_suggestion || task.payload?.target_response,
                    result: aiResult.score >= 0.8 ? 'correct' : aiResult.score >= 0.5 ? 'partial' : 'incorrect',
                    questionLevel: 'B1',
                    answerLevel: aiResult.detected_level || 'B1',
                    explanation: {
                        whyCorrect: aiResult.score >= 0.8 ? aiResult.reasoning_summary : undefined,
                        whatWentWrong: aiResult.score < 0.8 ? aiResult.error_analysis?.detected_errors?.join(', ') : undefined,
                        levelNote: `Detected CEFR: ${aiResult.detected_level}. ${aiResult.reasoning_summary}`,
                        improvementTip: aiResult.model_suggestion ? `Try this: ${aiResult.model_suggestion}` : undefined
                    }
                }
            };

            return { feedback, result };
        }
    } catch (err) {
        console.error('[RuntimeService] AI Evaluation failed, using local heuristic:', err);
    }

    // ── LOCAL FALLBACK ──
    const score = analysis.complexityScore;
    const isSuccess = score >= 40;

    return {
      feedback: {
        taskId: task.taskId,
        feedbackType: score >= 65 ? 'praise' : 'correction',
        primaryMessage: score >= 65 ? 'Excellent!' : 'Good effort, but try to be more descriptive.',
        canAdvance: isSuccess,
      },
      result: this.buildResult(task, score, analysis, isSuccess, responseMode, rawText),
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
