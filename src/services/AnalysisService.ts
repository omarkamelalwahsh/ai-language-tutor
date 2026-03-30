import { LearnerModelSnapshot, CEFRLevel, ErrorPattern } from '../types/learner-model';
import { TaskResult } from '../types/app';

/**
 * Transforms raw evidence from adaptive assessment tasks into a realistic Learner Model snapshot.
 * Highly deterministic evaluation logic to simulate backend processing.
 */
export class AssessmentAnalysisService {

  public static initializeLearnerModel(
    onboardingData: any,
    taskResults: TaskResult[]
  ): LearnerModelSnapshot {
    
    const analysisResults = this.analyzeResponses(taskResults);
    const skillAnalysis = this.calculateSkills(analysisResults);
    const overallLevel = this.calculateOverallLevel(skillAnalysis);
    
    const errorAnalysis = this.extractErrors(analysisResults);
    const confidenceState = this.determineConfidence(analysisResults);
    const pacingProfile = this.determinePacing(analysisResults);

    return {
      version: "1.2.0",
      timestamp: new Date().toISOString(),
      overallLevel,
      hasStartedLearning: false,
      skills: skillAnalysis,
      errors: errorAnalysis,
      retention: {
        initialReviewQueue: errorAnalysis.map(e => e.type),
        itemStrengthDefault: 0.5
      },
      pacing: pacingProfile,
      confidence: confidenceState,
      interpretation: this.generateInterpretation(overallLevel, skillAnalysis, analysisResults)
    };
  }

  // ---- 1. Signal Extraction ---- //

  private static analyzeResponses(taskResults: any[]) {
    // Group signals by skill category
    const signalsBySkill: Record<string, any[]> = {};
    
    taskResults.forEach(t => {
      const skill = t.metadata?.skill || t.targetSkill || 'general';
      if (!signalsBySkill[skill]) signalsBySkill[skill] = [];
      signalsBySkill[skill].push(t);
    });

    const productionText = taskResults
      .filter(t => ['speaking', 'writing', 'speaking_proxy'].includes(t.metadata?.skill || t.taskType))
      .map(t => t.answer || '')
      .join(' ').toLowerCase();

    // 1. Length & Complexity
    const words = productionText.split(/\s+/).filter(w => w.replace(/[^a-z]/g, '').length > 0);
    const wordCount = words.length;
    const sentences = productionText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceComplexity = sentences.length > 0 ? wordCount / sentences.length : 0;

    // 2. Grammar Indicators
    const pastTenseMarkers = ['ed', 'was', 'were', 'had', 'did', 'went', 'saw', 'said'];
    const pastTenseScore = pastTenseMarkers.reduce((acc, marker) => acc + (productionText.match(new RegExp(`\\b${marker}\\b|\\w+ed\\b`, 'g'))?.length || 0), 0);
    
    const connectorList = ['because', 'however', 'although', 'therefore', 'moreover', 'furthermore', 'thus', 'while', 'whereas', 'but', 'and', 'so'];
    const connectorsUsed = connectorList.filter(c => productionText.includes(c));

    // 3. Vocab Richness
    const uniqueWords = new Set(words);
    const vocabRichness = wordCount > 0 ? uniqueWords.size / wordCount : 0;

    // 4. Adaptive Difficulty Signals
    // We calculate a "Cap Score" for each skill based on the highest level question passed
    const getSkillCap = (skillName: string) => {
      const skillTasks = signalsBySkill[skillName] || [];
      if (skillTasks.length === 0) return 0;
      
      const correctTasks = skillTasks.filter(t => t.metadata?.isCorrect);
      if (correctTasks.length === 0) return 10; // Baseline

      const levels = { 'A1': 20, 'A2': 40, 'B1': 60, 'B2': 80, 'C1': 95 };
      const maxDifficulty = correctTasks.reduce((max, t) => {
        const val = (levels as any)[t.metadata?.difficulty] || 0;
        return val > max ? val : max;
      }, 0);
      
      return maxDifficulty;
    };

    const caps = {
      grammar: getSkillCap('grammar'),
      vocabulary: getSkillCap('vocabulary'),
      reading: getSkillCap('reading'),
      listening: getSkillCap('listening_proxy'),
      writing: getSkillCap('writing')
    };

    // Capture timing 
    const isEmpty = wordCount < 3 && taskResults.length < 5;
    const avgLatencyMs = taskResults.length > 0 
      ? taskResults.reduce((acc, t) => acc + (t.responseTime || 0), 0) / taskResults.length 
      : 3000;

    return {
      wordCount,
      sentenceComplexity,
      pastTenseScore,
      connectorsUsed,
      vocabRichness,
      caps,
      isEmpty,
      avgLatencyMs,
      allTasks: taskResults
    };
  }

  // ---- 2. Scoring & CEFR Mapping ---- //

