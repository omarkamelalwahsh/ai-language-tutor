import { QuestionBankItem } from '../../types/efset';
import { DifficultyZone } from '../../config/assessment-config';

export interface BatteryQuestion {
  item: QuestionBankItem;
  block: number;
  skill: string;
  zone: DifficultyZone;
  globalIndex: number;
  pointValue: number;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export class BatterySelector {

  /**
   * Fetches the strictly architected 40-question battery from the backend.
   * This battery follows the 12-8-8-4-4-4 skill quota and Easy-Medium-Hard progression.
   */
  public static async fetchAndBuild(_userId: string): Promise<BatteryQuestion[]> {
    console.log("[Selector] 🏗️ Fetching architected diagnostic battery from server...");
    
    try {
      const resp = await fetch(`${API_BASE}/api/questions?type=diagnostic`);
      if (!resp.ok) throw new Error("Failed to fetch diagnostic battery");
      
      const data: any[] = await resp.json();
      
      if (!data || data.length === 0) {
        throw new Error("Received empty battery from server");
      }

      console.log(`[Selector] ✅ Received ${data.length} pre-ordered questions.`);

      // Map to BatteryQuestion format for the Engine
      const battery: BatteryQuestion[] = data.map((item, index) => {
        const difficulty = Number(item.difficulty) || 0.5;
        let zone: DifficultyZone = 'MEDIUM';
        if (difficulty <= 0.3) zone = 'EASY';
        else if (difficulty > 0.7) zone = 'HARD';

        return {
          item: {
            ...item,
            id: item.id // Ensure ID is mapped correctly
          } as QuestionBankItem,
          block: Math.floor(index / 10) + 1, // Logic blocks of 10
          skill: item.skill,
          zone,
          globalIndex: index,
          pointValue: difficulty
        };
      });

      return battery;

    } catch (err: any) {
      console.error("[Selector] ❌ Critical Error fetching battery:", err.message);
      return [];
    }
  }
}
