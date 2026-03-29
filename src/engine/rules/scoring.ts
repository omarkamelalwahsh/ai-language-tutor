// ============================================================================
// Challenge Scorer
// ============================================================================
// Step 1 of the pipeline: scoreChallengeResult
//
// Takes a raw ChallengeResult and produces a ScoredResult with:
// - Overall score
// - Dimensional scores
// - List of detected errors (with ErrorCodes)
// - List of correct elements
//
// Scoring is DETERMINISTIC: same input always produces same output.
// ============================================================================

import {
  ChallengeResult, ScoredResult, DetectedError, CorrectElement,
  ChallengeBlueprint, ScoringDimension,
} from '../domain/types';
import { ErrorCode } from '../domain/errors';

/**
 * Score a challenge result by comparing learner response to expected output.
 *
 * This is a dispatcher — it delegates to challenge-type-specific scoring
 * functions. Each function applies deterministic comparison rules.
 */
export function scoreChallengeResult(result: ChallengeResult): ScoredResult {
  switch (result.blueprint.challengeType) {
    case 'listen_and_write':
    case 'dictation':
      return scoreDictationStyle(result);
    case 'free_writing':
    case 'guided_writing':
      return scoreFreeWriting(result);
    case 'grammar_transformation':
      return scoreGrammarTransformation(result);
    case 'vocabulary_in_context':
      return scoreVocabularyInContext(result);
    case 'read_and_answer':
    case 'read_and_summarize':
    case 'listen_and_answer':
    case 'reading_comprehension':
      return scoreComprehensionStyle(result);
    default:
      return scoreFreeWriting(result); // Fallback
  }
}

// ─── Dictation / Listen-and-Write Scoring ───────────────────────────────────

/**
 * Scores a dictation/listen-and-write challenge.
 *
 * Logic:
 * 1. Normalize both target and response (lowercase, trim, standardize whitespace)
 * 2. Tokenize into words
 * 3. Compare word-by-word for:
 *    - Exact matches (correct)
 *    - Spelling errors (edit distance ≤ 2)
 *    - Missing words (in target but not response)
 *    - Extra words (in response but not target)
 * 4. Check grammar patterns (subject-verb agreement, tense)
 * 5. Score each dimension
 */
