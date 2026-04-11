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
    const coreSkills: SkillName[] = ['listening', 'reading', 'writing', 'speaking'];

    // --------------------------------------------------------------------------
    // PHASE 1: RANDOMIZED ROUND ROBIN (1-4)
    // --------------------------------------------------------------------------
    if (count < 4) {
      const targetSkill = this.shuffledRR[count];
      console.log(`[Selector] Phase 1: SHUFFLED RR | target: ${targetSkill} | level: ${currentOverallLevel}`);
      return this.findBestItem(currentOverallLevel, targetSkill, askedQuestionIds);
    }

    // --------------------------------------------------------------------------
    // PHASE 2 & 3: ADAPTIVE & WILDCARDS (5-20)
    // --------------------------------------------------------------------------
    const isAdvocatePhase = count >= 17; // Questions 18, 19, 20
    
    // 1. Determine target skill
    let targetSkill: SkillName;

    if (isAdvocatePhase) {
      // PHASE 3: Wildcard Advocate - Prioritize weakest link
      targetSkill = coreSkills.sort((a, b) => skills[a].score - skills[b].score)[0];
      console.log(`[Selector] Phase 3: WILDCARD ADVOCATE | Lifting weakest link: ${targetSkill}`);
    } else {
      // PHASE 2: Adaptive with Slot Management
      const availableSkills = coreSkills.filter(s => {
        const used = skills[s].directEvidenceCount;
        const capped = used >= this.SKILL_CAPS[s];
        if (capped) console.log(`[Selector] 🚫 Slot for ${s} capped (${used}/${this.SKILL_CAPS[s]})`);
        return !capped;
      });

      const missingAny = availableSkills.filter(s => skills[s].directEvidenceCount === 0);
      if (missingAny.length > 0) {
        targetSkill = missingAny[Math.floor(Math.random() * missingAny.length)];
      } else {
        // Normal Adaptive: Pick lowest confidence from available pool
        const pool = availableSkills.length > 0 ? availableSkills : coreSkills;
        targetSkill = pool.sort((a, b) => skills[a].confidence - skills[b].confidence)[0];
      }
    }

    // 2. Determine target level
    const skillState = skills[targetSkill];
    const currentScore = skillState.score;
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
