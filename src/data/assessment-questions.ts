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
    difficulty: 'A1',
    type: 'mcq',
    prompt: "Choose the correct word: 'She ___ my best friend.'",
    options: ['am', 'is', 'are', 'be'],
    correctAnswer: 'is',
    subskills: ['subject-verb agreement', 'be-verb conjugation'],
    discriminationValue: 0.8,
    scaffoldingLevel: 0,
    targetDescriptorIds: ['gram_A1_accuracy_01'], // Can use simple words and phrases
  },
  {
    id: 'a1-gram-02',
    skill: 'grammar',
    primarySkill: 'grammar',
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
  },

  // Vocabulary A1
  {
    id: 'a1-vocab-01',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    difficulty: 'A1',
    type: 'mcq',
    prompt: "Which word means the opposite of 'hot'?",
    options: ['warm', 'boiling', 'cold', 'sunny'],
    correctAnswer: 'cold',
    subskills: ['antonyms', 'basic adjectives'],
  },
  {
    id: 'a1-vocab-02',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    secondarySkills: ['speaking'],
    difficulty: 'A1',
    type: 'short_text',
    prompt: "What dark, hot drink is popular to have in the morning at a cafe?",
    correctAnswer: ['coffee', 'cafe', 'espresso', 'latte', 'tea'],
    acceptedAnswers: ['coffee', 'cafe', 'espresso', 'latte', 'tea', 'drink'],
    subskills: ['everyday vocabulary', 'food and drink'],
  },

  // Reading A1
  {
    id: 'a1-read-01',
    skill: 'reading',
    primarySkill: 'reading',
    secondarySkills: ['vocabulary'],
    difficulty: 'A1',
    type: 'reading_mcq',
    prompt: "Read: 'My name is Sara. I am 10 years old. I have a cat.' How old is Sara?",
    options: ['8', '9', '10', '11'],
    correctAnswer: '10',
    subskills: ['literal comprehension', 'extracting facts'],
  },

  // Listening A1
  {
    id: 'a1-list-01',
    skill: 'listening',
    primarySkill: 'listening',
    secondarySkills: ['vocabulary'],
    difficulty: 'A1',
    type: 'listening_mcq',
    prompt: "Listen to the scenario: Someone says 'Hello, my name is John. I am from London.' Where is the person from?",
    options: ['Paris', 'London', 'New York', 'Berlin'],
    correctAnswer: 'London',
    subskills: ['basic listening', 'extracting key info'],
    discriminationValue: 0.85,
    scaffoldingLevel: 1, // Verbal scenario description
    targetDescriptorIds: ['list_A1_gist_01'], // Can understand simple greetings and info
  },

  // ═══════════════════════════════════════════════════════════════════════
  // A2 — ELEMENTARY
  // ═══════════════════════════════════════════════════════════════════════

  // Grammar A2
  {
    id: 'a2-gram-01',
    skill: 'grammar',
    primarySkill: 'grammar',
    difficulty: 'A2',
    type: 'mcq',
    prompt: "I ___ to the store yesterday to buy some milk.",
    options: ['go', 'goes', 'went', 'going'],
    correctAnswer: 'went',
    subskills: ['past simple', 'irregular verbs'],
    discriminationValue: 0.75,
    scaffoldingLevel: 0,
    targetDescriptorIds: ['gram_A2_accuracy_01_past'], // Can use simple grammatical structures correctly
  },
  {
    id: 'a2-gram-02',
    skill: 'grammar',
    primarySkill: 'grammar',
    secondarySkills: ['vocabulary'],
    difficulty: 'A2',
    type: 'mcq',
    prompt: "She ___ her homework every evening after school.",
    options: ['do', 'does', 'doing', 'done'],
    correctAnswer: 'does',
    subskills: ['present simple', 'third person -s'],
  },

  // Vocabulary A2
  {
    id: 'a2-vocab-01',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    difficulty: 'A2',
    type: 'mcq',
    prompt: "Which word describes a place where you can borrow books?",
    options: ['hospital', 'library', 'restaurant', 'stadium'],
    correctAnswer: 'library',
    subskills: ['places vocabulary', 'everyday lexis'],
  },
  {
    id: 'a2-vocab-02',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    secondarySkills: ['grammar'],
    difficulty: 'A2',
    type: 'fill_blank',
    prompt: "I need to ___ the bus to get to work. (take / make / do / give)",
    options: ['take', 'make', 'do', 'give'],
    correctAnswer: 'take',
    subskills: ['collocations', 'verb-noun pairing'],
  },

  // Reading A2
  {
    id: 'a2-read-01',
    skill: 'reading',
    primarySkill: 'reading',
    difficulty: 'A2',
    type: 'reading_mcq',
    prompt: "Read: 'The library is open from 9 AM to 5 PM. It is closed on Sundays.' Can you go to the library at 10 AM on Sunday?",
    options: ['Yes', 'No', 'Maybe', 'Only in the morning'],
    correctAnswer: 'No',
    subskills: ['inference', 'schedule comprehension'],
  },
  {
    id: 'a2-read-02',
    skill: 'reading',
    primarySkill: 'reading',
    secondarySkills: ['vocabulary'],
    difficulty: 'A2',
    type: 'reading_mcq',
    prompt: "Read: 'Tom is a doctor. He works at the City Hospital. He helps sick people every day.' What is Tom's job?",
    options: ['Teacher', 'Doctor', 'Engineer', 'Chef'],
    correctAnswer: 'Doctor',
    subskills: ['literal comprehension', 'occupation vocabulary'],
  },

  // Listening A2
  {
    id: 'a2-list-01',
    skill: 'listening',
    primarySkill: 'listening',
    secondarySkills: ['vocabulary'],
    difficulty: 'A2',
    type: 'listening_summary',
    prompt: "Listen to the scenario: A coworker calls. They mention traffic is very bad and they will be 30 minutes late. Summarize the reason they called.",
    correctAnswer: ['late', 'traffic', '30 minutes'],
    acceptedAnswers: ['late', 'traffic', 'delay', 'stuck', '30'],
    subskills: ['gist comprehension', 'summarizing'],
    discriminationValue: 0.8,
    scaffoldingLevel: 2, // Summarization help
    targetDescriptorIds: ['list_A2_gist_01'], // Can catch main points in short simple messages
  },

  // Speaking A2
  {
    id: 'a2-speak-01',
    skill: 'speaking',
    primarySkill: 'speaking',
    secondarySkills: ['vocabulary', 'grammar'],
    difficulty: 'A2',
    type: 'short_text',
    prompt: "Introduce yourself in 2-3 sentences. Say your name, where you are from, and what you do.",
    subskills: ['self-introduction', 'simple sentence production'],
  },

  // Writing A2
  {
    id: 'a2-write-01',
    skill: 'writing',
    primarySkill: 'writing',
    secondarySkills: ['grammar', 'vocabulary'],
    difficulty: 'A2',
    type: 'short_text',
    prompt: "Write 2-3 sentences describing your daily routine. What do you do in the morning?",
    subskills: ['simple description', 'present tense usage'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // B1 — INTERMEDIATE
  // ═══════════════════════════════════════════════════════════════════════

  // Grammar B1
  {
    id: 'b1-gram-01',
    skill: 'grammar',
    primarySkill: 'grammar',
    difficulty: 'B1',
    type: 'mcq',
    prompt: "I have been living in this city ___ five years.",
    options: ['since', 'for', 'during', 'while'],
    correctAnswer: 'for',
    subskills: ['present perfect continuous', 'for vs since'],
  },
  {
    id: 'b1-gram-02',
    skill: 'grammar',
    primarySkill: 'grammar',
    difficulty: 'B1',
    type: 'mcq',
    prompt: "If it rains tomorrow, we ___ stay inside.",
    options: ['will', 'would', 'are', 'have'],
    correctAnswer: 'will',
    subskills: ['first conditional', 'future tense'],
  },

  // Vocabulary B1
  {
    id: 'b1-vocab-01',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    difficulty: 'B1',
    type: 'mcq',
    prompt: "Despite the heavy rain, she decided to ___ with her travel plans.",
    options: ['abandon', 'continue', 'postpone', 'cancel'],
    correctAnswer: 'continue',
    subskills: ['context clues', 'intermediate lexis'],
  },
  {
    id: 'b1-vocab-02',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    secondarySkills: ['reading'],
    difficulty: 'B1',
    type: 'mcq',
    prompt: "The manager asked the team to ___ the deadline to next Friday.",
    options: ['extend', 'expand', 'increase', 'enlarge'],
    correctAnswer: 'extend',
    subskills: ['business vocabulary', 'word precision'],
  },

  // Reading B1
  {
    id: 'b1-read-01',
    skill: 'reading',
    primarySkill: 'reading',
    secondarySkills: ['vocabulary'],
    difficulty: 'B1',
    type: 'reading_mcq',
    prompt: "Read: 'The new policy aims to reduce plastic waste by charging a fee for single-use bags.' What is the goal of the policy?",
    options: ['To ban all plastics', 'To lower plastic waste', 'To give away free bags', 'To create more plastic bags'],
    correctAnswer: 'To lower plastic waste',
    subskills: ['main idea extraction', 'paraphrase recognition'],
  },
  {
    id: 'b1-read-02',
    skill: 'reading',
    primarySkill: 'reading',
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
  },

  // Writing B1
  {
    id: 'b1-write-01',
    skill: 'writing',
    primarySkill: 'writing',
    secondarySkills: ['grammar', 'vocabulary'],
    difficulty: 'B1',
    type: 'short_text',
    prompt: "Tell me about a challenging situation you faced in the past and how you handled it. Write 2-3 sentences.",
    subskills: ['past narrative', 'cohesive writing', 'connector usage'],
  },

  // Listening B1
  {
    id: 'b1-list-01',
    skill: 'listening',
    primarySkill: 'listening',
    secondarySkills: ['grammar'],
    difficulty: 'B1',
    type: 'listening_mcq',
    prompt: "Listen to the scenario: A news anchor says 'Due to the severe weather warning, all outdoor events in the city center have been postponed until further notice.' What happened to the outdoor events?",
    options: ['They were cancelled permanently', 'They were postponed', 'They continued as planned', 'They moved indoors'],
    correctAnswer: 'They were postponed',
    subskills: ['detailed listening', 'understanding announcements'],
  },

  // Speaking B1
  {
    id: 'b1-speak-01',
    skill: 'speaking',
    primarySkill: 'speaking',
    secondarySkills: ['grammar', 'vocabulary'],
    difficulty: 'B1',
    type: 'short_text',
    prompt: "Describe a memorable trip or vacation you have taken. Where did you go, what did you do, and why was it special? Write 3-4 sentences.",
    subskills: ['narrative production', 'past tense fluency', 'descriptive language'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // B2 — UPPER INTERMEDIATE
  // ═══════════════════════════════════════════════════════════════════════

  // Grammar B2
  {
    id: 'b2-gram-01',
    skill: 'grammar',
    primarySkill: 'grammar',
    difficulty: 'B2',
    type: 'mcq',
    prompt: "Had I known about the terrible traffic, I ___ earlier.",
    options: ['will leave', 'would leave', 'would have left', 'left'],
    correctAnswer: 'would have left',
    subskills: ['third conditional', 'past perfect', 'mixed conditionals'],
  },
  {
    id: 'b2-gram-02',
    skill: 'grammar',
    primarySkill: 'grammar',
    difficulty: 'B2',
    type: 'mcq',
    prompt: "Not only ___ the project on time, but she also exceeded all quality standards.",
    options: ['she completed', 'did she complete', 'she did complete', 'completed she'],
    correctAnswer: 'did she complete',
    subskills: ['inversion after negative adverbials', 'complex sentence structure'],
  },

  // Vocabulary B2
  {
    id: 'b2-vocab-01',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    difficulty: 'B2',
    type: 'mcq',
    prompt: "The new evidence was completely ___, leaving no room for doubt.",
    options: ['ambiguous', 'inconclusive', 'compelling', 'irrelevant'],
    correctAnswer: 'compelling',
    subskills: ['advanced adjectives', 'academic vocabulary'],
  },
  {
    id: 'b2-vocab-02',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    secondarySkills: ['reading'],
    difficulty: 'B2',
    type: 'mcq',
    prompt: "The committee decided to ___ the controversial proposal after significant public backlash.",
    options: ['endorse', 'implement', 'withdraw', 'amend'],
    correctAnswer: 'withdraw',
    subskills: ['formal vocabulary', 'collocation awareness'],
  },

  // Reading B2
  {
    id: 'b2-read-01',
    skill: 'reading',
    primarySkill: 'reading',
    secondarySkills: ['vocabulary'],
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
  },

  // Writing B2
  {
    id: 'b2-write-01',
    skill: 'writing',
    primarySkill: 'writing',
    secondarySkills: ['grammar', 'vocabulary'],
    difficulty: 'B2',
    type: 'short_text',
    prompt: "What is your opinion on the impact of Artificial Intelligence on education? Provide a reasoned argument in 3-5 sentences.",
    subskills: ['opinion essay', 'argumentative structure', 'connector usage', 'formal register'],
  },

  // Listening B2
  {
    id: 'b2-list-01',
    skill: 'listening',
    primarySkill: 'listening',
    secondarySkills: ['vocabulary'],
    difficulty: 'B2',
    type: 'listening_mcq',
    prompt: "Listen to the scenario: A university lecturer says 'The research findings suggest that bilingual individuals demonstrate enhanced cognitive flexibility, particularly in tasks requiring attention switching and inhibitory control.' What advantage do bilingual people have?",
    options: [
      'Better memory for facts',
      'Enhanced cognitive flexibility',
      'Faster reading speed',
      'Superior mathematical ability',
    ],
    correctAnswer: 'Enhanced cognitive flexibility',
    subskills: ['academic listening', 'understanding specialized content'],
  },

  {
    id: 'b2-speak-01',
    skill: 'speaking',
    primarySkill: 'speaking',
    secondarySkills: ['grammar', 'vocabulary'],
    difficulty: 'B2',
    type: 'short_text',
    prompt: "Some people believe that remote work is the future of employment. Do you agree or disagree? Explain your position with at least one supporting reason. Write 4-5 sentences.",
    subskills: ['opinion expression', 'argumentation', 'hedging', 'discourse management'],
  },
  {
    id: 'b2p-list-01',
    skill: 'listening',
    primarySkill: 'listening',
    difficulty: 'B2',
    type: 'listening_mcq',
    prompt: "Listen to the scenario: An animated conversation between two tech leads discusses a critical system failure. One says 'If we'd pushed that hotfix without a canary deployment, the cascading failures would have been catastrophic. We dodged a bullet there.' What does 'dodged a bullet' mean in this context?",
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
  },

  // ═══════════════════════════════════════════════════════════════════════
  // C1 — ADVANCED
  // ═══════════════════════════════════════════════════════════════════════

  // Grammar C1
  {
    id: 'c1-gram-01',
    skill: 'grammar',
    primarySkill: 'grammar',
    difficulty: 'C1',
    type: 'mcq',
    prompt: "Scarcely ___ the room when the phone started ringing.",
    options: ['he entered', 'had he entered', 'did he entered', 'he had entered'],
    correctAnswer: 'had he entered',
    subskills: ['inversion', 'past perfect', 'literary grammar'],
  },
  {
    id: 'c1-gram-02',
    skill: 'grammar',
    primarySkill: 'grammar',
    difficulty: 'C1',
    type: 'mcq',
    prompt: "The report, ___ findings were based on extensive research, was published last month.",
    options: ['which', 'whose', 'that', 'whom'],
    correctAnswer: 'whose',
    subskills: ['relative clauses', 'possessive relative pronoun'],
  },

  // Vocabulary C1
  {
    id: 'c1-vocab-01',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    difficulty: 'C1',
    type: 'mcq',
    prompt: "The politician tried to ___ the fears of the public with a soothing speech.",
    options: ['exacerbate', 'allay', 'instigate', 'provoke'],
    correctAnswer: 'allay',
    subskills: ['advanced lexis', 'formal register', 'nuanced meaning'],
  },
  {
    id: 'c1-vocab-02',
    skill: 'vocabulary',
    primarySkill: 'vocabulary',
    secondarySkills: ['reading'],
    difficulty: 'C1',
    type: 'mcq',
    prompt: "The author's prose style is notable for its ___, avoiding unnecessary embellishment in favor of clarity.",
    options: ['verbosity', 'austerity', 'prolixity', 'terseness'],
    correctAnswer: 'terseness',
    subskills: ['literary vocabulary', 'semantic precision'],
  },

  // Reading C1
  {
    id: 'c1-read-01',
    skill: 'reading',
    primarySkill: 'reading',
    secondarySkills: ['vocabulary', 'grammar'],
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
  },

  // Writing C1
  {
    id: 'c1-write-01',
    skill: 'writing',
    primarySkill: 'writing',
    secondarySkills: ['grammar', 'vocabulary'],
    difficulty: 'C1',
    type: 'short_text',
    prompt: "Discuss the extent to which globalization has been beneficial or harmful for developing nations. Present a nuanced argument in 4-6 sentences.",
    subskills: ['academic writing', 'nuanced argumentation', 'hedging', 'formal cohesion'],
  },

  // Listening C1
  {
    id: 'c1-list-01',
    skill: 'listening',
    primarySkill: 'listening',
    secondarySkills: ['vocabulary'],
    difficulty: 'C1',
    type: 'listening_mcq',
    prompt: "Listen to the scenario: A policy analyst states 'The efficacy of quantitative easing as a monetary policy tool remains a subject of considerable debate, with proponents citing its role in averting deflationary spirals, while detractors point to the moral hazard it creates and its limited impact on real economic growth.' What do detractors criticize about quantitative easing?",
    options: [
      'It causes inflation',
      'It creates moral hazard and has limited real growth impact',
      'It is too expensive to implement',
      'It benefits only developing nations',
    ],
    correctAnswer: 'It creates moral hazard and has limited real growth impact',
    subskills: ['complex argument structure', 'academic vocabulary in context'],
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
