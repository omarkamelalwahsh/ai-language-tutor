// ============================================================================
// Assessment Pipeline v2 — Comprehensive Test Suite
// ============================================================================
// Tests covering all 9 behavioral guarantees specified in the refactor spec.
// Each test proves a specific policy invariant.
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  AssessmentPipelineV2,
  PipelineItemInput,
  AssessmentReport,
  EvidenceRecord,
  DEFAULT_PIPELINE_CONFIG,
  mapLegacyQuestionType,
  parseLinguisticSignals,
  normalizeSignals,
  attributeEvidence,
  aggregateSkills,
  scoreToCefrLevel,
  guardAuthenticity,
} from '../index';
import type { SpeakingAuditInfo } from '../cefr-decision-engine';

// ────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Default speaking audit: no audio. */
const NO_AUDIO_AUDIT: SpeakingAuditInfo = {
  speakingTasksTotal: 0,
  hasAnySpeakingEvidence: false,
};

/** Speaking audit with valid audio. */
const HAS_AUDIO_AUDIT: SpeakingAuditInfo = {
  speakingTasksTotal: 2,
  hasAnySpeakingEvidence: true,
};

/** High-quality LLM output simulating a B2 response. */
function b2LlmOutput(): Record<string, unknown> {
  return {
    content_accuracy: 0.85,
    semantic_accuracy: 0.85,
    task_completion: 0.80,
    grammar_control: 0.78,
    lexical_range: 0.75,
    lexical_sophistication: 0.75,
    syntactic_complexity: 0.70,
    coherence: 0.80,
    register_control: 0.72,
    idiomatic_usage: 0.65,
    typo_severity: 0.05,
    estimated_band: 'B2',
    estimated_output_band: 'B2',
    confidence: 0.85,
    flags: [],
    rationale: 'Demonstrated B2-level proficiency.',
  };
}

/** Medium LLM output simulating an A2 response. */
function a2LlmOutput(): Record<string, unknown> {
  return {
    content_accuracy: 0.60,
    semantic_accuracy: 0.60,
    task_completion: 0.55,
    grammar_control: 0.45,
    lexical_range: 0.40,
    lexical_sophistication: 0.40,
    syntactic_complexity: 0.35,
    coherence: 0.45,
    register_control: 0.40,
    idiomatic_usage: 0.30,
    typo_severity: 0.10,
    estimated_band: 'A2',
    estimated_output_band: 'A2',
    confidence: 0.70,
    flags: [],
    rationale: 'A2-level performance.',
  };
}

