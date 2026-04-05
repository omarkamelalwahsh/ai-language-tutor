import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdaptiveAssessmentEngine } from '../services/AdaptiveAssessmentEngine';
import { QUESTION_BANK } from '../data/assessment-questions';
import { evaluateWithGroq } from '../services/groqEvaluator';

// Mock DescriptorService
vi.mock('../services/DescriptorService', () => ({
  DescriptorService: {
    getInstance: () => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      matchFeatures: vi.fn().mockReturnValue([]),
      getRelevantDescriptors: vi.fn().mockReturnValue([])
    })
  }
}));

// Mock Groq Backend
vi.mock('../services/groqEvaluator', () => ({
  evaluateWithGroq: vi.fn()
}));

describe('AdaptiveAssessmentEngine - Core Tests', () => {
  let engine: AdaptiveAssessmentEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new AdaptiveAssessmentEngine('A2');
  });

  describe('Relevance Gating', () => {
    it('should penalize an off-topic response', async () => {
      const question = QUESTION_BANK.find(q => q.id === 'b1-write-01')!;
      
      vi.mocked(evaluateWithGroq).mockResolvedValue({
        relevance: 0.1,
        is_off_topic: true,
        task_completion: 0.1,
        missing_content_points: ['challenge'],
        semantic_accuracy: 0.8,
        grammar_control: 0.9,
        lexical_sophistication: 0.9,
        coherence: 0.4,
        estimated_band: 'B1',
        confidence: 0.9,
        rationale: "Off topic"
      } as any);

      await engine.submitAnswer(question, "Irrelevant answer.", 5000);

      const state = engine.getState();
      const lastRecord = state.answerHistory[0];
      const lastEval = state.taskEvaluations[0];

      expect(lastRecord.score).toBeLessThanOrEqual(0.2);
      expect(lastRecord.correct).toBe(false);
      expect(lastEval.isOffTopic).toBe(true);
    });

    it('should reduce credit for incomplete response', async () => {
      const question = QUESTION_BANK.find(q => q.id === 'a2-speak-01')!;
      
      vi.mocked(evaluateWithGroq).mockResolvedValue({
        relevance: 0.8,
        task_completion: 0.5,
        is_off_topic: false,
        missing_content_points: ['job'],
        semantic_accuracy: 0.9,
        grammar_control: 0.9,
        lexical_sophistication: 0.9,
        coherence: 0.9,
        estimated_band: 'A2',
        rationale: "Incomplete"
      } as any);

      await engine.submitAnswer(question, "Partial answer.", 5000);

      const lastRecord = engine.getState().answerHistory[0];
      expect(lastRecord.score).toBeLessThanOrEqual(0.5);
    });
  });

  describe('Skill Progression (Sticky A1 Fix)', () => {
    it('should promote rapid success correctly', async () => {
      // Start at A1
      const testEngine = new AdaptiveAssessmentEngine('A1');
      
      // Submit a perfect C1 result (manually updating to avoid mock complexity)
      (testEngine as any).updateSingleSkillEstimate('grammar', {
        taskId: 'ext-c1',
        score: 1.0,
        difficulty: 5, // C1
        correct: true,
        taskType: 'short_text'
      });

      const report = testEngine.getOutcome();
      const grammar = report.skillBreakdown.grammar;
      // Mastery = C1(100), Demonst = C1(100)
      // Score = (100 * 0.7) + (100 * 0.3) = 100.
      expect(grammar.score).toBeGreaterThan(95);
      expect(grammar.band).toBe('C2');
    });

    it('should show stability as emerging with high evidence', async () => {
        const testEngine = new AdaptiveAssessmentEngine('A1');
        // Submit 3 perfect B1 answers
        for (let i = 0; i < 3; i++) {
            (testEngine as any).updateSingleSkillEstimate('reading', {
                taskId: `b1-${i}`,
                score: 1.0,
                difficulty: 3, // B1
                correct: true
            });
        }
        
        const report = testEngine.getOutcome();
        const reading = report.skillBreakdown.reading;
        expect(reading.band).toBe('B1_B2'); // score 60
        expect(reading.status).toBe('emerging');
    });
  });
});
