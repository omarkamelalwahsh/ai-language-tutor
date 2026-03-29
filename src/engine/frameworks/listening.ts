// ============================================================================
// Listening Skill Framework
// ============================================================================

import { SkillFramework } from '../domain/types';

export const LISTENING_FRAMEWORK: SkillFramework = {
  skillId: 'listening',
  name: 'Listening',
  description: 'Ability to understand spoken language in various contexts, speeds, and accents.',

  subskills: [
    {
      subskillId: 'listening.gist_comprehension',
      name: 'Gist Comprehension',
      description: 'Understanding the main idea or overall topic of spoken input.',
      isShared: false,
      weightInParent: 0.15,
      relevanceFloor: null,
      indicators: [
        'Identifies the topic of a simple spoken exchange',
        'Understands the main point of clear standard speech',
        'Grasps the gist of complex lectures or discussions',
      ],
    },
    {
      subskillId: 'listening.detail_extraction',
      name: 'Detail Extraction',
      description: 'Catching specific details, facts, numbers, and names from spoken input.',
      isShared: false,
      weightInParent: 0.15,
      relevanceFloor: null,
      indicators: [
        'Catches numbers and familiar words in slow, clear speech',
        'Extracts specific information from announcements or conversations',
        'Catches nuanced details in fast-paced speech',
      ],
    },
    {
      subskillId: 'listening.inferential_comprehension',
      name: 'Inferential Listening',
      description: 'Understanding implied meaning, speaker attitude, and drawing conclusions from audio.',
      isShared: false,
      weightInParent: 0.10,
      relevanceFloor: 'B1',
      indicators: [
        'Understands speaker\'s basic attitude (happy, sad, angry)',
        'Infers meaning from tone and context',
        'Detects sarcasm, irony, and subtle implications',
      ],
    },
    {
      subskillId: 'listening.phonemic_discrimination',
      name: 'Phonemic Discrimination',
      description: 'Distinguishing between similar sounds, word boundaries, and connected speech patterns.',
      isShared: false,
      weightInParent: 0.15,
      relevanceFloor: null,
      indicators: [
        'Distinguishes between basic minimal pairs (ship/sheep)',
        'Handles connected speech features (linking, elision)',
        'Understands multiple accents and rapid connected speech',
      ],
    },
    {
      subskillId: 'listening.note_taking',
      name: 'Listening Note-Taking',
      description: 'Ability to capture key points while listening in real-time.',
      isShared: false,
      weightInParent: 0.05,
      relevanceFloor: 'B1',
      indicators: [
        'Can jot down key words while listening',
        'Takes structured notes from extended speech',
        'Captures complex arguments in note form during lectures',
      ],
    },
  ],

  scoringDimensions: [
    'main_idea_identification',
    'detail_accuracy',
    'inference_quality',
    'phonemic_accuracy',
    'processing_speed',
  ],

  observableIndicators: {
    A1: [
      'Understands very slow, carefully articulated speech with pauses',
      'Recognizes familiar words and basic phrases',
    ],
    A2: [
      'Understands phrases and high-frequency vocabulary on familiar topics',
      'Catches the main point of short, clear, simple messages',
    ],
    B1: [
      'Understands the main points of clear standard speech on familiar matters',
      'Understands the gist of radio or TV programmes on topics of personal interest',
    ],
    B2: [
      'Understands extended speech and lectures and follows complex lines of argument',
      'Understands most TV news and current affairs programmes',
    ],
    C1: [
      'Understands extended speech even when poorly structured or with implicit relationships',
      'Understands television programmes and films without too much effort',
    ],
    C2: [
      'Has no difficulty understanding any kind of spoken language',
      'Understands any speaker at natural speed with any accent',
    ],
  },
};
