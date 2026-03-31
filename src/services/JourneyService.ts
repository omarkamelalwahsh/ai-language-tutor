import { AssessmentSessionResult, SkillName, CefrLevel } from '../types/assessment';
import { getNextBand, normalizeBand } from '../lib/cefr-utils';
import { LearnerJourneyPayload, JourneyNode } from '../types/dashboard';
import { CEFR_CATALOG, CefrDescriptor } from '../data/cefr-catalog';

export class JourneyService {
  
  public static buildJourney(result: AssessmentSessionResult): LearnerJourneyPayload {
    const currentLevel = result.overall.estimatedLevel;
    const targetLevel = getNextBand(currentLevel);
    
    // 1. Identify Gaps (Descriptors at current level that are missing/weak)
    const gaps = this.identifyGaps(result);
    
    // 2. Identify Next Objectives (Descriptors at target level)
    const objectives = this.identifyObjectives(targetLevel);

    const nodes = this.generateDynamicNodes(gaps, objectives);

    return {
      currentStage: currentLevel,
      targetStage: targetLevel,
      journeyTitle: `Your Path to ${targetLevel}`,
      currentCapabilitiesSummary: `Refining ${currentLevel} foundations based on your performance evidence.`,
      targetCapabilitiesSummary: `Achieving full competence at ${targetLevel} level.`,
      nodes
    };
  }

  private static identifyGaps(result: AssessmentSessionResult): CefrDescriptor[] {
    const gaps: CefrDescriptor[] = [];
    
    Object.values(result.skills).forEach(skillResult => {
      const currentLevel = skillResult.estimatedLevel;
      const allForLevel = CEFR_CATALOG.filter(d => 
        d.skill === skillResult.skill && d.level === currentLevel
      );

      allForLevel.forEach(desc => {
        const evidence = skillResult.descriptors.find(d => d.descriptorId === desc.id);
        // If not tested OR tested and weak (< 0.5)
        if (!evidence || (evidence.strength < 0.5)) {
          gaps.push(desc);
        }
      });
    });

    return gaps.slice(0, 4); // Limit to top 4 gaps for clarity
  }

  private static identifyObjectives(targetLevel: CefrLevel): CefrDescriptor[] {
    return CEFR_CATALOG.filter(d => d.level === targetLevel).slice(0, 3);
  }

  private static generateDynamicNodes(gaps: CefrDescriptor[], objectives: CefrDescriptor[]): JourneyNode[] {
    const nodes: JourneyNode[] = [];
    let nodeIndex = 0;

    // Phase 1: Remediation (Gap Filling)
    gaps.forEach(gap => {
      nodes.push({
        id: `gap_${gap.id}`,
        type: 'task',
        status: nodeIndex === 0 ? 'current' : 'locked',
        title: `Bridge: ${gap.skill.charAt(0).toUpperCase() + gap.skill.slice(1)}`,
        description: gap.canonicalTextEn,
        iconType: (gap.skill === 'grammar' || gap.skill === 'vocabulary') ? gap.skill : (gap.skill as any),
      });
      nodeIndex++;
    });

    // Checkpoint
    nodes.push({
      id: `cp_remediation`,
      type: 'checkpoint',
      status: 'locked',
      title: 'Foundation Checkpoint',
      description: 'Validate remediation of identified gaps before moving to new objectives.',
      iconType: 'assessment',
    });

    // Phase 2: Progression (New Objectives)
    objectives.forEach(obj => {
      nodes.push({
        id: `obj_${obj.id}`,
        type: 'task',
        status: 'locked',
        title: `Target: ${obj.skill.charAt(0).toUpperCase() + obj.skill.slice(1)}`,
        description: obj.canonicalTextEn,
        iconType: (obj.skill === 'grammar' || obj.skill === 'vocabulary') ? obj.skill : (obj.skill as any),
      });
    });

    return nodes;
  }
}
