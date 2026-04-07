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

  constructor(banks: Record<CEFRLevel, QuestionBankItem[]>) {
    this.banks = banks;
  }

  public selectSwap(currentLevel: CEFRLevel, currentSkill: SkillName, askedIds: Set<string>): QuestionBankItem | null {
    console.log(`[Selector] SWAP | skill: ${currentSkill} | level: ${currentLevel}`);
    return this.pickFromLevel(currentLevel, currentSkill, askedIds);
  }

  public selectNext(state: SelectorState): QuestionBankItem | null {

    const { skills, askedQuestionIds, currentOverallLevel } = state;
    const questionCount = askedQuestionIds.size;
    
    // 🔍 Diagnostic Logging for Bank Visibility
    const totalBankSize = Object.values(this.banks).reduce((acc, b) => acc + b.length, 0);
    console.log(`[Selector] Diagnostic | Current Bank Visibility: ${totalBankSize} questions.`);

    // --------------------------------------------------------------------------
    // PHASE 1: STRUCTURED CALIBRATION (First 4 questions)
    // --------------------------------------------------------------------------
    if (questionCount < 4) {
      const calibrationOrder: SkillName[] = ['listening', 'reading', 'writing', 'speaking'];
      const targetSkill = calibrationOrder[questionCount];
      console.log(`[Selector] Phase 1: CALIBRATION | target: ${targetSkill}`);
      const item = this.pickFromLevel(currentOverallLevel, targetSkill, askedQuestionIds);
      if (item) return item;

      // 🛡️ Radiating Search: Search levels by proximity to currentOverallLevel
      // This prevents "fleeing" to A1 if B1 is empty; it will try B2 or A2 first.
      const targetIndex = LEVEL_ORDER.indexOf(currentOverallLevel);
      const searchOrder = [...LEVEL_ORDER].sort((a, b) => 
        Math.abs(LEVEL_ORDER.indexOf(a) - targetIndex) - Math.abs(LEVEL_ORDER.indexOf(b) - targetIndex)
      );

      for (const level of searchOrder) {
        if (level === currentOverallLevel) continue; // Already tried in line 42
        const fallback = this.pickFromLevel(level, targetSkill, askedQuestionIds);
        if (fallback) {
          console.log(`[Selector] Phase 1 fallback: Found ${targetSkill} at ${level} (Target was ${currentOverallLevel})`);
          return fallback;
        }
      }
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
    
    // 🧠 Skill-Specific Baseline: Calculate level based on THIS skill's score, not the average.
    // This allows a C1 Writing skill to probe C2 regardless of other skills.
    const skillLevel = CEFREngine.mapScoreToLevel(skillState.score);
    const currentIndex = LEVEL_ORDER.indexOf(skillLevel);
    
    // Boundary Testing with Momentum
    const recent = skillState.history.slice(-2);
    const isStruggling = recent.length >= 1 && recent.every(h => h.score < 0.4);
    const isExelling = recent.length >= 1 && recent.every(h => h.score > 0.82);

    let probeLevel: CEFRLevel = currentOverallLevel;
    
    // 📈 Momentum & Leapfrog Strategy
    const history = skillState.history;
    const h3 = history.slice(-3);
    
    // Formula: (n * 0.5) + (n-1 * 0.3) + (n-2 * 0.2)
    const s0 = h3.length >= 1 ? h3[h3.length - 1].score : 0.5;
    const s1 = h3.length >= 2 ? h3[h3.length - 2].score : s0;
    const s2 = h3.length >= 3 ? h3[h3.length - 3].score : s1;
    const momentumScore = (s0 * 0.5) + (s1 * 0.3) + (s2 * 0.2);

    // Streak detection for jumps
    const isHighStreak = h3.length >= 2 && h3.slice(-2).every(h => h.score > 0.90);
    const isLowStreak = h3.length >= 2 && h3.slice(-2).every(h => h.score < 0.20);

    probeLevel = currentOverallLevel;
    
    if (isHighStreak && currentIndex < LEVEL_ORDER.length - 1) {
       // 🚀 LEAP UP: (+2) only in early calibration phase, otherwise (+1)
       const leapSize = (questionCount < 10) ? 2 : 1;
       probeLevel = LEVEL_ORDER[Math.min(LEVEL_ORDER.length - 1, currentIndex + leapSize)];
       console.log(`[Selector] LEAP UP! +${leapSize} to ${probeLevel} (Streak detected)`);
    } else if (isLowStreak && currentIndex > 1) {
       // 📉 LEAP DOWN: (-2) only if performance is consistently poor, otherwise (-1)
       const dropSize = (questionCount < 10) ? 2 : 1;
       probeLevel = LEVEL_ORDER[Math.max(0, currentIndex - dropSize)];
       console.log(`[Selector] LEAP DOWN! -${dropSize} to ${probeLevel} (Loss Streak detected)`);
    } else if (momentumScore < 0.40 && currentIndex > 0) {
       // 🐌 Step Down (-1)
       probeLevel = LEVEL_ORDER[currentIndex - 1];
       console.log(`[Selector] Momentum Step Down to ${probeLevel} (Momentum: ${momentumScore.toFixed(2)})`);
    } else if (momentumScore > 0.82 && currentIndex < LEVEL_ORDER.length - 1) {
       // 🧗 Step Up (+1)
       probeLevel = LEVEL_ORDER[currentIndex + 1];
       console.log(`[Selector] Momentum Step Up to ${probeLevel} (Momentum: ${momentumScore.toFixed(2)})`);
    } else {
       // ⚖️ Fast-Track Probing (Cautious)
       const reachProb = skillState.confidence >= 0.4 ? 0.3 : 0.15; // Slightly more cautious
       const rand = Math.random();
       if (rand < 0.05 && currentIndex > 0) {
         probeLevel = LEVEL_ORDER[currentIndex - 1];
       } else if (rand > (1 - reachProb) && currentIndex < LEVEL_ORDER.length - 1) {
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
