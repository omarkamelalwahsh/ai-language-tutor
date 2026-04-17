import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdaptiveAssessmentEngine } from '../services/AdaptiveAssessmentEngine';
import { QUESTION_BANK } from '../data/assessment-questions';
import type { AssessmentQuestion } from '../types/assessment';
import { evaluateWithGroq } from '../services/groqEvaluator';
import { DescriptorService } from '../services/DescriptorService';

// Mock DescriptorService
vi.mock('../services/DescriptorService', () => ({
  DescriptorService: {
    getInstance: () => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      matchFeatures: vi.fn().mockReturnValue([]), // No deterministic matches to test the synthetic/relaxed logic
      getRelevantDescriptors: vi.fn().mockReturnValue([])
    })
  }
}));

// Mock Groq Backend
vi.mock('../services/groqEvaluator', () => ({
  evaluateWithGroq: vi.fn()
}));

describe('High Proficiency Paradox Resolution', () => {
  let engine: AdaptiveAssessmentEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new AdaptiveAssessmentEngine('A1');
  });

  it('should promote to C1 label when answering C1 questions correctly', async () => {
    try {
      const qTemplate = QUESTION_BANK.find(q => q.id === 'c1-gram-01')!;

      // Mock perfect C1 signals
      vi.mocked(evaluateWithGroq).mockResolvedValue({
        relevance: 1.0,
        task_completion: 1.0,
        semantic_accuracy: 1.0,
        grammar_control: 1.0,
        lexical_sophistication: 1.0,
        syntactic_complexity: 1.0,
        estimated_band: 'C1',
        confidence: 0.95,
        rationale: "Sophisticated C1 response"
      } as any);

      // Need at least 5 questions for a stable non-provisional rating in V2
      for (let i = 0; i < 5; i++) {
        await engine.submitAnswer({ ...qTemplate, id: `c1-gram-test-${i}` }, "Advanced structure...", 5000);
      }

      const outcome = engine.getOutcome();
      const grammar = outcome.skillBreakdown.grammar;

      // With 5 perfect C1 signals, grammar should break out of A1 and stabilize at C1
      expect(grammar.band).toBe('C1');
      expect(grammar.score).toBeGreaterThan(90);
    } catch (e: any) {
      console.error("TEST ERROR:", e);
      throw e;
    }
  });

  it('should process speaking strictly via audio, but assign `insufficient_data` when voice is missing', async () => {
    try {
      // 1. Provide strong Writing/Grammar evidence
      for (let i = 0; i < 5; i++) {
        const writeQ = QUESTION_BANK.find(q => q.id === 'c1-write-01')!;
        vi.mocked(evaluateWithGroq).mockResolvedValue({
          relevance: 1.0, task_completion: 1.0, semantic_accuracy: 1.0, grammar_control: 1.0,
          lexical_sophistication: 1.0, syntactic_complexity: 1.0, estimated_band: 'C1', confidence: 0.95, rationale: "C1 Writing"
        } as any);
        await engine.submitAnswer({ ...writeQ, id: `write-${i}` }, `Detailed nuanced argument ${i}...`, 10000);
      }

      // 2. Respond to a speaking task with Typed Fallback
      const speakQ = QUESTION_BANK.find(q => q.id === 'a2-speak-01')!;
      await engine.submitAnswer(speakQ, "Highly sophisticated typed introduction...", 5000, 'typed_fallback', {
         responseMode: 'typed_fallback',
         hasValidAudio: false
      });

      const outcome = engine.getOutcome();
      const speaking = outcome.skillBreakdown.speaking;

      // Verify V2 behavior: Speaking is strictly 'insufficient_data' and placed at A1 floor
      expect(speaking.speakingFallbackApplied).toBe(true);
      expect(speaking.status).toBe('insufficient_data');
      expect(speaking.band).toBe('A1');
    } catch (e: any) {
      console.error("TEST ERROR:", e);
      throw e;
    }
  });

  it('should enforce proper conservative capping (e.g. +1 band max from targeting)', async () => {
    try {
      // Answer an A2 question perfectly
      const writeQ = QUESTION_BANK.find(q => q.difficulty === 'A2' && q.primarySkill === 'writing') || QUESTION_BANK[0];
      
      vi.mocked(evaluateWithGroq).mockResolvedValue({
        relevance: 1.0, task_completion: 1.0, semantic_accuracy: 1.0, grammar_control: 1.0,
        lexical_sophistication: 1.0, syntactic_complexity: 1.0, estimated_band: 'C1', confidence: 0.98, rationale: "Peak performance on an easy question"
      } as any);

      for (let i = 0; i < 5; i++) {
        await engine.submitAnswer({ ...writeQ, difficulty: 'A2', id: `a2-write-${i}` } as AssessmentQuestion, `Advanced writing attempt ${i}...`, 5000);
      }

      const outcome = engine.getOutcome();
      const writing = outcome.skillBreakdown.writing;

      // An A2 question can at most provide evidence up to B1 under Assessment V2 Authenticity Guard
      expect(['A2', 'A2_B1', 'B1']).toContain(writing.band);
      expect(writing.band).not.toBe('C1');
    } catch (e: any) {
      console.error("TEST ERROR:", e);
      throw e;
    }
  });
});
