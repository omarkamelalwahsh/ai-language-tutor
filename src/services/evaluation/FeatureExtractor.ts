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

    // Correctness (Deterministic for MCQ / Keyword based for short_text)
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
        const matched = filteredKeywords.filter(kw => normAnswer.toLowerCase().includes(kw.toLowerCase()));
        correctness = Math.min(1.0, matched.length / Math.max(1, Math.ceil(filteredKeywords.length * 0.6)));
      } else {
        // Fallback for open text without keywords: length and diversity proxy
        correctness = wordCount > 5 ? 0.5 : 0.2;
      }
    }

    return {
      correctness,
      wordCount,
      sentenceComplexity: sentenceCount > 1 ? Math.min(1.0, (avgSentenceLength / 10) + (connectorCount * 0.1)) : 0,
      averageSentenceLength: avgSentenceLength,
      lexicalDiversity,
      connectorUsage: connectorCount,
      relevance: wordCount > 2 ? 1.0 : 0.0,
      timestamp: new Date().toISOString()
    };
  }
}