  private static calculateSkills(metrics: any) {
    // Base score is derived from the "Adaptive Cap" reached
    // Then modulated by production quality (writing/speaking)
    
    // Writing: Cap + grammar multiplier
    let writingBase = Math.max(metrics.caps.writing, metrics.caps.grammar * 0.8);
    let writingMod = (metrics.connectorsUsed.length * 5) + (metrics.sentenceComplexity * 2);
    let writingScore = Math.min(100, Math.max(10, writingBase + writingMod));

    // Speaking: Cap + volume multiplier
    let speakingBase = metrics.caps.grammar * 0.9;
    let speakingMod = (metrics.wordCount / 20) * 10 + (metrics.pastTenseScore * 5);
    let speakingScore = Math.min(100, Math.max(10, speakingBase + speakingMod));

    // Listening
    let listeningScore = Math.min(100, Math.max(10, metrics.caps.listening));
    
    // Vocab: Cap + uniqueness multiplier
    let vocabScore = Math.min(100, Math.max(10, metrics.caps.vocabulary + (metrics.vocabRichness * 30)));

    return {
      speaking: { level: this.mapToCEFR(speakingScore), score: Math.round(speakingScore), confidence: 0.8 },
      writing: { level: this.mapToCEFR(writingScore), score: Math.round(writingScore), confidence: 0.9 },
      listening: { level: this.mapToCEFR(listeningScore), score: Math.round(listeningScore), confidence: 0.6 },
      vocabulary: { level: this.mapToCEFR(vocabScore), score: Math.round(vocabScore), confidence: 0.85 }
    };
  }

  private static mapToCEFR(score: number): CEFRLevel {
    if (score < 15) return 'Pre-A1';
    if (score < 25) return 'A1';
    if (score < 35) return 'A1+';
    if (score < 45) return 'A2';
    if (score < 55) return 'A2+';
    if (score < 65) return 'B1';
    if (score < 75) return 'B1+';
    if (score < 85) return 'B2';
    if (score < 92) return 'B2+';
    if (score < 97) return 'C1';
    return 'C2';
  }

  private static calculateOverallLevel(skills: any): CEFRLevel {
    const scores = [skills.speaking.score, skills.writing.score, skills.listening.score, skills.vocabulary.score];
    const avg = scores.reduce((a,b)=>a+b, 0) / 4;
    return this.mapToCEFR(avg);
  }

  // ---- 3. Meta-Signals (Behavioral & Error) ---- //

  private static extractErrors(metrics: any): ErrorPattern[] {
    const errors: ErrorPattern[] = [];
    const incorrectTasks = metrics.allTasks.filter((t: any) => t.metadata?.isCorrect === false);
    
    if (incorrectTasks.some((t:any) => t.metadata?.skill === 'grammar')) {
      errors.push({ type: 'Grammatical Inconsistency', evidenceStrength: 0.7, severity: 'medium', affectedSkills: ['writing', 'speaking'], remediationPriority: 1 });
    }

    if (metrics.connectorsUsed.length === 0 && metrics.wordCount > 15) {
      errors.push({ type: 'Limited Cohesion', evidenceStrength: 0.9, severity: 'high', affectedSkills: ['writing'], remediationPriority: 2 });
    }
    
    if (metrics.vocabRichness < 0.3 && metrics.wordCount > 20) {
      errors.push({ type: 'Lexical Repetition', evidenceStrength: 0.75, severity: 'low', affectedSkills: ['writing', 'vocabulary'], remediationPriority: 3 });
    }

    return errors;
  }

  private static determineConfidence(metrics: any): any {
    if (metrics.isEmpty) return { state: 'fragile', selfCorrectionRate: 0.0 };
    if (metrics.wordCount > 40 && metrics.sentenceComplexity > 8) return { state: 'resilient', selfCorrectionRate: 0.6 };
    if (metrics.wordCount > 15) return { state: 'steady', selfCorrectionRate: 0.3 };
    return { state: 'stable-beginner', selfCorrectionRate: 0.1 };
  }

  private static determinePacing(metrics: any): any {
    const { avgLatencyMs } = metrics;
    let profile: 'slow' | 'moderate' | 'fast' | 'support-sensitive' | 'fragile' = 'moderate';
    
    if (avgLatencyMs > 25000 || metrics.isEmpty) profile = 'slow';
    else if (avgLatencyMs < 6000) profile = 'fast';

    return {
      profile,
      avgLatencyMs,
      hesitationIndex: Math.min(1, avgLatencyMs / 45000)
    };
  }

  private static generateInterpretation(level: CEFRLevel, skills: any, metrics: any) {
    const caps = [];
    const zones = [];

    const avgScore = (skills.speaking.score + skills.writing.score + skills.listening.score + skills.vocabulary.score) / 4;

    if (avgScore > 60) caps.push('Strong grasp of intermediate structures');
    else caps.push('Functional command of basic range');

    if (metrics.connectorsUsed.length > 2) caps.push('Effective use of linking devices');
    else zones.push('Strengthening logical markers in production');

    if (metrics.caps.vocabulary >= 60) caps.push('Competent in varied semantic fields');
    else zones.push('Expanding vocabulary precision');

    return {
      currentCapacities: caps,
      growthZones: zones,
      recommendedPathId: `path-${level.toLowerCase().replace('+', '-plus')}`
    };
  }
}

