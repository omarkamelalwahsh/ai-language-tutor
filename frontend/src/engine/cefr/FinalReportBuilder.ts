import { AssessmentResultOutput, SkillState, OverallState, SkillName } from '../../types/efset';

export class FinalReportBuilder {
  
  public static build(
    skills: Record<SkillName, SkillState>, 
    overall: OverallState
  ): AssessmentResultOutput {
    
    // In actual production, we might add logic to "clean up" the output, 
    // e.g. hiding history or adding human-readable descriptions.
    
    return {
      skills: {
        listening: skills.listening,
        reading: skills.reading,
        writing: skills.writing,
        speaking: skills.speaking,
        grammar: skills.grammar,
        vocabulary: skills.vocabulary
      },
      overall
    };
  }
}
