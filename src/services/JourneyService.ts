import { LearnerModelSnapshot, CEFRLevel } from '../types/learner-model';

// (Types removed from here to use unified types/dashboard.ts)

const NEXT_LEVEL_MAP: Record<CEFRLevel, CEFRLevel> = {
  'Pre-A1': 'A1', 'A1': 'A2', 'A1+': 'A2', 
  'A2': 'B1', 'A2+': 'B1', 'B1': 'B2', 'B1+': 'B2', 
  'B2': 'C1', 'B2+': 'C1', 'C1': 'C2', 'C2': 'C2'
};

import { LearnerJourneyPayload, JourneyNode } from '../types/dashboard';

export class JourneyService {
  
  public static buildJourney(currentLevel: CEFRLevel): LearnerJourneyPayload {
    const targetLevel = NEXT_LEVEL_MAP[currentLevel];
    const nodes = this.generateNodesForLevel(currentLevel);

    return {
      currentStage: currentLevel,
      targetStage: targetLevel,
      journeyTitle: `Your Path to ${targetLevel}`,
      currentCapabilitiesSummary: `Building foundation in ${currentLevel} core skills.`,
      targetCapabilitiesSummary: `Achieving full competence at ${targetLevel} level.`,
      nodes
    };
  }

  private static generateNodesForLevel(level: CEFRLevel): JourneyNode[] {
    const baseID = `node_${level}`;
    
    // Core curriculum components based on level
    const curriculm = this.getCurriculumTemplate(level);
    const nodes: JourneyNode[] = [];
    
    curriculm.forEach((item, index) => {
      // Add Task Node
      nodes.push({
        id: `${baseID}_t${index}`,
        type: 'task',
        status: index === 0 ? 'current' : 'locked',
        title: item.title,
        description: item.desc,
        iconType: item.icon as any,
      });

      // Inject Checkpoint every 3 tasks
      if ((index + 1) % 3 === 0 && index !== curriculm.length - 1) {
        nodes.push({
          id: `${baseID}_cp${index}`,
          type: 'checkpoint',
          status: 'locked',
          title: `Checkpoint: ${item.skill} Mastery`,
          description: `Validate your progress in ${item.skill} before moving forward.`,
          iconType: 'assessment',
        });
      }
    });

    return nodes;
  }

  private static getCurriculumTemplate(level: string) {
    if (level.includes('A')) {
      return [
        { title: 'Sentence Basics', desc: 'SVO structure and basic word order', icon: 'grammar', skill: 'Grammar' },
        { title: 'Daily Routines', desc: 'Describing your day with frequency adverbs', icon: 'speaking', skill: 'Speaking' },
        { title: 'Simple Requests', desc: 'How to ask for things politely', icon: 'listening', skill: 'Listening' },
        { title: 'Connective Words', desc: 'Using and/but/because correctly', icon: 'writing', skill: 'Writing' },
        { title: 'Past Events', desc: 'Talking about what you did yesterday', icon: 'speaking', skill: 'Speaking' },
        { title: 'Basic Description', desc: 'Using adjectives for people and places', icon: 'vocabulary', skill: 'Vocabulary' },
      ];
    }
    return [
      { title: 'Nuanced Debate', desc: 'Expressing pros and cons with precision', icon: 'speaking', skill: 'Speaking' },
      { title: 'Complex Conditionals', desc: 'Hypothetical situations and regrets', icon: 'grammar', skill: 'Grammar' },
      { title: 'Professional Drafting', desc: 'Writing formal emails and reports', icon: 'writing', skill: 'Writing' },
      { title: 'Inference Skills', desc: 'Understanding subtext in fast speech', icon: 'listening', skill: 'Listening' },
      { title: 'Idiomatic Range', desc: 'Natural expressions and metaphors', icon: 'vocabulary', skill: 'Vocabulary' },
      { title: 'Topic Deep Dive', desc: 'Sustained monologue on abstract topics', icon: 'speaking', skill: 'Speaking' },
    ];
  }

}
