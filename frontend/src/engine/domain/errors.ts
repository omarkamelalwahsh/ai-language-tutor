// ============================================================================
// Error Taxonomy
// ============================================================================
// Structured error codes with deterministic attribution rules.
// Each error maps to specific subskills with severity weights.
// This taxonomy is extensible — add new codes as the system grows.
// ============================================================================

import { SubskillId, SkillId } from './types';

/**
 * All recognized error codes in the system.
 * Naming convention: CATEGORY_SPECIFIC_ERROR
 */
export type ErrorCode =
  // Grammar errors
  | 'grammar_tense_error'
  | 'grammar_sv_agreement'
  | 'grammar_article_error'
  | 'grammar_preposition_error'
  | 'grammar_word_order'
  | 'grammar_modal_misuse'
  | 'grammar_conditional_error'
  | 'grammar_relative_clause_error'
  | 'grammar_passive_error'
  | 'grammar_pronoun_error'
  // Spelling & mechanics
  | 'spelling_error'
  | 'punctuation_error'
  | 'capitalization_error'
  // Vocabulary errors
  | 'vocabulary_wrong_word'
  | 'vocabulary_limited_range'
  | 'vocabulary_collocation_error'
  | 'vocabulary_false_friend'
  | 'vocabulary_register_mismatch'
  // Listening errors
  | 'listening_missed_detail'
  | 'listening_wrong_inference'
  | 'listening_phoneme_confusion'
  | 'listening_boundary_error'     // mis-segmenting word boundaries
  // Speaking errors
  | 'speaking_pronunciation'
  | 'speaking_hesitation_fluency'
  | 'speaking_intonation'
  | 'speaking_filler_overuse'
  // Discourse errors
  | 'discourse_coherence_gap'
  | 'discourse_no_connectors'
  | 'discourse_paragraph_structure'
  // Task-level errors
  | 'task_misunderstanding'
  | 'task_incomplete'
  | 'task_off_topic';

/**
 * All error codes as an iterable array.
 */
export const ALL_ERROR_CODES: readonly ErrorCode[] = [
  'grammar_tense_error', 'grammar_sv_agreement', 'grammar_article_error',
  'grammar_preposition_error', 'grammar_word_order', 'grammar_modal_misuse',
  'grammar_conditional_error', 'grammar_relative_clause_error',
  'grammar_passive_error', 'grammar_pronoun_error',
  'spelling_error', 'punctuation_error', 'capitalization_error',
  'vocabulary_wrong_word', 'vocabulary_limited_range', 'vocabulary_collocation_error',
  'vocabulary_false_friend', 'vocabulary_register_mismatch',
  'listening_missed_detail', 'listening_wrong_inference',
  'listening_phoneme_confusion', 'listening_boundary_error',
  'speaking_pronunciation', 'speaking_hesitation_fluency',
  'speaking_intonation', 'speaking_filler_overuse',
  'discourse_coherence_gap', 'discourse_no_connectors', 'discourse_paragraph_structure',
  'task_misunderstanding', 'task_incomplete', 'task_off_topic',
] as const;

// ─── Attribution Rules ──────────────────────────────────────────────────────

/**
 * Defines how an error impacts subskills and skills.
 * This is the core of deterministic error attribution.
 */
export interface ErrorAttributionRule {
  readonly errorCode: ErrorCode;

  /** Human-readable label. */
  readonly label: string;

  /** Category for grouping. */
  readonly category: 'grammar' | 'spelling' | 'vocabulary' | 'listening' | 'speaking' | 'discourse' | 'task';

  /** Example of this error. */
  readonly example: {
    readonly incorrect: string;
    readonly correct: string;
    readonly explanation: string;
  };

  /**
   * Subskills DIRECTLY affected by this error.
   * Each entry has a weight (0–1) expressing how strongly this error
   * impacts that subskill. 1.0 = this error is a primary indicator.
   */
  readonly directImpact: readonly {
    readonly subskillId: SubskillId;
    readonly weight: number;
  }[];

