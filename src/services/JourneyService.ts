import { AssessmentSessionResult, SkillName, CefrLevel } from '../types/assessment';
import { getNextBand } from '../lib/cefr-utils';
import { LearnerJourneyPayload, JourneyNode } from '../types/dashboard';
import { CEFR_CATALOG, CefrDescriptor, getDescriptorById } from '../data/cefr-catalog';
import { InferenceGateway, LLMJourneyNode } from './InferenceGateway';
import { supabase } from '../lib/supabaseClient';
import { toValidUUID } from '../lib/utils';

/**
 * Service to generate the Learner Journey Roadmap.
 * Supports both deterministic (static) and LLM-driven (dynamic) generation.
 */
export class JourneyService {
  
  /**
   * Deterministic generation based on CEFR catalog.
   * Used as an immediate response and fallback for LLM failures.
   */
  public static buildJourney(result: AssessmentSessionResult): LearnerJourneyPayload {
    const currentLevel = result?.overall?.estimatedLevel || 'A1';
    const targetLevel = getNextBand(currentLevel);
    
    const gaps = result ? this.identifyGaps(result) : [];
    const objectives = this.identifyObjectives(targetLevel);
    const nodes = this.generateStaticNodes(gaps, objectives);

    return {
      currentStage: currentLevel,
      targetStage: targetLevel,
      journeyTitle: `Your Path to ${targetLevel}`,
      currentCapabilitiesSummary: `Refining ${currentLevel} foundations based on your performance evidence.`,
      targetCapabilitiesSummary: `Achieving full competence at ${targetLevel} level.`,
      nodes
    };
  }

  /**
   * AI-Driven generation using the "Journey Architect" prompt.
   * Provides personalized, high-impact nodes based on specific performance.
   */
  public static async generateDynamicJourney(result: AssessmentSessionResult): Promise<LearnerJourneyPayload> {
    const currentLevel = result.overall.estimatedLevel;
    const targetLevel = getNextBand(currentLevel);

    // 1. Prepare Inputs for LLM
    const gaps = this.identifyGaps(result).map(g => `${g.skill}: ${g.canonicalTextEn}`);
    const performance = [
      `Overall Confidence: ${Math.round(result.overall.confidence * 100)}%`,
      ...result.overall.rationale
    ].join(' | ');

    // 2. Call LLM Architect
    const response = await InferenceGateway.generateJourney({
      currentLevel,
      targetLevel,
      gaps,
      recentPerformance: performance
    });

    if (!response || !response.nodes) {
      console.warn('[JourneyService] LLM generation failed or returned no nodes. Falling back to static.');
      return this.buildJourney(result);
    }

    // 3. Map LLM nodes to UI structure
    const nodes: JourneyNode[] = response.nodes.map((node: LLMJourneyNode, index: number) => ({
      id: toValidUUID(node.id || `node_${index}`),
      type: node.type === 'CHECKPOINT' ? 'checkpoint' : 'task',
      status: index === 0 ? 'current' : 'locked',
      title: node.title,
      description: node.description,
      iconType: this.mapIconType(node.icon, node.skills?.[0]),
      estimatedDuration: `${(node.difficulty || 2) * 15} mins`,
      skillFocus: node.type === 'REMEDIATION' ? 'remediation' : 'progression'
    }));

    const resultPayload: LearnerJourneyPayload = {
      currentStage: currentLevel,
      targetStage: targetLevel,
      journeyTitle: `AI Architected Path to ${targetLevel}`,
      currentCapabilitiesSummary: `Personalized roadmap addressing ${gaps.length} technical gaps.`,
      targetCapabilitiesSummary: `Dynamic progression focused on ${targetLevel} proficiency.`,
      nodes
    };

    return resultPayload;
  }

