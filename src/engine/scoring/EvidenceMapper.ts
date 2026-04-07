import { LLMSignal, QuestionBankItem, SkillName, SkillEvidence } from '../../types/efset';
import { ScoreWeights, getEvidentialPower } from './ScoringPolicy';

const BAND_VALUE: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

export class EvidenceMapper {
  
  static mapSignalToEvidence(
    item: QuestionBankItem, 
    signal: LLMSignal,
    isCorrect: boolean, // used as a fallback or for MCQ
    actualResponseMode?: 'typed' | 'audio' | 'mcq'
  ): SkillEvidence[] {
    
    // 1. Calculate base scores from signal
    const isMCQ = item.response_mode === 'mcq' || (item as any).type === 'mcq' || item.task_type === 'mcq';
    const lv = item.target_cefr || item.level || 'A1';
    const numericDifficulty = BAND_VALUE[lv] || 1;
    
    let baseScore = 0;
    if (isMCQ) {
       baseScore = isCorrect ? 1.0 : 0.0;
    } else {
       // Safe fallbacks for missing signals (e.g. circuit breaker or incorrect mock)
       const s = (signal || {}) as any;
       const contentScore = 
         ((s.content_accuracy ?? (isCorrect ? 1 : 0)) * ScoreWeights.content.content_accuracy) + 
         ((s.task_completion ?? (isCorrect ? 1 : 0)) * ScoreWeights.content.task_completion);
         
       const language_control = s.grammar_control ?? (isCorrect ? 1 : 0);
       const lexical_range = s.lexical_range ?? (isCorrect ? 0.5 : 0);
       const syntactic_complexity = s.syntactic_complexity ?? (isCorrect ? 0.5 : 0);
       const coherence = s.coherence ?? (isCorrect ? 1 : 0);
       const typo_severity = s.typo_severity ?? 0.0;

       const languageScore = 
         (language_control * ScoreWeights.language.grammar_control) +
         (lexical_range * ScoreWeights.language.lexical_range) +
         (syntactic_complexity * ScoreWeights.language.syntactic_complexity) +
         (coherence * ScoreWeights.language.coherence) +
         ((1.0 - typo_severity) * ScoreWeights.language.typo_severity);
         
       baseScore = (contentScore * 0.6) + (languageScore * 0.4);
    }
    
    // 1. Difficulty Weighting (User Request #1)
    // Scale the base score so a perfect A1 answer maxes out at the A1 threshold,
    // while a perfect C1/C2 answer can push the score up to the highest tiers.
    const difficultyScale: Record<number, number> = { 1: 0.35, 2: 0.50, 3: 0.65, 4: 0.80, 5: 0.92, 6: 1.0 };
    const maxScoreForLevel = difficultyScale[numericDifficulty] || 1.0;
    baseScore *= maxScoreForLevel;
    
    // 🛡️ SAFENET: Ensure evidence_policy exists to avoid Object.entries TypeError
    const evidences: SkillEvidence[] = [];
    const rawTaskType = (item.task_type || (item as any).type || 'mcq') as string;
    const taskPower = getEvidentialPower(rawTaskType);
    const policyMap = item.evidence_policy || {};
    
    for (const [skillStr, policy] of Object.entries(policyMap)) {
        const castPolicy = policy as any; // Cast to access sub-properties safely
        // ❌ Speaking Guard: Zero credit for 'Speaking' mastery if the user typed 
        // their response. No audio = no speaking evidence.
        if (skillStr === 'speaking' && actualResponseMode === 'typed') {
             continue; 
        }
       
       evidences.push({
            skill: skillStr as SkillName,
            score: baseScore,
            weight: (castPolicy.weight || 0.5) * taskPower,
            direct: !!castPolicy.direct,
            numericDifficulty
        });
    }
    
    return evidences;
  }
}
