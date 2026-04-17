// ============================================================================
// Reading Skill Framework
// ============================================================================

import { SkillFramework } from '../domain/types';

export const READING_FRAMEWORK: SkillFramework = {
  skillId: 'reading',
  name: 'Reading',
  description: 'Ability to understand written texts of varying complexity, extract information, and make inferences.',

  subskills: [
    {
      subskillId: 'reading.skimming',
      name: 'Skimming & Scanning',
      description: 'Quickly identifying the main topic or locating specific information in a text.',
      isShared: false,
      weightInParent: 0.10,
      relevanceFloor: null,
      indicators: [
        'Identifies the topic of a short paragraph',
        'Locates specific facts in a structured text',
        'Quickly grasps the thesis of a long article',
      ],
    },
    {
      subskillId: 'reading.detail_comprehension',
      name: 'Detail Comprehension',
      description: 'Understanding specific details, facts, and explicit information in a text.',
      isShared: false,
      weightInParent: 0.15,
      relevanceFloor: null,
      indicators: [
        'Understands explicitly stated facts in simple texts',
        'Identifies supporting details in moderately complex texts',
        'Distinguishes main points from subordinate details',
      ],
    },
    {
      subskillId: 'reading.inferential_comprehension',
      name: 'Inferential Comprehension',
      description: 'Drawing conclusions and understanding implied meaning beyond literal text.',
      isShared: false,
      weightInParent: 0.10,
      relevanceFloor: 'A2',
      indicators: [
        'Infers meaning from context clues',
        'Understands writer\'s attitude and purpose',
        'Identifies irony, understatement, and implicature',
      ],
    },
    {
      subskillId: 'reading.instruction_comprehension',
      name: 'Instruction Comprehension',
      description: 'Understanding task instructions, directions, and procedural text.',
      isShared: false,
      weightInParent: 0.10,
      relevanceFloor: null,
      indicators: [
        'Follows simple one-step instructions',
        'Understands multi-step written procedures',
        'Interprets complex conditional instructions',
      ],
    },
  ],

  scoringDimensions: [
    'literal_understanding',
    'inferential_understanding',
    'vocabulary_in_context',
    'text_structure_awareness',
    'speed_and_efficiency',
  ],

  observableIndicators: {
    A1: [
      'Understands very short, simple texts with familiar vocabulary',
      'Identifies basic information (names, numbers, dates)',
    ],
    A2: [
      'Understands short simple texts on familiar topics',
      'Finds specific predictable information in everyday material',
    ],
    B1: [
      'Understands straightforward factual texts on subjects of interest',
      'Identifies main conclusions in clearly signalled argumentative text',
    ],
    B2: [
      'Reads with a large degree of independence',
      'Understands articles on contemporary problems where writers adopt stances',
    ],
    C1: [
      'Understands long complex texts, appreciating distinctions of style',
      'Understands specialized articles outside own field',
    ],
    C2: [
      'Understands virtually all forms of written language including abstract texts',
      'Appreciates subtle distinctions of style and meaning',
    ],
  },
};
