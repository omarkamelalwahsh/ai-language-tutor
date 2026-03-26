import { LearnerModelSnapshot, CEFRLevel, ErrorPattern, SkillDimension } from '../types/learner-model';

export class AssessmentAnalysisService {
  /**
   * Main Entry Point: Transforms raw evidence into a Learner Model
   */
  public static initializeLearnerModel(
    onboardingData: any,
    taskResults: any[]
  ): LearnerModelSnapshot {
    
    const { wordCount, avgComplexity, vocabRichness, connectorsUsed } = this.analyzeText(taskResults);
    
    const skillAnalysis = this.analyzeSkills(taskResults, wordCount, avgComplexity, vocabRichness, connectorsUsed);
    const errorAnalysis = this.analyzeErrors(taskResults, connectorsUsed);
    const pacingProfile = this.inferPacing(taskResults);
    const confidenceState = this.estimateConfidence(taskResults, avgComplexity);

    const overallLevel = this.calculateOverallLevel(skillAnalysis);

    return {
      version: "1.0.0",
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
      interpretation: this.generateInterpretation(overallLevel, skillAnalysis, errorAnalysis, connectorsUsed)
    };
  }

  private static analyzeText(taskResults: any[]) {
    const combinedText = taskResults.map(t => t.answer || '').join(' ').toLowerCase();
    
    // length
    const words = combinedText.split(/\s+/).filter(w => w.replace(/[^a-z]/g, '').length > 0);
    const wordCount = words.length;
    
    // Sentence complexity
    const sentences = combinedText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgComplexity = sentences.length > 0 ? wordCount / sentences.length : 0;

    // Vocab richness
    const complexWords = words.filter(w => w.length > 6);
    const uniqueComplexWords = new Set(complexWords);
    const vocabRichness = wordCount > 0 ? uniqueComplexWords.size / wordCount : 0;

    // Connectors
    const connectorList = ['because', 'however', 'although', 'instead of', 'therefore', 'moreover', 'furthermore', 'thus', 'while', 'whereas', 'but', 'and', 'so'];
    const connectorsUsed = connectorList.filter(c => combinedText.includes(c));

    return { wordCount, avgComplexity, vocabRichness, connectorsUsed };
  }

  private static analyzeSkills(taskResults: any[], wc: number, comp: number, vocab: number, conn: string[]): LearnerModelSnapshot['skills'] {
    // 0-100 normalized scores based on deterministic factors

    // Speaking: heavily weighting length / volume of production
    let speakingScore = Math.min(100, (wc / 60) * 100); 
    if (speakingScore < 10) speakingScore = 15;
    
    // Writing: complexity and connectors
    let writingScore = Math.min(100, (comp / 15) * 40 + (conn.length / 5) * 60);
    if (writingScore < 10) writingScore = 15;
    
    // Vocabulary: unique long words ratio
    let vocabScore = Math.min(100, vocab * 800); 
    if (vocabScore < 10) vocabScore = 15;

    // Listening: proxy based on general completeness
    let listeningScore = Math.min(100, (speakingScore + writingScore) / 2 + 5);

    return {
      speaking: { level: this.scoreToLevel(speakingScore), score: Math.round(speakingScore), confidence: 0.9 },
      writing: { level: this.scoreToLevel(writingScore), score: Math.round(writingScore), confidence: 0.9 },
      listening: { level: this.scoreToLevel(listeningScore), score: Math.round(listeningScore), confidence: 0.6 },
      vocabulary: { level: this.scoreToLevel(vocabScore), score: Math.round(vocabScore), confidence: 0.85 }
    };
  }

  private static scoreToLevel(score: number): CEFRLevel {
    if (score < 25) return 'A1';
    if (score < 40) return 'A2';
    if (score < 55) return 'A2+';
    if (score < 70) return 'B1';
    if (score < 85) return 'B1+';
    if (score < 95) return 'B2';
    return 'C1';
  }

  private static analyzeErrors(taskResults: any[], conn: string[]): ErrorPattern[] {
    const errors: ErrorPattern[] = [];
    if (conn.length < 2) {
      errors.push({
        type: 'Simple Sentence Dependency',
        evidenceStrength: 0.9,
        severity: 'medium',
        affectedSkills: ['writing', 'speaking'],
        remediationPriority: 1
      });
    }
    if (errors.length === 0) {
      errors.push({
        type: 'Nuanced Register Control',
        evidenceStrength: 0.4,
        severity: 'low',
        affectedSkills: ['speaking'],
        remediationPriority: 2
      });
    }
    return errors;
  }

  private static inferPacing(taskResults: any[]) {
    // Average response time
    const totalTime = taskResults.reduce((acc, t) => acc + (t.responseTime || 0), 0);
    const avgLatencyMs = taskResults.length > 0 ? totalTime / taskResults.length : 2500;
    
    let profile: 'slow' | 'moderate' | 'fast' | 'support-sensitive' | 'fragile' = 'moderate';
    if (avgLatencyMs < 8000) profile = 'fast';
    else if (avgLatencyMs > 30000) profile = 'slow';

    return {
      profile,
      avgLatencyMs,
      hesitationIndex: Math.min(1, avgLatencyMs / 60000)
    };
  }

  private static estimateConfidence(taskResults: any[], complexity: number) {
    let state: 'fragile' | 'steady' | 'resilient' | 'stable-beginner' = 'steady';
    if (complexity > 10) state = 'resilient';
    else if (complexity < 6) state = 'fragile';

    return {
      state,
      selfCorrectionRate: 0.2
    };
  }

  private static calculateOverallLevel(skills: any): CEFRLevel {
    const scores = [skills.speaking.score, skills.writing.score, skills.listening.score, skills.vocabulary.score];
    const avg = scores.reduce((a,b)=>a+b, 0) / 4;
    return this.scoreToLevel(avg);
  }

  private static generateInterpretation(level: CEFRLevel, skills: any, errors: any[], connectors: string[]) {
    const caps = [];
    const zones = [];

    if (skills.speaking.score > 55) {
      caps.push('Clear professional self-introduction');
    } else {
      caps.push('Able to convey basic ideas directly');
      zones.push('Expanding detail and length in spoken responses');
    }

    if (skills.writing.score > 55) {
      caps.push('Strong structured written responses');
    } else {
      zones.push('Using more advanced connectors (however, although)');
    }

    if (connectors.length >= 2) {
      caps.push(`Effective use of transition words: ${connectors.slice(0,3).join(', ')}`);
    }

    if (zones.length === 0) {
      zones.push('Nuanced word choice in high-pressure scenarios');
      zones.push('Refining past-tense stability during spontaneous speech');
    }

    return {
      currentCapacities: caps,
      growthZones: zones,
      recommendedPathId: "path-personalized"
    };
  }
}