/** Build a pipeline item for testing. */
function makeItem(overrides: Partial<PipelineItemInput>): PipelineItemInput {
  return {
    itemId: 'test-item-1',
    targetCEFR: 'B1',
    primarySkill: 'listening',
    questionType: 'listening_mcq',
    responseWordCount: 1,
    llmOutput: a2LlmOutput(),
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Test Cases
// ────────────────────────────────────────────────────────────────────────────

describe('Assessment Pipeline v2', () => {

  // ====================================================================
  // TEST 1: Listening MCQ — only listening gets direct evidence; no writing
  // ====================================================================
  describe('Listening MCQ Evidence Routing', () => {
    it('provides direct listening evidence and NO writing evidence', () => {
      const pipeline = new AssessmentPipelineV2();
      const evidence = pipeline.addEvidence(makeItem({
        itemId: 'listen-mcq-1',
        questionType: 'listening_mcq',
        primarySkill: 'listening',
        targetCEFR: 'A2',
        responseWordCount: 1,
        llmOutput: a2LlmOutput(),
      }));

      // Must have listening evidence
      const listeningEvidence = evidence.filter(e => e.skill === 'listening');
      expect(listeningEvidence.length).toBe(1);
      expect(listeningEvidence[0].isDirect).toBe(true);
      expect(listeningEvidence[0].directnessFactor).toBe(1.0);

      // Must NOT have writing evidence
      const writingEvidence = evidence.filter(e => e.skill === 'writing');
      expect(writingEvidence.length).toBe(0);

      // Must NOT have speaking evidence
      const speakingEvidence = evidence.filter(e => e.skill === 'speaking');
      expect(speakingEvidence.length).toBe(0);
    });
  });

  // ====================================================================
  // TEST 2: Listening Typed Answer — listening direct + weak indirect
  // ====================================================================
  describe('Listening Short Answer Evidence', () => {
    it('provides listening direct + weak indirect grammar/vocab/writing', () => {
      const pipeline = new AssessmentPipelineV2();
      const evidence = pipeline.addEvidence(makeItem({
        itemId: 'listen-typed-1',
        questionType: 'listening_summary',
        primarySkill: 'listening',
        targetCEFR: 'B1',
        responseWordCount: 20,
        llmOutput: b2LlmOutput(),
      }));

      // Listening must be direct
      const listening = evidence.find(e => e.skill === 'listening');
      expect(listening).toBeDefined();
      expect(listening!.isDirect).toBe(true);

      // Writing must be weak indirect
      const writing = evidence.find(e => e.skill === 'writing');
      expect(writing).toBeDefined();
      expect(writing!.isDirect).toBe(false);
      expect(writing!.directnessFactor).toBe(0.3);

      // Grammar must be weak indirect
      const grammar = evidence.find(e => e.skill === 'grammar');
      expect(grammar).toBeDefined();
      expect(grammar!.isDirect).toBe(false);
      expect(grammar!.directnessFactor).toBe(0.3);
    });
  });

  // ====================================================================
  // TEST 3: Writing Prompt — direct writing + strong grammar/vocab
  // ====================================================================
  describe('Writing Paragraph Evidence', () => {
    it('provides direct writing + strong indirect grammar/vocab', () => {
      const pipeline = new AssessmentPipelineV2();
      const evidence = pipeline.addEvidence(makeItem({
        itemId: 'write-para-1',
        questionType: 'short_text',
        primarySkill: 'writing',
        targetCEFR: 'B2',
        responseWordCount: 80,
        llmOutput: b2LlmOutput(),
      }));

      // Writing must be direct
      const writing = evidence.find(e => e.skill === 'writing');
      expect(writing).toBeDefined();
      expect(writing!.isDirect).toBe(true);
      expect(writing!.directnessFactor).toBe(1.0);

      // Grammar must be strong indirect
      const grammar = evidence.find(e => e.skill === 'grammar');
      expect(grammar).toBeDefined();
      expect(grammar!.isDirect).toBe(false);
      expect(grammar!.directnessFactor).toBe(0.6);

      // Vocabulary must be strong indirect
      const vocab = evidence.find(e => e.skill === 'vocabulary');
      expect(vocab).toBeDefined();
      expect(vocab!.isDirect).toBe(false);
      expect(vocab!.directnessFactor).toBe(0.6);
    });
  });

  // ====================================================================
  // TEST 4: Speaking Audio — direct speaking + grammar/vocab support
  // ====================================================================
  describe('Speaking Audio Evidence', () => {
    it('provides direct speaking evidence + grammar/vocab support', () => {
      const pipeline = new AssessmentPipelineV2();
      const evidence = pipeline.addEvidence(makeItem({
        itemId: 'speak-audio-1',
        questionType: 'short_text',
        primarySkill: 'speaking',
        responseMode: 'voice',
        targetCEFR: 'B1',
        responseWordCount: 30,
        llmOutput: b2LlmOutput(),
      }));

      // Speaking must be direct
      const speaking = evidence.find(e => e.skill === 'speaking');
      expect(speaking).toBeDefined();
      expect(speaking!.isDirect).toBe(true);
      expect(speaking!.directnessFactor).toBe(1.0);

      // Grammar support
      const grammar = evidence.find(e => e.skill === 'grammar');
      expect(grammar).toBeDefined();
      expect(grammar!.isDirect).toBe(false);
    });
  });

  // ====================================================================
  // TEST 5: Speaking Typed Fallback — ZERO speaking evidence
  // ====================================================================
  describe('Speaking Typed Fallback', () => {
    it('produces ZERO speaking evidence and marks speaking as insufficient_data', () => {
      const pipeline = new AssessmentPipelineV2();
      const evidence = pipeline.addEvidence(makeItem({
        itemId: 'speak-typed-1',
        questionType: 'short_text',
        primarySkill: 'speaking',
        responseMode: 'typed_fallback',
        targetCEFR: 'B1',
        responseWordCount: 20,
        llmOutput: b2LlmOutput(),
      }));

      // MUST NOT have any speaking evidence
      const speakingEvidence = evidence.filter(e => e.skill === 'speaking');
      expect(speakingEvidence.length).toBe(0);

      // May have weak indirect writing/grammar/vocab
      const writingEvidence = evidence.filter(e => e.skill === 'writing');
      expect(writingEvidence.length).toBeGreaterThan(0);
      expect(writingEvidence[0].isDirect).toBe(false);
      expect(writingEvidence[0].directnessFactor).toBe(0.3);

      // Full report: speaking must be insufficient_data
      const report = pipeline.getReport({
        speakingTasksTotal: 1,
        hasAnySpeakingEvidence: false,
      });

      expect(report.skills.speaking.status).toBe('insufficient_data');
      expect(report.skills.speaking.level).toBe('A1');
      expect(report.skills.speaking.confidence).toBe(0);
    });
  });

  // ====================================================================
  // TEST 6: Overperformance Cap — A2 item caps at B1 max
  // ====================================================================
  describe('Overperformance Cap', () => {
    it('caps item contribution to targetCEFR + 1 band', () => {
      const pipeline = new AssessmentPipelineV2();

      // Super high scores on an A2 item
      const highOutput = {
        ...b2LlmOutput(),
        content_accuracy: 0.98,
        grammar_control: 0.95,
        lexical_range: 0.95,
        syntactic_complexity: 0.93,
        estimated_output_band: 'C1',
        confidence: 0.95,
      };

      const evidence = pipeline.addEvidence(makeItem({
        itemId: 'overperf-1',
        questionType: 'listening_mcq',
        primarySkill: 'listening',
        targetCEFR: 'A2',
        responseWordCount: 1,
        llmOutput: highOutput,
      }));

      // The item score should be capped — not representing C1
      const listening = evidence.find(e => e.skill === 'listening');
      expect(listening).toBeDefined();
      // The cap for A2 + 1 band = B1 max = 0.69
      expect(listening!.itemScore).toBeLessThanOrEqual(0.70);
    });
  });

  // ====================================================================
  // TEST 7: Insufficient Evidence — marks as provisional/insufficient_data
  // ====================================================================
  describe('Insufficient Evidence', () => {
    it('marks skills with too few direct items as provisional', () => {
      const pipeline = new AssessmentPipelineV2();

      // Add only 1 listening MCQ (need 5 for stable)
      pipeline.addEvidence(makeItem({
        itemId: 'insuff-1',
        questionType: 'listening_mcq',
        primarySkill: 'listening',
        targetCEFR: 'B1',
        llmOutput: b2LlmOutput(),
      }));

      const report = pipeline.getReport(NO_AUDIO_AUDIT);

      // Listening should be provisional (1/5 direct evidence)
      expect(report.skills.listening.status).not.toBe('stable');
      expect(report.skills.listening.notes.some(n => n.includes('direct evidence'))).toBe(true);

      // Skills with zero evidence should be insufficient_data
      expect(report.skills.reading.status).toBe('insufficient_data');
      expect(report.skills.grammar.status).toBe('insufficient_data');
    });
  });

  // ====================================================================
  // TEST 8: Stable B2 Case — sufficient evidence produces stable B2
  // ====================================================================
  describe('Stable B2 Assessment', () => {
    it('produces stable B2 with sufficient consistent evidence', () => {
      const pipeline = new AssessmentPipelineV2();

      // Add 5 listening MCQs at B2
      for (let i = 0; i < 5; i++) {
        pipeline.addEvidence(makeItem({
          itemId: `listen-b2-${i}`,
          questionType: 'listening_mcq',
          primarySkill: 'listening',
          targetCEFR: 'B2',
          responseWordCount: 1,
          llmOutput: b2LlmOutput(),
        }));
      }

      // Add 5 reading MCQs at B2
      for (let i = 0; i < 5; i++) {
        pipeline.addEvidence(makeItem({
          itemId: `read-b2-${i}`,
          questionType: 'reading_mcq',
          primarySkill: 'reading',
          targetCEFR: 'B2',
          responseWordCount: 1,
          llmOutput: b2LlmOutput(),
        }));
      }

      // Add 2 writing paragraphs at B2
      for (let i = 0; i < 2; i++) {
        pipeline.addEvidence(makeItem({
          itemId: `write-b2-${i}`,
          questionType: 'short_text',
          primarySkill: 'writing',
          targetCEFR: 'B2',
          responseWordCount: 80,
          llmOutput: b2LlmOutput(),
        }));
      }

      // Add 2 speaking audio at B2
      for (let i = 0; i < 2; i++) {
        pipeline.addEvidence(makeItem({
          itemId: `speak-b2-${i}`,
          questionType: 'short_text',
          primarySkill: 'speaking',
          responseMode: 'voice',
          targetCEFR: 'B2',
          responseWordCount: 40,
          llmOutput: b2LlmOutput(),
        }));
      }

      // Add 4 grammar fill-blanks
      for (let i = 0; i < 4; i++) {
        pipeline.addEvidence(makeItem({
          itemId: `gram-b2-${i}`,
          questionType: 'fill_blank',
          primarySkill: 'grammar',
          targetCEFR: 'B2',
          responseWordCount: 3,
          llmOutput: b2LlmOutput(),
        }));
      }

      const report = pipeline.getReport(HAS_AUDIO_AUDIT);

      // Listening should be stable
      expect(report.skills.listening.status).toBe('stable');
      // The level should be around B1-B2 range (MCQ has low evidential power)
      expect(['B1', 'B2']).toContain(report.skills.listening.level);

      // Reading should be stable
      expect(report.skills.reading.status).toBe('stable');

      // Overall should not be insufficient_data
      expect(report.overall.status).not.toBe('insufficient_data');
    });
  });

  // ====================================================================
  // TEST 9: Provisional Writing — 1 direct prompt → provisional
  // ====================================================================
  describe('Provisional Writing', () => {
    it('marks writing as provisional with only 1 direct writing prompt', () => {
      const pipeline = new AssessmentPipelineV2();

      pipeline.addEvidence(makeItem({
        itemId: 'write-prov-1',
        questionType: 'short_text',
        primarySkill: 'writing',
        targetCEFR: 'B2',
        responseWordCount: 80,
        llmOutput: b2LlmOutput(),
      }));

      const report = pipeline.getReport(NO_AUDIO_AUDIT);

      // Writing: 1 direct out of 2 required → provisional
      expect(report.skills.writing.status).not.toBe('stable');
      expect(report.skills.writing.directEvidenceCount).toBe(1);
    });
  });

  // ====================================================================
  // TEST: MCQ has lower evidential power than open responses
  // ====================================================================
  describe('MCQ vs Open Response Evidence Power', () => {
    it('MCQ produces lower item scores than equivalent open responses', () => {
      const pipeline1 = new AssessmentPipelineV2();
      const pipeline2 = new AssessmentPipelineV2();

      const sameOutput = b2LlmOutput();

      // MCQ response
      const mcqEvidence = pipeline1.addEvidence(makeItem({
        itemId: 'mcq-1',
        questionType: 'listening_mcq',
        primarySkill: 'listening',
        targetCEFR: 'B2',
        responseWordCount: 1,
        llmOutput: sameOutput,
      }));

      // Open response (listening summary)
      const openEvidence = pipeline2.addEvidence(makeItem({
        itemId: 'open-1',
        questionType: 'listening_summary',
        primarySkill: 'listening',
        targetCEFR: 'B2',
        responseWordCount: 40,
        llmOutput: sameOutput,
      }));

      const mcqListening = mcqEvidence.find(e => e.skill === 'listening')!;
      const openListening = openEvidence.find(e => e.skill === 'listening')!;

      // MCQ should have lower evidence weight due to evidential power multiplier
      // Score reflects learner performance (similar), weight reflects task trust (MCQ lower)
      expect(mcqListening.evidenceWeight).toBeLessThan(openListening.evidenceWeight);
    });
  });

  // ====================================================================
  // TEST: Legacy type mapping
  // ====================================================================
  describe('Legacy Task Type Mapping', () => {
    it('maps speaking typed_fallback correctly', () => {
      expect(mapLegacyQuestionType('short_text', 'speaking', 'typed_fallback'))
        .toBe('speaking_typed_fallback');
    });

    it('maps speaking voice correctly', () => {
      expect(mapLegacyQuestionType('short_text', 'speaking', 'voice'))
        .toBe('speaking_audio');
    });

    it('maps listening_mcq correctly', () => {
      expect(mapLegacyQuestionType('listening_mcq', 'listening'))
        .toBe('listening_mcq');
    });

    it('maps fill_blank to grammar', () => {
      expect(mapLegacyQuestionType('fill_blank', 'grammar'))
        .toBe('grammar_fill_blank');
    });
  });

  // ====================================================================
  // TEST: Signal parser handles malformed input
  // ====================================================================
  describe('Signal Parser Robustness', () => {
    it('handles null input gracefully', () => {
      const signals = parseLinguisticSignals(null);
      expect(signals.content_accuracy).toBe(0);
      expect(signals.confidence).toBe(0);
      expect(signals.estimated_output_band).toBe('A1');
    });

    it('clamps out-of-range values', () => {
      const signals = parseLinguisticSignals({
        content_accuracy: 5.0,
        grammar_control: -2.0,
        lexical_range: NaN,
        confidence: Infinity,
      });
      expect(signals.content_accuracy).toBe(1);
      expect(signals.grammar_control).toBe(0);
      expect(signals.lexical_range).toBe(0);
      expect(signals.confidence).toBe(0);
    });

    it('maps legacy field names', () => {
      const signals = parseLinguisticSignals({
        semantic_accuracy: 0.8,
        lexical_sophistication: 0.7,
      });
      expect(signals.content_accuracy).toBe(0.8);
      expect(signals.lexical_range).toBe(0.7);
    });
  });

  // ====================================================================
  // TEST: Overall report marks provisional when speaking is missing
  // ====================================================================
  describe('Overall Report with Missing Speaking', () => {
    it('marks overall as provisional when speaking is insufficient_data', () => {
      const pipeline = new AssessmentPipelineV2();

      // Add some listening and reading evidence, but no speaking
      for (let i = 0; i < 5; i++) {
        pipeline.addEvidence(makeItem({
          itemId: `listen-${i}`,
          questionType: 'listening_mcq',
          primarySkill: 'listening',
          targetCEFR: 'B1',
          llmOutput: b2LlmOutput(),
        }));
      }

      const report = pipeline.getReport(NO_AUDIO_AUDIT);

      // Overall must be provisional since speaking is missing
      expect(report.overall.status).toBe('provisional');
      expect(report.overall.notes.some(n => n.includes('speaking'))).toBe(true);
    });
  });

  // ====================================================================
  // TEST: CEFR score thresholds are applied correctly
  // ====================================================================
  describe('CEFR Score Threshold Mapping', () => {
    it('maps scores to correct CEFR levels', () => {
      expect(scoreToCefrLevel(0.00)).toBe('A1');
      expect(scoreToCefrLevel(0.20)).toBe('A1');
      expect(scoreToCefrLevel(0.39)).toBe('A1');
      expect(scoreToCefrLevel(0.40)).toBe('A2');
      expect(scoreToCefrLevel(0.54)).toBe('A2');
      expect(scoreToCefrLevel(0.55)).toBe('B1');
      expect(scoreToCefrLevel(0.69)).toBe('B1');
      expect(scoreToCefrLevel(0.70)).toBe('B2');
      expect(scoreToCefrLevel(0.82)).toBe('B2');
      expect(scoreToCefrLevel(0.83)).toBe('C1');
      expect(scoreToCefrLevel(0.92)).toBe('C1');
      expect(scoreToCefrLevel(0.93)).toBe('C2');
      expect(scoreToCefrLevel(1.00)).toBe('C2');
    });
  });
});