  /**
   * Skills INDIRECTLY affected.
   * These get a reduced impact through the subskill→skill propagation,
   * but we track them here for diagnostic clarity.
   */
  readonly indirectSkills: readonly SkillId[];

  /**
   * Base severity weight (0–1).
   * This is further modulated by the learner's current level.
   * For example, article errors are low severity at A1, high at B2.
   */
  readonly baseSeverity: number;

  /**
   * Level-dependent severity multipliers.
   * If the learner is at level X, multiply baseSeverity by the multiplier.
   * Missing levels use baseSeverity unchanged.
   */
  readonly severityByLevel: Partial<Record<import('./cefr').CEFRLevel, number>>;
}

/**
 * The complete error attribution registry.
 * Every error code maps to deterministic attribution rules.
 */
export const ERROR_ATTRIBUTION_REGISTRY: Record<ErrorCode, ErrorAttributionRule> = {

  // ── Grammar Errors ──────────────────────────────────────────────────────

  grammar_tense_error: {
    errorCode: 'grammar_tense_error',
    label: 'Verb Tense Error',
    category: 'grammar',
    example: {
      incorrect: 'She go to school yesterday.',
      correct: 'She went to school yesterday.',
      explanation: 'Past tense required for completed past action.',
    },
    directImpact: [
      { subskillId: 'shared.grammar_control', weight: 0.9 },
      { subskillId: 'shared.verb_system', weight: 1.0 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.6,
    severityByLevel: { A1: 0.3, A2: 0.5, B1: 0.7, B2: 0.9, C1: 1.0, C2: 1.0 },
  },

  grammar_sv_agreement: {
    errorCode: 'grammar_sv_agreement',
    label: 'Subject-Verb Agreement Error',
    category: 'grammar',
    example: {
      incorrect: 'She go to school every day.',
      correct: 'She goes to school every day.',
      explanation: 'Third person singular present requires -s ending.',
    },
    directImpact: [
      { subskillId: 'shared.grammar_control', weight: 0.8 },
      { subskillId: 'shared.verb_system', weight: 0.7 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.5,
    severityByLevel: { A1: 0.3, A2: 0.6, B1: 0.8, B2: 1.0, C1: 1.0, C2: 1.0 },
  },

  grammar_article_error: {
    errorCode: 'grammar_article_error',
    label: 'Article Error',
    category: 'grammar',
    example: {
      incorrect: 'I saw movie yesterday.',
      correct: 'I saw a movie yesterday.',
      explanation: 'Indefinite article needed for first mention of a countable noun.',
    },
    directImpact: [
      { subskillId: 'shared.grammar_control', weight: 0.5 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.3,
    severityByLevel: { A1: 0.1, A2: 0.3, B1: 0.5, B2: 0.7, C1: 0.9, C2: 1.0 },
  },

  grammar_preposition_error: {
    errorCode: 'grammar_preposition_error',
    label: 'Preposition Error',
    category: 'grammar',
    example: {
      incorrect: 'She arrived to school.',
      correct: 'She arrived at school.',
      explanation: 'Arrive takes preposition "at" for locations.',
    },
    directImpact: [
      { subskillId: 'shared.grammar_control', weight: 0.5 },
      { subskillId: 'shared.vocabulary_range', weight: 0.3 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.4,
    severityByLevel: { A1: 0.2, A2: 0.4, B1: 0.6, B2: 0.8, C1: 0.9, C2: 1.0 },
  },

  grammar_word_order: {
    errorCode: 'grammar_word_order',
    label: 'Word Order Error',
    category: 'grammar',
    example: {
      incorrect: 'Always she goes to school.',
      correct: 'She always goes to school.',
      explanation: 'Adverb of frequency placed between subject and verb in English.',
    },
    directImpact: [
      { subskillId: 'shared.grammar_control', weight: 0.7 },
      { subskillId: 'shared.discourse_coherence', weight: 0.3 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.5,
    severityByLevel: { A1: 0.3, A2: 0.5, B1: 0.7, B2: 0.9, C1: 1.0, C2: 1.0 },
  },

  grammar_modal_misuse: {
    errorCode: 'grammar_modal_misuse',
    label: 'Modal Verb Misuse',
    category: 'grammar',
    example: {
      incorrect: 'She can to go now.',
      correct: 'She can go now.',
      explanation: 'Modal verbs are followed by bare infinitive (no "to").',
    },
    directImpact: [
      { subskillId: 'shared.grammar_control', weight: 0.7 },
      { subskillId: 'shared.verb_system', weight: 0.6 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.5,
    severityByLevel: { A1: 0.2, A2: 0.4, B1: 0.7, B2: 0.9, C1: 1.0, C2: 1.0 },
  },

  grammar_conditional_error: {
    errorCode: 'grammar_conditional_error',
    label: 'Conditional Structure Error',
    category: 'grammar',
    example: {
      incorrect: 'If I will go, I tell you.',
      correct: 'If I go, I will tell you.',
      explanation: 'First conditional: if + present simple, will + base verb.',
    },
    directImpact: [
      { subskillId: 'shared.grammar_control', weight: 0.8 },
      { subskillId: 'shared.verb_system', weight: 0.7 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.6,
    severityByLevel: { A1: 0.1, A2: 0.3, B1: 0.7, B2: 0.9, C1: 1.0, C2: 1.0 },
  },

  grammar_relative_clause_error: {
    errorCode: 'grammar_relative_clause_error',
    label: 'Relative Clause Error',
    category: 'grammar',
    example: {
      incorrect: 'The man which I saw.',
      correct: 'The man whom I saw.',
      explanation: 'Use "whom" for object relative pronouns referring to people.',
    },
    directImpact: [
      { subskillId: 'shared.grammar_control', weight: 0.6 },
      { subskillId: 'shared.discourse_coherence', weight: 0.4 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.5,
    severityByLevel: { A1: 0.1, A2: 0.2, B1: 0.5, B2: 0.8, C1: 1.0, C2: 1.0 },
  },

  grammar_passive_error: {
    errorCode: 'grammar_passive_error',
    label: 'Passive Voice Error',
    category: 'grammar',
    example: {
      incorrect: 'The cake was eat.',
      correct: 'The cake was eaten.',
      explanation: 'Passive requires past participle.',
    },
    directImpact: [
      { subskillId: 'shared.grammar_control', weight: 0.7 },
      { subskillId: 'shared.verb_system', weight: 0.8 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.5,
    severityByLevel: { A1: 0.1, A2: 0.3, B1: 0.6, B2: 0.8, C1: 1.0, C2: 1.0 },
  },

  grammar_pronoun_error: {
    errorCode: 'grammar_pronoun_error',
    label: 'Pronoun Error',
    category: 'grammar',
    example: {
      incorrect: 'Her goes to school.',
      correct: 'She goes to school.',
      explanation: 'Subject pronoun required in subject position.',
    },
    directImpact: [
      { subskillId: 'shared.grammar_control', weight: 0.6 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.4,
    severityByLevel: { A1: 0.3, A2: 0.5, B1: 0.7, B2: 0.9, C1: 1.0, C2: 1.0 },
  },

  // ── Spelling & Mechanics ────────────────────────────────────────────────

  spelling_error: {
    errorCode: 'spelling_error',
    label: 'Spelling Error',
    category: 'spelling',
    example: {
      incorrect: 'She goes to scool.',
      correct: 'She goes to school.',
      explanation: 'Misspelling of common word.',
    },
    directImpact: [
      { subskillId: 'writing.spelling', weight: 1.0 },
      { subskillId: 'shared.vocabulary_range', weight: 0.2 },
    ],
    indirectSkills: ['writing'],
    baseSeverity: 0.4,
    severityByLevel: { A1: 0.2, A2: 0.4, B1: 0.6, B2: 0.8, C1: 0.9, C2: 1.0 },
  },

  punctuation_error: {
    errorCode: 'punctuation_error',
    label: 'Punctuation Error',
    category: 'spelling',
    example: {
      incorrect: 'She goes to school everyday',
      correct: 'She goes to school every day.',
      explanation: 'Missing period at end of sentence.',
    },
    directImpact: [
      { subskillId: 'writing.mechanics', weight: 0.8 },
    ],
    indirectSkills: ['writing'],
    baseSeverity: 0.2,
    severityByLevel: { A1: 0.1, A2: 0.2, B1: 0.4, B2: 0.6, C1: 0.8, C2: 1.0 },
  },

  capitalization_error: {
    errorCode: 'capitalization_error',
    label: 'Capitalization Error',
    category: 'spelling',
    example: {
      incorrect: 'she goes to school.',
      correct: 'She goes to school.',
      explanation: 'Sentence must begin with a capital letter.',
    },
    directImpact: [
      { subskillId: 'writing.mechanics', weight: 0.5 },
    ],
    indirectSkills: ['writing'],
    baseSeverity: 0.1,
    severityByLevel: { A1: 0.1, A2: 0.2, B1: 0.3, B2: 0.5, C1: 0.7, C2: 1.0 },
  },

  // ── Vocabulary Errors ───────────────────────────────────────────────────

  vocabulary_wrong_word: {
    errorCode: 'vocabulary_wrong_word',
    label: 'Wrong Word Choice',
    category: 'vocabulary',
    example: {
      incorrect: 'She does to school.',
      correct: 'She goes to school.',
      explanation: 'Incorrect verb choice; "does" is not the correct main verb here.',
    },
    directImpact: [
      { subskillId: 'shared.vocabulary_range', weight: 0.8 },
      { subskillId: 'shared.vocabulary_precision', weight: 1.0 },
    ],
    indirectSkills: ['writing', 'speaking', 'reading'],
    baseSeverity: 0.6,
    severityByLevel: { A1: 0.3, A2: 0.5, B1: 0.7, B2: 0.8, C1: 0.9, C2: 1.0 },
  },

  vocabulary_limited_range: {
    errorCode: 'vocabulary_limited_range',
    label: 'Limited Vocabulary Range',
    category: 'vocabulary',
    example: {
      incorrect: 'The thing is good. The other thing is good too.',
      correct: 'The presentation was excellent. The content was also compelling.',
      explanation: 'Repetitive, vague word choices indicate limited vocabulary.',
    },
    directImpact: [
      { subskillId: 'shared.vocabulary_range', weight: 1.0 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.5,
    severityByLevel: { A1: 0.2, A2: 0.4, B1: 0.6, B2: 0.8, C1: 1.0, C2: 1.0 },
  },

  vocabulary_collocation_error: {
    errorCode: 'vocabulary_collocation_error',
    label: 'Collocation Error',
    category: 'vocabulary',
    example: {
      incorrect: 'She made her homework.',
      correct: 'She did her homework.',
      explanation: '"Do homework" is the standard collocation in English.',
    },
    directImpact: [
      { subskillId: 'shared.vocabulary_precision', weight: 0.9 },
      { subskillId: 'shared.vocabulary_range', weight: 0.4 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.4,
    severityByLevel: { A1: 0.1, A2: 0.3, B1: 0.6, B2: 0.8, C1: 0.9, C2: 1.0 },
  },

  vocabulary_false_friend: {
    errorCode: 'vocabulary_false_friend',
    label: 'False Friend',
    category: 'vocabulary',
    example: {
      incorrect: 'I am actually tired. (meaning: currently)',
      correct: 'I am currently tired.',
      explanation: '"Actually" means "in fact" in English, not "currently".',
    },
    directImpact: [
      { subskillId: 'shared.vocabulary_precision', weight: 0.8 },
    ],
    indirectSkills: ['writing', 'speaking', 'reading'],
    baseSeverity: 0.4,
    severityByLevel: { A1: 0.2, A2: 0.4, B1: 0.6, B2: 0.7, C1: 0.8, C2: 0.9 },
  },

  vocabulary_register_mismatch: {
    errorCode: 'vocabulary_register_mismatch',
    label: 'Register Mismatch',
    category: 'vocabulary',
    example: {
      incorrect: 'Dear Sir, gonna need those reports ASAP.',
      correct: 'Dear Sir, I require the reports at your earliest convenience.',
      explanation: 'Informal language used in a formal context.',
    },
    directImpact: [
      { subskillId: 'shared.vocabulary_precision', weight: 0.6 },
      { subskillId: 'writing.register_control', weight: 0.9 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.4,
    severityByLevel: { A1: 0.1, A2: 0.2, B1: 0.4, B2: 0.7, C1: 0.9, C2: 1.0 },
  },

  // ── Listening Errors ────────────────────────────────────────────────────

  listening_missed_detail: {
    errorCode: 'listening_missed_detail',
    label: 'Missed Detail in Audio',
    category: 'listening',
    example: {
      incorrect: 'She goes to school.',
      correct: 'She goes to school every day.',
      explanation: 'Learner missed the frequency adverb "every day".',
    },
    directImpact: [
      { subskillId: 'listening.detail_extraction', weight: 1.0 },
      { subskillId: 'listening.gist_comprehension', weight: 0.3 },
    ],
    indirectSkills: ['listening'],
    baseSeverity: 0.5,
    severityByLevel: { A1: 0.3, A2: 0.5, B1: 0.7, B2: 0.8, C1: 0.9, C2: 1.0 },
  },

  listening_wrong_inference: {
    errorCode: 'listening_wrong_inference',
    label: 'Incorrect Inference from Audio',
    category: 'listening',
    example: {
      incorrect: 'She said she hates school.',
      correct: 'She said she goes to school every day. (no opinion expressed)',
      explanation: 'Learner inferred meaning not present in the audio.',
    },
    directImpact: [
      { subskillId: 'listening.inferential_comprehension', weight: 1.0 },
      { subskillId: 'listening.gist_comprehension', weight: 0.5 },
    ],
    indirectSkills: ['listening', 'reading'],
    baseSeverity: 0.6,
    severityByLevel: { A1: 0.2, A2: 0.4, B1: 0.6, B2: 0.8, C1: 0.9, C2: 1.0 },
  },

  listening_phoneme_confusion: {
    errorCode: 'listening_phoneme_confusion',
    label: 'Phoneme Confusion',
    category: 'listening',
    example: {
      incorrect: 'She goes to "shool".',
      correct: 'She goes to school.',
      explanation: 'Learner confused /sk/ with /sh/ sounds.',
    },
    directImpact: [
      { subskillId: 'listening.phonemic_discrimination', weight: 1.0 },
    ],
    indirectSkills: ['listening'],
    baseSeverity: 0.5,
    severityByLevel: { A1: 0.3, A2: 0.5, B1: 0.7, B2: 0.8, C1: 0.9, C2: 1.0 },
  },

  listening_boundary_error: {
    errorCode: 'listening_boundary_error',
    label: 'Word Boundary Error',
    category: 'listening',
    example: {
      incorrect: 'She goes two school.',
      correct: 'She goes to school.',
      explanation: 'Learner incorrectly segmented "to" as "two".',
    },
    directImpact: [
      { subskillId: 'listening.phonemic_discrimination', weight: 0.7 },
      { subskillId: 'listening.detail_extraction', weight: 0.5 },
    ],
    indirectSkills: ['listening'],
    baseSeverity: 0.4,
    severityByLevel: { A1: 0.3, A2: 0.5, B1: 0.6, B2: 0.7, C1: 0.8, C2: 0.9 },
  },

  // ── Speaking Errors ─────────────────────────────────────────────────────

  speaking_pronunciation: {
    errorCode: 'speaking_pronunciation',
    label: 'Pronunciation Issue',
    category: 'speaking',
    example: {
      incorrect: '/ʃiː goʊz tuː skoʊl/ with heavy L1 accent',
      correct: 'Clear, intelligible pronunciation',
      explanation: 'Pronunciation makes meaning unclear.',
    },
    directImpact: [
      { subskillId: 'speaking.pronunciation_clarity', weight: 1.0 },
    ],
    indirectSkills: ['speaking'],
    baseSeverity: 0.5,
    severityByLevel: { A1: 0.2, A2: 0.4, B1: 0.6, B2: 0.8, C1: 0.9, C2: 1.0 },
  },

  speaking_hesitation_fluency: {
    errorCode: 'speaking_hesitation_fluency',
    label: 'Hesitation / Fluency Issue',
    category: 'speaking',
    example: {
      incorrect: 'She... um... goes... to... uh... school.',
      correct: 'She goes to school every day.',
      explanation: 'Excessive pauses and fillers disrupt flow.',
    },
    directImpact: [
      { subskillId: 'speaking.fluency', weight: 1.0 },
    ],
    indirectSkills: ['speaking'],
    baseSeverity: 0.4,
    severityByLevel: { A1: 0.2, A2: 0.3, B1: 0.5, B2: 0.7, C1: 0.9, C2: 1.0 },
  },

  speaking_intonation: {
    errorCode: 'speaking_intonation',
    label: 'Intonation Issue',
    category: 'speaking',
    example: {
      incorrect: 'Flat monotone delivery throughout.',
      correct: 'Natural rising/falling intonation patterns.',
      explanation: 'Lack of prosodic variation affects naturalness.',
    },
    directImpact: [
      { subskillId: 'speaking.pronunciation_clarity', weight: 0.5 },
      { subskillId: 'speaking.fluency', weight: 0.4 },
    ],
    indirectSkills: ['speaking'],
    baseSeverity: 0.3,
    severityByLevel: { A1: 0.1, A2: 0.2, B1: 0.4, B2: 0.6, C1: 0.8, C2: 1.0 },
  },

  speaking_filler_overuse: {
    errorCode: 'speaking_filler_overuse',
    label: 'Filler Word Overuse',
    category: 'speaking',
    example: {
      incorrect: 'Like, you know, she like goes to school and like...',
      correct: 'She goes to school every day.',
      explanation: 'Overuse of filler words indicates processing difficulty.',
    },
    directImpact: [
      { subskillId: 'speaking.fluency', weight: 0.7 },
      { subskillId: 'shared.vocabulary_range', weight: 0.2 },
    ],
    indirectSkills: ['speaking'],
    baseSeverity: 0.3,
    severityByLevel: { A1: 0.1, A2: 0.2, B1: 0.4, B2: 0.6, C1: 0.8, C2: 1.0 },
  },

  // ── Discourse Errors ────────────────────────────────────────────────────

  discourse_coherence_gap: {
    errorCode: 'discourse_coherence_gap',
    label: 'Coherence Gap',
    category: 'discourse',
    example: {
      incorrect: 'She goes to school. I like cats.',
      correct: 'She goes to school every day. After school, she studies at the library.',
      explanation: 'Ideas are disconnected without logical flow.',
    },
    directImpact: [
      { subskillId: 'shared.discourse_coherence', weight: 1.0 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.5,
    severityByLevel: { A1: 0.2, A2: 0.3, B1: 0.6, B2: 0.8, C1: 0.9, C2: 1.0 },
  },

  discourse_no_connectors: {
    errorCode: 'discourse_no_connectors',
    label: 'Missing Discourse Connectors',
    category: 'discourse',
    example: {
      incorrect: 'It rained. We stayed home.',
      correct: 'It rained, so we stayed home.',
      explanation: 'No linking words used to connect related ideas.',
    },
    directImpact: [
      { subskillId: 'shared.discourse_coherence', weight: 0.8 },
      { subskillId: 'shared.grammar_control', weight: 0.2 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.4,
    severityByLevel: { A1: 0.1, A2: 0.3, B1: 0.6, B2: 0.8, C1: 0.9, C2: 1.0 },
  },

  discourse_paragraph_structure: {
    errorCode: 'discourse_paragraph_structure',
    label: 'Poor Paragraph Structure',
    category: 'discourse',
    example: {
      incorrect: 'Long block of text with no paragraphs or topic sentences.',
      correct: 'Organized into paragraphs with clear topic sentences.',
      explanation: 'Written text lacks structural organization.',
    },
    directImpact: [
      { subskillId: 'shared.discourse_coherence', weight: 0.7 },
      { subskillId: 'writing.text_organization', weight: 1.0 },
    ],
    indirectSkills: ['writing'],
    baseSeverity: 0.4,
    severityByLevel: { A1: 0.1, A2: 0.2, B1: 0.4, B2: 0.7, C1: 0.9, C2: 1.0 },
  },

  // ── Task-Level Errors ───────────────────────────────────────────────────

  task_misunderstanding: {
    errorCode: 'task_misunderstanding',
    label: 'Task Misunderstanding',
    category: 'task',
    example: {
      incorrect: 'Asked to write a summary but wrote an opinion piece.',
      correct: 'Summary of the provided text.',
      explanation: 'Learner did not understand the task instructions.',
    },
    directImpact: [
      { subskillId: 'shared.task_completion', weight: 1.0 },
      { subskillId: 'reading.instruction_comprehension', weight: 0.6 },
    ],
    indirectSkills: ['reading', 'listening'],
    baseSeverity: 0.7,
    severityByLevel: { A1: 0.5, A2: 0.6, B1: 0.7, B2: 0.8, C1: 0.9, C2: 1.0 },
  },

  task_incomplete: {
    errorCode: 'task_incomplete',
    label: 'Incomplete Task',
    category: 'task',
    example: {
      incorrect: 'Wrote 2 words when 2 sentences were required.',
      correct: 'Full response addressing all parts of the prompt.',
      explanation: 'Response is substantially incomplete.',
    },
    directImpact: [
      { subskillId: 'shared.task_completion', weight: 1.0 },
    ],
    indirectSkills: ['writing', 'speaking'],
    baseSeverity: 0.6,
    severityByLevel: { A1: 0.4, A2: 0.5, B1: 0.6, B2: 0.7, C1: 0.8, C2: 0.9 },
  },

  task_off_topic: {
    errorCode: 'task_off_topic',
    label: 'Off-Topic Response',
    category: 'task',
    example: {
      incorrect: 'Asked about weather, responded about food.',
      correct: 'Response addresses the weather topic.',
      explanation: 'Response does not address the task prompt.',
    },
    directImpact: [
      { subskillId: 'shared.task_completion', weight: 0.9 },
      { subskillId: 'reading.instruction_comprehension', weight: 0.5 },
    ],
    indirectSkills: ['reading'],
    baseSeverity: 0.7,
    severityByLevel: { A1: 0.4, A2: 0.5, B1: 0.7, B2: 0.8, C1: 0.9, C2: 1.0 },
  },
};

/**
 * Get the attribution rule for a given error code.
 */
export function getAttributionRule(errorCode: ErrorCode): ErrorAttributionRule {
  return ERROR_ATTRIBUTION_REGISTRY[errorCode];
}

/**
 * Get the effective severity of an error at a given CEFR level.
 */
export function getEffectiveSeverity(errorCode: ErrorCode, level: import('./cefr').CEFRLevel): number {
  const rule = ERROR_ATTRIBUTION_REGISTRY[errorCode];
  const multiplier = rule.severityByLevel[level] ?? 1.0;
  return rule.baseSeverity * multiplier;
}
