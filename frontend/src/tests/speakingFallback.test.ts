import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdaptiveAssessmentEngine } from '../services/AdaptiveAssessmentEngine';
import * as groqEvaluator from '../services/groqEvaluator';
import type { AssessmentQuestion } from '../types/assessment';

vi.mock('../services/groqEvaluator', () => ({ evaluateWithGroq: vi.fn() }));

function baseLLM(): any {
  return {
    semantic_accuracy: 0.8, task_completion: 0.8, lexical_sophistication: 0.8,
    syntactic_complexity: 0.8, coherence: 0.8, grammar_control: 0.8,
    typo_severity: 0.1, idiomatic_usage: 0.8, register_control: 0.8,
    estimated_band: 'A2', confidence: 0.8, rationale: 'Test.',
    relevance: 1.0, is_off_topic: false, missing_content_points: [],
  };
}

describe('Speaking Response Mode Deterministic Fallback', () => {
  beforeEach(() => vi.resetAllMocks());

  it('enforces A1 speaking level and sets flags when speaking tasks are answered via typed fallback only (NO VOICE EVIDENCE)', async () => {
    const engine = new AdaptiveAssessmentEngine('B1'); // Pre-seed with B1 to show downward override
    vi.mocked(groqEvaluator.evaluateWithGroq).mockResolvedValue(baseLLM());

    // Submit a speaking task using typed fallback
    const q: AssessmentQuestion = {
      id: 'spk-01', primarySkill: 'speaking',
      evidenceWeights: { speaking: 1.0, grammar: 0.5 },
      difficulty: 'B1', type: 'short_text', prompt: 'Speak', subskills: [],
    };

    // Answer with responseMode === 'typed_fallback'
    await engine.submitAnswer(q, 'I am typing this instead of speaking.', 5000, 'typed_fallback', {
      responseMode: 'typed_fallback', hasValidAudio: false
    });

    const outcome = engine.getOutcome();

    // 1. Audit trail should reflect the fallback
    expect(outcome.speakingAudit?.speakingTasksTotal).toBe(1);
    expect(outcome.speakingAudit?.hasAnySpeakingEvidence).toBe(false);
    expect(outcome.speakingAudit?.speakingFallbackApplied).toBe(true);
    expect(outcome.speakingAudit?.typedFallbacksUsed).toBe(1);

    // 2. The speaking skill should be set to A1 floor due to insufficient_data
    expect(outcome.skillBreakdown['speaking'].band).toBe('A1');
    expect(outcome.skillBreakdown['speaking'].status).toBe('insufficient_data');
    expect(outcome.skillBreakdown['speaking'].isCapped).toBe(false);
    expect(outcome.skillBreakdown['speaking'].speakingFallbackApplied).toBe(true);
    expect(outcome.skillBreakdown['speaking'].speakingFallbackReason).toContain('No spoken audio');
  });

  it('allows natural progression when speaking task uses valid voice evidence', async () => {
    const engine = new AdaptiveAssessmentEngine('B1');
    vi.mocked(groqEvaluator.evaluateWithGroq).mockResolvedValue(baseLLM());

    const q: AssessmentQuestion = {
      id: 'spk-02', primarySkill: 'speaking',
      evidenceWeights: { speaking: 1.0, grammar: 0.5 },
      difficulty: 'A2', type: 'short_text', prompt: 'Speak', subskills: [],
    };

    // Answer with responseMode === 'voice' AND hasValidAudio === true
    await engine.submitAnswer(q, 'Valid transcribed text', 5000, 'voice', {
      responseMode: 'voice', hasValidAudio: true, audioDurationSec: 5, micCheckPassed: true
    });

    const outcome = engine.getOutcome();

    // 1. Audit trail should be healthy
    expect(outcome.speakingAudit?.speakingTasksTotal).toBe(1);
    expect(outcome.speakingAudit?.hasAnySpeakingEvidence).toBe(true);
    expect(outcome.speakingAudit?.speakingFallbackApplied).toBe(false);
    expect(outcome.speakingAudit?.voiceRecordingsValid).toBe(1);

    // 2. The speaking skill should NOT be strictly floored to A1
    expect(outcome.skillBreakdown['speaking'].speakingFallbackApplied).toBe(false);
  });
});
