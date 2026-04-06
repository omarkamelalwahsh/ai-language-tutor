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
    const isMCQ = item.response_mode === 'mcq';
    const lv = item.target_cefr || item.level || 'A1';
    const numericDifficulty = BAND_VALUE[lv] || 1;
    
    let baseScore = 0;
    if (isMCQ) {
       baseScore = isCorrect ? 1.0 : 0.0;
    } else {
       const contentScore = 
         (signal.content_accuracy * ScoreWeights.content.content_accuracy) + 
         (signal.task_completion * ScoreWeights.content.task_completion);
         
       const languageScore = 
         (signal.grammar_control * ScoreWeights.language.grammar_control) +
         (signal.lexical_range * ScoreWeights.language.lexical_range) +
         (signal.syntactic_complexity * ScoreWeights.language.syntactic_complexity) +
         (signal.coherence * ScoreWeights.language.coherence) +
         ((1.0 - signal.typo_severity) * ScoreWeights.language.typo_severity);
         
       baseScore = (contentScore * 0.6) + (languageScore * 0.4);
    }
    
    // 🛡️ SAFENET: Ensure evidence_policy exists to avoid Object.entries TypeError
    const evidences: SkillEvidence[] = [];
    const taskPower = getEvidentialPower(item.task_type);
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
