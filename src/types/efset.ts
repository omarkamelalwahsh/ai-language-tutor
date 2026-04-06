export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type SkillName = 'listening' | 'reading' | 'writing' | 'speaking' | 'grammar' | 'vocabulary';

export interface SkillEvidence {
  skill: string;
  score: number;
  weight: number;
  direct: boolean;
  numericDifficulty: number; // 1-6 for A1-C2
}

export type EvidencePolicy = {
  [key in SkillName]?: {
    weight: number;
    direct: boolean;
  };
};

export interface AnswerKeyObject {
  type: 'mcq' | 'text' | 'audio_analysis';
  value: string | number | string[] | { options: string[], correct_index: number };
  correct_answer?: string;
}

export interface QuestionBankItem {
  id: string;
  skill: string; // primary skill
  task_type: string;
  target_cefr: CEFRLevel;
  level?: CEFRLevel; // Alias for target_cefr used by selector
  difficulty: number; // 0.0 - 1.0 within the band, or absolute 0-6 relative
  response_mode: 'typed' | 'audio' | 'mcq';
  prompt: string;
  answer_key: string | AnswerKeyObject;
  options?: string[]; // Top-level options for backward compatibility
  audio_url?: string; // Optional URL for audio stimulus
  stimulus?: string; // Optional text stimulus/transcript
  evidence_policy: EvidencePolicy;
}

export interface LLMSignal {
  content_accuracy: number;
  task_completion: number;
  grammar_control: number;
  lexical_range: number;
  syntactic_complexity: number;
  coherence: number;
  typo_severity: number;
  confidence: number;
}

export type SkillStatus = 'stable' | 'provisional' | 'insufficient_data';

export interface SkillState {
  score: number;
  levelRange: [CEFRLevel | null, CEFRLevel | null];
  confidence: number;
  directEvidenceCount: number;
  consistency: number;
  status: SkillStatus;
  history: Array<{ 
    taskId: string; 
    score: number; 
    difficulty: number;
    weight: number;
    direct: boolean;
  }>;
}

export interface OverallState {
  levelRange: [CEFRLevel | null, CEFRLevel | null];
  confidence: number;
  status: SkillStatus;
}

export interface AssessmentResultOutput {
  skills: {
    listening: SkillState;
    reading: SkillState;
    writing: SkillState;
    speaking: SkillState;
    grammar: SkillState;
    vocabulary: SkillState;
  };
  overall: OverallState;
}

