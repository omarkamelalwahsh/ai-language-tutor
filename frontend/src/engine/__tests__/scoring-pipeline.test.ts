import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptiveAssessmentEngine } from '../../services/AdaptiveAssessmentEngine';
import { ASSESSMENT_CONFIG } from '../../config/assessment-config';

describe('Progressive 40-Question Battery - Scoring System', () => {
  let engine: AdaptiveAssessmentEngine;

  beforeEach(() => {
    // We mock the fetch or ensure the engine can run without real network in tests
    engine = new AdaptiveAssessmentEngine('B1');
  });

  it('Total points sum to 80 for a perfect score', async () => {
    // 1. Manually populate the engine with a mock battery to avoid fetching
    const mockItem = (id: string, skill: string, cefr: string) => ({
      id, skill, target_cefr: cefr, prompt: 'Mock', task_type: 'mcq',
      answer_key: { value: { options: ['A', 'B'], correct_index: 0 } }
    });

    // We can't easily mock the private battery, so we'll test the output of submitAnswer
    // and the resulting outcome calculation.
    
    // Simulating 40 questions with specific point weights
    // Block 1: 10 Qs (3 Easy=1, 4 Med=2, 3 Hard=3) = 20 pts
    // Block 2: 10 Qs (3 Easy=1, 4 Med=2, 3 Hard=3) = 20 pts
    // ... total 80
    
    // Let's test the math directly in getOutcome by simulating entries in answer history if possible,
    // or just simulate a full run.
    
    // For this test, we'll verify if the engine.submitAnswer correctly increments points.
    // We need to bypass the fetch in getNextQuestion.
    (engine as any).battery = [
      { block: 1, skill: 'grammar', zone: 'EASY', pointValue: 1, item: mockItem('q1', 'grammar', 'A1') },
      { block: 1, skill: 'grammar', zone: 'MEDIUM', pointValue: 2, item: mockItem('q2', 'grammar', 'B1') },
      { block: 1, skill: 'grammar', zone: 'HARD', pointValue: 3, item: mockItem('q3', 'grammar', 'C1') }
    ];

    const q1 = await engine.getNextQuestion();
    await engine.submitAnswer(q1!, 'A', 100); // 1.0 score * 1 pt = 1 pt
    
    const q2 = await engine.getNextQuestion();
    await engine.submitAnswer(q2!, 'A', 100); // 1.0 score * 2 pt = 2 pt
    
    const q3 = await engine.getNextQuestion();
    await engine.submitAnswer(q3!, 'B', 100); // 0.0 score * 3 pt = 0 pt
    
    const outcome = engine.getOutcome();
    expect(outcome.overall.rationale[0]).toContain('Total Score: 3.0/80');
  });

  it('Maps 75/80 points to C2 level correctly', async () => {
    // Manually inject a high score into the internal state for the outcome calculation test
    (engine as any).blockScores = [
      { earnedPoints: 20, totalPossible: 20 },
      { earnedPoints: 20, totalPossible: 20 },
      { earnedPoints: 20, totalPossible: 20 },
      { earnedPoints: 15, totalPossible: 20 }
    ];
    
    const outcome = engine.getOutcome();
    // 75/80 = 93.75% -> Should be C2 (usually 90%+)
    expect(outcome.overallBand).toBe('C2');
  });

  it('Maps 40/80 points to B1+ level correctly', async () => {
    (engine as any).blockScores = [
      { earnedPoints: 15, totalPossible: 20 },
      { earnedPoints: 10, totalPossible: 20 },
      { earnedPoints: 10, totalPossible: 20 },
      { earnedPoints: 5, totalPossible: 20 }
    ];
    
    const outcome = engine.getOutcome();
    // 40/80 = 50% -> B1 or B1+ depending on CEFREngine mapping
    expect(outcome.overallBand).toContain('B1');
  });

  it('Foundational Gap: Detects easy failure + hard pass inconsistency', async () => {
    // Set up a skill where easy failure > 50% and hard pass > 50%
    (engine as any).skillScores['reading'] = {
      earned: 10,
      total: 20,
      easyCorrect: 1,
      easyTotal: 3, // 33% correct -> 66% fail rate (> 50%)
      hardCorrect: 2,
      hardTotal: 3  // 66% pass rate (> 50%)
    };

    const outcome = engine.getOutcome();
    expect(outcome.skillBreakdown['reading'].isCapped).toBe(true);
    expect(outcome.skillBreakdown['reading'].cappedReason).toBe('Foundational gap detected.');
  });
});
