import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdaptiveAssessmentEngine } from '../services/AdaptiveAssessmentEngine';
import { QUESTION_BANK } from '../data/assessment-questions';

// Mock DescriptorService to avoid fetch/xlsx errors in Node test environment
vi.mock('../services/DescriptorService', () => ({
  DescriptorService: {
    getInstance: () => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      matchFeatures: vi.fn().mockReturnValue([]),
      getRelevantDescriptors: vi.fn().mockReturnValue([])
    })
  }
}));

// Mock the backend evaluation to simulate off-topic responses
vi.mock('../services/groqEvaluator', () => ({
  evaluateWithGroq: vi.fn()
}));

import { evaluateWithGroq } from '../services/groqEvaluator';

describe('Relevance Gating & Verification Mode', () => {
  let engine: AdaptiveAssessmentEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new AdaptiveAssessmentEngine();
  });

  it('should penalize an off-topic response by capping the score and blocking skill credit', async () => {
    const question = QUESTION_BANK.find(q => q.id === 'b1-write-01')!; // Narrative task
    
    // Mock an off-topic LLM result
    vi.mocked(evaluateWithGroq).mockResolvedValue({
      relevance: 0.1,
      task_completion: 0.1,
      is_off_topic: true,
      missing_content_points: ['challenge', 'resolution'],
      semantic_accuracy: 0.8, // High grammar/vocab but off-topic
      grammar_control: 0.9,
      lexical_sophistication: 0.9,
      coherence: 0.4,
      idiomatic_usage: 0.5,
      register_control: 0.5,
      syntactic_complexity: 0.5,
      typo_severity: 0.1,
      estimated_band: 'B1',
      confidence: 0.95,
      rationale: "The user wrote about their favorite food instead of a past challenge."
    } as any);

    await engine.submitAnswer(question, "I really love eating pepperoni pizza for lunch.", 5000);

    const history = engine.getState().answerHistory;
    const lastRecord = history[history.length - 1];
    const lastEval = engine.getState().taskEvaluations[engine.getState().taskEvaluations.length - 1];

    // Verify gating
    expect(lastRecord.score).toBeLessThanOrEqual(0.2);
    expect(lastRecord.correct).toBe(false);
    expect(lastEval.isOffTopic).toBe(true);
    
    // Verify skill evidence dampening (writing weight should be reduced by 0.1)
    expect(lastEval.skillEvidence['writing']).toBeLessThan(0.2);
  });

  it('should trigger Verification Mode after an off-topic response', async () => {
    const question = QUESTION_BANK.find(q => q.id === 'b1-write-01')!;
    
    // 1. Submit off-topic answer
    vi.mocked(evaluateWithGroq).mockResolvedValue({
      relevance: 0.1,
      is_off_topic: true,
      task_completion: 0.1,
      missing_content_points: ['challenge'],
      semantic_accuracy: 0.5,
      grammar_control: 0.5,
      lexical_sophistication: 0.5,
      coherence: 0.5,
      estimated_band: 'B1',
      confidence: 0.9,
      rationale: "Off topic"
    } as any);

    await engine.submitAnswer(question, "Off topic text", 1000);

    // 2. Select next question
    const nextQuestion = (engine as any).selectNextQuestion();

    // Verify next question is the same skill and same difficulty (Verification Mode)
    expect(nextQuestion.primarySkill).toBe(question.primarySkill);
    expect(nextQuestion.difficulty).toBe(question.difficulty);
  });

  it('should reduce credit for incomplete responses without marking as total failure', async () => {
    const question = QUESTION_BANK.find(q => q.id === 'a2-speak-01')!; // Intro self
    
    // Mock an incomplete LLM result (missing job)
    vi.mocked(evaluateWithGroq).mockResolvedValue({
      relevance: 0.8,
      task_completion: 0.5,
      is_off_topic: false,
      missing_content_points: ['job/status'],
      semantic_accuracy: 0.9,
      grammar_control: 0.9,
      lexical_sophistication: 0.9,
      coherence: 0.9,
      estimated_band: 'A2',
      confidence: 0.9,
      rationale: "User introduced name and country but forgot to mention their job."
    } as any);

    await engine.submitAnswer(question, "My name is John and I am from the USA.", 5000);

    const history = engine.getState().answerHistory;
    const lastRecord = history[history.length - 1];

    // Verify score cap for incomplete
    expect(lastRecord.score).toBeLessThanOrEqual(0.5);
  });
});
