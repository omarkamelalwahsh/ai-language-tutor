import { CEFRLevel, QuestionBankItem, SkillState, SkillName } from '../../types/efset';

export interface SelectorState {
  skills: Record<SkillName, SkillState>;
  askedQuestionIds: Set<string>;
  currentOverallLevel: CEFRLevel;
}

const LEVEL_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export class AdaptiveSelector {
  private banks: Record<CEFRLevel, QuestionBankItem[]> = {
    'A1': [], 'A2': [], 'B1': [], 'B2': [], 'C1': [], 'C2': []
  };

  constructor(banks: Record<CEFRLevel, QuestionBankItem[]>) {
    this.banks = banks;
  }

  public selectNext(state: SelectorState): QuestionBankItem | null {
    const { skills, askedQuestionIds, currentOverallLevel } = state;

    // 1. Identify skills missing direct evidence
    const coreSkills: SkillName[] = ['reading', 'listening', 'writing', 'speaking'];
    const skillsToPrioritize = coreSkills.filter(
      s => skills[s].directEvidenceCount === 0
    );

    let targetSkill: SkillName;
    if (skillsToPrioritize.length > 0) {
      targetSkill = skillsToPrioritize[Math.floor(Math.random() * skillsToPrioritize.length)];
    } else {
      // Pick skill with lowest confidence
      targetSkill = (Object.keys(skills) as SkillName[]).sort(
        (a, b) => skills[a].confidence - skills[b].confidence
      )[0];
    }

    const skillState = skills[targetSkill];
    const currentIndex = LEVEL_ORDER.indexOf(currentOverallLevel);
    
    // 2. Momentum Tracking (Fast Drop)
    // If the last 3 answers for this skill were < 0.4 score, demote significantly
    const recent = skillState.history.slice(-3);
    if (recent.length === 3 && recent.every(h => h.score < 0.4)) {
       const demotedIndex = Math.max(0, currentIndex - 2);
       console.log(`[Momentum] Critical failure trend for ${targetSkill}. Demoting to ${LEVEL_ORDER[demotedIndex]}.`);
       return this.pickFromLevel(LEVEL_ORDER[demotedIndex], targetSkill, askedQuestionIds);
    }

    // 3. Boundary Testing (Probe model)
    const rand = Math.random();
    let probeDifficulty: CEFRLevel = currentOverallLevel;

    if (rand < 0.20 && currentIndex > 0) {
       probeDifficulty = LEVEL_ORDER[currentIndex - 1]; // Checkdown L-1
       console.log(`[Selector] Probe: Checkdown L-1 for ${targetSkill} -> ${probeDifficulty}`);
    } else if (rand > 0.80 && currentIndex < LEVEL_ORDER.length - 1) {
       probeDifficulty = LEVEL_ORDER[currentIndex + 1]; // Reach L+1
       console.log(`[Selector] Probe: Reach L+1 for ${targetSkill} -> ${probeDifficulty}`);
    } else {
       // Target current estimated level
       const estimatedSkillLevel = this.scoreToLevel(skillState.score);
       probeDifficulty = estimatedSkillLevel;
    }

    const item = this.pickFromLevel(probeDifficulty, targetSkill, askedQuestionIds);
    if (item) return item;

    // Fallback: search neighbors
    const neighbors = [currentIndex - 1, currentIndex + 1].filter(
      i => i >= 0 && i < LEVEL_ORDER.length
    );
    for (const ni of neighbors) {
       const fallback = this.pickFromLevel(LEVEL_ORDER[ni], targetSkill, askedQuestionIds);
       if (fallback) return fallback;
    }

    return null;
  }

  private pickFromLevel(level: CEFRLevel, skill: SkillName, askedIds: Set<string>): QuestionBankItem | null {
    const available = this.banks[level].filter(
      q => !askedIds.has(q.id) && (q.skill === skill || skill in q.evidence_policy)
    );
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  private scoreToLevel(score: number): CEFRLevel {
    if (score < 0.40) return 'A1';
    if (score < 0.55) return 'A2';
    if (score < 0.70) return 'B1';
    if (score < 0.83) return 'B2';
    if (score < 0.93) return 'C1';
    return 'C2';
  }
}
