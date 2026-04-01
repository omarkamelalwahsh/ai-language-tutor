import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptiveAssessmentEngine } from '../../services/AdaptiveAssessmentEngine';
import { AssessmentAnalysisService } from '../../services/AnalysisService';
import { clamp01, safeDivide, finiteOr } from '../../lib/numeric-guards';

describe('Numeric Guards', () => {
  it('clamp01 limits values to [0, 1] and handles NaN', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(undefined)).toBe(0);
  });

  it('safeDivide handles division by zero and NaN', () => {
    expect(safeDivide(10, 2)).toBe(5);
    expect(safeDivide(10, 0)).toBe(0);
    expect(safeDivide(10, 0, 1)).toBe(1);
    expect(safeDivide(NaN, 5)).toBe(0);
  });

  it('finiteOr provides fallback for non-finite values', () => {
    expect(finiteOr(5, 10)).toBe(5);
    expect(finiteOr(Infinity, 10)).toBe(10);
    expect(finiteOr(NaN, 10)).toBe(10);
  });
});

describe('AdaptiveAssessmentEngine Bug Fixes', () => {
  let engine: AdaptiveAssessmentEngine;

  beforeEach(() => {
    engine = new AdaptiveAssessmentEngine('A2');
  });

  it('Bug 1 & 2: Submitting an answer updates skill estimate and computes valid finite confidence', async () => {
    const q1 = engine.getNextQuestion();
    expect(q1).toBeDefined();
    
    // Artificially inflate the difficulty of the first question to B1
    // to prove that passing a higher-level question increments the score
    q1!.difficulty = 'B1';

    const initialState = engine.getState();
    const initialScore = initialState.skillEstimates[q1!.primarySkill].score;
    const initialConf = initialState.overallConfidence;

    // Mock the backend evaluation to return a perfect descriptor match
    // since the real function relies on fetching an Excel file which fails in the test environment
    (engine as any).evaluateWithBackend = async () => ({
      semantic_accuracy: 1.0,
      task_completion: 1.0,
      lexical_sophistication: 0.8,
      syntactic_complexity: 0.7,
      coherence: 0.9,
      grammar_control: 0.9,
      typo_severity: 0.0,
      idiomatic_usage: 0.6,
      register_control: 0.8,
      estimated_band: 'B1',
      confidence: 0.9,
      rationale: 'Excellent B1 response with clear syntax.'
    });

    // A perfect answer mapping to high descriptor strength
    await engine.submitAnswer(q1!, 'This is a perfect and very long answer with many connectors because it is complex.', 2000);

    const updatedState = engine.getState();
    const updatedScore = updatedState.skillEstimates[q1!.primarySkill].score;
    const updatedConf = updatedState.overallConfidence;

    expect(updatedScore).not.toBe(initialScore); // Score should change!
    expect(updatedConf).not.toBe(initialConf); // Confidence should change!
    expect(Number.isFinite(updatedConf)).toBe(true);
    expect(updatedConf).toBeGreaterThanOrEqual(0);
    expect(updatedConf).toBeLessThanOrEqual(1);
  });

  it('Bug 4: normalizeBand logic inflates conservatively (A2_B1 -> A2+, not B1)', () => {
    const outcome = {
      overallBand: 'A2_B1' as any,
      overallConfidence: 0.8,
      skillBreakdown: {
        listening: { band: 'A2_B1', score: 60, confidence: 0.8, evidenceCount: 3, status: 'stable', matchedDescriptors: [], missingDescriptors: [] } as any,
        reading: { band: 'A2_B1', score: 60, confidence: 0.8, evidenceCount: 3, status: 'stable', matchedDescriptors: [], missingDescriptors: [] } as any,
        writing: { band: 'A2_B1', score: 60, confidence: 0.8, evidenceCount: 3, status: 'stable', matchedDescriptors: [], missingDescriptors: [] } as any,
        speaking: { band: 'A2_B1', score: 60, confidence: 0.8, evidenceCount: 3, status: 'stable', matchedDescriptors: [], missingDescriptors: [] } as any,
        vocabulary: { band: 'A2_B1', score: 60, confidence: 0.8, evidenceCount: 3, status: 'stable', matchedDescriptors: [], missingDescriptors: [] } as any,
        grammar: { band: 'A2_B1', score: 60, confidence: 0.8, evidenceCount: 3, status: 'stable', matchedDescriptors: [], missingDescriptors: [] } as any,
      },
      strengths: [],
      weaknesses: [],
      answerHistory: [],
      totalQuestions: 5,
      stopReason: 'max_reached'
    };

    const sessionResult = AssessmentAnalysisService.fromAssessmentOutcome(outcome, 'user', 'session');
    expect(sessionResult.overall.estimatedLevel).toBe('A2+');
    expect(sessionResult.skills.listening.estimatedLevel).toBe('A2+');
  });

  it('Bug 3 & 5: masteryScore is separated from confidence wrapper and weaknesses are humanized', () => {
    const outcome = {
      overallBand: 'B1' as any,
      overallConfidence: 0.7,
      skillBreakdown: {
        listening: { band: 'B1', score: 65, confidence: 0.7, evidenceCount: 3, status: 'stable', matchedDescriptors: [], missingDescriptors: [] } as any,
        reading: { band: 'B1', score: 65, confidence: 0.7, evidenceCount: 3, status: 'stable', matchedDescriptors: [], missingDescriptors: [] } as any,
        writing: { 
          band: 'B1', 
          score: 65, // Should become 0.65 masteryScore
          confidence: 0.7, 
          evidenceCount: 3, 
          status: 'stable', 
          matchedDescriptors: [], 
          missingDescriptors: ['writing_B1_3'] // Should become human text
        } as any,
        speaking: { band: 'B1', score: 65, confidence: 0.7, evidenceCount: 3, status: 'stable', matchedDescriptors: [], missingDescriptors: [] } as any,
        vocabulary: { band: 'B1', score: 65, confidence: 0.7, evidenceCount: 3, status: 'stable', matchedDescriptors: [], missingDescriptors: [] } as any,
        grammar: { band: 'B1', score: 65, confidence: 0.7, evidenceCount: 3, status: 'stable', matchedDescriptors: [], missingDescriptors: [] } as any,
      },
      strengths: [],
      weaknesses: [],
      answerHistory: [],
      totalQuestions: 5,
      stopReason: 'max_reached'
    };

    const sessionResult = AssessmentAnalysisService.fromAssessmentOutcome(outcome, 'user', 'session');
    
    // Mastery score test
    expect(sessionResult.skills.writing.masteryScore).toBe(0.65);
    expect(sessionResult.skills.writing.confidence.score).toBe(0.7);

    // Humanized descriptor test (using fallback generation format since catalog isn't fully mocked here)
    expect(sessionResult.skills.writing.weaknesses[0]).toContain('writing');
    expect(sessionResult.skills.writing.weaknesses[0]).not.toBe('writing_B1_3');
  });
});
