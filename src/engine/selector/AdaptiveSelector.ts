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

  // 🎯 New Academic Thresholds (More Rewarding)
  private readonly STEP_UP_THRESHOLD = 0.75; 
  private readonly LEAP_UP_THRESHOLD = 0.85;

  constructor(banks: Record<CEFRLevel, QuestionBankItem[]>) {
    this.banks = banks;
  }

  public selectSwap(currentLevel: CEFRLevel, currentSkill: SkillName, askedIds: Set<string>): QuestionBankItem | null {
    console.log(`[Selector] SWAP | Hunting for alternate in: ${currentLevel} ${currentSkill}`);
    const item = this.pickFromLevel(currentLevel, currentSkill, askedIds);
    if (item) return item;

    // 🚩 Fallback: Adjacent levels for same skill
    const targetIndex = LEVEL_ORDER.indexOf(currentLevel);
    const neighbors = [...LEVEL_ORDER].sort((a, b) => 
      Math.abs(LEVEL_ORDER.indexOf(a) - targetIndex) - Math.abs(LEVEL_ORDER.indexOf(b) - targetIndex)
    );
    
    for (const level of neighbors) {
      const fallback = this.pickFromLevel(level, currentSkill, askedIds);
      if (fallback) return fallback;
    }

    return null;
  }

  public selectNext(state: SelectorState): QuestionBankItem | null {
    const { skills, askedQuestionIds, currentOverallLevel } = state;
    const questionCount = askedQuestionIds.size;
    
    // 🔍 Diagnostic Logging for Bank Visibility
    const totalBankSize = Object.values(this.banks).reduce((acc, b) => acc + b.length, 0);
    console.log(`[Selector] 🎯 Current Bank Visibility: ${totalBankSize} questions.`);

    // --------------------------------------------------------------------------
    // PHASE 1: CALIBRATION (First 4 questions)
    // --------------------------------------------------------------------------
    if (questionCount < 4) {
      const calibrationOrder: SkillName[] = ['listening', 'reading', 'writing', 'speaking'];
      const targetSkill = calibrationOrder[questionCount];
      console.log(`[Selector] Phase 1: CALIBRATION | target: ${targetSkill} | level: ${currentOverallLevel}`);
      
      const item = this.pickFromLevel(currentOverallLevel, targetSkill, askedQuestionIds);
      if (item) return item;

      // 🛡️ Proximity Radiating Search (Same skill, neighbor levels)
      const neighbors = this.getNeighborLevels(currentOverallLevel);
      for (const level of neighbors) {
        const fallback = this.pickFromLevel(level, targetSkill, askedQuestionIds);
        if (fallback) return fallback;
      }
    }

    // --------------------------------------------------------------------------
    // PHASE 2: ADAPTIVE ROUTING
    // --------------------------------------------------------------------------
    const coreSkills: SkillName[] = ['listening', 'reading', 'writing', 'speaking'];
    
    // Pick target skill (lowest confidence or repair coverage)
    let targetSkill: SkillName;
    const underEvidenced = coreSkills.filter(s => skills[s].directEvidenceCount < 2);
    
    if (questionCount >= 12 && underEvidenced.length > 0) {
      targetSkill = underEvidenced[0];
      console.log(`[Selector] Phase 3: REPAIR | target: ${targetSkill}`);
    } else {
      const missingAny = coreSkills.filter(s => skills[s].directEvidenceCount === 0);
      if (missingAny.length > 0) {
         targetSkill = missingAny[Math.floor(Math.random() * missingAny.length)];
      } else {
         targetSkill = coreSkills.sort((a, b) => skills[a].confidence - skills[b].confidence)[0];
      }
    }

    const skillState = skills[targetSkill];
    const skillLevel = CEFREngine.mapScoreToLevel(skillState.score);
    const currentIndex = LEVEL_ORDER.indexOf(skillLevel);

    // 🧠 Momentum Calculation (Weighted history)
    const history = skillState.history.slice(-3);
    const s0 = history.length >= 1 ? history[history.length - 1].score : 0.5;
    const s1 = history.length >= 2 ? history[history.length - 2].score : s0;
    const s2 = history.length >= 3 ? history[history.length - 3].score : s1;
    const momentum = (s0 * 0.5) + (s1 * 0.3) + (s2 * 0.2);

    // 🧗 Adaptive Logic using new Academic Thresholds
    let probeLevel = currentOverallLevel;
    const isLeapUp = history.length >= 2 && history.slice(-2).every(h => h.score >= this.LEAP_UP_THRESHOLD);
    const isStepUp = momentum >= this.STEP_UP_THRESHOLD;
    const isStepDown = momentum < 0.40;

    if (isLeapUp && currentIndex < LEVEL_ORDER.length - 1) {
      const jumpSize = (questionCount < 10) ? 2 : 1;
      probeLevel = LEVEL_ORDER[Math.min(LEVEL_ORDER.length - 1, currentIndex + jumpSize)];
      console.log(`[Selector] 🚀 LEAP UP! +${jumpSize} to ${probeLevel}`);
    } else if (isStepUp && currentIndex < LEVEL_ORDER.length - 1) {
      probeLevel = LEVEL_ORDER[currentIndex + 1];
      console.log(`[Selector] 🧗 Step Up to ${probeLevel} (Momentum: ${momentum.toFixed(2)})`);
    } else if (isStepDown && currentIndex > 0) {
      probeLevel = LEVEL_ORDER[currentIndex - 1];
      console.log(`[Selector] 📉 Step Down to ${probeLevel}`);
    }

    // 1. Attempt Exact Match
    console.log(`[Selector] Phase 2: ADAPTIVE | Hunting: ${probeLevel} ${targetSkill}`);
    let nextItem = this.pickFromLevel(probeLevel, targetSkill, askedQuestionIds);
    if (nextItem) return nextItem;

    // 2. 🚩 Relaxation 1: Neighbor Levels (Same Skill)
    console.log(`[Selector] Relaxing Level constraints for ${targetSkill}...`);
    const neighbors = this.getNeighborLevels(probeLevel);
    for (const level of neighbors) {
      nextItem = this.pickFromLevel(level, targetSkill, askedQuestionIds);
      if (nextItem) return nextItem;
    }

    // 3. 🚩 Relaxation 2: Neighbor Skills (Same Level)
    console.log(`[Selector] Relaxing Skill constraints for ${probeLevel}...`);
    for (const skill of coreSkills) {
      nextItem = this.pickFromLevel(probeLevel, skill, askedQuestionIds);
      if (nextItem) return nextItem;
    }

    // 4. 🚩 ABSOLUTE FALLBACK: Any unused question (Total Exhaustion Prevention)
    console.warn(`[Selector] CRITICAL: Running Absolute Fallback...`);
    for (const level of LEVEL_ORDER) {
      for (const skill of coreSkills) {
        nextItem = this.pickFromLevel(level, skill, askedQuestionIds);
        if (nextItem) {
          console.log(`[Selector] ✅ Absolute Fallback SUCCESS: ${nextItem.id}`);
          return nextItem;
        }
      }
    }

    console.error("[Selector] 💀 BANK TOTALLY EXHAUSTED.");
    return null;
  }

  private getNeighborLevels(level: CEFRLevel): CEFRLevel[] {
    const idx = LEVEL_ORDER.indexOf(level);
    return [...LEVEL_ORDER].sort((a, b) => 
      Math.abs(LEVEL_ORDER.indexOf(a) - idx) - Math.abs(LEVEL_ORDER.indexOf(b) - idx)
    ).filter(l => l !== level);
  }

  private pickFromLevel(level: CEFRLevel, skill: SkillName, askedIds: Set<string>): QuestionBankItem | null {
    const bank = this.banks[level] || [];
    const available = bank.filter(
      q => {
        if (askedIds.has(q.id)) return false;
        
        // 🎯 Alias-First Matching: The engine now ensures 'level' is present and normalized.
        if (q.level !== level && q.target_cefr !== level) return false;

        // 🧠 Skill Matching: The engine ensures 'skill' is lowercase and trimmed.
        return q.skill === skill || (q.evidence_policy && skill in q.evidence_policy);
      }
    );
    
    if (available.length === 0) return null;
    
    // Pick the most distinct task type if possible (TBD: could add task type tracking here)
    return available[Math.floor(Math.random() * available.length)];
  }
}
