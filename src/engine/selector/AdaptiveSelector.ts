import { CEFRLevel, QuestionBankItem, SkillState, SkillName } from '../../types/efset';
import { CEFREngine } from '../cefr/CEFREngine';

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

  private readonly SKILL_CAPS: Record<SkillName, number> = {
    listening: 4,
    reading: 4,
    writing: 4,
    speaking: 5
  };

  private readonly shuffledRR: SkillName[];

  constructor(banks: Record<CEFRLevel, QuestionBankItem[]>) {
    this.banks = banks;
    // 🎲 Initialize Randomized Round Robin sequence for this session
    const coreSkills: SkillName[] = ['listening', 'reading', 'writing', 'speaking'];
    this.shuffledRR = [...coreSkills].sort(() => Math.random() - 0.5);
  }

  public selectNext(state: SelectorState): QuestionBankItem | null {
    const { skills, askedQuestionIds, currentOverallLevel } = state;
    const count = askedQuestionIds.size;
    
    // 🎯 STRICLY EQUAL DISTRIBUTION: 20 questions / 4 core skills = exactly 5 questions per skill
    const targetSkill = this.shuffledRR[count % this.shuffledRR.length];

    console.log(`[Selector] Round Robin | target: ${targetSkill} | level: ${currentOverallLevel} | Q: ${count + 1}/20`);

    // 2. Determine target level (Adaptive based on recent momentum)
    const skillState = skills[targetSkill];
    const momentum = skillState.history.slice(-2).reduce((acc, h) => acc + h.score, 0) / 2 || 0.5;

    let targetLevel = currentOverallLevel;
    if (momentum > 0.8 && LEVEL_ORDER.indexOf(currentOverallLevel) < 5) {
      targetLevel = LEVEL_ORDER[LEVEL_ORDER.indexOf(currentOverallLevel) + 1];
    } else if (momentum < 0.4 && LEVEL_ORDER.indexOf(currentOverallLevel) > 0) {
      targetLevel = LEVEL_ORDER[LEVEL_ORDER.indexOf(currentOverallLevel) - 1];
    }

    return this.findBestItem(targetLevel, targetSkill, askedQuestionIds);
  }

  private findBestItem(level: CEFRLevel, skill: SkillName, askedIds: Set<string>): QuestionBankItem | null {
    // Exact match
    let item = this.pickFromLevel(level, skill, askedIds);
    if (item) return item;

    // Neighbor fallback
    const neighbors = this.getNeighbors(level);
    for (const l of neighbors) {
      item = this.pickFromLevel(l, skill, askedIds);
      if (item) return item;
    }

    // Absolute fallback (Any unused in same level)
    return this.pickFromLevel(level, 'any' as any, askedIds) || null;
  }

  private getNeighbors(level: CEFRLevel): CEFRLevel[] {
    const idx = LEVEL_ORDER.indexOf(level);
    return [...LEVEL_ORDER].sort((a, b) => 
      Math.abs(LEVEL_ORDER.indexOf(a) - idx) - Math.abs(LEVEL_ORDER.indexOf(b) - idx)
    ).filter(l => l !== level);
  }

  private pickFromLevel(level: CEFRLevel, skill: SkillName, askedIds: Set<string>): QuestionBankItem | null {
    const bank = this.banks[level] || [];
    const available = bank.filter(q => {
      if (askedIds.has(q.id)) return false;
      if (q.level !== level && q.target_cefr !== level) return false;
      return skill === 'any' || q.skill === skill;
    });
    
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }
}
