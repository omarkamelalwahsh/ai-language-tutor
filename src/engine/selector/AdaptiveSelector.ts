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
    const questionCount = askedQuestionIds.size;

    // --------------------------------------------------------------------------
    // PHASE 1: STRUCTURED CALIBRATION (First 4 questions)
    // --------------------------------------------------------------------------
    if (questionCount < 4) {
      const calibrationOrder: SkillName[] = ['listening', 'reading', 'writing', 'speaking'];
      const targetSkill = calibrationOrder[questionCount];
      console.log(`[Selector] Phase 1: CALIBRATION | target: ${targetSkill}`);
      return this.pickFromLevel(currentOverallLevel, targetSkill, askedQuestionIds);
    }

    // --------------------------------------------------------------------------
    // PHASE 3: REPAIR / COVERAGE (Near the end or if evidence is low)
    // --------------------------------------------------------------------------
    const coreSkills: SkillName[] = ['listening', 'reading', 'writing', 'speaking'];
    const underEvidenced = coreSkills.filter(s => skills[s].directEvidenceCount < 2);
    
    if (questionCount >= 12 && underEvidenced.length > 0) {
      const targetSkill = underEvidenced[0];
      console.log(`[Selector] Phase 3: REPAIR | target: ${targetSkill}`);
      return this.pickFromLevel(currentOverallLevel, targetSkill, askedQuestionIds);
    }

    // --------------------------------------------------------------------------
    // PHASE 2: ADAPTIVE ROUTING
    // --------------------------------------------------------------------------
    
    // Choose skill based on lowest confidence or missing evidence
    let targetSkill: SkillName;
    const missingAny = coreSkills.filter(s => skills[s].directEvidenceCount === 0);
    
    if (missingAny.length > 0) {
      targetSkill = missingAny[Math.floor(Math.random() * missingAny.length)];
    } else {
      targetSkill = coreSkills.sort((a, b) => skills[a].confidence - skills[b].confidence)[0];
    }

    const skillState = skills[targetSkill];
    const currentIndex = LEVEL_ORDER.indexOf(currentOverallLevel);
    
    // Boundary Testing with Momentum
    const recent = skillState.history.slice(-2);
    const isStruggling = recent.length === 2 && recent.every(h => h.score < 0.4);
    const isExelling = recent.length === 2 && recent.every(h => h.score > 0.8);

    let probeLevel: CEFRLevel = currentOverallLevel;
    if (isStruggling && currentIndex > 0) {
      probeLevel = LEVEL_ORDER[currentIndex - 1]; // Step down
    } else if (isExelling && currentIndex < LEVEL_ORDER.length - 1) {
      probeLevel = LEVEL_ORDER[currentIndex + 1]; // Step up
    } else {
      // Random Probe logic (20/60/20)
      const rand = Math.random();
      if (rand < 0.2 && currentIndex > 0) {
        probeLevel = LEVEL_ORDER[currentIndex - 1];
      } else if (rand > 0.8 && currentIndex < LEVEL_ORDER.length - 1) {
        probeLevel = LEVEL_ORDER[currentIndex + 1];
      }
    }

    console.log(`[Selector] Phase 2: ADAPTIVE | skill: ${targetSkill} | target: ${probeLevel}`);
    const item = this.pickFromLevel(probeLevel, targetSkill, askedQuestionIds);
    
    if (item) return item;

    // --------------------------------------------------------------------------
    // FALLBACKS (Exhaustion Management)
    // --------------------------------------------------------------------------
    console.log(`[Selector] Target level ${probeLevel} for ${targetSkill} exhausted. Searching neighbors...`);
    
    // Try other levels for the SAME skill
    for (const level of LEVEL_ORDER) {
      const fallback = this.pickFromLevel(level, targetSkill, askedQuestionIds);
      if (fallback) return fallback;
    }

    // Try other skills at ANY level (Desperation)
    for (const skill of coreSkills) {
      for (const level of LEVEL_ORDER) {
        const desperateFallback = this.pickFromLevel(level, skill, askedQuestionIds);
        if (desperateFallback) return desperateFallback;
      }
    }

    return null;
  }

  private pickFromLevel(level: CEFRLevel, skill: SkillName, askedIds: Set<string>): QuestionBankItem | null {
    const bank = this.banks[level] || [];
    const available = bank.filter(
      q => !askedIds.has(q.id) && (q.skill === skill || (q.evidence_policy && skill in q.evidence_policy))
    );
    
    if (available.length === 0) return null;
    
    // Pick the most distinct task type if possible (TBD: could add task type tracking here)
    return available[Math.floor(Math.random() * available.length)];
  }
}