  /**
   * Explicitly persists a generated journey to the database.
   */
  public static async persistJourney(journey: LearnerJourneyPayload, userId: string): Promise<void> {
    try {
      // A. Upsert the main journey metadata
      const { data: journeyRow, error: jError } = await supabase
        .from('learning_journeys')
        .upsert({
          id: userId,
          user_id: userId,
          nodes: journey.nodes,
          current_node_id: journey.nodes[0]?.id || 'start',
          metadata: {
            journey_title: journey.journeyTitle,
            current_stage: journey.currentStage,
            target_stage: journey.targetStage,
            generated_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (jError) throw jError;
      const journeyId = journeyRow.id;

      // B. Atomic Step Update: Clear and Rebuild
      await supabase.from('journey_steps').delete().eq('journey_id', journeyId);

      const stepsToInsert = journey.nodes.map((node, i) => ({
        id: node.id, // Explicitly pass the deterministic UUID
        journey_id: journeyId,
        title: node.title,
        description: node.description,
        order_index: i,
        status: node.status,
        icon_type: node.iconType,
        skill_focus: node.skillFocus || (node.id.includes('gap') ? 'remediation' : 'progression')
      }));

      const { error: sError } = await supabase.from('journey_steps').insert(stepsToInsert);
      if (sError) throw sError;

      console.log(`[JourneyService] ✅ Journey and ${stepsToInsert.length} steps persisted.`);
    } catch (e) {
      console.warn('[JourneyService] Database persistence failed:', e);
      throw e;
    }
  }

  // ---- Private Helpers ----

  private static mapIconType(iconHint: string, skillHint?: string): JourneyNode['iconType'] {
    const normalized = (iconHint || skillHint || '').toLowerCase();
    
    if (normalized.includes('mic') || normalized.includes('speaking')) return 'speaking';
    if (normalized.includes('pen') || normalized.includes('writing')) return 'writing';
    if (normalized.includes('ear') || normalized.includes('listening')) return 'listening';
    if (normalized.includes('book') || normalized.includes('reading')) return 'listening'; // Reading uses book/listening icon style
    if (normalized.includes('grammar')) return 'grammar';
    if (normalized.includes('vocab') || normalized.includes('word') || normalized.includes('lightbulb')) return 'vocabulary';
    
    return 'assessment';
  }

  private static identifyGaps(result: AssessmentSessionResult): CefrDescriptor[] {
    const gaps: CefrDescriptor[] = [];
    
    Object.values(result.skills).forEach(skillResult => {
      if (!skillResult.weaknesses) return;

      skillResult.weaknesses.forEach(descText => {
        // Try to find descriptor in catalog by text or ID fallback
        const desc = CEFR_CATALOG.find(d => d.canonicalTextEn === descText || d.id === descText);
        if (desc) gaps.push(desc);
      });
    });
    
    return gaps.slice(0, 5);
  }

  private static identifyObjectives(targetLevel: CefrLevel): CefrDescriptor[] {
    return CEFR_CATALOG.filter(d => d.level === targetLevel).slice(0, 3);
  }

  private static generateStaticNodes(gaps: CefrDescriptor[], objectives: CefrDescriptor[]): JourneyNode[] {
    const nodes: JourneyNode[] = [];
    let nodeIndex = 0;

    // Phase 1: Remediation (Gap Filling)
    gaps.forEach(gap => {
      nodes.push({
        id: toValidUUID(`gap_${gap.id}`),
        type: 'task',
        status: nodeIndex === 0 ? 'current' : 'locked',
        title: `Bridge: ${gap.skill.charAt(0).toUpperCase() + gap.skill.slice(1)}`,
        description: gap.canonicalTextEn,
        iconType: this.mapIconType('', gap.skill),
        skillFocus: 'remediation'
      });
      nodeIndex++;
    });

    // Checkpoint
    nodes.push({
      id: toValidUUID(`cp_remediation`),
      type: 'checkpoint',
      status: 'locked',
      title: 'Foundation Checkpoint',
      description: 'Validate remediation of identified gaps before moving to new objectives.',
      iconType: 'assessment',
      skillFocus: 'progression'
    });

    // Phase 2: Progression (New Objectives)
    objectives.forEach(obj => {
      nodes.push({
        id: toValidUUID(`obj_${obj.id}`),
        type: 'task',
        status: 'locked',
        title: `Target: ${obj.skill.charAt(0).toUpperCase() + obj.skill.slice(1)}`,
        description: obj.canonicalTextEn,
        iconType: this.mapIconType('', obj.skill),
        skillFocus: 'progression'
      });
    });

    return nodes;
  }
}
