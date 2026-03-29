// ============================================================================
// Core Scoring & Strategy Engine
// ============================================================================
// Takes extracted features, applies a task-specific rubric, 
// and produces normalized 0-100 dimensional scores.
// ============================================================================

import { ExtractedFeatures, EvalTaskType } from './types';

/** Represents a dimensional score out of 100 with a weight toward the total. */
export interface ScoredDimension {
  score: number;
  weight: number; 
}

/** 
 * Computes 0-100 scores for dimensions based on features.
 * Adheres to the user's constraints: realistically capping B2 for MVP.
 */
export class DimensionScorer {

  public static scoreTask(task: EvalTaskType, features: ExtractedFeatures): Record<string, ScoredDimension> {
    switch (task) {
      case 'self_introduction':
      case 'personal_routine':
        return this.scoreBasicWriting(features);
      case 'opinion_essay':
        return this.scoreOpinionEssay(features);
      case 'picture_description':
        return this.scorePictureDescription(features);
      case 'past_narrative':
        return this.scoreNarrative(features);
      case 'listening_summary':
        return this.scoreListeningSummary(features);
      default:
        return this.scoreBasicWriting(features);
    }
  }

  // --------------------------------------------------------------------------
  // Task-Specific Score Mappers 
  // All output dimensions must be 0-100 scale.
  // --------------------------------------------------------------------------

  private static scoreBasicWriting(f: ExtractedFeatures): Record<string, ScoredDimension> {
    const completion = Math.min(100, (f.wordCount / 20) * 100);
    
    // Grammar requires complexity to score high
    const complexityCap = Math.min(100, (f.averageSentenceLength / 10) * 100);
    const grammar = f.grammarIntegrity * complexityCap;
    
    // Vocab relies on the actual count of unique words, not just the ratio
    const uniqueWordCount = f.wordCount * f.uniqueWordRatio;
    const vocab = Math.min(100, uniqueWordCount * 4); // 25 unique words to score 100
    
    // Mechanics: if too short, can't score 100
    const mechanicsCap = Math.min(100, (f.wordCount / 15) * 100);
    const mechanics = f.spellingIntegrity * mechanicsCap;

    return {
      'Task Completion': { score: completion, weight: 0.3 },
      'Grammar Control': { score: grammar, weight: 0.3 },
      'Vocabulary Range': { score: vocab, weight: 0.2 },
      'Mechanics': { score: mechanics, weight: 0.2 },
    };
  }

  private static scoreOpinionEssay(f: ExtractedFeatures): Record<string, ScoredDimension> {
    const completion = Math.min(100, (f.wordCount / 60) * 100);
    
    // Coherence demands basic/advanced connectors and paragraphing
    const coherenceRaw = (f.connectorCount * 10) + (f.advancedConnectorCount * 25) + (f.paragraphCount > 1 ? 20 : 0);
    const coherence = Math.min(100, coherenceRaw) * (Math.min(100, f.wordCount / 40) / 100); // Penalty if short
    
    // Argumentation demands specific markers ("I believe", "however")
    const argumentRaw = (f.argumentMarkerCount * 30);
    const argumentation = Math.min(100, argumentRaw);

    const grammar = f.grammarIntegrity * Math.min(100, (f.averageSentenceLength / 12) * 100);
    const complexity = Math.min(100, (f.averageSentenceLength / 15) * 100);

    return {
      'Task Completion': { score: completion, weight: 0.2 },
      'Coherence & Organization': { score: coherence, weight: 0.25 },
      'Argumentation': { score: argumentation, weight: 0.25 },
      'Grammar Control': { score: grammar, weight: 0.15 },
      'Sentence Complexity': { score: complexity, weight: 0.15 },
    };
  }

  private static scorePictureDescription(f: ExtractedFeatures): Record<string, ScoredDimension> {
    const completion = Math.min(100, (f.wordCount / 40) * 100);
    const spatialLangRaw = (f.descriptiveMarkerCount * 25);
    const spatialLang = Math.min(100, spatialLangRaw);
    
    // Coverage of observable details (if targetKeywordHitRatio is present)
    const detailCoverage = f.targetKeywordHitRatio !== undefined 
      ? f.targetKeywordHitRatio * 100 
      : Math.min(100, (f.wordCount / 30) * 100); 

    const uniqueWordCount = f.wordCount * f.uniqueWordRatio;
    const vocab = Math.min(100, uniqueWordCount * 3); // 33 unique words to score 100

    return {
      'Task Completion': { score: completion, weight: 0.2 },
      'Spatial Language': { score: spatialLang, weight: 0.3 },
      'Detail Coverage': { score: detailCoverage, weight: 0.3 },
      'Vocabulary Range': { score: vocab, weight: 0.2 },
    };
  }

  private static scoreNarrative(f: ExtractedFeatures): Record<string, ScoredDimension> {
    const completion = Math.min(100, (f.wordCount / 50) * 100);
    const narrativeFlowCap = Math.min(100, (f.wordCount / 30) * 100);
    const narrativeFlow = Math.min(100, (f.narrativeMarkerCount * 25) + (f.connectorCount * 10)) * (narrativeFlowCap / 100);
    const grammar = f.grammarIntegrity * Math.min(100, (f.averageSentenceLength / 10) * 100);

    return {
      'Task Completion': { score: completion, weight: 0.3 },
      'Narrative Flow': { score: narrativeFlow, weight: 0.3 },
      'Grammar Control': { score: grammar, weight: 0.4 }, 
    };
  }

  private static scoreListeningSummary(f: ExtractedFeatures): Record<string, ScoredDimension> {
    const mainIdeaRaw = f.targetKeywordHitRatio !== undefined ? f.targetKeywordHitRatio * 100 : 50;
    const efficiency = f.wordCount > 15 ? 100 : (f.wordCount / 15) * 100;
    const lengthCap = Math.min(100, (f.wordCount / 10) * 100);
    const clarity = (f.grammarIntegrity * 50 + f.spellingIntegrity * 50) * (lengthCap / 100);

    return {
      'Main Idea Accuracy': { score: mainIdeaRaw, weight: 0.5 }, 
      'Response Relevance': { score: efficiency, weight: 0.2 },
      'Clarity': { score: clarity, weight: 0.3 },
    };
  }

  /** Normalizes the object structure into the final flat Record + Weighted total */
  public static calculateComposite(scoredDims: Record<string, ScoredDimension>): { 
    dimensions: Record<string, number>, 
    total: number 
  } {
    const dimensions: Record<string, number> = {};
    let total = 0;
    
    for (const [key, sd] of Object.entries(scoredDims)) {
      dimensions[key] = Math.round(sd.score);
      total += sd.score * sd.weight;
    }
    
    return { dimensions, total: Math.round(total) };
  }
}
