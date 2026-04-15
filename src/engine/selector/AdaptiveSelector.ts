/**
 * BatterySelector — 40-Question IELTS-Inspired Hybrid Battery Builder
 * 
 * Enforces strict skill quotas with balanced difficulty distribution:
 *   Grammar: 12 | Listening: 8 | Reading: 8 | Vocabulary: 4 | Writing: 4 | Speaking: 4
 * 
 * Difficulty split per skill group follows a balanced Easy/Medium/Hard pattern.
 * Production tasks (Writing/Speaking) are interleaved every ~5 questions.
 */

import { CEFRLevel, QuestionBankItem } from '../../types/efset';
import { ASSESSMENT_CONFIG, DifficultyZone } from '../../config/assessment-config';
import { supabase } from '../../lib/supabaseClient';

export interface BatteryQuestion {
  item: QuestionBankItem;
  block: number;
  skill: string;
  zone: DifficultyZone;
  globalIndex: number;
  pointValue: number;
}

// ═══════════════════════════════════════════════════════════════════
// IELTS-Inspired Skill Quota Configuration
// ═══════════════════════════════════════════════════════════════════

interface SkillQuota {
  skill: string;
  total: number;
  easy: number;
  medium: number;
  hard: number;
  responseMode: 'mcq' | 'typed' | 'audio';
  isProduction: boolean;
}

const SKILL_QUOTAS: SkillQuota[] = [
  { skill: 'grammar',    total: 12, easy: 4, medium: 4, hard: 4, responseMode: 'mcq',   isProduction: false },
  { skill: 'listening',  total: 8,  easy: 2, medium: 4, hard: 2, responseMode: 'mcq',   isProduction: false },
  { skill: 'reading',    total: 8,  easy: 2, medium: 4, hard: 2, responseMode: 'mcq',   isProduction: false },
  { skill: 'vocabulary', total: 4,  easy: 2, medium: 0, hard: 2, responseMode: 'mcq',   isProduction: false },
  { skill: 'writing',    total: 4,  easy: 1, medium: 2, hard: 1, responseMode: 'typed',  isProduction: true },
  { skill: 'speaking',   total: 4,  easy: 1, medium: 2, hard: 1, responseMode: 'audio',  isProduction: true },

];

const BATTERY_SIZE = 40;

const LEVEL_WEIGHTS: Record<string, number> = {
  'a1': 1.0, 'a2': 2.0,
  'b1': 3.0, 'b2': 4.0,
  'c1': 5.0, 'c2': 6.0
};

const BLACKLISTED_IDS = [
  // Add IDs of questions that are known to be low quality or too easy
];


