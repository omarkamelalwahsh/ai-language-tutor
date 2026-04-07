import { LLMSignal, QuestionBankItem, SkillName, SkillEvidence } from '../../types/efset';
import { ScoreWeights, getEvidentialPower } from './ScoringPolicy';

const BAND_VALUE: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

export class EvidenceMapper {
  
  static mapSignalToEvidence(
    item: QuestionBankItem, 
    signal: LLMSignal,
    isCorrect: boolean, 
    actualResponseMode?: 'typed' | 'audio' | 'mcq'
  ): SkillEvidence[] {
    
    // 1. تحديد نوع السؤال (MCQ check)
    const isMCQ = item.response_mode === 'mcq' || (item as any).type === 'mcq' || item.task_type === 'mcq';
    const lv = item.target_cefr || item.level || 'A1';
    const numericDifficulty = BAND_VALUE[lv] || 1;
    
    let baseScore = 0;

    if (isMCQ) {
       // في أسئلة الاختيار من متعدد، السكور يا 1 يا 0
       baseScore = isCorrect ? 1.0 : 0.0;
    } else {
       // التعامل مع إشارات الـ LLM لأسئلة الـ Open-ended
       const s = (signal || {}) as any;
       
       // حماية ضد القيم المفقودة (Fallback to isCorrect state)
       const contentScore = 
          ((Number(s.content_accuracy ?? (isCorrect ? 1 : 0))) * (ScoreWeights.content?.content_accuracy || 0.5)) + 
          ((Number(s.task_completion ?? (isCorrect ? 1 : 0))) * (ScoreWeights.content?.task_completion || 0.5));
          
       const language_control = Number(s.grammar_control ?? (isCorrect ? 1 : 0));
       const lexical_range = Number(s.lexical_range ?? (isCorrect ? 0.5 : 0));
       const syntactic_complexity = Number(s.syntactic_complexity ?? (isCorrect ? 0.5 : 0));
       const coherence = Number(s.coherence ?? (isCorrect ? 1 : 0));
       const typo_severity = Number(s.typo_severity ?? 0.0);

       const languageScore = 
          (language_control * (ScoreWeights.language?.grammar_control || 0.2)) +
          (lexical_range * (ScoreWeights.language?.lexical_range || 0.2)) +
          (syntactic_complexity * (ScoreWeights.language?.syntactic_complexity || 0.2)) +
          (coherence * (ScoreWeights.language?.coherence || 0.2)) +
          ((1.0 - typo_severity) * (ScoreWeights.language?.typo_severity || 0.2));
          
       baseScore = (contentScore * 0.6) + (languageScore * 0.4);
    }
    
    // 🛡️ أهم خطوة: منع الـ NaN من التسرب للداتا بيز
    if (isNaN(baseScore)) {
        baseScore = isCorrect ? 0.5 : 0.0;
    }

    // 2. تطبيق Difficulty Weighting
    const difficultyScale: Record<number, number> = { 
        1: 0.35, // A1
        2: 0.50, // A2
        3: 0.65, // B1
        4: 0.80, // B2
        5: 0.92, // C1
        6: 1.0   // C2
    };
    
    const maxScoreForLevel = difficultyScale[numericDifficulty] || 1.0;
    baseScore *= maxScoreForLevel;
    
    const evidences: SkillEvidence[] = [];
    const rawTaskType = (item.task_type || (item as any).type || 'mcq') as string;
    const taskPower = getEvidentialPower(rawTaskType) || 1;
    
    // 3. معالجة الـ Evidence Policy (ما سيظهر في الداشبورد)
    let policyMap = item.evidence_policy || {};
    
    // لو الـ Database مبعتش سياسة، بنعمل Fallback للمهارة الأساسية للسؤال
    if (!policyMap || Object.keys(policyMap).length === 0) {
        const defaultSkill = (item.category || 'reading') as SkillName;
        policyMap = { [defaultSkill]: { weight: 1.0, direct: true } };
    }
    
    for (const [skillStr, policy] of Object.entries(policyMap)) {
        const castPolicy = policy as any;
        
        // منع إضافة مهارة التحدث لو الإجابة كانت كتابية (Typed)
        if (skillStr === 'speaking' && actualResponseMode === 'typed') {
             continue; 
        }
       
        evidences.push({
            skill: skillStr as SkillName,
            score: Number(baseScore.toFixed(4)), // تقريب الرقم لضمان سلامة الـ JSON
            weight: (Number(castPolicy.weight) || 0.5) * taskPower,
            direct: !!castPolicy.direct,
            numericDifficulty
        });
    }
    
    return evidences;
  }
}