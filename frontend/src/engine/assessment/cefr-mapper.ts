// ============================================================================
// CEFR Mapper & Explainability Logic
// ============================================================================
// Maps normalized scores and raw features to CEFR bands (A1-C1).
// Supports Complexity Override for Semantic Proficiency Analysis.
// ============================================================================

import { CEFRLevel } from '../domain/types';
import { ExtractedFeatures, EvalTaskType } from './types';

export class CEFRMapper {

  /** Maps a weighted 0-100 score to a CEFR band. B2 ceiling removed for Semantic Proficiency Analyzer. */
  public static mapScoreToBand(score: number): CEFRLevel {
    if (score < 40) return 'A1';
    if (score < 65) return 'A2';
    if (score < 85) return 'B1';
    if (score < 95) return 'B2';
    return 'C1';
  }

  /**
   * Complexity Override: If deterministic features show unambiguous C1+ signals,
   * override the score-based mapping. Requires 2+ open-ended evidence signals
   * (enforced by the caller, not here).
   */
  public static complexityOverride(
    f: ExtractedFeatures,
    scoreBand: CEFRLevel
  ): CEFRLevel {
    // Gate: Only promote if rare tokens AND deep nesting both present
    if (f.rareTokenRatio > 0.08 && f.nestedClauseDepth >= 3) {
      return 'C1'; // Bypass B-level entirely per spec
    }
    // Secondary gate: strong lexical density + syntactic complexity + rare tokens
    if (f.rareTokenRatio > 0.05 && f.lexicalDensity > 0.7 && f.syntacticComplexity > 0.6) {
      // Promote by one band if not already at C1
      if (scoreBand === 'B1') return 'B2';
      if (scoreBand === 'B2') return 'C1';
    }
    return scoreBand;
  }

  /** Calculates a confidence 0.0-1.0 based on response robustness. */
  public static calculateConfidence(f: ExtractedFeatures): number {
    if (f.wordCount < 5) return 0.2; // Too short to be sure
    if (f.wordCount < 15) return 0.5;
    
    // Low integrity implies random key-mashing or unintelligible structure
    if (f.grammarIntegrity < 0.2 || f.spellingIntegrity < 0.2) return 0.4;
    
    // Repetition usually indicates tricking the system
    if (f.repetitionRatio > 0.3) return 0.3;
    
    // If it's a solid, >15 word response with normal features
    return 0.85; 
  }

  /**
   * Generates the "bandLabel" 
   * (e.g., "likely A2", "A2/B1 emerging").
   */
  public static generateBandLabel(band: CEFRLevel, score: number, conf: number): string {
    const isEmerging = (band === 'A1' && score > 35) || 
                       (band === 'A2' && score > 60) || 
                       (band === 'B1' && score > 80);

    if (conf <= 0.4) return `uncertain ${band}`;
    
    if (isEmerging) {
      if (band === 'A1') return `A1/A2 emerging`;
      if (band === 'A2') return `A2/B1 emerging`;
      if (band === 'B1') return `B1/B2 emerging`;
    }

    return `likely ${band}`;
  }

  /** Detects readable strengths based on raw features. */
  public static extractStrengths(f: ExtractedFeatures, task: EvalTaskType): string[] {
    const strengths: string[] = [];
    
    if (f.wordCount > 40) strengths.push('Good length and detail for this task level.');
    if (f.uniqueWordRatio > 0.65 && f.wordCount > 20) strengths.push('Strong vocabulary range without excessive repetition.');
    if (f.connectorCount > 1 || f.advancedConnectorCount > 0) strengths.push('Uses linking words to connect ideas effectively.');
    if (f.grammarIntegrity > 0.8) strengths.push('Good control over basic sentence structure and verb forms.');
    
    // Advanced Semantic Proficiency strengths
    if (f.lexicalDensity > 0.6) strengths.push('Uses sophisticated or professional vocabulary with high lexical density.');
    if (f.syntacticComplexity > 0.6) strengths.push('Demonstrates advanced syntactic maturity (clauses or passive voice).');
    if (f.rareTokenRatio > 0.05) strengths.push('Employs low-frequency, precise vocabulary typical of C1+ proficiency.');
    if (f.nestedClauseDepth >= 3) strengths.push('Manages complex multi-level subordination with clarity.');
    if (f.contentWordRatio > 0.65 && f.wordCount > 15) strengths.push('High content-word density indicates domain authority and precision.');
    if (f.gerundPhraseCount >= 2) strengths.push('Effective use of gerund constructions for syntactic variety.');
    
    if (task === 'opinion_essay' && f.argumentMarkerCount > 0) strengths.push('Clear indicators of argumentation and opinion-giving.');
    if (task === 'picture_description' && f.descriptiveMarkerCount > 0) strengths.push('Effective use of spatial and descriptive language.');
    if (task === 'past_narrative' && f.narrativeMarkerCount > 0) strengths.push('Good logical flow using time and narrative markers.');
    
    return strengths.slice(0, 4);
  }

  /** Detects readable weaknesses based on raw features. */
  public static extractWeaknesses(f: ExtractedFeatures, task: EvalTaskType): string[] {
    const weaknesses: string[] = [];
    
    if (f.wordCount < 8) weaknesses.push('Response is too short to show full capability.');
    if (f.connectorCount === 0 && f.sentenceCount > 2) weaknesses.push('Sentences are disconnected. Try using words like "because" or "but".');
    if (f.repetitionRatio > 0.15) weaknesses.push('Relies on repeating the same words; try expanding vocabulary.');
    if (f.grammarIntegrity < 0.6) weaknesses.push('Frequent grammatical errors disrupt the flow.');
    if (f.spellingIntegrity < 0.7) weaknesses.push('Spelling mistakes make parts of the response hard to follow.');
    
    if (task === 'opinion_essay' && f.argumentMarkerCount === 0 && f.wordCount > 20) weaknesses.push('Lacks clear phrases stating your opinion (e.g. "I believe").');
    
    return weaknesses.slice(0, 3);
  }
}