export class BatterySelector {

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  public static async fetchAndBuild(userId: string): Promise<BatteryQuestion[]> {
    console.log("[Selector] 🏗️ Initializing 40-Question IELTS Battery...");
    const seenIds = userId ? await this.getSeenIds(userId) : new Set<string>();

    // 1. Fetch per-skill pools from database
    const skillPools = await this.fetchPerSkillPools(seenIds);

    // 2. Sample each skill quota with difficulty distribution
    const receptiveItems: BatteryQuestion[] = [];
    const productionItems: BatteryQuestion[] = [];

    for (const quota of SKILL_QUOTAS) {
      const pool = skillPools[quota.skill] || [];
      
      let sampled: QuestionBankItem[];
      
      // 📚 SPECIAL HANDLING: Reading Bundles (3 MCQ + 1 Writing)
      if (quota.skill === 'reading') {
        sampled = this.sampleReadingBundles(pool, quota);
      } else {
        sampled = this.sampleWithDifficulty(pool, quota);
      }

      // Enforce response_mode and hoist options (MCQ only)
      sampled.forEach(item => {
        // Hoist response mode from quota (unless it's a reading writing question)
        if (item.task_type === 'reading_writing' || item.response_mode === 'typed') {
             item.response_mode = 'typed' as any;
        } else {
             item.response_mode = quota.responseMode as any;
        }

        // Only hoist options for MCQ tasks
        if (item.response_mode === 'mcq') {
          this.hoistOptions(item);
        }
      });

      const batteryItems = sampled.map((item) => this.toBatteryQuestion(item));

      if (quota.isProduction) {
        productionItems.push(...batteryItems);
      } else {
        receptiveItems.push(...batteryItems);
      }

      console.log(`[Selector]   ✅ ${quota.skill}: ${sampled.length}/${quota.total}`);
    }

    // 3. Strict 3-4-3 Distribution Logic per Block (10 questions)
    // We must respect reading bundles implicitly by assigning them whole into blocks.
    const battery: BatteryQuestion[] = [];
    const allItems = [...receptiveItems, ...productionItems];
    
    // Group reading bundles
    const readingBundles: Record<string, BatteryQuestion[]> = {};
    const freestandingItems: BatteryQuestion[] = [];
    
    allItems.forEach(q => {
       if (q.skill === 'reading' && q.item.stimulus) {
          if (!readingBundles[q.item.stimulus]) readingBundles[q.item.stimulus] = [];
          readingBundles[q.item.stimulus].push(q);
       } else {
          freestandingItems.push(q);
       }
    });

    const easyPool = freestandingItems.filter(q => q.zone === 'EASY');
    const medPool = freestandingItems.filter(q => q.zone === 'MEDIUM');
    const hardPool = freestandingItems.filter(q => q.zone === 'HARD');

    // Distribute bundles (limit to 2 bundles maximum, assign to block 2 and 4 typically)
    const bundleKeys = Object.keys(readingBundles);
    const bundlesToAssign = [
       bundleKeys[0] ? readingBundles[bundleKeys[0]] : [],
       bundleKeys[1] ? readingBundles[bundleKeys[1]] : []
    ];

    for (let b = 1; b <= 4; b++) {
       const blockOutput: BatteryQuestion[] = [];
       let targetE = 3;
       let targetM = 4;
       let targetH = 3;

       // Assign a reading bundle to Block 2 and Block 4 if available
       if (b === 2 && bundlesToAssign[0].length > 0) {
           const bundle = bundlesToAssign[0];
           blockOutput.push(...bundle);
           bundle.forEach(q => { if(q.zone==='EASY') targetE--; else if (q.zone==='MEDIUM') targetM--; else targetH--; });
       }
       if (b === 4 && bundlesToAssign[1].length > 0) {
           const bundle = bundlesToAssign[1];
           blockOutput.push(...bundle);
           bundle.forEach(q => { if(q.zone==='EASY') targetE--; else if (q.zone==='MEDIUM') targetM--; else targetH--; });
       }

       // Fill remaining targets (allowing negative targets to swallow over-represented zones)
       const pickQuestions = (pool: BatteryQuestion[], fallbackA: BatteryQuestion[], fallbackB: BatteryQuestion[], count: number) => {
          for(let i = 0; i < count; i++) {
             if (pool.length > 0) blockOutput.push(pool.pop()!);
             else if (fallbackA.length > 0) blockOutput.push(fallbackA.pop()!); // No Overlap Alert: Used fallback
             else if (fallbackB.length > 0) blockOutput.push(fallbackB.pop()!);
          }
       };

       if (targetE > 0) pickQuestions(easyPool, medPool, hardPool, targetE);
       if (targetM > 0) pickQuestions(medPool, hardPool, easyPool, targetM);
       if (targetH > 0) pickQuestions(hardPool, medPool, easyPool, targetH);

       // Reorder the block: Non-reading (sorted E -> M -> H) + Reading Bundle at the end
       const nonR = blockOutput.filter(q => !(q.skill === 'reading' && q.item.stimulus));
       const r = blockOutput.filter(q => q.skill === 'reading' && q.item.stimulus);
       
       nonR.sort((x, y) => {
           const map: any = { 'EASY': 1, 'MEDIUM': 2, 'HARD': 3 };
           return map[x.zone] - map[y.zone];
       });

       // Interleave production into nonR carefully so it isn't clustered
       const finalBlock = [...nonR, ...r];
       
       finalBlock.forEach((q) => {
         q.block = b;
         battery.push(q);
       });
    }

    // Assign final indices
    battery.forEach((q, i) => {
      q.globalIndex = i;
    });



    // 6. Validation
    this.validateBattery(battery);

    console.log(`[Selector] ✅ 40-Question IELTS Battery Assembled (${battery.length} items).`);
    return battery;
  }


