// ============================================================================
// Feature Extractor
// ============================================================================
// Parses text deterministically to extract reliable linguistic signals.
// Avoids LLM-based fuzziness.
// ============================================================================

import { ExtractedFeatures, PromptContext } from './types';

// Lexicons for marker detection
const BASIC_CONNECTORS = new Set(['and', 'but', 'so', 'because', 'or', 'then', 'also']);
const ADVANCED_CONNECTORS = new Set(['however', 'although', 'therefore', 'moreover', 'furthermore', 'nevertheless', 'consequently', 'meanwhile', 'despite', 'whereas']);
const ARGUMENT_MARKERS = new Set(['in my opinion', 'i believe', 'i think', 'advantage', 'disadvantage', 'on the other hand', 'overall', 'for example', 'for instance', 'firstly', 'secondly', 'in conclusion']);
const NARRATIVE_MARKERS = new Set(['at first', 'after that', 'suddenly', 'in the end', 'finally', 'next', 'later', 'eventually']);
const DESCRIPTIVE_MARKERS = new Set(['in the picture', 'on the left', 'on the right', 'behind', 'in front of', 'next to', 'there is', 'there are', 'looks like']);

export class FeatureExtractor {
  
  /**
   * Main entry point to transform text into numeric features.
   */
  public static extract(text: string, context?: PromptContext): ExtractedFeatures {
    const rawText = text.trim();
    if (!rawText) return this.emptyFeatures();

    const paragraphs = rawText.split(/\n+/).filter(p => p.trim().length > 0);
    const sentences = rawText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = rawText.toLowerCase().split(/[\s,()"]+/).filter(w => w.length > 0);
    
    // Clean words for accurate unique counting
    const cleanWords = words.map(w => w.replace(/[^a-z0-9'-]/g, '')).filter(w => w.length > 0);
    
    if (cleanWords.length === 0) return this.emptyFeatures();

    // 1. Core Metrics
    const wordCount = cleanWords.length;
    const sentenceCount = Math.max(sentences.length, 1);
    const averageSentenceLength = wordCount / sentenceCount;
    
    const uniqueSubset = new Set(cleanWords);
    const uniqueWordRatio = uniqueSubset.size / wordCount;

    // 2. Discourse Markers
    const loweredText = rawText.toLowerCase();
    
    let basicCount = 0;
    for (const w of cleanWords) if (BASIC_CONNECTORS.has(w)) basicCount++;
    
    let advCount = 0;
    for (const marker of ADVANCED_CONNECTORS) if (cleanWords.includes(marker)) advCount++;

    let argCount = 0;
    for (const marker of ARGUMENT_MARKERS) if (loweredText.includes(marker)) argCount++;

    let narrCount = 0;
    for (const marker of NARRATIVE_MARKERS) if (loweredText.includes(marker)) narrCount++;

    let descCount = 0;
    for (const marker of DESCRIPTIVE_MARKERS) if (loweredText.includes(marker)) descCount++;

    // 3. Complexity & Repetition
    // Find consecutive or identical words in close proximity as a proxy for bad repetition
    let repScore = 0;
    for (let i = 0; i < cleanWords.length - 2; i++) {
        if (cleanWords[i] === cleanWords[i+1]) repScore += 1; // Stutter/Typo
        if (cleanWords[i] === cleanWords[i+2]) repScore += 0.5; // Highly repetitive
    }
    // E.g., repeating 5 times in 50 words = 5 / 50 = 0.1 ratio
    const repetitionRatio = Math.min(1.0, repScore / wordCount);

    // 4. Heuristic Integrity (Simple approximations)
    const spellingIntegrity = this.approximateSpellingIntegrity(cleanWords);
    const grammarIntegrity = this.approximateGrammarIntegrity(loweredText);

    // 5. Context specific
    let targetKeywordHitRatio = undefined;
    if (context?.targetKeywords && context.targetKeywords.length > 0) {
      const targets = context.targetKeywords.map(k => k.toLowerCase());
      let hits = 0;
      for (const t of targets) {
        if (loweredText.includes(t)) hits++;
      }
      targetKeywordHitRatio = hits / targets.length;
    }

    return {
      wordCount,
      sentenceCount,
      averageSentenceLength,
      uniqueWordRatio,
      connectorCount: basicCount,
      advancedConnectorCount: advCount,
      argumentMarkerCount: argCount,
      narrativeMarkerCount: narrCount,
      descriptiveMarkerCount: descCount,
      paragraphCount: paragraphs.length,
      repetitionRatio,
      grammarIntegrity,
      spellingIntegrity,
      targetKeywordHitRatio
    };
  }

  private static emptyFeatures(): ExtractedFeatures {
    return {
      wordCount: 0, sentenceCount: 0, averageSentenceLength: 0, uniqueWordRatio: 0,
      connectorCount: 0, advancedConnectorCount: 0, argumentMarkerCount: 0,
      narrativeMarkerCount: 0, descriptiveMarkerCount: 0,
      paragraphCount: 0, repetitionRatio: 0,
      grammarIntegrity: 0, spellingIntegrity: 0
    };
  }

  /**
   * Deterministic logic to proxy spelling accuracy.
   * Based on length rules and basic invalid sequences.
   */
  private static approximateSpellingIntegrity(words: string[]): number {
    if (words.length === 0) return 0;
    let errors = 0;
    
    // Very basic heuristics for invalid spelling patterns in English
    const invalidPatterns = [/^[bcdfghjklmnpqrstvwxz]{4,}/, /[aeiou]{3,}/, /q[^u\s]/];
    
    for (const w of words) {
        if (w.length > 15 && !w.includes('-')) errors++; // likely run-on or smash
        if (invalidPatterns.some(p => p.test(w))) errors++;
    }
    
    const penaltyRatio = Math.min(1.0, errors / words.length);
    return 1.0 - penaltyRatio;
  }

  /**
   * Deterministic logic to proxy grammatical accuracy.
   */
  private static approximateGrammarIntegrity(text: string): number {
      let errors = 0;
      const count = (text.match(/[\s(]a [aeiou]/g) || []).length; // "a apple"
      const count2 = (text.match(/[\s(]an [^aeiou]/g) || []).length; // "an car"
      const svErrors = (text.match(/\b(he|she|it)\s+(go|do|have|make|take)\b/g) || []).length; // "he go" instead of "goes"
      const doubleNeg = (text.match(/\b(don't|doesn't|didn't)\s+(no|nothing|none|never)\b/g) || []).length;
      const toIng = (text.match(/\bto\s+[a-z]+ing\b/g) || []).length; // "to going" 
      
      errors = count + count2 + svErrors + doubleNeg + toIng;
      const lengthProxy = Math.max(1, text.split(' ').length / 10); // per 10 words
      const errorRate = Math.min(1.0, errors / lengthProxy * 0.4); // 40% penalty per error per 10 words.
      
      return 1.0 - errorRate;
  }
}
