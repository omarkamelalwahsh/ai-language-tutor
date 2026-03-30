import { AssessmentQuestion } from '../types/assessment';

export const QUESTION_BANK: AssessmentQuestion[] = [
  // A1
  {
    id: "a1-g1",
    skill: "grammar",
    difficulty: "A1",
    type: "multiple_choice",
    prompt: "Choose the correct word: 'She ___ my best friend.'",
    options: ["am", "is", "are", "be"],
    correctAnswer: "is",
    evaluationMode: "exact",
  },
  {
    id: "a1-v1",
    skill: "vocabulary",
    difficulty: "A1",
    type: "multiple_choice",
    prompt: "Which word means the opposite of 'hot'?",
    options: ["warm", "boiling", "cold", "sunny"],
    correctAnswer: "cold",
    evaluationMode: "exact",
  },
  {
    id: "2", // Expected by AnalysisService for vocab
    skill: "vocabulary",
    difficulty: "A1",
    type: "short_text",
    prompt: "What dark, hot drink is popular to have in the morning at a cafe?",
    correctAnswer: ["coffee", "cafe", "espresso", "latte", "tea", "drink"],
    evaluationMode: "includes",
  },
  
  // A2
  {
    id: "a2-g1",
    skill: "grammar",
    difficulty: "A2",
    type: "multiple_choice",
    prompt: "I ___ to the store yesterday to buy some milk.",
    options: ["go", "goes", "went", "going"],
    correctAnswer: "went",
    evaluationMode: "exact",
  },
  {
    id: "a2-r1",
    skill: "reading",
    difficulty: "A2",
    type: "multiple_choice",
    prompt: "Read: 'The library is open from 9 AM to 5 PM. It is closed on Sundays.' Can you go to the library at 10 AM on Sunday?",
    options: ["Yes", "No", "Maybe", "Only in the morning"],
    correctAnswer: "No",
    evaluationMode: "exact",
  },
  {
    id: "5", // Expected by AnalysisService for listening proxy
    skill: "listening_proxy",
    difficulty: "A2",
    type: "short_text",
    prompt: "Listen to the scenario: A coworker calls. They mention traffic is very bad and they will be 30 minutes late. Summarize the reason they called.",
    correctAnswer: ["late", "traffic", "30 minutes"],
    evaluationMode: "includes",
  },

  // B1
  {
    id: "6", // Expected by AnalysisService for "continue"
    skill: "vocabulary",
    difficulty: "B1",
    type: "multiple_choice",
    prompt: "Despite the heavy rain, she decided to ______ with her travel plans.",
    options: ["abandon", "continue", "postpone", "cancel"],
    correctAnswer: "continue",
    evaluationMode: "exact",
  },
  {
    id: "b1-g1",
    skill: "grammar",
    difficulty: "B1",
    type: "multiple_choice",
    prompt: "I have been living in this city ___ five years.",
    options: ["since", "for", "during", "while"],
    correctAnswer: "for",
    evaluationMode: "exact",
  },
  {
    id: "3", // Expected by AnalysisService for writing evaluation
    skill: "writing",
    difficulty: "B1",
    type: "short_text",
    prompt: "Tell me about a challenging situation you faced in the past and how you handled it. (2-3 sentences)",
    evaluationMode: "manual_rule", // We will accept anything reasonable, but the engine measures word count/past tense. Let's just pass if length > 10.
  },
  {
    id: "b1-r1",
    skill: "reading",
    difficulty: "B1",
    type: "multiple_choice",
    prompt: "Read: 'The new policy aims to reduce plastic waste by charging a fee for single-use bags.' What is the goal of the policy?",
    options: ["To ban all plastics", "To lower plastic waste", "To give away free bags", "To create more plastic bags"],
    correctAnswer: "To lower plastic waste",
    evaluationMode: "exact",
  },

  // B2
  {
    id: "b2-g1",
    skill: "grammar",
    difficulty: "B2",
    type: "multiple_choice",
    prompt: "Had I known about the terrible traffic, I ___ earlier.",
    options: ["will leave", "would leave", "would have left", "left"],
    correctAnswer: "would have left",
    evaluationMode: "exact",
  },
  {
    id: "b2-v1",
    skill: "vocabulary",
    difficulty: "B2",
    type: "multiple_choice",
    prompt: "The new evidence was completely ___, leaving no room for doubt.",
    options: ["ambiguous", "inconclusive", "compelling", "irrelevant"],
    correctAnswer: "compelling",
    evaluationMode: "exact",
  },
  {
    id: "4", // Free writing response - good for capturing connectors
    skill: "writing",
    difficulty: "B2",
    type: "short_text",
    prompt: "What is your opinion on the impact of Artificial Intelligence on education? Provide a reasoned argument.",
    evaluationMode: "manual_rule", // Automatically marked correct if length > 15 words
  },
  
  // C1
  {
    id: "c1-v1",
    skill: "vocabulary",
    difficulty: "C1",
    type: "multiple_choice",
    prompt: "The politician tried to ___ the fears of the public with a soothing speech.",
    options: ["exacerbate", "allay", "instigate", "provoke"],
    correctAnswer: "allay",
    evaluationMode: "exact",
  },
  {
    id: "c1-g1",
    skill: "grammar",
    difficulty: "C1",
    type: "multiple_choice",
    prompt: "Scarcely ___ the room when the phone started ringing.",
    options: ["he entered", "had he entered", "did he entered", "he had entered"],
    correctAnswer: "had he entered",
    evaluationMode: "exact",
  }
];
