// ============================================================================
// Assessment Pipeline v2 — Orchestrator
// ============================================================================
// Connects all 9 layers into a single, callable pipeline.
//
// Usage:
//   const pipeline = new AssessmentPipelineV2();
//   pipeline.addEvidence(itemDef, rawLlmOutput, responseWordCount);
//   pipeline.addEvidence(itemDef2, rawLlmOutput2, responseWordCount2);
//   const report = pipeline.getReport(speakingAudit);
//
// The pipeline accumulates evidence across multiple items, then produces
// a final report on demand. It is stateful (holds evidence records) but
// all scoring/decision logic is pure and deterministic.
// ============================================================================

import {
  EvidenceRecord,
  AssessmentReport,
  SkillName,
  CEFRLevel,
  TaskType,
  ResponseMode,
  LinguisticSignals,
  PipelineConfig,
  DEFAULT_PIPELINE_CONFIG,
  ALL_SKILLS,
} from './types';
import { parseLinguisticSignals, buildSignalsFromHeuristics, createDefaultSignals } from './signal-parser';
import { normalizeSignals, computeItemScore } from './signal-normalizer';
import { attributeEvidence, AttributionInput } from './evidence-attribution';
import { guardAuthenticity, AuthenticityResult } from './authenticity-guard';
import { aggregateSkills } from './skill-aggregator';
import { makeDecisions, SpeakingAuditInfo } from './cefr-decision-engine';
import { applyConfidence } from './confidence-engine';
import { buildReport } from './final-report';
import { mapLegacyQuestionType } from './item-policy';

/**
 * Input to add a single item's evidence to the pipeline.
 */
export interface PipelineItemInput {
  /** Unique item ID. */
  readonly itemId: string;
  /** The item's target CEFR level. */
  readonly targetCEFR: CEFRLevel;
  /** Primary skill this item targets. */
  readonly primarySkill: SkillName;
  /** Legacy question type (will be mapped to TaskType). */
  readonly questionType: string;
  /** How the learner responded (for speaking: 'voice' or 'typed_fallback'). */
  readonly responseMode?: string;
  /** Word count of the learner's response. */
  readonly responseWordCount: number;
  /** Raw LLM evaluation output (may be null if LLM unavailable). */
  readonly llmOutput: Record<string, unknown> | null;
  /** Local heuristic features (fallback when no LLM). */
  readonly heuristicFeatures?: {
    correctness?: number;
    lexicalDiversity?: number;
    sentenceComplexity?: number;
    connectorUsage?: number;
    wordCount?: number;
  };
}

/**
 * The main assessment pipeline. Accumulates evidence from multiple items
 * and produces a final report through all 9 layers.
 */
export class AssessmentPipelineV2 {
  private readonly config: PipelineConfig;
  private evidenceRecords: EvidenceRecord[] = [];
  private authenticityFlags: string[] = [];
  private authenticityNotes: string[] = [];

  constructor(config: PipelineConfig = DEFAULT_PIPELINE_CONFIG) {
    this.config = config;
  }