function scoreDictationStyle(result: ChallengeResult): ScoredResult {
  const target = result.blueprint.stimulus['audioText'] || result.blueprint.stimulus['targetText'] || '';
  const response = result.learnerResponse || result.responseData['transcription'] || '';

  const targetNorm = normalize(target);
  const responseNorm = normalize(response);

  const targetWords = tokenize(targetNorm);
  const responseWords = tokenize(responseNorm);

  const errors: DetectedError[] = [];
  const correctElements: CorrectElement[] = [];

  // Word-level comparison
  let correctWordCount = 0;
  let spellingErrors = 0;
  let missingWords = 0;
  let extraWords = 0;

  // Simple alignment: compare position by position
  const maxLen = Math.max(targetWords.length, responseWords.length);

  for (let i = 0; i < maxLen; i++) {
    const tWord = targetWords[i];
    const rWord = responseWords[i];

    if (!tWord && rWord) {
      // Extra word in response
      extraWords++;
      continue;
    }

    if (tWord && !rWord) {
      // Missing word
      missingWords++;
      errors.push({
        errorCode: 'listening_missed_detail',
        fragment: `[missing: "${tWord}"]`,
        expected: tWord,
        context: `Word at position ${i + 1} was not transcribed.`,
      });
      continue;
    }

    if (tWord === rWord) {
      correctWordCount++;
      correctElements.push({
        dimensionId: 'accuracy',
        fragment: rWord!,
        description: `Correctly transcribed "${rWord}"`,
      });
      continue;
    }

    // Check if it's a spelling error (close but not exact)
    if (tWord && rWord && editDistance(tWord, rWord) <= 2) {
      spellingErrors++;
      errors.push({
        errorCode: 'spelling_error',
        fragment: rWord,
        expected: tWord,
        context: `Spelling error: wrote "${rWord}" instead of "${tWord}"`,
      });
      correctElements.push({
        dimensionId: 'listening_accuracy',
        fragment: rWord,
        description: `Correctly heard the word but misspelled it (wrote "${rWord}" for "${tWord}")`,
      });
      continue;
    }

    // Different word entirely — could be listening or vocabulary error
    if (tWord && rWord) {
      // Determine if it's a listening error or vocabulary confusion
      if (soundsSimilar(tWord, rWord)) {
        errors.push({
          errorCode: 'listening_phoneme_confusion',
          fragment: rWord,
          expected: tWord,
          context: `Phoneme confusion: heard "${rWord}" instead of "${tWord}"`,
        });
      } else {
        errors.push({
          errorCode: 'vocabulary_wrong_word',
          fragment: rWord,
          expected: tWord,
          context: `Wrong word: wrote "${rWord}" instead of "${tWord}"`,
        });
      }
    }
  }

  // Grammar checks on the response
  const grammarErrors = checkGrammarPatterns(responseNorm, targetNorm);
  errors.push(...grammarErrors);

  // Compute dimensional scores
  const totalWords = targetWords.length;
  const accuracyScore = totalWords > 0 ? (correctWordCount / totalWords) * 100 : 0;
  const spellingScore = totalWords > 0
    ? ((totalWords - spellingErrors) / totalWords) * 100
    : 100;
  const completenessScore = totalWords > 0
    ? ((totalWords - missingWords) / totalWords) * 100
    : 0;
  const grammarScore = grammarErrors.length === 0 ? 100 : Math.max(0, 100 - grammarErrors.length * 25);

  // Overall score: weighted combination
  const overallScore = Math.round(
    accuracyScore * 0.35 +
    spellingScore * 0.20 +
    completenessScore * 0.25 +
    grammarScore * 0.20
  );

  return {
    challengeResult: result,
    overallScore: Math.max(0, Math.min(100, overallScore)),
    dimensionScores: {
      accuracy: Math.round(accuracyScore),
      spelling: Math.round(spellingScore),
      completeness: Math.round(completenessScore),
      grammar: Math.round(grammarScore),
    },
    detectedErrors: errors,
    correctElements,
  };
}

// ─── Free Writing Scoring ───────────────────────────────────────────────────

function scoreFreeWriting(result: ChallengeResult): ScoredResult {
  const response = result.learnerResponse || '';
  const errors: DetectedError[] = [];
  const correctElements: CorrectElement[] = [];

  const words = tokenize(normalize(response));
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));

  // Length check
  if (words.length < 3) {
    errors.push({
      errorCode: 'task_incomplete',
      fragment: response,
      expected: 'A substantive response of at least one full sentence.',
    });
  }

  // Lexical diversity
  const lexicalDiversity = words.length > 0 ? uniqueWords.size / words.length : 0;
  if (lexicalDiversity < 0.4 && words.length > 10) {
    errors.push({
      errorCode: 'vocabulary_limited_range',
      fragment: response.substring(0, 50),
      expected: 'Greater variety of vocabulary.',
    });
  }

  // Connector check
  const connectors = ['because', 'however', 'although', 'therefore', 'but', 'so', 'and', 'moreover', 'furthermore', 'while', 'since'];
  const usedConnectors = connectors.filter(c => response.toLowerCase().includes(c));
  if (usedConnectors.length === 0 && sentences.length > 1) {
    errors.push({
      errorCode: 'discourse_no_connectors',
      fragment: response.substring(0, 50),
      expected: 'Use of linking words to connect ideas.',
    });
  } else if (usedConnectors.length > 0) {
    correctElements.push({
      dimensionId: 'coherence',
      fragment: usedConnectors.join(', '),
      description: `Used connectors: ${usedConnectors.join(', ')}`,
    });
  }

  // Basic grammar checks
  const grammarErrors = checkBasicGrammar(response);
  errors.push(...grammarErrors);

  // Compute scores
  const lengthScore = Math.min(100, words.length * 5);
  const diversityScore = Math.min(100, lexicalDiversity * 150);
  const coherenceScore = usedConnectors.length > 0 ? Math.min(100, 50 + usedConnectors.length * 15) : 30;
  const grammarScoreVal = Math.max(0, 100 - grammarErrors.length * 20);
  const complexityScore = Math.min(100, (sentences.length > 0 ? words.length / sentences.length : 0) * 10);

  const overallScore = Math.round(
    lengthScore * 0.15 +
    diversityScore * 0.20 +
    coherenceScore * 0.20 +
    grammarScoreVal * 0.30 +
    complexityScore * 0.15
  );

  return {
    challengeResult: result,
    overallScore: Math.max(0, Math.min(100, overallScore)),
    dimensionScores: {
      length: Math.round(lengthScore),
      lexical_diversity: Math.round(diversityScore),
      coherence: Math.round(coherenceScore),
      grammar: Math.round(grammarScoreVal),
      complexity: Math.round(complexityScore),
    },
    detectedErrors: errors,
    correctElements,
  };
}

