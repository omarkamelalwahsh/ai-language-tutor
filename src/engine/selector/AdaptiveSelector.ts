import { QuestionBankItem } from '../../types/efset';
import { DifficultyZone } from '../../config/assessment-config';
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

  /**
   * ARCHITECTED BATTERY (The "Magic Code" Implementation)
   * Executes 18 specific sub-queries (6 skills * 3 difficulties) to ensure a perfect 40-question test.
   */
  public static async fetchAndBuild(_userId: string): Promise<BatteryQuestion[]> {
    console.log("[Selector] 🏗️ Building Architected Battery (Direct Supabase Mode)...");
    
    // Default level for diagnostic starting point (usually B1/A2 or dynamic)
    const targetLevel = 'B1'; 

    const distribution = [
      { skill: 'grammar',    easy: 4, medium: 4, hard: 4 },
      { skill: 'listening',  easy: 2, medium: 4, hard: 2 },
      { skill: 'reading',    easy: 2, medium: 4, hard: 2 },
      { skill: 'vocabulary', easy: 1, medium: 2, hard: 1 },
      { skill: 'writing',    easy: 1, medium: 2, hard: 1 },
      { skill: 'speaking',   easy: 1, medium: 2, hard: 1 }
    ];

    let fullBattery: any[] = [];

    try {
      for (const item of distribution) {
        // 1. Fetch Easy (difficulty <= 0.3)
        const { data: easyQs } = await supabase
          .from('question_bank_items')
          .select('*')
          .eq('skill', item.skill)
          // Note: If bank is sparse on 'B1' specifically, you might want to remove the level filter 
          // to pull from the general bank, or ensure the bank is fully populated.
          // .eq('level', targetLevel) 
          .lte('difficulty', 0.3)
          .limit(item.easy);

        // 2. Fetch Medium (0.3 < diff <= 0.7)
        const { data: mediumQs } = await supabase
          .from('question_bank_items')
          .select('*')
          .eq('skill', item.skill)
          // .eq('level', targetLevel)
          .gt('difficulty', 0.3)
          .lte('difficulty', 0.7)
          .limit(item.medium);

        // 3. Fetch Hard (diff > 0.7)
        const { data: hardQs } = await supabase
          .from('question_bank_items')
          .select('*')
          .eq('skill', item.skill)
          // .eq('level', targetLevel)
          .gt('difficulty', 0.7)
          .limit(item.hard);

        fullBattery.push(...(easyQs || []), ...(mediumQs || []), ...(hardQs || []));
      }

      console.log(`[Selector] ✅ Constructed ${fullBattery.length} questions.`);

      // Final mapping to BatteryQuestion format
      return fullBattery.map((item, index) => {
        const difficulty = Number(item.difficulty) || 0.5;
        let zone: DifficultyZone = 'MEDIUM';
        if (difficulty <= 0.3) zone = 'EASY';
        else if (difficulty > 0.7) zone = 'HARD';

        return {
          item: {
            ...item,
            id: item.id,
            response_mode: (item.task_type?.includes('mcq') || (item.answer_key && (item.answer_key.options || (typeof item.answer_key === 'string' && item.answer_key.includes('options'))))) ? 'mcq' : 'typed'
          } as QuestionBankItem,
          block: Math.floor(index / 10) + 1,
          skill: item.skill,
          zone,
          globalIndex: index,
          pointValue: difficulty
        };
      });

    } catch (err: any) {
      console.error("[Selector] ❌ Supabase Fetch Error:", err.message);
      return [];
    }
  }
}
