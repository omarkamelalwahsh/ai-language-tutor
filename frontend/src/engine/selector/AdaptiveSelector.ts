/**
 * ═══════════════════════════════════════════════════════════════════════
 * Fixed-Length Adaptive Battery Selector
 * 
 * Builds a deterministic 40-question battery using CEFR-tier queries:
 *   Block 1: Reading(8) + Grammar(7) = 15 MCQ
 *   Block 2: Writing(5) = 5 Open-Ended
 *   Block 3: Listening(15) = 15 MCQ
 *   Block 4: Speaking(5) = 5 Audio
 * 
 * Within each block, items are ordered easy→hard (Tier1 → Tier2 → Tier3).
 * ═══════════════════════════════════════════════════════════════════════
 */

import { QuestionBankItem } from '../../types/efset';
import { DifficultyZone, ASSESSMENT_CONFIG, CEFRTier, BatterySkill } from '../../config/assessment-config';
import { supabase } from '../../lib/supabaseClient';
import { extractOptions, extractAnswerMetadata } from '../../lib/utils';

export interface BatteryQuestion {
  item: QuestionBankItem;
  block: number;
  skill: string;
  zone: DifficultyZone;
  globalIndex: number;
  pointValue: number;
}

/** CEFR level → numeric difficulty for scoring weight */
const CEFR_DIFF: Record<string, number> = ASSESSMENT_CONFIG.CEFR_DIFFICULTY_MAP;

export class BatterySelector {

  /**
   * Fetches items from the question_bank_items table using CEFR-tier queries,
   * then assembles them into a strictly ordered 40-question battery.
   */
  public static async fetchAndBuild(_userId: string): Promise<BatteryQuestion[]> {
    console.log("[Selector] 🏗️ Building Fixed-Length Battery (CEFR-Tier Mode)...");

    const { SKILL_DISTRIBUTION, TIERS, BLOCK_CONFIG } = ASSESSMENT_CONFIG;

    // ── Step 1: Fetch all items per skill+tier ──
    const skillBuckets: Record<string, any[]> = {};

    for (const dist of SKILL_DISTRIBUTION) {
      skillBuckets[dist.skill] = [];

      for (const [tierKey, tierConfig] of Object.entries(TIERS)) {
        const quota = dist[tierKey as CEFRTier];
        if (quota <= 0) continue;

        const { data, error } = await supabase
          .from('question_bank_items')
          .select('*')
          .eq('skill', dist.skill)
          .in('level', [...tierConfig.levels])
          .limit(quota);

        if (error) {
          console.warn(`[Selector] ⚠️ Error fetching ${dist.skill}/${tierKey}:`, error.message);
          continue;
        }

        if (data && data.length > 0) {
          // Tag each item with its tier zone for ordering
          const tagged = data.map(item => ({
            ...item,
            _tier: tierKey,
            _zone: tierConfig.zone,
            _difficulty: CEFR_DIFF[item.level?.toUpperCase()] || 0.5,
          }));
          skillBuckets[dist.skill].push(...tagged);
        }

        console.log(`   [${dist.skill}/${tierKey}] Fetched ${data?.length || 0}/${quota}`);
      }
    }

    // ── Step 2: Assemble into block order ──
    // Block 1: reading items then grammar items (both sorted Tier1→Tier2→Tier3)
    // Block 2: writing items
    // Block 3: listening items
    // Block 4: speaking items
    const TIER_ORDER: Record<string, number> = { tier1: 0, tier2: 1, tier3: 2 };
    const sortByTier = (items: any[]) => 
      items.sort((a, b) => (TIER_ORDER[a._tier] || 0) - (TIER_ORDER[b._tier] || 0));

    const block1 = [
      ...sortByTier(skillBuckets['reading'] || []),
      ...sortByTier(skillBuckets['grammar'] || []),
    ];
    const block2 = sortByTier(skillBuckets['writing'] || []);
    const block3 = sortByTier(skillBuckets['listening'] || []);
    const block4 = sortByTier(skillBuckets['speaking'] || []);

    const orderedItems = [
      ...block1.map(item => ({ ...item, _block: 1 })),
      ...block2.map(item => ({ ...item, _block: 2 })),
      ...block3.map(item => ({ ...item, _block: 3 })),
      ...block4.map(item => ({ ...item, _block: 4 })),
    ];

    console.log(`[Selector] ✅ Assembled ${orderedItems.length} items: ` +
      `Block1=${block1.length}, Block2=${block2.length}, Block3=${block3.length}, Block4=${block4.length}`);
    // ── Step 3: Map to BatteryQuestion format ──
    return orderedItems.map((item, index) => {
      const difficulty = item._difficulty || CEFR_DIFF[item.level?.toUpperCase()] || 0.5;
      const zone: DifficultyZone = item._zone || 'MEDIUM';
      const ak = item.answer_key;

      // ── Hoist options from answer_key ──
      const options = extractOptions(item.options || item.answer_key);

      // ── Extract correct_index from answer_key ──
      const { correctIndex } = extractAnswerMetadata(item.answer_key, options);

      // ── Skill-based response mode ──
      const skillName = (item.skill || '').toLowerCase();
      let response_mode: 'mcq' | 'typed' | 'audio' = 'mcq';
      if (skillName === 'speaking') {
        response_mode = 'audio';
      } else if (skillName === 'writing') {
        response_mode = 'typed';
      } else {
        // Reading, Grammar, Listening → MCQ
        response_mode = 'mcq';
      }

      return {
        item: {
          ...item,
          id: item.id,
          options,
          answer_key: {
            ...(typeof ak === 'string' ? JSON.parse(ak) : ak),
            correct_index: correctIndex,
          },
          audio_url: item.audio_url || item.audioUrl || null,
          response_mode,
          difficulty,
        } as QuestionBankItem,
        block: item._block,
        skill: item.skill,
        zone,
        globalIndex: index,
        pointValue: difficulty,
      };
    });
  }
}
