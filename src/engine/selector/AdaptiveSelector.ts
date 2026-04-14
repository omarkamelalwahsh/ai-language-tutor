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
    // Skills: Listening, Grammar, Vocabulary (Aligned with DB Enums)
    const block1Pool = await this.queryPool(['Listening', 'Grammar', 'Vocabulary'], seenIds);
    const block1Qs = this.sampleSequential(block1Pool, { EASY: 3, MEDIUM: 4, HARD: 3 }, 'Block 1');
    this.addBatch(battery, block1Qs, 1);

    // --- BLOCK 2 & 3: Reading & Writing (Shared Stimulus) ---
    const sharedPool = await this.querySharedStimulusPool(seenIds);
    if (sharedPool.Reading.length >= 10 && sharedPool.Writing.length >= 10) {
      this.addBatch(battery, this.sampleSequential(sharedPool.Reading, { EASY: 3, MEDIUM: 4, HARD: 3 }, 'Block 2 (Shared)'), 2);
      this.addBatch(battery, this.sampleSequential(sharedPool.Writing, { EASY: 3, MEDIUM: 4, HARD: 3 }, 'Block 3 (Shared)'), 3);
    } else {
      console.warn("[Selector] Shared stimulus pool dry. Falling back to independent pools.");
      const rPool = await this.queryPool(['Reading'], seenIds);
      const wPool = await this.queryPool(['Writing'], seenIds);
      this.addBatch(battery, this.sampleSequential(rPool, { EASY: 3, MEDIUM: 4, HARD: 3 }, 'Block 2 (Indep)'), 2);
      this.addBatch(battery, this.sampleSequential(wPool, { EASY: 3, MEDIUM: 4, HARD: 3 }, 'Block 3 (Indep)'), 3);
    }

    // --- BLOCK 4: Speaking (10 Qs) ---
    const block4Pool = await this.queryPool(['Speaking'], seenIds);
    const block4Qs = this.sampleSequential(block4Pool, { EASY: 3, MEDIUM: 4, HARD: 3 }, 'Block 4');
    this.addBatch(battery, block4Qs, 4);

    // --- GLOBAL SAFETY CHECK: FILL TO 40 ---
    if (battery.length < 40) {
      console.warn(`[Selector] ⚠️ Battery incomplete (${battery.length}/40). Filling gaps...`);
      const gapSize = 40 - battery.length;
      const fillerPool = await this.queryPool(['Listening', 'Reading', 'Grammar', 'Vocabulary'], seenIds);
      const fillerShuffled = this.shuffle(fillerPool.filter(f => !battery.some(b => b.item.id === f.id)));
      this.addBatch(battery, fillerShuffled.slice(0, gapSize), 99); // Block 99 for filler
    }

    console.log(`[Selector] ✅ Final high-fidelity battery built with ${battery.length} questions.`);
    return battery;
  }

  private static async queryPool(skills: string[], seenIds: Set<string>): Promise<QuestionBankItem[]> {
    // Exact match (.in) for prioritized skills
    const { data, error } = await supabase
      .from('question_bank_items')
      .select('*')
      .in('skill', skills)
      .limit(200);

    if (error) throw error;
    return (data || []).filter(q => !seenIds.has(q.id)) as any;
  }

  private static async querySharedStimulusPool(seenIds: Set<string>): Promise<{ Reading: QuestionBankItem[], Writing: QuestionBankItem[] }> {
    const { data: candidates } = await supabase
      .from('question_bank_items')
      .select('stimulus')
      .not('stimulus', 'is', null)
      .eq('skill', 'Reading')
      .limit(10);
    
    if (!candidates || candidates.length === 0) return { Reading: [], Writing: [] };

    const stimulus = candidates[0].stimulus;
    const { data: tasks } = await supabase
      .from('question_bank_items')
      .select('*')
      .eq('stimulus', stimulus)
      .in('skill', ['Reading', 'Writing']);

    const items = (tasks || []) as any[];
    return {
      Reading: items.filter(i => i.skill === 'Reading' && !seenIds.has(i.id)),
      Writing: items.filter(i => i.skill === 'Writing' && !seenIds.has(i.id))
    };
  }

  private static sampleSequential(pool: QuestionBankItem[], counts: Record<DifficultyZone, number>, context: string): QuestionBankItem[] {
    const sampled: QuestionBankItem[] = [];
    const zones: DifficultyZone[] = ['EASY', 'MEDIUM', 'HARD'];

    zones.forEach(zone => {
      const levels = ASSESSMENT_CONFIG.ZONES[zone].levels;
      const zonePool = pool.filter(q => levels.includes(q.target_cefr || (q as any).level));
      const requestedCount = counts[zone];
      
      const shuffled = this.shuffle(zonePool);
      const zoneSelection = shuffled.slice(0, requestedCount);
      sampled.push(...zoneSelection);
      
      if (zoneSelection.length < requestedCount) {
        console.warn(`[Selector] [${context}] Requested ${requestedCount} for ${zone} but only found ${zoneSelection.length}.`);
        // Intra-block fallback: grab from the broader pool ignoring specific level
        const remainingNeeded = requestedCount - zoneSelection.length;
        const fallbackPool = pool.filter(p => !sampled.some(s => s.id === p.id));
        sampled.push(...this.shuffle(fallbackPool).slice(0, remainingNeeded));
      }
    });

    return sampled;
  }

  private static addBatch(battery: BatteryQuestion[], items: QuestionBankItem[], block: number) {
    items.forEach(item => {
      const dbLevel = item.target_cefr || (item as any).level || 'B1';
      // Ensure we handle potential lowercase/uppercase variation in the level string
      const level = dbLevel.toUpperCase(); 
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

