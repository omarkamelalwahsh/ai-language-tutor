import { LearnerModelSnapshot, CEFRLevel } from '../types/learner-model';

export interface JourneyMilestone {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'current' | 'locked';
  estimatedDuration: string;
}

export interface LearnerJourney {
  currentStage: CEFRLevel;
  targetStage: CEFRLevel;
  journeyTitle: string;
  milestones: JourneyMilestone[];
}

const NEXT_LEVEL_MAP: Record<CEFRLevel, CEFRLevel> = {
  'Pre-A1': 'A1', 'A1': 'A2', 'A1+': 'A2', 
  'A2': 'B1', 'A2+': 'B1', 'B1': 'B2', 'B1+': 'B2', 
  'B2': 'C1', 'B2+': 'C1', 'C1': 'C2', 'C2': 'C2'
};

/**
 * Dynamically generates a learner's curriculum journey based on their CEFR level.
 */
export class JourneyService {
  
  public static buildJourney(currentLevel: CEFRLevel): LearnerJourney {
    const targetLevel = NEXT_LEVEL_MAP[currentLevel];
    const milestones = this.getMilestonesForTransition(currentLevel, targetLevel);

    return {
      currentStage: currentLevel,
      targetStage: targetLevel,
      journeyTitle: `Your Path from ${currentLevel} to ${targetLevel}`,
      milestones
    };
  }

  private static getMilestonesForTransition(current: CEFRLevel, target: CEFRLevel): JourneyMilestone[] {
    const baseID = `journey_${current}_${target}`;
    
    // A2 -> B1 (Foundation -> Intermediate)
    if (current.includes('A2')) {
      return [
        { id: `${baseID}_m1`, title: 'Daily Conversation Basics', description: 'Expanding common verbs and daily routines', status: 'completed', estimatedDuration: '~1 week' },
        { id: `${baseID}_m2`, title: 'Sentence Building', description: 'Compound sentences and linking words (because, but, so)', status: 'current', estimatedDuration: '~2 weeks' },
        { id: `${baseID}_m3`, title: 'Basic Storytelling', description: 'Using past tense to describe recent events clearly', status: 'locked', estimatedDuration: '~2 weeks' },
        { id: `${baseID}_m4`, title: 'Listening Comprehension', description: 'Catching the main gist of short audio clips', status: 'locked', estimatedDuration: '~1 week' }
      ];
    }
    
    // B1 -> B2 (Intermediate -> Advanced)
    if (current.includes('B1')) {
      return [
        { id: `${baseID}_m1`, title: 'Expressing Opinions', description: 'Structuring arguments and defending viewpoints', status: 'completed', estimatedDuration: '~1 week' },
        { id: `${baseID}_m2`, title: 'Advanced Connectors', description: 'Using however, although, furthermore correctly', status: 'current', estimatedDuration: '~2 weeks' },
        { id: `${baseID}_m3`, title: 'Professional Tone', description: 'Adjusting register for workplace communication', status: 'locked', estimatedDuration: '~2 weeks' },
        { id: `${baseID}_m4`, title: 'Detail Extraction', description: 'Catching specific reasons and nuances in fast audio', status: 'locked', estimatedDuration: '~2 weeks' }
      ];
    }

    // B2 -> C1 (Advanced -> Mastery)
    if (current.includes('B2')) {
      return [
        { id: `${baseID}_m1`, title: 'Complex Argumentation', description: 'Discussing abstract topics with precision', status: 'completed', estimatedDuration: '~2 weeks' },
        { id: `${baseID}_m2`, title: 'Nuance & Tone Control', description: 'Using vocabulary to imply emotion and stance', status: 'current', estimatedDuration: '~3 weeks' },
        { id: `${baseID}_m3`, title: 'Idiomatic Fluency', description: 'Natural phrasal verbs and cultural idioms', status: 'locked', estimatedDuration: '~3 weeks' },
        { id: `${baseID}_m4`, title: 'Native-Speed Comprehension', description: 'Following multiple speakers in noisy environments', status: 'locked', estimatedDuration: '~2 weeks' }
      ];
    }

    // Default (A1 / C1 / C2)
    return [
      { id: `${baseID}_m1`, title: 'Foundational Vocabulary', description: 'Core words and phrases for survival', status: 'completed', estimatedDuration: '~1 week' },
      { id: `${baseID}_m2`, title: 'Simple Exchanges', description: 'Asking and answering basic questions', status: 'current', estimatedDuration: '~2 weeks' },
      { id: `${baseID}_m3`, title: 'Practical Survival', description: 'Ordering food, directions, basic transactions', status: 'locked', estimatedDuration: '~2 weeks' }
    ];
  }
}
