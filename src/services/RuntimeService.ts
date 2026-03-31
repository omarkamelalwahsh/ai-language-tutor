import { SessionTask, TaskEvaluationResult, TaskFeedbackPayload } from '../types/runtime';
import { AssessmentSessionResult, SkillName } from '../types/assessment';

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

export class RuntimeService {
  /**
   * Returns structured session tasks based on the deterministic assessment result.
   */
  public static generateSessionTasks(result: AssessmentSessionResult): SessionTask[] {
    const overallLevel = result.overall.estimatedLevel;
    const confidence = result.overall.confidence;
    
    // 1. Identify Fragile Zones (Descriptors with low support/strength)
    const fragileDescriptors: { skill: SkillName; desc: any }[] = [];
    Object.entries(result.skills).forEach(([skillName, skillResult]) => {
      skillResult.descriptors
        .filter(d => d.strength < 0.7)
        .forEach(d => fragileDescriptors.push({ skill: skillName as SkillName, desc: d }));
    });

    // 2. Identify weakest skill for fallback
    const sortedSkills = Object.values(result.skills).sort((a, b) => a.confidence.score - b.confidence.score);
    const weakestSkill = sortedSkills[0].skill as SkillName;
    
    // Support level based on confidence: Low confidence = High support
    const supportLevel = confidence < 0.5 ? 'high' : confidence < 0.8 ? 'medium' : 'low';
    const taskCount = confidence < 0.6 ? 2 : 3;

    const tasks: SessionTask[] = [];

    // Prioritize fragile descriptors if any exist
    const targetZonse = fragileDescriptors.length > 0 ? fragileDescriptors : [{ skill: weakestSkill, desc: null }];

    for (let i = 0; i < taskCount; i++) {
      const zone = targetZonse[i % targetZonse.length];
      const focusSkill = zone.skill;
      const rationale = zone.desc 
        ? `Targeting identified gap: ${zone.desc.descriptorText}`
        : `Building consistency in your primary growth area: ${focusSkill}`;

      if (focusSkill === 'vocabulary' || focusSkill === 'reading') {
        tasks.push({
          taskId: `vocab_${Date.now()}_${i}`,
          taskType: 'vocabulary',
          targetSkill: 'vocabulary',
          learningObjective: 'Contextual Use of Target Words',
          prompt: 'Fill in the blank: "The new software update will ________ the performance of the system." (Options: improve, delay, abandon, compromise)',
          supportSettings: { allowHints: supportLevel !== 'low', allowReplay: false, maxRetries: supportLevel === 'high' ? 3 : 1 },
          difficultyTarget: overallLevel,
          completionCondition: 'Correct answer provided',
          reason: rationale,
          fragileDescriptorIds: zone.desc ? [zone.desc.descriptorId] : [],
          payload: { targetWord: 'improve', distractors: ['delay', 'abandon'] }
        });
      } else if (focusSkill === 'listening') {
        tasks.push({
          taskId: `listen_${Date.now()}_${i}`,
          taskType: 'listening',
          targetSkill: 'listening',
          learningObjective: 'Gist comprehension',
          prompt: 'Listen to the audio. What is the speaker primarily discussing?',
          supportSettings: { allowHints: supportLevel !== 'low', allowReplay: true, allowSlowAudio: supportLevel === 'high', maxRetries: 2 },
          difficultyTarget: overallLevel,
          completionCondition: 'Identify the gist successfully',
          reason: rationale,
          fragileDescriptorIds: zone.desc ? [zone.desc.descriptorId] : [],
          payload: { audioSrc: 'https://cdn.pixabay.com/audio/2022/10/25/audio_24911f32a6.mp3' }
        });
      } else if (focusSkill === 'writing' || focusSkill === 'grammar') {
        tasks.push({
          taskId: `write_${Date.now()}_${i}`,
          taskType: 'writing',
          targetSkill: 'writing',
          learningObjective: 'Sentence building and connector use',
          prompt: 'Write two sentences explaining why you prefer working from home or from an office. You MUST use at least one linking word (e.g., however, because, therefore).',
          supportSettings: { allowHints: true, allowReplay: false, maxRetries: 3 },
          difficultyTarget: overallLevel,
          completionCondition: 'Use of connector and complete sentence structure',
          reason: rationale,
          fragileDescriptorIds: zone.desc ? [zone.desc.descriptorId] : []
        });
      } else {
        tasks.push({
          taskId: `speak_${Date.now()}_${i}`,
          taskType: 'speaking',
          targetSkill: 'speaking',
          learningObjective: 'Fluency in routine scenarios',
          prompt: 'You need to reschedule your dentist appointment. Leave a short voice message explaining why you cannot make it.',
          supportSettings: { allowHints: supportLevel !== 'low', allowReplay: false, maxRetries: supportLevel === 'high' ? 3 : 2 },
          difficultyTarget: overallLevel,
          completionCondition: 'Clear communication of intent and reason',
          reason: rationale,
          fragileDescriptorIds: zone.desc ? [zone.desc.descriptorId] : []
        });
      }
    }

    return tasks;
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