// ─── Grammar Transformation Scoring ─────────────────────────────────────────

function scoreGrammarTransformation(result: ChallengeResult): ScoredResult {
  const target = result.blueprint.stimulus['expectedAnswer'] || '';
  const response = result.learnerResponse || '';

  const targetNorm = normalize(target);
  const responseNorm = normalize(response);

  const errors: DetectedError[] = [];
  const correctElements: CorrectElement[] = [];

  const isExactMatch = targetNorm === responseNorm;
  const editDist = editDistance(targetNorm, responseNorm);
  const similarity = target.length > 0 ? 1 - editDist / Math.max(targetNorm.length, responseNorm.length) : 0;

  if (isExactMatch) {
    correctElements.push({
      dimensionId: 'accuracy',
      fragment: response,
      description: 'Perfect grammatical transformation.',
    });
  } else if (similarity > 0.8) {
    errors.push({
      errorCode: 'spelling_error',
      fragment: response,
      expected: target,
      context: 'Close but has minor errors.',
    });
  } else {
    errors.push({
      errorCode: 'grammar_tense_error',
      fragment: response,
      expected: target,
      context: 'Grammatical transformation not applied correctly.',
    });
  }

  const overallScore = isExactMatch ? 100 : Math.round(similarity * 100);

  return {
    challengeResult: result,
    overallScore,
    dimensionScores: { accuracy: overallScore, grammar: overallScore },
    detectedErrors: errors,
    correctElements,
  };
}

// ─── Vocabulary in Context Scoring ──────────────────────────────────────────

function scoreVocabularyInContext(result: ChallengeResult): ScoredResult {
  const target = normalize(result.blueprint.stimulus['expectedAnswer'] || '');
  const response = normalize(result.learnerResponse || '');

  const errors: DetectedError[] = [];
  const correctElements: CorrectElement[] = [];

  const isCorrect = response.includes(target) || target.includes(response);

  if (isCorrect) {
    correctElements.push({
      dimensionId: 'vocabulary',
      fragment: result.learnerResponse,
      description: 'Correct vocabulary choice in context.',
    });
  } else {
    errors.push({
      errorCode: 'vocabulary_wrong_word',
      fragment: result.learnerResponse,
      expected: result.blueprint.stimulus['expectedAnswer'] || '',
      context: 'Incorrect word choice for this context.',
    });
  }

  return {
    challengeResult: result,
    overallScore: isCorrect ? 95 : 20,
    dimensionScores: { vocabulary_accuracy: isCorrect ? 95 : 20 },
    detectedErrors: errors,
    correctElements,
  };
}

// ─── Comprehension Style Scoring ────────────────────────────────────────────

