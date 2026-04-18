import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptiveAssessmentEngine } from '../../services/AdaptiveAssessmentEngine';
import { ASSESSMENT_CONFIG } from '../../config/assessment-config';

describe('Progressive 40-Question Battery - Scoring System', () => {
  let engine: AdaptiveAssessmentEngine;

  beforeEach(() => {
    engine = new AdaptiveAssessmentEngine('B1');
  });

  it('Total points sum reflects CEFR difficulty weights', async () => {
    // 1. Manually populate the engine with a mock battery to avoid fetching
    const mockItem = (id: string, skill: string, level: string, diff: number) => ({
      id, skill, level, prompt: 'Mock', task_type: 'mcq', difficulty: diff, answer_key: { value: { options: ['A', 'B'], correct_index: 0 } }
    });

    (engine as any).battery = [
      { block: 1, skill: 'grammar', zone: 'EASY', pointValue: 1, item: mockItem('q1', 'grammar', 'A1', 0.1) },
      { block: 1, skill: 'grammar', zone: 'MEDIUM', pointValue: 2, item: mockItem('q2', 'grammar', 'B1', 0.4) },
      { block: 1, skill: 'grammar', zone: 'HARD', pointValue: 3, item: mockItem('q3', 'grammar', 'C1', 0.8) }
    ];

    const q1 = await engine.getNextQuestion();
    await engine.submitAnswer(q1!, 'A', 100); // 1.0 score * 0.1 diff = 0.1 pt
    
    const q2 = await engine.getNextQuestion();
    await engine.submitAnswer(q2!, 'A', 100); // 1.0 score * 0.4 diff = 0.4 pt
    
    const q3 = await engine.getNextQuestion();
    await engine.submitAnswer(q3!, 'B', 100); // 0.0 score * 0.8 diff = 0 pt
    
    const outcome = engine.getOutcome();
    // Earned: 0.5. Total possible: 1.3. Max Base Points. 0.5/1.3 = ~38%
    expect(outcome.overall.rationale[0]).toContain('Weighted Score: 0.50/ 1.30');
  });

  it('Maps 95% weighted score to C2 level correctly', async () => {
    (engine as any).skillScores = {
      'grammar': { earned: 9.5, total: 10.0 }
    };
    
    const outcome = engine.getOutcome();
    // 95% -> Should be C2
    expect(outcome.overallBand).toBe('C2');
  });

  it('Maps 50% weighted score to B1 level correctly', async () => {
    (engine as any).skillScores = {
      'reading': { earned: 5.0, total: 10.0 }
    };
    
    const outcome = engine.getOutcome();
    // 50% -> B1
    expect(outcome.overallBand).toBe('B1');
  });

});