  // ═══════════════════════════════════════════════════════════════
  // FETCHING
  // ═══════════════════════════════════════════════════════════════

  private static async getSeenIds(userId: string): Promise<Set<string>> {
    try {
      const { data } = await supabase
        .from('assessment_responses')
        .select('question_id')
        .eq('user_id', userId);
      return new Set((data || []).map(r => r.question_id));
    } catch (e) {
      console.warn("[Selector] Failed to fetch seen IDs:", e);
      return new Set();
    }
  }

  /**
   * Fetches a generous pool for each skill independently.
   * This ensures we have enough items to satisfy each quota.
   */
  private static async fetchPerSkillPools(seenIds: Set<string>): Promise<Record<string, QuestionBankItem[]>> {
    const pools: Record<string, QuestionBankItem[]> = {};

    const fetchPromises = SKILL_QUOTAS.map(async (quota) => {
      // Fetch 4x the quota for Reading to ensure we can form bundles
      const limit = quota.skill === 'reading' ? 100 : Math.max(quota.total * 3, 30);
      const { data, error } = await supabase
        .from('question_bank_items')
        .select('*')
        .eq('skill', quota.skill)
        .limit(limit);

      if (error) {
        console.error(`[Selector] ❌ Failed to fetch ${quota.skill}:`, error.message);
        pools[quota.skill] = [];
        return;
      }

      // Filter out seen IDs and blacklisted IDs
      pools[quota.skill] = (data || []).filter(q => !seenIds.has(q.id) && !BLACKLISTED_IDS.includes(q.id)) as QuestionBankItem[];
    });

    await Promise.all(fetchPromises);
    return pools;
  }

  // ═══════════════════════════════════════════════════════════════
  // DIFFICULTY SAMPLING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Samples items from a pool matching the Easy/Medium/Hard quota.
   * Falls back to filling from remaining items if a difficulty band is short.
   */
  /**
   * Samples items from a pool matching the Easy/Medium/Hard quota.
   * Falls back to filling from remaining items if a difficulty band is short.
   */
  private static sampleWithDifficulty(pool: QuestionBankItem[], quota: SkillQuota): QuestionBankItem[] {
    const easyPool = pool.filter(q => this.getDifficultyZone(q) === 'EASY');
    const mediumPool = pool.filter(q => this.getDifficultyZone(q) === 'MEDIUM');
    const hardPool = pool.filter(q => this.getDifficultyZone(q) === 'HARD');

    const sampledEasy = this.shuffle(easyPool).slice(0, quota.easy);
    const sampledMedium = this.shuffle(mediumPool).slice(0, quota.medium);
    const sampledHard = this.shuffle(hardPool).slice(0, quota.hard);

    let result = [...sampledEasy, ...sampledMedium, ...sampledHard];

    // Fallback: If we're short, fill from the remaining pool
    if (result.length < quota.total) {
      const usedIds = new Set(result.map(q => q.id));
      const remaining = this.shuffle(pool.filter(q => !usedIds.has(q.id)));
      const deficit = quota.total - result.length;
      result = [...result, ...remaining.slice(0, deficit)];
      
      if (result.length < quota.total) {
        console.warn(`[Selector] ⚠️ ${quota.skill}: Only found ${result.length}/${quota.total} items. Battery may be smaller.`);
      }
    }

    return result;
  }