function scoreComprehensionStyle(result: ChallengeResult): ScoredResult {
  const keywords = (result.blueprint.stimulus['keywords'] || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
  const response = normalize(result.learnerResponse || '');
  const responseWords = tokenize(response);

  const errors: DetectedError[] = [];
  const correctElements: CorrectElement[] = [];

  let keywordHits = 0;
  for (const kw of keywords) {
    if (response.includes(kw)) {
      keywordHits++;
      correctElements.push({
        dimensionId: 'comprehension',
        fragment: kw,
        description: `Identified key concept: "${kw}"`,
      });
    } else {
      errors.push({
        errorCode: 'listening_missed_detail',
        fragment: `[missing: "${kw}"]`,
        expected: kw,
        context: `Key concept "${kw}" not mentioned in response.`,
      });
    }
  }

  const keywordScore = keywords.length > 0 ? (keywordHits / keywords.length) * 100 : 50;
  const lengthScore = Math.min(100, responseWords.length * 8);

  const overallScore = Math.round(keywordScore * 0.7 + lengthScore * 0.3);

  return {
    challengeResult: result,
    overallScore: Math.max(0, Math.min(100, overallScore)),
    dimensionScores: {
      keyword_coverage: Math.round(keywordScore),
      response_length: Math.round(lengthScore),
    },
    detectedErrors: errors,
    correctElements,
  };
}

// ─── Utility Functions ──────────────────────────────────────────────────────

/** Normalize text: lowercase, trim, collapse whitespace. */
function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Tokenize text into words. */
function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(w => w.replace(/[^a-z'-]/g, '').length > 0)
    .map(w => w.replace(/[^a-z'-]/g, ''));
}

/** Levenshtein edit distance between two strings. */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/** Heuristic: do two words sound similar? (simplified phonetic check) */
function soundsSimilar(a: string, b: string): boolean {
  // Simple heuristic: same first letter and similar length
  if (a.length === 0 || b.length === 0) return false;
  if (a[0] !== b[0]) return false;
  if (Math.abs(a.length - b.length) > 2) return false;
  // Share at least 50% of characters
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  const intersection = [...setA].filter(c => setB.has(c)).length;
  return intersection / Math.max(setA.size, setB.size) > 0.5;
}

/** Check basic grammar patterns and return detected errors. */
function checkGrammarPatterns(response: string, target: string): DetectedError[] {
  const errors: DetectedError[] = [];

  // Check subject-verb agreement
  // Pattern: "she/he/it" followed by base form instead of -s form
  const svPatterns = [
    { pattern: /\b(she|he|it)\s+(go|do|have|come|make|take|say|get|know|think|see|want|use|find|give|tell|work|call|try|need|leave|play)\b/i,
      errorCode: 'grammar_sv_agreement' as ErrorCode },
  ];

  for (const { pattern, errorCode } of svPatterns) {
    const match = response.match(pattern);
    if (match) {
      const verb = match[2];
      const subject = match[1];
      errors.push({
        errorCode,
        fragment: match[0],
        expected: `${subject} ${verb}s`,
        context: `Third person singular requires "${verb}s" not "${verb}".`,
      });
    }
  }

  return errors;
}

/** Check basic grammar in free-form text. */
function checkBasicGrammar(text: string): DetectedError[] {
  const errors: DetectedError[] = [];
  const lower = text.toLowerCase();

  // Subject-verb agreement
  const svMatches = lower.match(/\b(she|he|it)\s+(go|do|have|come|make|take)\b/g);
  if (svMatches) {
    for (const match of svMatches) {
      errors.push({
        errorCode: 'grammar_sv_agreement',
        fragment: match,
        expected: match.replace(/\s+(go|do|have|come|make|take)$/, (_, v) => ` ${v}${v === 'have' ? 's' : v === 'do' ? 'es' : v === 'go' ? 'es' : 's'}`),
      });
    }
  }

  // Basic article check (very simplified)
  const articleMissing = lower.match(/\b(is|was)\s+[bcdfghjklmnpqrstvwxyz]\w{2,}\b/g);
  if (articleMissing && articleMissing.length > 2) {
    errors.push({
      errorCode: 'grammar_article_error',
      fragment: articleMissing[0],
      expected: 'Article may be needed before noun.',
    });
  }

  return errors;
}
