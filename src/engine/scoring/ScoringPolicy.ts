export const ScoreWeights = {
  content: {
    content_accuracy: 0.6,
    task_completion: 0.4
  },
  language: {
    grammar_control: 0.25,
    lexical_range: 0.20,
    syntactic_complexity: 0.15,
    coherence: 0.15,
    typo_severity: 0.05 // note: it's 0.05 * (1 - typo_severity)
  }
};

export const EvidentialPower = {
  mcq: 0.4,
  short_answer: 0.8,
  multiple_choice: 0.4,
  listening_mcq: 0.4,
  reading_mcq: 0.4,
  summary: 1.0,
  listening_summary: 1.0,
  reading_summary: 1.0,
  writing: 1.2,
  short_text: 0.8,
};

export const EvidenceMultiplier = {
  direct: 1.0,
  strong_indirect: 0.6,
  weak_indirect: 0.3
};

export function getEvidentialPower(taskType: string): number {
  const normType = taskType.toLowerCase() as keyof typeof EvidentialPower;
  return EvidentialPower[normType] || 0.8;
}
