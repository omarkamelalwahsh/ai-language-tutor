import { AssessmentQuestion } from '../types/assessment';

/**
 * Structured Question Bank for the Adaptive Pre-Assessment Engine.
 *
 * Design principles:
 * - Every question is tagged with primary skill, difficulty band, and subskills
 * - Questions span A1–C1 across 6 skills (reading, writing, listening, speaking, vocabulary, grammar)
 * - MCQ questions have exact-match scoring; short_text uses keyword inclusion or rubric
 * - Minimum coverage: 2+ questions per skill across different bands
 * - Total pool: 40+ questions to support adaptive branching without repetition
 */

export const QUESTION_BANK: AssessmentQuestion[] = [

  // ═══════════════════════════════════════════════════════════════════════
  // A1 — BEGINNER
  // ═══════════════════════════════════════════════════════════════════════

  // Grammar A1
  {
    id: 'a1-gram-01',
    skill: 'grammar',
    primarySkill: 'grammar',
    secondarySkills: ['vocabulary'],
    evidenceWeights: { grammar: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'A1',
    type: 'mcq',
    prompt: "Choose the correct word: 'She ___ my best friend.'",
    options: ['am', 'is', 'are', 'be'],
    correctAnswer: 'is',
    subskills: ['subject-verb agreement', 'be-verb conjugation'],
    discriminationValue: 0.8,
    scaffoldingLevel: 0,
    targetDescriptorIds: ['gram_A1_accuracy_01'], // Can use simple words and phrases
    topicTags: ['daily_life'],
    goalTags: ['casual'],
  },
  {
    id: 'a1-gram-02',
    skill: 'grammar',
    primarySkill: 'grammar',
    evidenceWeights: { grammar: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'A1',
    type: 'mcq',
    prompt: "Choose the correct sentence:",
    options: [
      'They is happy.',
      'They are happy.',
      'They am happy.',
      'They be happy.',
    ],
    correctAnswer: 'They are happy.',
    subskills: ['subject-verb agreement', 'plural subjects'],
    discriminationValue: 0.7,
    scaffoldingLevel: 0,
    targetDescriptorIds: ['gram_A1_accuracy_01'],
    topicTags: ['daily_life', 'education'],
    goalTags: ['casual', 'serious'],
  },

  // Vocabulary A1
  {
    id: 'a1-vocab-01',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    evidenceWeights: { vocabulary: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'A1',
    type: 'mcq',
    prompt: "Which word means the opposite of 'hot'?",
    options: ['warm', 'boiling', 'cold', 'sunny'],
    correctAnswer: 'cold',
    subskills: ['antonyms', 'basic adjectives'],
    topicTags: ['daily_life', 'science'],
    goalTags: ['casual', 'serious'],
  },
  {
    id: 'a1-vocab-02',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    secondarySkills: ['speaking'],
    evidenceWeights: { vocabulary: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'A1',
    type: 'short_text',
    prompt: "What dark, hot drink is popular to have in the morning at a cafe?",
    correctAnswer: ['coffee', 'cafe', 'espresso', 'latte', 'tea'],
    acceptedAnswers: ['coffee', 'cafe', 'espresso', 'latte', 'tea', 'drink'],
    subskills: ['everyday vocabulary', 'food and drink'],
    topicTags: ['daily_life', 'health'],
    domainTags: ['cafe'],
    goalTags: ['casual'],
  },

  // Reading A1
  {
    id: 'a1-read-01',
    skill: 'reading',
    primarySkill: 'reading',
    secondarySkills: ['vocabulary'],
    evidenceWeights: { reading: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'A1',
    type: 'reading_mcq',
    prompt: "Read: 'My name is Sara. I am 10 years old. I have a cat.' How old is Sara?",
    options: ['8', '9', '10', '11'],
    correctAnswer: '10',
    subskills: ['literal comprehension', 'extracting facts'],
    topicTags: ['daily_life', 'culture'],
    goalTags: ['casual'],
  },

  // Listening A1
  {
    id: 'a1-list-01',
    skill: 'listening',
    primarySkill: 'listening',
    secondarySkills: ['vocabulary'],
    evidenceWeights: { listening: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension'],
    difficulty: 'A1',
    type: 'listening_mcq',
    prompt: "Where is the person from?",
    transcript: "Hello, my name is John. I am from London.",
    options: ['Paris', 'London', 'New York', 'Berlin'],
    correctAnswer: 'London',
    subskills: ['basic listening', 'extracting key info'],
    discriminationValue: 0.85,
    scaffoldingLevel: 1, // Verbal scenario description
    targetDescriptorIds: ['list_A1_gist_01'], // Can understand simple greetings and info
    topicTags: ['daily_life'],
    goalTags: ['casual'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // A2 — ELEMENTARY
  // ═══════════════════════════════════════════════════════════════════════

  // Grammar A2
  {
    id: 'a2-gram-01',
    skill: 'grammar',
    primarySkill: 'grammar',
    evidenceWeights: { grammar: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'A2',
    type: 'mcq',
    prompt: "I ___ to the store yesterday to buy some milk.",
    options: ['go', 'goes', 'went', 'going'],
    correctAnswer: 'went',
    subskills: ['past simple', 'irregular verbs'],
    discriminationValue: 0.75,
    scaffoldingLevel: 0,
    targetDescriptorIds: ['gram_A2_accuracy_01_past'], // Can use simple grammatical structures correctly
    topicTags: ['daily_life', 'travel'],
    goalTags: ['casual', 'serious'],
  },
  {
    id: 'a2-gram-02',
    skill: 'grammar',
    primarySkill: 'grammar',
    secondarySkills: ['vocabulary'],
    evidenceWeights: { grammar: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'A2',
    type: 'mcq',
    prompt: "She ___ her homework every evening after school.",
    options: ['do', 'does', 'doing', 'done'],
    correctAnswer: 'does',
    subskills: ['present simple', 'third person -s'],
    topicTags: ['daily_life', 'education'],
    goalTags: ['casual', 'serious'],
  },

  // Vocabulary A2
  {
    id: 'a2-vocab-01',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    evidenceWeights: { vocabulary: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'A2',
    type: 'mcq',
    prompt: "Which word describes a place where you can borrow books?",
    options: ['hospital', 'library', 'restaurant', 'stadium'],
    correctAnswer: 'library',
    subskills: ['places vocabulary', 'everyday lexis'],
    topicTags: ['education', 'culture'],
    goalTags: ['serious', 'casual'],
  },
  {
    id: 'a2-vocab-02',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    secondarySkills: ['grammar'],
    evidenceWeights: { vocabulary: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'A2',
    type: 'fill_blank',
    prompt: "I need to ___ the bus to get to work. (take / make / do / give)",
    options: ['take', 'make', 'do', 'give'],
    correctAnswer: 'take',
    subskills: ['collocations', 'verb-noun pairing'],
    topicTags: ['travel', 'daily_life'],
    goalTags: ['casual', 'professional'],
  },

  // Reading A2
  {
    id: 'a2-read-01',
    skill: 'reading',
    primarySkill: 'reading',
    evidenceWeights: { reading: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'A2',
    type: 'reading_mcq',
    prompt: "Read: 'The library is open from 9 AM to 5 PM. It is closed on Sundays.' Can you go to the library at 10 AM on Sunday?",
    options: ['Yes', 'No', 'Maybe', 'Only in the morning'],
    correctAnswer: 'No',
    subskills: ['inference', 'schedule comprehension'],
    topicTags: ['education', 'business'],
    goalTags: ['serious', 'professional'],
  },
  {
    id: 'a2-read-02',
    skill: 'reading',
    primarySkill: 'reading',
    secondarySkills: ['vocabulary'],
    evidenceWeights: { reading: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'A2',
    type: 'reading_mcq',
    prompt: "Read: 'Tom is a doctor. He works at the City Hospital. He helps sick people every day.' What is Tom's job?",
    options: ['Teacher', 'Doctor', 'Engineer', 'Chef'],
    correctAnswer: 'Doctor',
    subskills: ['literal comprehension', 'occupation vocabulary'],
    topicTags: ['health', 'business'],
    goalTags: ['casual', 'professional'],
  },

  // Listening A2
  {
    id: 'a2-list-01',
    skill: 'listening',
    primarySkill: 'listening',
    secondarySkills: ['vocabulary'],
    evidenceWeights: { listening: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension'],
    difficulty: 'A2',
    type: 'listening_summary',
    prompt: "Summarize the reason they called.",
    transcript: "Hi, it's Alex. Listen, traffic is very bad on the highway this morning. I'm going to be about 30 minutes late for the meeting.",
    correctAnswer: ['late', 'traffic', '30 minutes'],
    acceptedAnswers: ['late', 'traffic', 'delay', 'stuck', '30'],
    subskills: ['gist comprehension', 'summarizing'],
    discriminationValue: 0.8,
    scaffoldingLevel: 2, // Summarization help
    targetDescriptorIds: ['list_A2_gist_01'], // Can catch main points in short simple messages
    topicTags: ['business'],
    domainTags: ['office'],
    goalTags: ['professional'],
  },

  // Speaking A2
  {
    id: 'a2-speak-01',
    skill: 'speaking',
    primarySkill: 'speaking',
    secondarySkills: ['vocabulary', 'grammar'],
    evidenceWeights: { speaking: 1.0, grammar: 0.5, vocabulary: 0.5 },
    scoringChannels: ['task_completion', 'lexical_range', 'grammar_accuracy', 'fluency'],
    difficulty: 'A2',
    type: 'short_text',
    prompt: "Introduce yourself. Say your name, where you are from, and what you do.",
    subskills: ['self-introduction', 'simple sentence production'],
    topicTags: ['daily_life', 'business'],
    goalTags: ['casual', 'professional', 'serious'],
    expectedResponseType: 'narrative',
    semanticIntent: 'self-introduction covering name, origin, and occupation',
    requiredContentPoints: ['name', 'origin', 'job/status'],
  },

  // Writing A2
  {
    id: 'a2-write-01',
    skill: 'writing',
    primarySkill: 'writing',
    secondarySkills: ['grammar', 'vocabulary'],
    evidenceWeights: { writing: 1.0, grammar: 0.5, vocabulary: 0.5 },
    scoringChannels: ['task_completion', 'lexical_range', 'grammar_accuracy', 'fluency'],
    difficulty: 'A2',
    type: 'short_text',
    prompt: "Describe your daily routine. What do you do in the morning?",
    subskills: ['simple description', 'present tense usage'],
    expectedResponseType: 'description',
    semanticIntent: 'description of daily morning routine',
    requiredContentPoints: ['morning activities'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // B1 — INTERMEDIATE
  // ═══════════════════════════════════════════════════════════════════════

  // Grammar B1
  {
    id: 'b1-gram-01',
    skill: 'grammar',
    primarySkill: 'grammar',
    evidenceWeights: { grammar: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'B1',
    type: 'mcq',
    prompt: "I have been living in this city ___ five years.",
    options: ['since', 'for', 'during', 'while'],
    correctAnswer: 'for',
    subskills: ['present perfect continuous', 'for vs since'],
    topicTags: ['daily_life', 'travel'],
    goalTags: ['serious', 'casual'],
  },
  {
    id: 'b1-gram-02',
    skill: 'grammar',
    primarySkill: 'grammar',
    evidenceWeights: { grammar: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'B1',
    type: 'mcq',
    prompt: "If it rains tomorrow, we ___ stay inside.",
    options: ['will', 'would', 'are', 'have'],
    correctAnswer: 'will',
    subskills: ['first conditional', 'future tense'],
    topicTags: ['daily_life', 'science'],
    goalTags: ['casual', 'serious'],
  },

  // Vocabulary B1
  {
    id: 'b1-vocab-01',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    evidenceWeights: { vocabulary: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'B1',
    type: 'mcq',
    prompt: "Despite the heavy rain, she decided to ___ with her travel plans.",
    options: ['abandon', 'continue', 'postpone', 'cancel'],
    correctAnswer: 'continue',
    subskills: ['context clues', 'intermediate lexis'],
    topicTags: ['travel', 'culture'],
    goalTags: ['casual', 'serious'],
  },
  {
    id: 'b1-vocab-02',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    secondarySkills: ['reading'],
    evidenceWeights: { vocabulary: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'B1',
    type: 'mcq',
    prompt: "The manager asked the team to ___ the deadline to next Friday.",
    options: ['extend', 'expand', 'increase', 'enlarge'],
    correctAnswer: 'extend',
    subskills: ['business vocabulary', 'word precision'],
    topicTags: ['business'],
    domainTags: ['office'],
    goalTags: ['professional'],
  },

  // Reading B1
  {
    id: 'b1-read-01',
    skill: 'reading',
    primarySkill: 'reading',
    secondarySkills: ['vocabulary'],
    evidenceWeights: { reading: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'B1',
    type: 'reading_mcq',
    prompt: "Read: 'The new policy aims to reduce plastic waste by charging a fee for single-use bags.' What is the goal of the policy?",
    options: ['To ban all plastics', 'To lower plastic waste', 'To give away free bags', 'To create more plastic bags'],
    correctAnswer: 'To lower plastic waste',
    subskills: ['main idea extraction', 'paraphrase recognition'],
    topicTags: ['science', 'technology', 'education'],
    goalTags: ['serious', 'professional'],
  },
  {
    id: 'b1-read-02',
    skill: 'reading',
    primarySkill: 'reading',
    evidenceWeights: { reading: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'B1',
    type: 'reading_mcq',
    prompt: "Read: 'Regular exercise not only improves physical health but also has significant benefits for mental well-being, including reduced stress and better sleep.' According to the text, what are some benefits of exercise besides physical health?",
    options: [
      'Weight loss and muscle gain',
      'Reduced stress and better sleep',
      'Higher income and better career',
      'More friends and social life',
    ],
    correctAnswer: 'Reduced stress and better sleep',
    subskills: ['detail extraction', 'linking ideas'],
    topicTags: ['health', 'science', 'sports'],
    goalTags: ['serious', 'casual'],
  },

  // Writing B1
  {
    id: 'b1-write-01',
    skill: 'writing',
    primarySkill: 'writing',
    secondarySkills: ['grammar', 'vocabulary'],
    evidenceWeights: { writing: 1.0, grammar: 0.5, vocabulary: 0.5 },
    scoringChannels: ['task_completion', 'lexical_range', 'grammar_accuracy', 'fluency'],
    difficulty: 'B1',
    type: 'short_text',
    prompt: "Tell me about a challenging situation you faced in the past and how you handled it.",
    subskills: ['past narrative', 'cohesive writing', 'connector usage'],
    topicTags: ['daily_life', 'culture'],
    goalTags: ['casual', 'serious'],
    expectedResponseType: 'narrative',
    semanticIntent: 'describe a past challenge and the handling of it',
    requiredContentPoints: ['challenge', 'resolution/handling'],
  },

  // Listening B1
  {
    id: 'b1-list-01',
    skill: 'listening',
    primarySkill: 'listening',
    secondarySkills: ['grammar'],
    evidenceWeights: { listening: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension'],
    difficulty: 'B1',
    type: 'listening_mcq',
    prompt: "What happened to the outdoor events?",
    transcript: "Due to the severe weather warning, all outdoor events in the city center have been postponed until further notice.",
    options: ['They were cancelled permanently', 'They were postponed', 'They continued as planned', 'They moved indoors'],
    correctAnswer: 'They were postponed',
    subskills: ['detailed listening', 'understanding announcements'],
    topicTags: ['travel', 'entertainment'],
    goalTags: ['casual', 'serious'],
  },

  // Speaking B1
  {
    id: 'b1-speak-01',
    skill: 'speaking',
    primarySkill: 'speaking',
    secondarySkills: ['grammar', 'vocabulary'],
    evidenceWeights: { speaking: 1.0, grammar: 0.5, vocabulary: 0.5 },
    scoringChannels: ['task_completion', 'lexical_range', 'grammar_accuracy', 'fluency'],
    difficulty: 'B1',
    type: 'short_text',
    prompt: "Describe a memorable trip or vacation you have taken. Where did you go, what did you do, and why was it special?",
    subskills: ['narrative production', 'past tense fluency', 'descriptive language'],
    expectedResponseType: 'narrative',
    semanticIntent: 'description of a past trip with location and activities',
    requiredContentPoints: ['location', 'activities', 'reason for being special'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // B2 — UPPER INTERMEDIATE
  // ═══════════════════════════════════════════════════════════════════════

  // Grammar B2
  {
    id: 'b2-gram-01',
    skill: 'grammar',
    primarySkill: 'grammar',
    evidenceWeights: { grammar: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'B2',
    type: 'mcq',
    prompt: "Had I known about the terrible traffic, I ___ earlier.",
    options: ['will leave', 'would leave', 'would have left', 'left'],
    correctAnswer: 'would have left',
    subskills: ['third conditional', 'past perfect', 'mixed conditionals'],
    targetDescriptorIds: ['gram_B2_accuracy_01'], // Can use a variety of complex structures
    topicTags: ['travel', 'daily_life'],
    goalTags: ['casual', 'serious'],
  },
  {
    id: 'b2-gram-02',
    skill: 'grammar',
    primarySkill: 'grammar',
    evidenceWeights: { grammar: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'B2',
    type: 'mcq',
    prompt: "Not only ___ the project on time, but she also exceeded all quality standards.",
    options: ['she completed', 'did she complete', 'she did complete', 'completed she'],
    correctAnswer: 'did she complete',
    subskills: ['inversion after negative adverbials', 'complex sentence structure'],
    targetDescriptorIds: ['gram_B2_accuracy_02'],
    topicTags: ['business', 'technology'],
    goalTags: ['professional', 'serious'],
  },

  // Vocabulary B2
  {
    id: 'b2-vocab-01',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    evidenceWeights: { vocabulary: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'B2',
    type: 'mcq',
    prompt: "The new evidence was completely ___, leaving no room for doubt.",
    options: ['ambiguous', 'inconclusive', 'compelling', 'irrelevant'],
    correctAnswer: 'compelling',
    subskills: ['advanced adjectives', 'academic vocabulary'],
    topicTags: ['science', 'education'],
    goalTags: ['serious', 'professional'],
  },
  {
    id: 'b2-vocab-02',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    secondarySkills: ['reading'],
    evidenceWeights: { vocabulary: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'B2',
    type: 'mcq',
    prompt: "The committee decided to ___ the controversial proposal after significant public backlash.",
    options: ['endorse', 'implement', 'withdraw', 'amend'],
    correctAnswer: 'withdraw',
    subskills: ['formal vocabulary', 'collocation awareness'],
    topicTags: ['business', 'culture'],
    goalTags: ['professional', 'serious'],
  },

  // Reading B2
  {
    id: 'b2-read-01',
    skill: 'reading',
    primarySkill: 'reading',
    secondarySkills: ['vocabulary'],
    evidenceWeights: { reading: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'B2',
    type: 'reading_mcq',
    prompt: "Read: 'While renewable energy sources have gained considerable momentum in recent years, critics argue that the intermittent nature of wind and solar power presents significant challenges for grid stability without adequate storage solutions.' What is the main concern raised by critics?",
    options: [
      'Renewable energy is too expensive',
      'Wind and solar are unreliable for consistent power supply',
      'Storage solutions already exist',
      'The grid does not need renewable energy',
    ],
    correctAnswer: 'Wind and solar are unreliable for consistent power supply',
    subskills: ['critical reading', 'argument identification', 'paraphrase'],
    topicTags: ['science', 'technology'],
    domainTags: ['environment'],
    goalTags: ['serious'],
  },

  // Writing B2
  {
    id: 'b2-write-01',
    skill: 'writing',
    primarySkill: 'writing',
    secondarySkills: ['grammar', 'vocabulary'],
    evidenceWeights: { writing: 1.0, grammar: 0.5, vocabulary: 0.5 },
    scoringChannels: ['task_completion', 'lexical_range', 'grammar_accuracy', 'fluency'],
    difficulty: 'B2',
    type: 'short_text',
    prompt: "What is your opinion on the impact of Artificial Intelligence on education?",
    subskills: ['opinion essay', 'argumentative structure', 'connector usage', 'formal register'],
    semanticIntent: 'reasoned argument on AI in education',
    requiredContentPoints: ['impact mentioned', 'supporting argument'],
    targetDescriptorIds: ['write_B2_argument_01'], // Can develop an argument systematically
    topicTags: ['technology', 'education', 'science'],
    goalTags: ['serious', 'professional'],
  },

  // Listening B2
  {
    id: 'b2-list-01',
    skill: 'listening',
    primarySkill: 'listening',
    secondarySkills: ['vocabulary'],
    evidenceWeights: { listening: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension'],
    difficulty: 'B2',
    type: 'listening_mcq',
    prompt: "What advantage do bilingual people have?",
    transcript: "The research findings suggest that bilingual individuals demonstrate enhanced cognitive flexibility, particularly in tasks requiring attention switching and inhibitory control.",
    options: [
      'Better memory for facts',
      'Enhanced cognitive flexibility',
      'Faster reading speed',
      'Superior mathematical ability',
    ],
    correctAnswer: 'Enhanced cognitive flexibility',
    subskills: ['academic listening', 'understanding specialized content'],
    topicTags: ['science', 'health', 'education'],
    goalTags: ['serious', 'professional'],
  },

  {
    id: 'b2-speak-01',
    skill: 'speaking',
    primarySkill: 'speaking',
    secondarySkills: ['grammar', 'vocabulary'],
    evidenceWeights: { speaking: 1.0, grammar: 0.5, vocabulary: 0.5 },
    scoringChannels: ['task_completion', 'lexical_range', 'grammar_accuracy', 'fluency'],
    difficulty: 'B2',
    type: 'short_text',
    prompt: "Some people believe that remote work is the future of employment. Do you agree or disagree? Explain your position with at least one supporting reason.",
    subskills: ['opinion expression', 'argumentation', 'hedging', 'discourse management'],
    topicTags: ['technology', 'business'],
    domainTags: ['office'],
    goalTags: ['professional'],
    expectedResponseType: 'opinion',
    semanticIntent: 'agreement/disagreement on remote work future',
    requiredContentPoints: ['position (agree/disagree)', 'supporting reason'],
    targetDescriptorIds: ['speak_B2_argument_01'], // Can develop a clear argument, expanding and supporting ideas
  },
  {
    id: 'b2p-list-01',
    skill: 'listening',
    primarySkill: 'listening',
    evidenceWeights: { listening: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension'],
    difficulty: 'B2',
    type: 'listening_mcq',
    prompt: "What does 'dodged a bullet' mean in this context?",
    transcript: "If we'd pushed that hotfix without a canary deployment, the cascading failures would have been catastrophic. We dodged a bullet there.",
    options: [
      'They literal avoided a physical projectile',
      'They narrowly escaped a disastrous situation',
      'They succeeded in their fix on the first try',
      'The failure was not as bad as they thought',
    ],
    correctAnswer: 'They narrowly escaped a disastrous situation',
    subskills: ['idiomatic expressions', 'understanding animated conversation', 'contextual inference'],
    discriminationValue: 0.9,
    scaffoldingLevel: 1,
    targetDescriptorIds: ['list_B2_animated_01'], // Can keep up with animated conversation between proficient users
    topicTags: ['technology'],
    domainTags: ['software'],
    goalTags: ['professional'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // C1 — ADVANCED
  // ═══════════════════════════════════════════════════════════════════════

  // Grammar C1
  {
    id: 'c1-gram-01',
    skill: 'grammar',
    primarySkill: 'grammar',
    evidenceWeights: { grammar: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'C1',
    type: 'mcq',
    prompt: "Scarcely ___ the room when the phone started ringing.",
    options: ['he entered', 'had he entered', 'did he entered', 'he had entered'],
    correctAnswer: 'had he entered',
    subskills: ['inversion', 'past perfect', 'literary grammar'],
    targetDescriptorIds: ['gram_C1_accuracy_01'], // Can maintain high degree of grammatical accuracy
    topicTags: ['culture', 'education'],
    goalTags: ['serious', 'professional'],
  },
  {
    id: 'c1-gram-02',
    skill: 'grammar',
    primarySkill: 'grammar',
    evidenceWeights: { grammar: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'C1',
    type: 'mcq',
    prompt: "The report, ___ findings were based on extensive research, was published last month.",
    options: ['which', 'whose', 'that', 'whom'],
    correctAnswer: 'whose',
    subskills: ['relative clauses', 'possessive relative pronoun'],
    targetDescriptorIds: ['gram_C1_accuracy_02'],
    topicTags: ['science', 'business'],
    goalTags: ['serious', 'professional'],
  },

  // Vocabulary C1
  {
    id: 'c1-vocab-01',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    evidenceWeights: { vocabulary: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'C1',
    type: 'mcq',
    prompt: "The politician tried to ___ the fears of the public with a soothing speech.",
    options: ['exacerbate', 'allay', 'instigate', 'provoke'],
    correctAnswer: 'allay',
    subskills: ['advanced lexis', 'formal register', 'nuanced meaning'],
    topicTags: ['culture', 'education'],
    goalTags: ['serious', 'professional'],
  },
  {
    id: 'c1-vocab-02',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    secondarySkills: ['reading'],
    evidenceWeights: { vocabulary: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'C1',
    type: 'mcq',
    prompt: "The author's prose style is notable for its ___, avoiding unnecessary embellishment in favor of clarity.",
    options: ['verbosity', 'austerity', 'prolixity', 'terseness'],
    correctAnswer: 'terseness',
    subskills: ['literary vocabulary', 'semantic precision'],
    topicTags: ['culture', 'education'],
    goalTags: ['serious', 'professional'],
  },

  // Reading C1
  {
    id: 'c1-read-01',
    skill: 'reading',
    primarySkill: 'reading',
    secondarySkills: ['vocabulary', 'grammar'],
    evidenceWeights: { reading: 1.0, vocabulary: 0.3 },
    scoringChannels: ['comprehension', 'grammar_accuracy'],
    difficulty: 'C1',
    type: 'reading_mcq',
    prompt: "Read: 'The paradox of choice, as described by psychologist Barry Schwartz, suggests that while having options is generally perceived as positive, an overabundance of choices can lead to decision paralysis, decreased satisfaction, and heightened anxiety.' What is the \"paradox\" being described?",
    options: [
      'Having choices reduces anxiety',
      'Too many choices lead to negative outcomes despite seeming positive',
      'People always make better decisions with more options',
      'Limited options cause decision paralysis',
    ],
    correctAnswer: 'Too many choices lead to negative outcomes despite seeming positive',
    subskills: ['abstract reasoning', 'paradox comprehension', 'academic reading'],
    topicTags: ['science', 'education'],
    goalTags: ['serious', 'professional'],
  },

  // Writing C1
  {
    id: 'c1-write-01',
    skill: 'writing',
    primarySkill: 'writing',
    secondarySkills: ['grammar', 'vocabulary'],
    evidenceWeights: { writing: 1.0, grammar: 0.5, vocabulary: 0.5 },
    scoringChannels: ['task_completion', 'lexical_range', 'grammar_accuracy', 'fluency'],
    difficulty: 'C1',
    type: 'short_text',
    prompt: "Discuss the extent to which globalization has been beneficial or harmful for developing nations. Present a nuanced argument in 4-6 sentences.",
    subskills: ['academic writing', 'nuanced argumentation', 'hedging', 'formal cohesion'],
    topicTags: ['culture', 'economy'],
    domainTags: ['society'],
    goalTags: ['serious'],
    expectedResponseType: 'opinion',
    semanticIntent: 'nuanced argument on globalization benefits and harms',
    requiredContentPoints: ['nuance (both sides/complexity)', 'developing nations focus'],
    targetDescriptorIds: ['write_C1_argument_01'], // Can write clear, well-structured exposition on complex subjects
  },

  // Listening C1
  {
    id: 'c1-list-01',
    skill: 'listening',
    primarySkill: 'listening',
    secondarySkills: ['vocabulary'],
    evidenceWeights: { listening: 1.0, grammar: 0.2 },
    scoringChannels: ['comprehension'],
    difficulty: 'C1',
    type: 'listening_mcq',
    prompt: "What do detractors criticize about quantitative easing?",
    transcript: "The efficacy of quantitative easing as a monetary policy tool remains a subject of considerable debate, with proponents citing its role in averting deflationary spirals, while detractors point to the moral hazard it creates and its limited impact on real economic growth.",
    options: [
      'It causes inflation',
      'It creates moral hazard and has limited real growth impact',
      'It is too expensive to implement',
      'It benefits only developing nations',
    ],
    correctAnswer: 'It creates moral hazard and has limited real growth impact',
    subskills: ['complex argument structure', 'academic vocabulary in context'],
    topicTags: ['business', 'science'],
    goalTags: ['serious', 'professional'],
  },
];

// ═══════════════════════════════════════════════════════════════════════
// Bank Utility Functions
// ═══════════════════════════════════════════════════════════════════════

export function getQuestionsByDifficulty(band: string): AssessmentQuestion[] {
  return QUESTION_BANK.filter(q => q.difficulty === band);
}

export function getQuestionsBySkill(skill: string): AssessmentQuestion[] {
  return QUESTION_BANK.filter(q => q.skill === skill);
}

export function getQuestionsByDifficultyAndSkill(band: string, skill: string): AssessmentQuestion[] {
  return QUESTION_BANK.filter(q => q.difficulty === band && q.skill === skill);
}

export function getAvailableSkills(): string[] {
  return [...new Set(QUESTION_BANK.map(q => q.skill))];
}

export function getBankStats() {
  const stats: Record<string, Record<string, number>> = {};
  for (const q of QUESTION_BANK) {
    if (!stats[q.difficulty]) stats[q.difficulty] = {};
    stats[q.difficulty][q.skill] = (stats[q.difficulty][q.skill] || 0) + 1;
  }
  return stats;
}
