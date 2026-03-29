// ============================================================================
// CEFR Mapper & Explainability Logic
// ============================================================================
// Maps normalized scores and raw features to MVP CEFR bands (A1-B2)
// Generates human-readable feedback.
// ============================================================================

import { CEFRLevel } from '../domain/types';
import { ExtractedFeatures, EvalTaskType } from './types';

// The maximum level we assign in MVP to avoid fake precision.
const MVP_CEFR_CEILING: CEFRLevel = 'B2';

export class CEFRMapper {

  /** Maps a weighted 0-100 score to a CEFR band. */
  public static mapScoreToBand(score: number): CEFRLevel {
    if (score < 40) return 'A1';
    if (score < 65) return 'A2';
    if (score < 85) return 'B1';
    // Any score 85+ gets the MVP ceiling
    return MVP_CEFR_CEILING; 
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
    
    if (task === 'opinion_essay' && f.argumentMarkerCount > 0) strengths.push('Clear indicators of argumentation and opinion-giving.');
    if (task === 'picture_description' && f.descriptiveMarkerCount > 0) strengths.push('Effective use of spatial and descriptive language.');
    if (task === 'past_narrative' && f.narrativeMarkerCount > 0) strengths.push('Good logical flow using time and narrative markers.');
    
    return strengths.slice(0, 3);
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