  /**
   * Add evidence from a single assessment item.
   * Runs Layers 1-4 + Layer 8 (authenticity guard) immediately.
   *
   * @param input - Item input with LLM and/or heuristic data
   * @returns The evidence records produced for this item
   */
  public addEvidence(input: PipelineItemInput): readonly EvidenceRecord[] {
    // ── Layer 1: Resolve task type from legacy question type ──────────
    const taskType = mapLegacyQuestionType(
      input.questionType,
      input.primarySkill,
      input.responseMode,
    );

    // Determine the response mode for the pipeline
    const responseMode = this.resolveResponseMode(taskType, input.responseMode);

    // ── Layer 2: Parse signals ────────────────────────────────────────
    let signals: LinguisticSignals;
    if (input.llmOutput) {
      signals = parseLinguisticSignals(input.llmOutput);
    } else if (input.heuristicFeatures) {
      signals = buildSignalsFromHeuristics(input.heuristicFeatures);
    } else {
      signals = createDefaultSignals();
    }

    // ── Layer 3: Normalize signals ────────────────────────────────────
    const normalized = normalizeSignals(
      signals,
      taskType,
      input.responseWordCount,
    );

    // ── Layer 4: Attribute evidence ───────────────────────────────────
    const attribInput: AttributionInput = {
      itemId: input.itemId,
      taskType,
      targetCEFR: input.targetCEFR,
      responseMode,
      normalized,
      responseWordCount: input.responseWordCount,
    };

    const rawEvidence = attributeEvidence(attribInput);

    // ── Layer 8: Authenticity guard (applied per-item) ────────────────
    const guardResult = guardAuthenticity(rawEvidence, this.config);
    this.authenticityFlags.push(...guardResult.flags);
    this.authenticityNotes.push(...guardResult.notes);

    // Store the cleaned evidence
    this.evidenceRecords.push(...guardResult.evidence);

    return guardResult.evidence;
  }

  /**
   * Produce the final assessment report.
   * Runs Layers 5-7 + Layer 9.
   *
   * @param speakingAudit - Speaking audit information
   * @returns The complete AssessmentReport
   */
  public getReport(speakingAudit: SpeakingAuditInfo): AssessmentReport {
    // ── Layer 5: Aggregate skills ─────────────────────────────────────
    const aggregations = aggregateSkills(this.evidenceRecords, this.config);

    // ── Layer 6: Make CEFR decisions ──────────────────────────────────
    const rawDecisions = makeDecisions(aggregations, speakingAudit, this.config);

    // ── Layer 7: Apply confidence ─────────────────────────────────────
    const decisions = applyConfidence(rawDecisions, this.config);

    // ── Layer 9: Build final report ───────────────────────────────────
    const report = buildReport(decisions);

    // Append authenticity notes to overall notes
    if (this.authenticityFlags.length > 0) {
      const updatedNotes = [
        ...report.overall.notes,
        ...this.authenticityNotes.slice(0, 5), // Cap at 5 notes to avoid noise
      ];
      return {
        ...report,
        overall: { ...report.overall, notes: updatedNotes },
      };
    }

    return report;
  }

  /**
   * Get all accumulated evidence records (for debugging/tracing).
   */
  public getEvidenceRecords(): readonly EvidenceRecord[] {
    return [...this.evidenceRecords];
  }

  /**
   * Get authenticity flags raised across all items.
   */
  public getAuthenticityFlags(): readonly string[] {
    return [...new Set(this.authenticityFlags)];
  }

  /**
   * Reset the pipeline (clear all accumulated evidence).
   */
  public reset(): void {
    this.evidenceRecords = [];
    this.authenticityFlags = [];
    this.authenticityNotes = [];
  }

  /**
   * Get current evidence counts per skill (for progress tracking).
   */
  public getEvidenceCounts(): Record<SkillName, { direct: number; indirect: number; total: number }> {
    const counts = {} as Record<SkillName, { direct: number; indirect: number; total: number }>;
    for (const skill of ALL_SKILLS) {
      const skillEvidence = this.evidenceRecords.filter(e => e.skill === skill);
      counts[skill] = {
        direct: skillEvidence.filter(e => e.isDirect).length,
        indirect: skillEvidence.filter(e => !e.isDirect).length,
        total: skillEvidence.length,
      };
    }
    return counts;
  }

  /**
   * Resolve the canonical response mode from task type and user-provided mode.
   */
  private resolveResponseMode(taskType: TaskType, userMode?: string): ResponseMode {
    if (taskType.includes('mcq') || taskType === 'vocab_mcq') return 'mcq';
    if (taskType === 'speaking_audio') return 'audio';
    if (userMode === 'voice') return 'audio';
    return 'typed';
  }
}
