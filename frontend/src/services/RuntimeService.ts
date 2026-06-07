import { SessionTask, TaskEvaluationResult, TaskFeedbackPayload } from '../types/runtime';
import { AssessmentSessionResult, SkillName } from '../types/assessment';
import { SemanticEvaluator } from './SemanticEvaluator';
import { ReviewExplanationBuilder } from '../engine/review/ReviewExplanationBuilder';
import { resolveApiBase } from '../lib/apiBase';
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
  public static async generateSessionTasks(result: AssessmentSessionResult, skillFilter?: string, taskType?: string): Promise<SessionTask[]> {
    if (!result || !result.overall) {
      console.warn('[RuntimeService] Attempted to generate tasks without a valid result object.');
      return [];
    }

    const BACKEND_URL = resolveApiBase((import.meta as any).env?.VITE_API_URL).replace(/\/$/, '');

    try {
        const endpoint = skillFilter
            ? `${BACKEND_URL}/api/v1/tasks/skill-practice`
            : `${BACKEND_URL}/api/v1/tasks/daily-mix`;
        const body: any = skillFilter ? { skill: skillFilter, count: 5 } : {};
        if (taskType) body.task_type = taskType;

        console.log(`[RuntimeService] 🧠 Requesting BATCH tasks via: ${endpoint} with type: ${taskType}`);

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

    // ── SMART SKILL-AWARE FALLBACK ──
    const activeSkill = (skillFilter || result.overall?.weakestSkill || 'writing').toLowerCase();
    const activeLevel = result.overall?.estimatedLevel || 'B1';

    // Skill-specific fallback task schemas
    const SKILL_FALLBACKS: Record<string, { taskType: any; prompt: string; stimulus: string; target: string; completion: string }> = {
      speaking: {
        taskType: 'speaking',
        prompt: `Record yourself introducing your technical role and one key challenge you solved recently. Target: ${activeLevel} fluency.`,
        stimulus: 'Speak naturally for 30–60 seconds. Focus on clarity and professional vocabulary.',
        target: 'A clear, structured spoken introduction with professional vocabulary.',
        completion: 'Minimum 3 coherent sentences spoken clearly.',
      },
      listening: {
        taskType: 'listening',
        prompt: 'Listen to the passage and answer: What is the main idea being communicated?',
        stimulus: 'A software engineer explains a deployment failure and how the team resolved it under pressure.',
        target: 'Identifying the core problem and the resolution strategy.',
        completion: 'One accurate sentence capturing the main idea.',
      },
      reading: {
        taskType: 'writing',
        prompt: `Read the excerpt and summarize it in your own words. Keep it at ${activeLevel} register.`,
        stimulus: 'The microservices architecture splits a monolithic application into independent, deployable services that communicate via APIs.',
        target: 'A concise paraphrase identifying the key concept.',
        completion: 'One or two complete sentences.',
      },
      grammar: {
        taskType: 'writing',
        prompt: 'Correct the grammatical errors in the sentence below and explain what was wrong.',
        stimulus: 'The team have been work on this feature since three months and still not finished yet.',
        target: 'The team has been working on this feature for three months and has still not finished.',
        completion: 'Corrected sentence with a brief explanation.',
      },
      vocabulary: {
        taskType: 'vocabulary',
        prompt: `Use the word 'deployment' correctly in a professional sentence that reflects a ${activeLevel} level of English.`,
        stimulus: 'Context: A software engineer describing their release process.',
        target: 'A grammatically correct sentence using "deployment" in a professional context.',
        completion: 'One complete, contextually appropriate sentence.',
      },
      writing: {
        taskType: 'writing',
        prompt: `Write two sentences describing your professional background and your main area of expertise. Target register: ${activeLevel}.`,
        stimulus: 'Focus on clarity and professional vocabulary.',
        target: 'I am a software engineer with experience in cloud architecture. I specialize in designing scalable microservices.',
        completion: 'Two complete, professional sentences.',
      },
    };

    const fallback = SKILL_FALLBACKS[activeSkill] ?? SKILL_FALLBACKS['writing'];

    return [{
        taskId: `fallback_${Date.now()}`,
        taskType: fallback.taskType,
        targetSkill: activeSkill,
        learningObjective: `${activeSkill.charAt(0).toUpperCase() + activeSkill.slice(1)} practice at ${activeLevel}`,
        prompt: fallback.prompt,
        supportSettings: { allowHints: true, allowReplay: true, allowSlowAudio: true, maxRetries: 3 },
        difficultyTarget: activeLevel,
        completionCondition: fallback.completion,
        payload: {
            stimulus: fallback.stimulus,
            instruction: fallback.prompt,
            target_response: fallback.target,
        }
    }];
  }

  /**
   * Maps a raw AI task payload to the frontend SessionTask interface.
   */
  private static mapAiTaskToFrontend(data: any): SessionTask {
    const aiMetadata = data.task_metadata || {};
    const aiContent = data.content || {};

    const targetSkill = (aiMetadata.skill_category || aiMetadata.skill || 'general').toLowerCase();
    let audioSrc = aiContent.audioSrc || '';

    // Favor local browser TTS over unreliable external Google URLs
    if (targetSkill === 'listening' && (!audioSrc || audioSrc === 'optional' || audioSrc === 'null')) {
        audioSrc = ''; // Let the frontend component handle TTS via stimulus/transcript
    }

    return {
        taskId: aiMetadata.id || `task_${Date.now()}`,
        taskType: this.mapAiTypeToFrontend(aiMetadata.type || 'OPEN_RESPONSE'),
        targetSkill: targetSkill,
        learningObjective: aiMetadata.objective || 'Linguistic Accuracy',
        prompt: aiContent.instruction || 'Complete the task stimulus.',
        supportSettings: {
            allowHints: true,
            allowReplay: true,
            allowSlowAudio: true,
            maxRetries: 3
        },
        // 🎯 UI Feedback Fix: Use the real-time difficulty (CEFR level) from AI
        difficultyTarget: aiMetadata.level || (aiMetadata.difficulty_score > 0.7 ? 'Advanced' : 'Intermediate'),
        completionCondition: 'Accurate completion of the task stimulus',
        payload: {
            ...aiContent,
            targetWord: aiContent.target_response || aiContent.targetWord,
            distractors: aiContent.distractors || (aiContent.options ? aiContent.options.filter((o: any) => o !== aiContent.target_response) : []),
            audioSrc
        },
        metadata: aiMetadata
    };
  }

  private static mapAiTypeToFrontend(aiType: string): any {
      const type = aiType.toUpperCase();
      if (type.includes('VISUAL')) return 'visual_vocabulary';
      if (type.includes('AUDIO') || type.includes('LISTENING')) return 'listening';
      if (type.includes('ORAL') || type.includes('SPEAKING')) return 'speaking';
      if (type.includes('OPEN') || type.includes('WRITING') || type.includes('READING')) return 'writing';
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

    const BACKEND_URL = resolveApiBase((import.meta as any).env?.VITE_API_URL).replace(/\/$/, '');
    try {
        const response = await fetch(`${BACKEND_URL}/api/v1/tasks/evaluate-task`, {
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
                user_response: rawText,
                session_id: (window as any).__ACTIVE_SESSION_ID__ || null,
                task_id: task.taskId
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
                syncState: aiResult.sync_state?.state_object, // 🚀 Real-time State Object
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
                        improvementTip: aiResult.model_suggestion || aiResult.error_analysis?.corrected_version 
                            ? `Try this: ${aiResult.model_suggestion || aiResult.error_analysis?.corrected_version}` 
                            : undefined
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
