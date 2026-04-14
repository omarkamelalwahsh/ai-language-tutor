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
  { skill: 'vocabulary', total: 4,  easy: 1, medium: 2, hard: 1, responseMode: 'mcq',   isProduction: false },
  { skill: 'writing',    total: 4,  easy: 1, medium: 2, hard: 1, responseMode: 'typed',  isProduction: true },
  { skill: 'speaking',   total: 4,  easy: 1, medium: 2, hard: 1, responseMode: 'audio',  isProduction: true },
];

const BATTERY_SIZE = 40;

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
      const sampled = this.sampleWithDifficulty(pool, quota);

      // Enforce response_mode and hoist options (MCQ only)
      sampled.forEach(item => {
        item.response_mode = quota.responseMode as any;
        // Only hoist options for MCQ tasks — writing/speaking have no options
        if (quota.responseMode === 'mcq') {
          this.hoistOptions(item);
        }
      });

      const batteryItems = sampled.map((item, i) => this.toBatteryQuestion(item, quota));

      if (quota.isProduction) {
        productionItems.push(...batteryItems);
      } else {
        receptiveItems.push(...batteryItems);
      }

      console.log(`[Selector]   ✅ ${quota.skill}: ${sampled.length}/${quota.total} (E:${quota.easy} M:${quota.medium} H:${quota.hard})`);
    }

    // 3. Shuffle receptive items
    const shuffledReceptive = this.shuffle(receptiveItems);

    // 4. Interleave production tasks every ~5 questions
    const battery = this.interleaveProduction(shuffledReceptive, this.shuffle(productionItems));

    // 5. Assign final indices and blocks
    battery.forEach((q, i) => {
      q.globalIndex = i;
      q.block = i < 13 ? 1 : i < 27 ? 2 : 3;
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
      // Fetch 3x the quota to have enough for difficulty sampling
      const limit = Math.max(quota.total * 3, 30);
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

      pools[quota.skill] = (data || []).filter(q => !seenIds.has(q.id)) as QuestionBankItem[];
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

  private static getDifficultyZone(item: QuestionBankItem): DifficultyZone {
    const diff = item.difficulty || this.getFallbackDifficulty(item.target_cefr || (item as any).level);
    if (diff <= 0.3) return 'EASY';
    if (diff <= 0.6) return 'MEDIUM';
    return 'HARD';
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
    // 🛡️ Guard: Skip hoisting for non-MCQ response modes (writing=typed, speaking=audio)
    const mode = (item.response_mode || '') as string;
    if (mode === 'typed' || mode === 'audio') {
      // Production tasks don't have MCQ options — this is expected, not a warning
      return;
    }

    if (item.options && item.options.length > 0) {
      // Already has top-level options, nothing to hoist
      return;
    }

    const ak = item.answer_key as any;
    if (!ak) return;

    let parsed = ak;

    // If answer_key is a JSON string, parse it
    if (typeof ak === 'string') {
      try { parsed = JSON.parse(ak); } catch { return; }
    }

    let options: string[] | null = null;
    let correctIndex: number | null = null;

    // Path 1: answer_key.value.options (canonical)
    if (parsed?.value && typeof parsed.value === 'object' && Array.isArray(parsed.value.options)) {
      options = parsed.value.options;
      correctIndex = parsed.value.correct_index;
    }
    // Path 2: answer_key.options (flat)
    else if (Array.isArray(parsed?.options)) {
      options = parsed.options;
      correctIndex = parsed.correct_index;
    }
    // Path 3: answer_key.value is a string (possibly JSON)
    else if (parsed?.value && typeof parsed.value === 'string') {
      try {
        const innerParsed = JSON.parse(parsed.value);
        if (Array.isArray(innerParsed?.options)) {
          options = innerParsed.options;
          correctIndex = innerParsed.correct_index;
        }
      } catch { /* not JSON */ }
    }

    if (options && options.length > 0) {
      item.options = options;
      console.log(`[Hoist] ✅ ${item.id} (${item.skill}): Hoisted ${options.length} options`);
    } else {
      console.warn(`[Hoist] ⚠️ ${item.id} (${item.skill}): No options found in answer_key:`, JSON.stringify(ak).slice(0, 200));
    }
  }

  private static toBatteryQuestion(item: QuestionBankItem, quota: SkillQuota): BatteryQuestion {
    return {
      item,
      block: 1, // Will be reassigned after interleaving
      skill: item.skill,
      zone: this.getDifficultyZone(item),
      globalIndex: 0, // Will be reassigned after interleaving
      pointValue: 0,   // Dynamic based on difficulty in Engine
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

    battery.forEach(q => {
      const skill = q.skill.toLowerCase();
      skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      zoneCounts[q.zone] = (zoneCounts[q.zone] || 0) + 1;
      const mode = q.item.response_mode || 'unknown';
      modeCounts[mode] = (modeCounts[mode] || 0) + 1;
    });

    console.log(`[Selector] 📊 Battery Composition:`);
    console.log(`  Skills:`, JSON.stringify(skillCounts));
    console.log(`  Zones:`, JSON.stringify(zoneCounts));
    console.log(`  Modes:`, JSON.stringify(modeCounts));
    console.log(`  Total:`, battery.length);

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
