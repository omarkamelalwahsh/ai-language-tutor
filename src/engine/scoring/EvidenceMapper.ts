import { LLMSignal, QuestionBankItem, SkillName, SkillEvidence } from '../../types/efset';
import { ScoreWeights, getEvidentialPower } from './ScoringPolicy';

const BAND_VALUE: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

export class EvidenceMapper {
  
  static mapSignalToEvidence(
    item: QuestionBankItem, 
    signal: LLMSignal,
    isCorrect: boolean // used as a fallback or for MCQ
  ): SkillEvidence[] {
    
    // 1. Calculate base scores from signal
    const isMCQ = item.response_mode === 'multiple_choice';
    const numericDifficulty = BAND_VALUE[item.target_cefr] || 1;
    
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
    
    // 2. Map via policy
    const evidences: SkillEvidence[] = [];
    const taskPower = getEvidentialPower(item.task_type);
    
    for (const [skillStr, policy] of Object.entries(item.evidence_policy)) {
       // Typed answers must NOT count as speaking
       if (skillStr === 'speaking' && item.response_mode === 'typed') {
           continue; 
       }
       
       evidences.push({
           skill: skillStr,
           score: baseScore,
           weight: policy.weight * taskPower,
           direct: policy.direct,
           numericDifficulty
       });
    }
    
    return evidences;
  }
}
