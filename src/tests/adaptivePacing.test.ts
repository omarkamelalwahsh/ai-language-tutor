import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdaptiveAssessmentEngine } from '../services/AdaptiveAssessmentEngine';
import { QUESTION_BANK } from '../data/assessment-questions';
import { evaluateWithGroq } from '../services/groqEvaluator';

// Mock Dependencies
vi.mock('../services/DescriptorService', () => ({
  DescriptorService: {
    getInstance: () => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      matchFeatures: vi.fn().mockReturnValue([]),
      getRelevantDescriptors: vi.fn().mockReturnValue([])
    })
  }
}));

vi.mock('../services/groqEvaluator', () => ({
  evaluateWithGroq: vi.fn()
}));

describe('Adaptive Pacing & Topic Relevance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Topic Preference Priority', () => {
    it('should prioritize questions with matching topicTags', () => {
      // Setup: Preferred topics "business" and "technology"
      const engine = new AdaptiveAssessmentEngine('A1', {
        preferredTopics: ['business', 'technology'],
        goal: 'professional'
      });

      // Selection should happen
      const nextQ = engine.getNextQuestion();
      
      // Verify that the selected question has "business" or "technology" tags
      // or "professional" goal tag
      expect(nextQ).not.toBeNull();
      const hasTopic = nextQ?.topicTags?.some(t => ['business', 'technology'].includes(t));
      const hasGoal = nextQ?.goalTags?.includes('professional');
      
      expect(hasTopic || hasGoal).toBe(true);
    });
  });

  describe('Accelerated Promotion (Cold Start)', () => {
    it('should jump difficulty band faster if the first answer is near-perfect', async () => {
      const engine = new AdaptiveAssessmentEngine('A2'); // Start at A2

      // Mock a perfect A2 answer with C1-level complexity/signals
      vi.mocked(evaluateWithGroq).mockResolvedValue({
        relevance: 1.0,
        task_completion: 1.0,
        semantic_accuracy: 1.0,
        grammar_control: 1.0,
        lexical_sophistication: 1.0,
        syntactic_complexity: 1.0,
        estimated_band: 'C1',
        confidence: 0.98,
        rationale: "Perfect advanced response"
      } as any);

      const firstQ = QUESTION_BANK.find(q => q.difficulty === 'A2')!;
      
      // Submit answer
      await engine.submitAnswer(firstQ, "A highly sophisticated and complex response that warrants a jump.", 2000);

      // Verify that currentTargetBand jumped from A2 to B2 (due to jumpBandUp logic)
      // Original logic was +1 (step) or +2 (jump). Accelerated logic calls jumpBandUp (+2 indexed).
      // A1=0, A2=1, B1=2, B2=3, C1=4, C2=5.
      // Jumping from A2 (idx 1) -> B2 (idx 3).
      
      const progress = engine.getProgress();
      expect(progress.currentBand).toBe('B2');
    });

    it('should not jump if the answer is just correct but not high-performance', async () => {
      const engine = new AdaptiveAssessmentEngine('A2');

      // Mock a standard correct answer
      vi.mocked(evaluateWithGroq).mockResolvedValue({
        relevance: 0.8,
        task_completion: 0.75,
        semantic_accuracy: 0.8,
        grammar_control: 0.7,
        lexical_sophistication: 0.6,
        syntactic_complexity: 0.5,
        estimated_band: 'A2',
        confidence: 0.7,
        rationale: "Standard correct A2"
      } as any);

      const firstQ = QUESTION_BANK.find(q => q.difficulty === 'A2')!;
      await engine.submitAnswer(firstQ, "Sample simple answer", 2000);

      const progress = engine.getProgress();
      // Should stay at A2 (or step to B1 if 2+ correct, but this is only the 1st question)
      // Standard logic needs 2 correct to move.
      expect(progress.currentBand).toBe('A2');
    });
  });
});
