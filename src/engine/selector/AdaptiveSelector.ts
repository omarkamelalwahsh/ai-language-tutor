/**
 * BatterySelector — Sequential Hybrid Battery Builder
 * 
 * Implements the 4-Block Sequential Flow:
 * 1. Listening & Language Use (10 Qs)
 * 2. Reading (10 Qs - Shared Stimulus)
 * 3. Writing (10 Qs - Same Stimulus)
 * 4. Speaking (10 Qs - Audio)
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

export class BatterySelector {
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

  public static async fetchAndBuild(userId: string): Promise<BatteryQuestion[]> {
    console.log("[Selector] Initializing Smart Pull for battery...");
    const seenIds = userId ? await this.getSeenIds(userId) : new Set<string>();
    const battery: BatteryQuestion[] = [];

    // --- BLOCK 1: Listening & Language Use (10 Qs) ---
    // Skills: listening, grammar, vocabulary
    const block1Pool = await this.queryPool(['listening', 'grammar', 'vocabulary'], seenIds);
    const block1Qs = this.sampleSequential(block1Pool, { EASY: 3, MEDIUM: 4, HARD: 3 });
    this.addBatch(battery, block1Qs, 1);

    // --- BLOCK 2 & 3: Reading & Writing (Shared Stimulus) ---
    // We fetch questions that share the same stimulus text
    const sharedPool = await this.querySharedStimulusPool(seenIds);
    if (sharedPool.reading.length >= 10 && sharedPool.writing.length >= 10) {
      this.addBatch(battery, this.sampleSequential(sharedPool.reading, { EASY: 3, MEDIUM: 4, HARD: 3 }), 2);
      this.addBatch(battery, this.sampleSequential(sharedPool.writing, { EASY: 3, MEDIUM: 4, HARD: 3 }), 3);
    } else {
      // Fallback if no shared stimulus found (unlikely with our generation)
      const rPool = await this.queryPool(['reading'], seenIds);
      const wPool = await this.queryPool(['writing'], seenIds);
      this.addBatch(battery, this.sampleSequential(rPool, { EASY: 3, MEDIUM: 4, HARD: 3 }), 2);
      this.addBatch(battery, this.sampleSequential(wPool, { EASY: 3, MEDIUM: 4, HARD: 3 }), 3);
    }

    // --- BLOCK 4: Speaking (10 Qs) ---
    const block4Pool = await this.queryPool(['speaking'], seenIds);
    const block4Qs = this.sampleSequential(block4Pool, { EASY: 3, MEDIUM: 4, HARD: 3 });
    this.addBatch(battery, block4Qs, 4);

    console.log(`[Selector] Battery built with ${battery.length} questions.`);
    return battery;
  }

  private static async queryPool(skills: string[], seenIds: Set<string>): Promise<QuestionBankItem[]> {
    // We fetch a buffer of 50 per skill to ensure we have enough even after filtering seen IDs
    const { data, error } = await supabase
      .from('question_bank_items')
      .select('*')
      .in('skill', skills)
      .limit(150);

    if (error) throw error;
    return (data || []).filter(q => !seenIds.has(q.id)) as any;
  }

  private static async querySharedStimulusPool(seenIds: Set<string>): Promise<{ reading: QuestionBankItem[], writing: QuestionBankItem[] }> {
    // 1. Find a stimulus that has multiple questions
    const { data: candidates } = await supabase
      .from('question_bank_items')
      .select('stimulus')
      .not('stimulus', 'is', null)
      .eq('skill', 'reading')
      .limit(10);
    
    if (!candidates || candidates.length === 0) return { reading: [], writing: [] };

    // Pick the first candidate stimulus
    const stimulus = candidates[0].stimulus;

    // 2. Fetch all reading and writing tasks for this stimulus
    const { data: tasks } = await supabase
      .from('question_bank_items')
      .select('*')
      .eq('stimulus', stimulus)
      .in('skill', ['reading', 'writing']);

    const items = (tasks || []) as any[];
    return {
      reading: items.filter(i => i.skill === 'reading' && !seenIds.has(i.id)),
      writing: items.filter(i => i.skill === 'writing' && !seenIds.has(i.id))
    };
  }

  private static sampleSequential(pool: QuestionBankItem[], counts: Record<DifficultyZone, number>): QuestionBankItem[] {
    const sampled: QuestionBankItem[] = [];
    const zones: DifficultyZone[] = ['EASY', 'MEDIUM', 'HARD'];

    zones.forEach(zone => {
      const levels = ASSESSMENT_CONFIG.ZONES[zone].levels;
      const zonePool = pool.filter(q => levels.includes(q.target_cefr || (q as any).level));
      const count = counts[zone];
      
      const shuffled = this.shuffle(zonePool);
      sampled.push(...shuffled.slice(0, count));
      
      // Secondary fallback if specific level is dry
      if (sampled.length < count) {
        const remaining = pool.filter(p => !sampled.includes(p));
        sampled.push(...remaining.slice(0, count - sampled.length));
      }
    });

    return sampled;
  }

  private static addBatch(battery: BatteryQuestion[], items: QuestionBankItem[], block: number) {
    items.forEach(item => {
      const level = item.target_cefr || (item as any).level || 'A1';
      const zone = this.getZoneForLevel(level);
      battery.push({
        item,
        block,
        skill: item.skill,
        zone,
        globalIndex: battery.length,
        pointValue: ASSESSMENT_CONFIG.ZONES[zone].pointsPerQuestion
      });
    });
  }

  private static getZoneForLevel(level: string): DifficultyZone {
    if (['A1', 'A2'].includes(level)) return 'EASY';
    if (['B1', 'B2'].includes(level)) return 'MEDIUM';
    return 'HARD';
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

