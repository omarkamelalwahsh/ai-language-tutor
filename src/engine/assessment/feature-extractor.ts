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
const PROFESSIONAL_DOMAIN_WORDS = new Set(['objective', 'notification', 'implementation', 'deployment', 'pipeline', 'significant', 'strategic', 'infrastructure', 'scalability', 'efficiency', 'utilization', 'comprehensive', 'facilitate', 'collaborate', 'optimization']);
const RELATIVE_PRONOUNS = new Set(['which', 'who', 'whom', 'whose', 'that']);
const SUBORDINATING_CONJUNCTIONS = new Set(['although', 'whereas', 'provided', 'unless', 'whether', 'since', 'as', 'whenever', 'wherever']);

// C1/C2-level rare/low-frequency tokens for Lexical Rarefaction detection
const RARE_TOKENS = new Set([
  'mitigate', 'orchestration', 'propagation', 'albeit', 'notwithstanding', 'predicate',
  'juxtapose', 'delineate', 'ameliorate', 'exacerbate', 'ubiquitous', 'paradigm',
  'dichotomy', 'synthesize', 'extrapolate', 'interpolate', 'circumvent', 'elucidate',
  'corroborate', 'substantiate', 'proliferate', 'precipitate', 'concomitant', 'precipitous',
  'antithetical', 'salient', 'nascent', 'ephemeral', 'pervasive', 'systemic',
  'ramification', 'conflagration', 'acquiesce', 'recalcitrant', 'surreptitious', 'taciturn',
  'impervious', 'commensurate', 'contingent', 'extraneous', 'superfluous', 'tantamount',
  'unequivocal', 'efficacy', 'pragmatic', 'heuristic', 'deterministic', 'idempotent',
  'obfuscate', 'concatenate', 'instantiate', 'enumerate'
]);

// Function words (closed-class) for content-word ratio calculation
const FUNCTION_WORDS = new Set([
  'the', 'a', 'an', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should',
  'may', 'might', 'can', 'could', 'must', 'to', 'of', 'in', 'for', 'on', 'with',
  'at', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'under', 'over', 'not', 'no', 'nor', 'or', 'and',
  'but', 'if', 'then', 'else', 'when', 'while', 'where', 'how', 'what', 'which',
  'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'mine', 'we',
  'us', 'our', 'ours', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her',
  'hers', 'it', 'its', 'they', 'them', 'their', 'theirs', 'so', 'as', 'than'
]);

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

    // 5. Advanced Linguistic Metrics
    // Lexical Density: Ratio of long words (>7 chars) and domain-specific words
    const longWords = cleanWords.filter(w => w.length > 7);
    const domainWords = cleanWords.filter(w => PROFESSIONAL_DOMAIN_WORDS.has(w));
    const lexicalDensity = Math.min(1.0, (longWords.length * 1.5 + domainWords.length * 2.5) / Math.max(1, wordCount) * 4);

    // Syntactic Complexity: Proxy for clauses and passive/advanced construction
    const relativeCount = cleanWords.filter(w => RELATIVE_PRONOUNS.has(w)).length;
    const subCount = cleanWords.filter(w => SUBORDINATING_CONJUNCTIONS.has(w)).length;
    
    // Passive voice proxy: (am|is|are|was|were|been|being) + (verb ending in ed/en)
    const passiveMatches = (loweredText.match(/\b(am|is|are|was|were|been|being)\b\s+\b[a-z]+(ed|en)\b/g) || []).length;
    
    // Normalize syntactic complexity (0.0 to 1.0)
    // 3 complex markers in 20 words = 1.0 peak for MVP
    const complexityRaw = (relativeCount * 0.3) + (subCount * 0.3) + (passiveMatches * 0.5) + (advCount * 0.2);
    const syntacticComplexity = Math.min(1.0, complexityRaw / Math.max(1, sentenceCount) * 1.5);

    // 6. Rare Token Detection (Lexical Rarefaction)
    const rareTokens = cleanWords.filter(w => RARE_TOKENS.has(w));
    const rareTokenRatio = rareTokens.length / Math.max(1, wordCount);

    // 7. Nested Clause Depth
    // Count maximum nesting of subordination markers
    const nestedClauseDepth = this.computeNestedClauseDepth(loweredText);

    // 8. Gerund Phrase Detection
    const gerundMatches = (loweredText.match(/\b[a-z]+ing\b\s+(?:the|a|an|my|his|her|their|its|our|your)\b/g) || []);
    const gerundPhraseCount = gerundMatches.length;

    // 9. Content vs Function Word Ratio
    const functionWordCount = cleanWords.filter(w => FUNCTION_WORDS.has(w)).length;
    const contentWordRatio = 1 - (functionWordCount / Math.max(1, wordCount));

    // 10. Context specific
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
      lexicalDensity,
      syntacticComplexity,
      rareTokenRatio,
      nestedClauseDepth,
      gerundPhraseCount,
      contentWordRatio,
      targetKeywordHitRatio
    };
  }

  /**
   * Computes maximum nesting depth of subordinate clauses.
   * Looks for stacked subordination patterns (e.g., "which ... that ... because").
   */
  private static computeNestedClauseDepth(text: string): number {
    const clauseMarkers = [
      'which', 'who', 'whom', 'whose', 'that', 'where', 'when',
      'although', 'whereas', 'because', 'since', 'while', 'unless',
      'provided', 'whether', 'if', 'after', 'before', 'until'
    ];
    
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let maxDepth = 0;
    
    for (const sentence of sentences) {
      const words = sentence.toLowerCase().split(/\s+/);
      let depth = 0;
      let currentMax = 0;
      
      for (const word of words) {
        if (clauseMarkers.includes(word)) {
          depth++;
          currentMax = Math.max(currentMax, depth);
        }
      }
      
      maxDepth = Math.max(maxDepth, currentMax);
    }
    
    return maxDepth;
  }

  private static emptyFeatures(): ExtractedFeatures {
    return {
      wordCount: 0, sentenceCount: 0, averageSentenceLength: 0, uniqueWordRatio: 0,
      connectorCount: 0, advancedConnectorCount: 0, argumentMarkerCount: 0,
      narrativeMarkerCount: 0, descriptiveMarkerCount: 0,
      paragraphCount: 0, repetitionRatio: 0,
      grammarIntegrity: 0, spellingIntegrity: 0,
      lexicalDensity: 0, syntacticComplexity: 0,
      rareTokenRatio: 0, nestedClauseDepth: 0,
      gerundPhraseCount: 0, contentWordRatio: 0
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