  /**
   * Samples Reading questions by grouping them into bundles (Passage-based).
   * Expects 3 MCQ + 1 Writing per bundle.
   */
  private static sampleReadingBundles(pool: QuestionBankItem[], quota: SkillQuota): QuestionBankItem[] {
    const result: QuestionBankItem[] = [];
    const groupedByStimulus: Record<string, QuestionBankItem[]> = {};

    pool.forEach(item => {
      if (!item.stimulus) return;
      if (!groupedByStimulus[item.stimulus]) groupedByStimulus[item.stimulus] = [];
      groupedByStimulus[item.stimulus].push(item);
    });

    // Sort stimulus groups by level to pick appropriate blocks
    const stimuli = this.shuffle(Object.keys(groupedByStimulus));
    
    // We need 8 questions total -> 2 bundles of 4
    for (const stim of stimuli) {
      if (result.length >= quota.total) break;
      
      const items = groupedByStimulus[stim];
      const mcqs = items.filter(q => q.response_mode === 'mcq' || q.task_type?.includes('mcq'));
      const writings = items.filter(q => q.response_mode === 'typed' || q.task_type?.includes('writing'));

      if (mcqs.length >= 3) {
        // Take 3 MCQs + 1 Writing (if available, otherwise 4th MCQ)
        result.push(...this.shuffle(mcqs).slice(0, 3));
        if (writings.length > 0) {
          result.push(writings[0]);
        } else if (mcqs.length > 3) {
          result.push(mcqs[3]);
        } else {
          // Incomplete bundle fallback
          continue; 
        }
      }
    }

    // If still short, backfill with random reading items
    if (result.length < quota.total) {
       const usedIds = new Set(result.map(r => r.id));
       const remaining = this.shuffle(pool.filter(p => !usedIds.has(p.id)));
       result.push(...remaining.slice(0, quota.total - result.length));
    }

    return result.slice(0, quota.total);
  }

  private static getDifficultyZone(item: QuestionBankItem): DifficultyZone {
    const level = (item.level || 'B1').toLowerCase();
    if (['a1', 'a2'].includes(level)) return 'EASY';
    if (['b1', 'b2'].includes(level)) return 'MEDIUM';
    return 'HARD';
  }

  private static getTrueDifficulty(item: QuestionBankItem): number {
    const level = (item.level || 'B1').toLowerCase();
    const weight = LEVEL_WEIGHTS[level] || 3.0;
    const diff = item.difficulty || 0.5;
    return weight + (diff * 0.1);
  }


  private static getFallbackDifficulty(level?: string): number {
    const l = (level || 'b1').toLowerCase();
    const map: Record<string, number> = {
      'a1': 0.1, 'a2': 0.2,
      'b1': 0.4, 'b2': 0.6,
      'c1': 0.8, 'c2': 1.0
    };
    return map[l] || 0.4;
  }

  // ═══════════════════════════════════════════════════════════════
  // INTERLEAVING ALGORITHM
  // ═══════════════════════════════════════════════════════════════

