// ============================================================================
// Core Scoring & Strategy Engine
// ============================================================================
// Takes extracted features, applies a task-specific rubric, 
// and produces normalized 0-100 dimensional scores.
// ============================================================================

import { ExtractedFeatures, EvalTaskType } from './types';

/**
 * Computes a complexity promotion bonus based on advanced semantic signals.
 * Returns 0-15 bonus points when rare tokens, lexical density, and syntactic depth
 * all indicate C1+ proficiency.
 */
function complexityPromotionBonus(f: ExtractedFeatures): number {
  const hasRareTokens = f.rareTokenRatio > 0.05;
  const hasHighDensity = f.lexicalDensity > 0.7;
  const hasHighComplexity = f.syntacticComplexity > 0.6;
  const hasDeepNesting = f.nestedClauseDepth >= 2;
  const hasHighContentRatio = f.contentWordRatio > 0.6;

  let bonus = 0;
  if (hasRareTokens && hasHighDensity && hasHighComplexity) bonus += 10;
  if (hasDeepNesting) bonus += 3;
  if (hasHighContentRatio && hasRareTokens) bonus += 2;
  return Math.min(15, bonus);
}

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
    // Added Syntactic Complexity bonus (up to +30 points to the base integrity score)
    const grammarBase = f.grammarIntegrity * 70;
    const complexityBonus = f.syntacticComplexity * 30;
    const grammar = Math.min(100, (grammarBase + complexityBonus) * Math.min(1.0, f.averageSentenceLength / 8));
    
    // Vocab relies on Lexical Density and unique word count
    const uniqueWordCount = f.wordCount * f.uniqueWordRatio;
    const vocabBase = Math.min(100, uniqueWordCount * 3); 
    const densityBonus = f.lexicalDensity * 40;
    const vocab = Math.min(100, (vocabBase * 0.6) + densityBonus); 
    
    // Mechanics: if too short, can't score 100
    const mechanicsCap = Math.min(100, (f.wordCount / 15) * 100);
    const mechanics = f.spellingIntegrity * mechanicsCap;

    // Advanced: Complexity Promotion Bonus
    const promotion = complexityPromotionBonus(f);

    return {
      'Task Completion': { score: completion, weight: 0.25 },
      'Grammar Control': { score: Math.min(100, grammar + promotion * 0.5), weight: 0.35 },
      'Vocabulary Range': { score: Math.min(100, vocab + promotion), weight: 0.25 },
      'Mechanics': { score: mechanics, weight: 0.15 },
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

    const grammarBase = f.grammarIntegrity * 60;
    const complexityBonus = f.syntacticComplexity * 40;
    const grammar = Math.min(100, grammarBase + complexityBonus);

    // Sentence Complexity is a dedicated dimension here
    const complexity = Math.min(100, (f.syntacticComplexity * 70) + (f.averageSentenceLength / 20 * 30));

    // Advanced: Complexity Promotion Bonus
    const promotion = complexityPromotionBonus(f);

    return {
      'Task Completion': { score: completion, weight: 0.2 },
      'Coherence & Organization': { score: coherence, weight: 0.2 },
      'Argumentation': { score: argumentation, weight: 0.2 },
      'Grammar Control': { score: Math.min(100, grammar + promotion * 0.5), weight: 0.2 },
      'Sentence Complexity': { score: Math.min(100, complexity + promotion), weight: 0.2 },
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
