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

describe('Assessment Engine Stability & Punctuation Regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Stability Fix (Double-Mapping)', () => {
    it('should correctly attribute DIRECT evidence to Vocabulary MCQ items', async () => {
      const engine = new AdaptiveAssessmentEngine('A2');

      // We need to find a vocabulary MCQ
      const vocabQ = QUESTION_BANK.find(q => q.type === 'mcq' && q.skill === 'vocabulary')!;
      
      // Mock correct answer (Heuristic will handle it if we set it right)
      const expected = vocabQ.correctAnswer as string;

      // Submit correct answer
      await engine.submitAnswer(vocabQ, expected, 2000);

      // Get the report via getProgress or internal state access
      const results = engine.getFinalResult();
      const vocabResult = results.skillBreakdown.vocabulary;

      // VERIFICATION: directEvidenceCount should NOT be 0
      // We need to check the pipeline_v2 records.
      // Since it's a private member, we verify through the status and evidence count.
      // If double-mapping happened, status would be 'insufficient_data' because 
      // it would map to 'general_short_text' (weight 0 direct).
      
      // Before fix: status was 'insufficient_data'.
      // After fix: status should be 'provisional' or 'stable' (depending on count).
      // With 1 item, it should be 'provisional' (needs 4 for stable vocabulary).
      expect(vocabResult.status).not.toBe('insufficient_data');
      expect(vocabResult.status).toBe('provisional');
    });

    it('should correctly attribute DIRECT evidence to Grammar MCQ items', async () => {
      const engine = new AdaptiveAssessmentEngine('A2');
      const grammarQ = QUESTION_BANK.find(q => q.type === 'mcq' && q.skill === 'grammar')!;
      
      await engine.submitAnswer(grammarQ, grammarQ.correctAnswer as string, 2000);

      const results = engine.getFinalResult();
      const grammarResult = results.skillBreakdown.grammar;

      expect(grammarResult.status).not.toBe('insufficient_data');
      expect(grammarResult.status).toBe('provisional');
    });
  });

  describe('Punctuation Resilience (Matching)', () => {
    it('should correctly match short answers even with trailing punctuation', async () => {
      const engine = new AdaptiveAssessmentEngine('B2');
      
      // Scarcely ___ the room question (Task 22 equivalent)
      const inversionQ = QUESTION_BANK.find(q => q.id === 'grammar_B2_inversion_01' || q.id === '22') || QUESTION_BANK[21];
      
      const expected = (Array.isArray(inversionQ.correctAnswer) ? inversionQ.correctAnswer[0] : inversionQ.correctAnswer) as string;
      
      // Submit answer with EXTRA punctuation and different case
      const userResponse = expected.toUpperCase() + ". ";
      
      const result = await engine.submitAnswer(inversionQ, userResponse, 2000);
      
      expect(result.correct).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.8);
    });

    it('should match fill-in-the-blank regardless of minor whitespace', async () => {
      const engine = new AdaptiveAssessmentEngine('A1');
      const fillQ = QUESTION_BANK.find(q => q.type === 'fill_blank')!;
      
      const expected = (Array.isArray(fillQ.correctAnswer) ? fillQ.correctAnswer[0] : fillQ.correctAnswer) as string;
      
      const result = await engine.submitAnswer(fillQ, "  " + expected + "  ", 1000);
      
      expect(result.correct).toBe(true);
    });
  });
});