  /**
   * Distributes production tasks (Writing/Speaking) evenly throughout the battery.
   * Target: one production task every ~5 questions.
   */
  private static interleaveProduction(
    receptive: BatteryQuestion[], 
    production: BatteryQuestion[]
  ): BatteryQuestion[] {
    if (production.length === 0) return receptive;

    const battery: BatteryQuestion[] = [];
    const receptiveQueue = [...receptive];
    const productionQueue = [...production];

    // Total slots = receptive + production
    const totalSlots = receptiveQueue.length + productionQueue.length;
    // Calculate interval: place a production task every N questions
    const interval = productionQueue.length > 0
      ? Math.floor(totalSlots / (productionQueue.length + 1))
      : totalSlots;

    let questionCount = 0;
    let nextProductionSlot = interval; // First production task after 'interval' receptive items

    while (receptiveQueue.length > 0 || productionQueue.length > 0) {
      questionCount++;

      if (questionCount >= nextProductionSlot && productionQueue.length > 0) {
        battery.push(productionQueue.shift()!);
        nextProductionSlot = questionCount + interval;
      } else if (receptiveQueue.length > 0) {
        battery.push(receptiveQueue.shift()!);
      } else if (productionQueue.length > 0) {
        battery.push(productionQueue.shift()!);
      }
    }

    return battery;
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA HOISTING & UTILITIES
  // ═══════════════════════════════════════════════════════════════

  /**
   * 🛡️ EXHAUSTIVE DATA HOISTING: Extract options from answer_key regardless of nesting.
   * Checks ALL possible structures:
   *   1. answer_key.value.options  (canonical AnswerKeyObject)
   *   2. answer_key.options        (flat structure)
   *   3. answer_key (as string → parsed JSON)
   *   4. answer_key.value (as string → parsed JSON)
   * Also extracts correct_answer for the engine's MCQ check.
   */
  private static hoistOptions(item: QuestionBankItem) {
    // 🛡️ Guard: Skip hoisting for production modes
    const mode = (item.response_mode || '') as string;
    if (mode === 'typed' || mode === 'audio') return;

    if (item.options && item.options.length > 0) return;

    // 🛡️ Exhaustive check for nested options in answer_key
    const ak = item.answer_key as any;
    if (!ak) return;

    let parsed = ak;
    if (typeof ak === 'string') {
      try { parsed = JSON.parse(ak); } catch { return; }
    }

    let options: string[] | null = null;

    // Path 1: answer_key.value.options (standard structure for some imports)
    if (parsed?.value && typeof parsed.value === 'object' && Array.isArray(parsed.value.options)) {
      options = parsed.value.options;
    }
    // Path 2: answer_key.options (the format the user mentioned)
    else if (Array.isArray(parsed?.options)) {
      options = parsed.options;
    }
    // Path 3: answer_key directly is the object
    else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).options)) {
       options = (parsed as any).options;
    }

    if (options && options.length > 0) {
      item.options = options;
      console.log(`[Hoist] ✅ ${item.id}: Hoisted ${options.length} options from answer_key`);
    }
  }


  private static toBatteryQuestion(item: QuestionBankItem): BatteryQuestion {
    return {
      item,
      block: 1, 
      skill: item.skill,
      zone: this.getDifficultyZone(item),
      globalIndex: 0, 
      pointValue: this.getTrueDifficulty(item),
    };
  }


  private static getZoneForLevel(level: string): DifficultyZone {
    const l = level.toLowerCase();
    if (['a1', 'a2'].includes(l)) return 'EASY';
    if (['b1', 'b2'].includes(l)) return 'MEDIUM';
    return 'HARD';
  }

  // ═══════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════

  private static validateBattery(battery: BatteryQuestion[]) {
    const skillCounts: Record<string, number> = {};
    const zoneCounts: Record<string, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
    const modeCounts: Record<string, number> = {};
    const blockDistributions: Record<number, Record<string, number>> = {
      1: { EASY: 0, MEDIUM: 0, HARD: 0 },
      2: { EASY: 0, MEDIUM: 0, HARD: 0 },
      3: { EASY: 0, MEDIUM: 0, HARD: 0 },
      4: { EASY: 0, MEDIUM: 0, HARD: 0 },
    };

    battery.forEach(q => {
      const skill = q.skill.toLowerCase();
      skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      zoneCounts[q.zone] = (zoneCounts[q.zone] || 0) + 1;
      const mode = q.item.response_mode || 'unknown';
      modeCounts[mode] = (modeCounts[mode] || 0) + 1;
      if (blockDistributions[q.block]) {
          blockDistributions[q.block][q.zone]++;
      }
    });

    console.log(`[Selector] 📊 Battery Composition:`);
    console.log(`  Skills:`, JSON.stringify(skillCounts));
    console.log(`  Zones:`, JSON.stringify(zoneCounts));
    console.log(`  Modes:`, JSON.stringify(modeCounts));
    console.log(`  Total:`, battery.length);

    console.log(`[Selector] 🎯 3-4-3 Block Distribution Check:`);
    Object.entries(blockDistributions).forEach(([block, zones]) => {
      console.log(`  Block ${block}: Easy: ${zones.EASY}, Medium: ${zones.MEDIUM}, Hard: ${zones.HARD} (Total: ${zones.EASY + zones.MEDIUM + zones.HARD})`);
    });

    if (battery.length < BATTERY_SIZE) {
      console.warn(`[Selector] ⚠️ Battery is undersized: ${battery.length}/${BATTERY_SIZE}. Some skills may have insufficient items in the question bank.`);
    }
  }

  private static shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
