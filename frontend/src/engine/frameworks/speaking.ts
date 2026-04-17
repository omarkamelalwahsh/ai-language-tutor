// ============================================================================
// Speaking Skill Framework
// ============================================================================

import { SkillFramework } from '../domain/types';

export const SPEAKING_FRAMEWORK: SkillFramework = {
  skillId: 'speaking',
  name: 'Speaking',
  description: 'Ability to produce spoken language fluently, accurately, and appropriately.',

  subskills: [
    {
      subskillId: 'speaking.pronunciation_clarity',
      name: 'Pronunciation Clarity',
      description: 'Producing sounds, stress, and intonation patterns that are intelligible.',
      isShared: false,
      weightInParent: 0.15,
      relevanceFloor: null,
      indicators: [
        'Produces basic sounds intelligibly despite strong accent',
        'Clear enough pronunciation to be understood without much effort',
        'Near-native pronunciation with appropriate stress and intonation',
      ],
    },
    {
      subskillId: 'speaking.fluency',
      name: 'Fluency',
      description: 'Speaking smoothly without excessive pauses, hesitations, or false starts.',
      isShared: false,
      weightInParent: 0.15,
      relevanceFloor: null,
      indicators: [
        'Produces short, isolated utterances with pauses',
        'Speaks with reasonable fluency on familiar topics',
        'Speaks fluently and spontaneously without obvious searching for expressions',
      ],
    },
    {
      subskillId: 'speaking.interactional_competence',
      name: 'Interactional Competence',
      description: 'Managing turn-taking, responding appropriately, and maintaining conversation.',
      isShared: false,
      weightInParent: 0.10,
      relevanceFloor: 'A2',
      indicators: [
        'Can answer simple direct questions',
        'Initiates, maintains, and closes conversations on familiar topics',
        'Manages complex discussions, mediates, and negotiates meaning',
      ],
    },
    {
      subskillId: 'speaking.spoken_production',
      name: 'Spoken Production',
      description: 'Producing extended spoken text (monologue, presentation, narration).',
      isShared: false,
      weightInParent: 0.10,
      relevanceFloor: 'A2',
      indicators: [
        'Produces simple phrases about familiar topics',
        'Gives straightforward descriptions and narratives',
        'Presents clear, detailed descriptions of complex subjects',
      ],
    },
  ],

  scoringDimensions: [
    'pronunciation_intelligibility',
    'fluency_and_rhythm',
    'grammatical_accuracy',
    'vocabulary_range_and_precision',
    'interactional_effectiveness',
    'task_completion',
  ],

  observableIndicators: {
    A1: [
      'Can produce simple, mainly isolated phrases about people and places',
      'Can interact in a simple way if the other person talks slowly',
    ],
    A2: [
      'Can describe in simple terms aspects of background and immediate environment',
      'Can communicate in simple routine tasks requiring direct exchange of information',
    ],
    B1: [
      'Can deal with most situations likely to arise whilst travelling',
      'Can enter unprepared into conversation on familiar topics',
    ],
    B2: [
      'Can interact with a degree of fluency and spontaneity',
      'Can take an active part in discussion in familiar contexts',
    ],
    C1: [
      'Can express ideas fluently and spontaneously without obvious searching',
      'Can use language flexibly and effectively for social and professional purposes',
    ],
    C2: [
      'Can take part effortlessly in any conversation or discussion',
      'Can express finer shades of meaning precisely using intonation and emphasis',
    ],
  },
};
