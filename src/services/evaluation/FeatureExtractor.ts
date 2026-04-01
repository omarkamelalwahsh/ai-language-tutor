import { AssessmentQuestion, AssessmentFeatures } from '../../types/assessment';

/**
 * Layer 2: Deterministic Feature Extraction
 * Extracts measurable linguistic and performance signals from a learner's response.
 */
export class FeatureExtractor {
  public static extract(
    question: AssessmentQuestion,
    answer: string,
    latencyMs: number
  ): AssessmentFeatures {
    const normAnswer = answer.trim();
    if (!normAnswer) {
      return {
        correctness: 0,
        wordCount: 0,
        sentenceComplexity: 0,
        averageSentenceLength: 0,
        lexicalDiversity: 0,
        connectorUsage: 0,
        timestamp: new Date().toISOString()
      };
    }

    const words = normAnswer.split(/\s+/).filter(w => w.length > 0);
    const sentences = normAnswer.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    const wordCount = words.length;
    const sentenceCount = sentences.length;
    const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;
    
    // Lexical Diversity (TTR - Type Token Ratio)
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const lexicalDiversity = wordCount > 0 ? uniqueWords.size / wordCount : 0;
    
    // Cohesion markers (connectors)
    const connectors = [
      'and', 'but', 'so', 'because', 'although', 'however', 'therefore', 
      'moreover', 'furthermore', 'nevertheless', 'consequently', 'instead',
      'otherwise', 'while', 'whereas', 'since', 'as soon as'
    ];
    const connectorCount = words.filter(w => connectors.includes(w.toLowerCase())).length;
    
    // Basic Grammar Proxy (punctuation check vs length)
    const punctuationCount = (normAnswer.match(/[.?!,;:]/g) || []).length;
    const punctuationAccuracy = wordCount > 0 ? Math.min(1.0, punctuationCount / (wordCount / 5)) : 0;

    // Correctness (Continuous Fuzzy Matching)
    let correctness = 0;
    if (['mcq', 'fill_blank', 'reading_mcq', 'listening_mcq'].includes(question.type)) {
      if (question.correctAnswer) {
        const expected = Array.isArray(question.correctAnswer) 
          ? question.correctAnswer[0] 
          : question.correctAnswer;
        correctness = normAnswer.toLowerCase() === expected.toLowerCase() ? 1.0 : 0.0;
      }
    } else if (['listening_summary', 'short_text', 'picture_description'].includes(question.type)) {
      const keywords = question.acceptedAnswers || 
        (Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer || '']);
      
      const filteredKeywords = keywords.filter(Boolean);
      
      if (filteredKeywords.length > 0) {
        // FUZZY MATCHING: calculate average best match score across keywords
        let totalMatchScore = 0;
        const inputWords = normAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        
        for (const kw of filteredKeywords) {
          const kwLower = kw.toLowerCase();
          // Direct inclusion is 1.0
          if (normAnswer.toLowerCase().includes(kwLower)) {
            totalMatchScore += 1.0;
            continue;
          }
          
          // Fuzzy check against input words
          let bestKwScore = 0;
          for (const word of inputWords) {
            const dist = FeatureExtractor.calculateLevenshteinDistance(word, kwLower);
            // Threshold: Distance <= 2 for long words, <= 1 for short
            const threshold = kwLower.length >= 6 ? 2 : 1;
            if (dist <= threshold) {
              const score = 1 - (dist / Math.max(word.length, kwLower.length));
              if (score > bestKwScore) bestKwScore = score;
            }
          }
          totalMatchScore += bestKwScore;
        }
        
        // RESCUE: If any SINGLE keyword matches (even fuzzy), the user PASSES (Correctness >= 0.85)
        if (totalMatchScore >= 1.6) {
          correctness = 1.0; // Two or more matches
        } else if (totalMatchScore >= 0.7) {
          correctness = 0.85; // One clear match
        } else {
          correctness = Math.min(0.5, totalMatchScore); // Partial matches
        }
      } else {
        // RECALIBRATED: If no keywords, but user wrote a decent sentence, give high base correctness
        correctness = wordCount >= 3 ? 0.85 : 0.4;
      }
    }

    return {
      correctness,
      wordCount,
      // Baseline complexity floor: even one sentence with punctuation gets 0.4
      sentenceComplexity: sentenceCount > 0 ? Math.min(1.0, 0.4 + (avgSentenceLength / 20) + (connectorCount * 0.15)) : 0,
      averageSentenceLength: avgSentenceLength,
      // Baseline diversity floor: 0.5 if answered
      lexicalDiversity: wordCount > 0 ? Math.min(1.0, 0.5 + (lexicalDiversity * 0.5)) : 0,
      connectorUsage: connectorCount,
      relevance: wordCount > 2 ? 1.0 : 0.0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Standard Levenshtein Distance implementation for fuzzy matching.
   */
  private static calculateLevenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}
