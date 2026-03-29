import { LearnerModelSnapshot, CEFRLevel, ErrorPattern, SkillDimension } from '../types/learner-model';

/**
 * Transforms raw evidence from assessment tasks into a realistic Learner Model snapshot.
 * Highly deterministic evaluation logic to simulate backend processing.
 */
export class AssessmentAnalysisService {

  public static initializeLearnerModel(
    onboardingData: any,
    taskResults: any[]
  ): LearnerModelSnapshot {
    
    const analysisResults = this.analyzeResponses(taskResults);
    const skillAnalysis = this.calculateSkills(analysisResults);
    const overallLevel = this.calculateOverallLevel(skillAnalysis);
    
    const errorAnalysis = this.extractErrors(analysisResults);
    const confidenceState = this.determineConfidence(analysisResults);
    const pacingProfile = this.determinePacing(analysisResults);

    return {
      version: "1.1.0",
      timestamp: new Date().toISOString(),
      overallLevel,
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
    // Collect specific task types
    const speakingTasks = taskResults.filter(t => t.taskType === 'speaking');
    const writingTasks = taskResults.filter(t => t.taskType === 'writing' || t.taskType === 'vocabulary_in_context' && t.taskId === '3');
    const listeningTasks = taskResults.filter(t => t.taskType === 'listening_comprehension');
    const vocabTasks = taskResults.filter(t => t.taskType === 'visual_description' || t.taskType === 'vocabulary_in_context');

    const speakingText = speakingTasks.map(t => t.answer || '').join(' ').toLowerCase();
    const writingText = writingTasks.map(t => t.answer || '').join(' ').toLowerCase();
    const productionText = speakingText + ' ' + writingText;

    // 1. Length & Complexity
    const words = productionText.split(/\s+/).filter(w => w.replace(/[^a-z]/g, '').length > 0);
    const wordCount = words.length;
    const sentences = productionText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceComplexity = sentences.length > 0 ? wordCount / sentences.length : 0; // simple < 8 < compound

    // 2. Grammar Indicators
    const pastTenseMarkers = ['ed', 'was', 'were', 'had', 'did', 'went', 'saw', 'said'];
    const pastTenseScore = pastTenseMarkers.reduce((acc, marker) => acc + (productionText.match(new RegExp(`\\b${marker}\\b|\\w+ed\\b`, 'g'))?.length || 0), 0);
    
    const connectorList = ['because', 'however', 'although', 'therefore', 'moreover', 'furthermore', 'thus', 'while', 'whereas', 'but', 'and', 'so'];
    const connectorsUsed = connectorList.filter(c => productionText.includes(c));

    // 3. Vocab Richness
    const uniqueWords = new Set(words);
    const vocabRichness = wordCount > 0 ? uniqueWords.size / wordCount : 0;
    
    // 4. Listening specific (Keyword match for task 5)
    let listeningScoreRaw = 0;
    if (listeningTasks.length > 0) {
      const summary = (listeningTasks[0].answer || '').toLowerCase();
      // Target: "late to a meeting" or "30 minutes late"
      if (summary.includes('late') && (summary.includes('30') || summary.includes('thirty') || summary.includes('half hour'))) {
        listeningScoreRaw = 100;
      } else if (summary.includes('late')) {
        listeningScoreRaw = 60;
      } else if (summary.length > 5) {
        listeningScoreRaw = 30; // caught gist but missed reason
      }
    }

    // 5. Vocab specific (Keyword match for task 6 / visual)
    let vocabCorrectnessScore = 0;
    let vocabContextScore = 0;
    
    const t6 = vocabTasks.find(t => t.taskId === '6');
    if (t6) {
      const ans = (t6.answer || '').toLowerCase();
      if (ans.includes('continue')) vocabCorrectnessScore += 50;
      if (ans.split(/\s+/).length > 5) vocabContextScore += 50; // Provided an explanation
    }
    const t2 = vocabTasks.find(t => t.taskId === '2');
    if (t2) {
      const ans = (t2.answer || '').toLowerCase();
      if (ans.includes('coffee') || ans.includes('cafe') || ans.includes('drink')) vocabCorrectnessScore += 50;
    }

    // Capture timing 
    const isEmpty = wordCount < 3;
    const avgLatencyMs = taskResults.length > 0 
      ? taskResults.reduce((acc, t) => acc + (t.responseTime || 0), 0) / taskResults.length 
      : 3000;

    return {
      wordCount,
      sentenceComplexity,
      pastTenseScore,
      connectorsUsed,
      vocabRichness,
      listeningScoreRaw,
      vocabCorrectnessScore,
      vocabContextScore,
      isEmpty,
      avgLatencyMs
    };
  }

  // ---- 2. Scoring & CEFR Mapping ---- //

  private static calculateSkills(metrics: any) {
    // Prevent 0s to avoid broken UX, minimum is 10
    
    // Writing logic: length + connectors + complexity
    let writingRaw = (metrics.wordCount / 50) * 30 + (metrics.connectorsUsed.length / 4) * 40 + (metrics.sentenceComplexity / 15) * 30;
    let writingScore = Math.min(100, Math.max(10, writingRaw));

    // Speaking logic: volume + past tense usage (basic grammar control)
    let speakingRaw = (metrics.wordCount / 40) * 50 + (metrics.pastTenseScore / 3) * 50;
    let speakingScore = Math.min(100, Math.max(10, speakingRaw));

    // Listening logic
    let listeningScore = Math.min(100, Math.max(10, metrics.listeningScoreRaw));
    if (metrics.listeningScoreRaw === 0) listeningScore = (speakingScore + writingScore) / 2; // fallback if skipped

    // Vocab logic
    let vocabScore = Math.min(100, Math.max(10, metrics.vocabCorrectnessScore + metrics.vocabContextScore * 0.5 + (metrics.vocabRichness * 50)));

    // Cap C1/C2 bounds (require strong evidence)
    if (metrics.wordCount < 15) { writingScore = Math.min(45, writingScore); speakingScore = Math.min(45, speakingScore); }
    if (metrics.connectorsUsed.length < 2) { writingScore = Math.min(75, writingScore); }
    
    return {
      speaking: { level: this.mapToCEFR(speakingScore), score: Math.round(speakingScore), confidence: 0.8 },
      writing: { level: this.mapToCEFR(writingScore), score: Math.round(writingScore), confidence: 0.9 },
      listening: { level: this.mapToCEFR(listeningScore), score: Math.round(listeningScore), confidence: 0.6 },
      vocabulary: { level: this.mapToCEFR(vocabScore), score: Math.round(vocabScore), confidence: 0.85 }
    };
  }

  private static mapToCEFR(score: number): CEFRLevel {
    // Mapping rules requested:
    // very short/broken (< 30) -> A1-A2
    // simple but correct (30-60) -> B1
    // structured + connectors (60-85) -> B2
    // complex + precise (85-95) -> C1
    // near-native (> 95) -> C2 (only if strong evidence)

    if (score < 20) return 'A1';
    if (score < 40) return 'A2';
    if (score < 60) return 'B1';
    if (score < 80) return 'B2';
    if (score < 95) return 'C1';
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
    
    if (metrics.connectorsUsed.length === 0 && metrics.wordCount > 10) {
      errors.push({ type: 'Sentence Connector Absence', evidenceStrength: 0.9, severity: 'high', affectedSkills: ['writing', 'speaking'], remediationPriority: 1 });
    }
    
    if (metrics.pastTenseScore === 0 && metrics.wordCount > 15) {
      errors.push({ type: 'Past Tense Consistency', evidenceStrength: 0.8, severity: 'medium', affectedSkills: ['speaking'], remediationPriority: 2 });
    }

    if (metrics.vocabRichness < 0.3 && metrics.wordCount > 20) {
      errors.push({ type: 'Vocabulary Repetition', evidenceStrength: 0.75, severity: 'low', affectedSkills: ['writing', 'vocabulary'], remediationPriority: 3 });
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

    if (skills.speaking.score >= 60) caps.push('Can produce extended spoken responses');
    else caps.push('Can produce basic isolated phrases');

    if (metrics.connectorsUsed.length > 0) caps.push(`Uses transition markers like '${metrics.connectorsUsed[0]}'`);
    else zones.push('Integrating linking words to connect ideas');

    if (metrics.vocabCorrectnessScore >= 50) caps.push('Grasps contextual vocabulary meanings');
    else zones.push('Improving precision of word choice in context');

    return {
      currentCapacities: caps,
      growthZones: zones,
      recommendedPathId: `path-${level.toLowerCase()}`
    };
  }
}
