// ============================================================================
// Writing Skill Framework
// ============================================================================

import { SkillFramework } from '../domain/types';

export const WRITING_FRAMEWORK: SkillFramework = {
  skillId: 'writing',
  name: 'Writing',
  description: 'Ability to produce written text that is accurate, coherent, and appropriate for the context.',

  subskills: [
    {
      subskillId: 'writing.spelling',
      name: 'Spelling',
      description: 'Correct spelling of words in written output.',
      isShared: false,
      weightInParent: 0.10,
      relevanceFloor: null,
      indicators: [
        'Spells high-frequency words correctly',
        'Spells topic-specific vocabulary correctly',
        'Minimal spelling errors even in complex/technical text',
      ],
    },
    {
      subskillId: 'writing.mechanics',
      name: 'Writing Mechanics',
      description: 'Punctuation, capitalization, and formatting conventions.',
      isShared: false,
      weightInParent: 0.05,
      relevanceFloor: null,
      indicators: [
        'Uses basic punctuation (period, comma)',
        'Uses apostrophes, colons, semicolons appropriately',
        'Handles all punctuation conventions correctly',
      ],
    },
    {
      subskillId: 'writing.sentence_construction',
      name: 'Sentence Construction',
      description: 'Ability to build grammatically correct and varied sentences.',
      isShared: false,
      weightInParent: 0.10,
      relevanceFloor: null,
      indicators: [
        'Writes simple SVO sentences',
        'Constructs compound and complex sentences',
        'Uses a wide range of sentence patterns naturally',
      ],
    },
    {
      subskillId: 'writing.text_organization',
      name: 'Text Organization',
      description: 'Structuring written text with paragraphs, headings, and logical flow.',
      isShared: false,
      weightInParent: 0.05,
      relevanceFloor: 'B1',
      indicators: [
        'Groups related ideas',
        'Uses paragraphs with topic sentences',
        'Creates well-structured multi-paragraph texts',
      ],
    },
    {
      subskillId: 'writing.register_control',
      name: 'Register Control',
      description: 'Adjusting formality and style to match the context and audience.',
      isShared: false,
      weightInParent: 0.05,
      relevanceFloor: 'B1',
      indicators: [
        'Distinguishes informal from formal',
        'Adjusts tone appropriately for different audiences',
        'Commands multiple registers with precision',
      ],
    },
  ],

  scoringDimensions: [
    'accuracy',
    'range_and_complexity',
    'coherence_and_organization',
    'task_achievement',
    'vocabulary_use',
  ],

  observableIndicators: {
    A1: [
      'Can write simple isolated phrases and sentences',
      'Can fill in personal details on forms',
    ],
    A2: [
      'Can write short, simple notes and messages',
      'Can write a very simple personal letter',
    ],
    B1: [
      'Can write straightforward connected text on familiar topics',
      'Can write personal letters describing experiences and impressions',
    ],
    B2: [
      'Can write clear, detailed text on a wide range of subjects',
      'Can write an essay or report passing on information or giving reasons',
    ],
    C1: [
      'Can express ideas in clear, well-structured text',
      'Can write detailed expositions of complex subjects in letters, essays, or reports',
    ],
    C2: [
      'Can write clear, smoothly flowing text in an appropriate style',
      'Can write complex letters, reports, or articles presenting a case with effective logical structure',
    ],
  },
};
