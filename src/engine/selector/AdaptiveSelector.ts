/**
 * BatterySelector — Sequential Hybrid Battery Builder
 * 
 * Implements the 4-Block Sequential Flow:
 * 1. Listening & Language Use (10 Qs)
 * 2. Reading (10 Qs - Big Stimulus)
 * 3. Writing (10 Qs - Same Stimulus)
 * 4. Speaking (10 Qs - Audio)
 */

import { CEFRLevel, QuestionBankItem } from '../../types/efset';
import { ASSESSMENT_CONFIG, DifficultyZone } from '../../config/assessment-config';

export interface BatteryQuestion {
  item: QuestionBankItem;
  block: number;
  skill: string;
  zone: DifficultyZone;
  globalIndex: number;
  pointValue: number;
}

export class BatterySelector {
  private banks: Record<CEFRLevel, QuestionBankItem[]>;
  private seenIds: Set<string>;

  constructor(banks: Record<CEFRLevel, QuestionBankItem[]>, seenIds: Set<string> = new Set()) {
    this.banks = banks;
    this.seenIds = seenIds;
  }

  public buildFullBattery(): BatteryQuestion[] {
    const battery: BatteryQuestion[] = [];
    
    // 1. BLOCK 1: Language Use & Listening (Q1-10)
    const block1Pools = {
      listening: this.getPoolForSkill(['listening']),
      grammar: this.getPoolForSkill(['grammar']),
      vocabulary: this.getPoolForSkill(['vocabulary'])
    };
    
    const block1Qs = [
      ...this.sampleFromZones(block1Pools.listening, { EASY: 1, MEDIUM: 2, HARD: 1 }, 'listening'),
      ...this.sampleFromZones(block1Pools.grammar, { EASY: 1, MEDIUM: 1, HARD: 1 }, 'grammar'),
      ...this.sampleFromZones(block1Pools.vocabulary, { EASY: 1, MEDIUM: 1, HARD: 1 }, 'vocabulary')
    ];
    this.addToBattery(battery, block1Qs, 1);

    // 2. BLOCK 2 & 3: Reading & Writing (Q11-30) - Shared Stimulus
    const sharedStimulus = this.findMasterStimulus();
    
    const readingPool = this.getPoolForSkill(['reading']);
    const block2Qs = this.sampleFromZones(readingPool, { EASY: 3, MEDIUM: 4, HARD: 3 }, 'reading');
    block2Qs.forEach(q => (q as any).stimulus = sharedStimulus.text);
    this.addToBattery(battery, block2Qs, 2);

    const writingPool = this.getPoolForSkill(['writing']);
    const block3Qs = this.sampleFromZones(writingPool, { EASY: 3, MEDIUM: 4, HARD: 3 }, 'writing');
    block3Qs.forEach(q => (q as any).stimulus = sharedStimulus.text);
    this.addToBattery(battery, block3Qs, 3);

    // 4. BLOCK 4: Speaking (Q31-40)
    const speakingPool = this.getPoolForSkill(['speaking']);
    const block4Qs = this.sampleFromZones(speakingPool, { EASY: 3, MEDIUM: 4, HARD: 3 }, 'speaking');
    this.addToBattery(battery, block4Qs, 4);

    return battery;
  }

  private addToBattery(battery: BatteryQuestion[], items: QuestionBankItem[], block: number) {
    items.forEach((item) => {
      const zone = this.getZoneForLevel(item.target_cefr);
      const pointValue = ASSESSMENT_CONFIG.ZONES[zone].pointsPerQuestion;
      battery.push({
        item, block, skill: item.skill, zone, globalIndex: battery.length, pointValue
      });
    });
  }

  private getPoolForSkill(skills: string[]): QuestionBankItem[] {
    const pool: QuestionBankItem[] = [];
    Object.values(this.banks).forEach(levelBank => {
      pool.push(...levelBank.filter(q => 
        skills.includes(q.skill.toLowerCase()) && !this.seenIds.has(q.id)
      ));
    });
    return pool;
  }

  private sampleFromZones(pool: QuestionBankItem[], counts: Record<DifficultyZone, number>, skill: string): QuestionBankItem[] {
    const sampled: QuestionBankItem[] = [];
    const zones: DifficultyZone[] = ['EASY', 'MEDIUM', 'HARD'];

    zones.forEach(zone => {
      const zoneLevels = ASSESSMENT_CONFIG.ZONES[zone].levels;
      const zonePool = pool.filter(q => zoneLevels.includes(q.target_cefr) && q.skill.toLowerCase() === skill.toLowerCase());
      const count = counts[zone];
      
      const shuffled = this.shuffle(zonePool);
      sampled.push(...shuffled.slice(0, count));
      
      if (sampled.length < count) {
          const fallback = pool.filter(q => !sampled.includes(q)).slice(0, count - sampled.length);
          sampled.push(...fallback);
      }
    });

    return sampled;
  }

  private findMasterStimulus(): { text: string } {
    const readingQs = this.getPoolForSkill(['reading']);
    const stimuli = readingQs.map(q => q.stimulus).filter(s => (s?.length || 0) > 200);
    if (stimuli.length > 0) return { text: this.shuffle(stimuli)[0]! };
    
    return { 
      text: "Global Business Trends: In the rapidly evolving landscape of the 21st century, the intersection of technology and commerce has created unprecedented opportunities. Remote work, once a peripheral concept, has become a cornerstone of modern organizational strategy. This shift requires not only digital literacy but also a high degree of cultural intelligence as teams become increasingly distributed across diverse time zones and linguistic backgrounds. Consequently, educational institutions are recalibrating their curricula to emphasize soft skills alongside technical expertise, preparing the next generation of leaders for an interconnected and fluid professional environment."
    };
  }

  private getZoneForLevel(level: string): DifficultyZone {
    if (['A1', 'A2'].includes(level)) return 'EASY';
    if (['B1', 'B2'].includes(level)) return 'MEDIUM';
    return 'HARD';
  }

  private shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export { BatterySelector as AdaptiveSelector };
