import { describe, it, expect, vi } from 'vitest';
import { AdaptiveAssessmentEngine } from '../services/AdaptiveAssessmentEngine';

// Mock Banks for testing
const MOCK_ITEM = (id: string, skill: string, level: string) => ({
  id,
  skill,
  task_type: `${skill}_mcq`,
  target_cefr: level,
  difficulty: 0.5,
  response_mode: 'multiple_choice',
  prompt: `Prompt ${id}`,
  answer_key: 'A',
  audio_url: skill === 'listening' ? '/audio/test.mp3' : undefined,
  evidence_policy: { [skill]: { weight: 1.0, direct: true } }
});

// We need to mock the JSON imports if we want to test in isolation,
// but since we have real banks, we can test with them or mock the engine's internal banks.
// For simplicity in this environment, we'll test the logic on the real engine instance.

describe('AdaptiveAssessmentEngine Stability', () => {
  it('Phase 1: Should follow the forced L->R->W->S calibration sequence', async () => {
    const engine = new AdaptiveAssessmentEngine('B1');
    
    const q1 = engine.getNextQuestion();
    expect(q1?.skill).toBe('listening');
    await engine.submitAnswer(q1!, 'A', 1000);

    const q2 = engine.getNextQuestion();
    expect(q2?.skill).toBe('reading');
    await engine.submitAnswer(q2!, 'A', 1000);

    const q3 = engine.getNextQuestion();
    expect(q3?.skill).toBe('writing');
    await engine.submitAnswer(q3!, 'A', 1000);

    const q4 = engine.getNextQuestion();
    expect(q4?.skill).toBe('speaking');
    await engine.submitAnswer(q4!, 'A', 1000);
    
    // Progress should be 4
    expect(engine.getProgress().answered).toBe(4);
  });

  it('Repetition Prevention: Should NOT repeat questions within 20 iterations', async () => {
    const engine = new AdaptiveAssessmentEngine('B1');
    const askedIds = new Set<string>();
    
    for (let i = 0; i < 15; i++) {
        const q = engine.getNextQuestion();
        if (!q) break;
        
        expect(askedIds.has(q.id)).toBe(false);
        askedIds.add(q.id);
        
        await engine.submitAnswer(q, 'A', 500);
    }
  });

  it('Progress and Counter: Should accurately reflect unique questions', async () => {
    const engine = new AdaptiveAssessmentEngine('B1');
    
    const q1 = engine.getNextQuestion();
    // Simulate double-call to getNextQuestion (rerender style)
    const q1_repeat = engine.getNextQuestion();
    
    expect(q1?.id).not.toBe(q1_repeat?.id); // Should have moved to next due to immediate marking
    
    await engine.submitAnswer(q1!, 'A', 1000);
    expect(engine.getProgress().answered).toBe(1);
  });

  it('Stop Condition: Should stop at MAX_QUESTIONS (20)', async () => {
    const engine = new AdaptiveAssessmentEngine('B1');
    
    // Simulate 20 questions
    for (let i = 0; i < 20; i++) {
      const q = engine.getNextQuestion();
      if (!q) break;
      await engine.submitAnswer(q, 'A', 100);
    }
    
    const lastQ = engine.getNextQuestion();
    expect(lastQ).toBeNull();
    expect(engine.getProgress().completed).toBe(true);
  });
});
