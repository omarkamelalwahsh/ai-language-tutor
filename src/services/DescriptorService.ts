import * as xlsx from 'xlsx';

export type CEFRDescriptor = {
  id: string;
  scheme: string;
  mode: string;
  activity: string;
  scale: string;
  level: string;
  descriptor: string;
};

export type SkillMapping = 'reading' | 'writing' | 'listening' | 'speaking' | 'vocabulary' | 'grammar';

export class DescriptorService {
  private static instance: DescriptorService;
  private descriptors: CEFRDescriptor[] = [];
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): DescriptorService {
    if (!DescriptorService.instance) {
      DescriptorService.instance = new DescriptorService();
    }
    return DescriptorService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.loadExcelData();
    await this.loadPromise;
  }

  private async loadExcelData(): Promise<void> {
    try {
      // In Vite, to dynamically load a static asset, we fetch its public URL.
      // Assuming the file is moved to public/ or imported directly.
      // Since it's in src/data, we must use import or dynamic fetch.
      const url = new URL('../data/CEFR Descriptors (2020).xlsx', import.meta.url).href;
      
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      const workbook = xlsx.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames.includes('English') ? 'English' : workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rawData = xlsx.utils.sheet_to_json(sheet) as any[];
      this.descriptors = this.normalizeDescriptors(rawData);
      this.isLoaded = true;
      console.log(`[DescriptorService] Loaded ${this.descriptors.length} CEFR descriptors.`);
    } catch (error) {
      console.error('[DescriptorService] Failed to load CEFR Excel sheet:', error);
      this.descriptors = []; // fallback empty
    }
  }

  private normalizeDescriptors(rawData: any[]): CEFRDescriptor[] {
    const normalized: CEFRDescriptor[] = [];
    
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      
      const getVal = (possibleKeys: string[]) => {
        for (const key of possibleKeys) {
          if (row[key] !== undefined) return String(row[key]);
          const found = Object.keys(row).find(k => k.toLowerCase().includes(key.toLowerCase()));
          if (found) return String(row[found]);
        }
        return '';
      };

      const scheme = getVal(['CEFR Descriptor Scheme', 'Scheme']);
      const mode = getVal(['Mode of communication', 'Mode']);
      const activity = getVal(['Activity, strategy', 'Activity']);
      const scale = getVal(['Scale']);
      const level = getVal(['Level']);
      const descriptor = getVal(['Descriptor']);

      // Only add valid descriptors that have level and text
      if (level && descriptor && descriptor !== 'No descriptors available') {
        normalized.push({
          id: `desc-${i}`,
          scheme: scheme.trim(),
          mode: mode.trim(),
          activity: activity.trim(),
          scale: scale.trim(),
          level: level.trim(),
          descriptor: descriptor.trim(),
        });
      }
    }
    return normalized;
  }

  /**
   * Maps a high-level assessment skill to relevant CEFR filtering terms.
   */
  private getKeywordsForSkill(skill: SkillMapping): string[] {
    switch (skill) {
      case 'reading': return ['reading', 'reception', 'written'];
      case 'writing': return ['writing', 'production', 'written'];
      case 'listening': return ['listening', 'reception', 'spoken', 'audio'];
      case 'speaking': return ['speaking', 'production', 'spoken', 'interaction'];
      case 'vocabulary': return ['vocabulary', 'lexical'];
      case 'grammar': return ['grammar', 'grammatical', 'accuracy'];
      default: return [];
    }
  }

  /**
   * Retrieves relevant descriptors filtered by skill and target levels.
   */
  public getRelevantDescriptors(skill: SkillMapping, levels: string[]): CEFRDescriptor[] {
    const keywords = this.getKeywordsForSkill(skill);
    
    // Filter by requested exact levels (e.g., ['A1', 'A2', 'B1'])
    let subset = this.descriptors.filter(d => levels.includes(d.level));

    // Filter down to rows that match the skill keywords (mode, activity, scale)
    if (keywords.length > 0) {
      subset = subset.filter(d => {
        const textToSearch = `${d.mode} ${d.activity} ${d.scale}`.toLowerCase();
        return keywords.some(kw => textToSearch.includes(kw));
      });
    }

    // Fallback: If no strict keyword matches, just return random subsets by level 
    // to ensure Groq has SOMETHING to evaluate against (though rare).
    if (subset.length === 0) {
      subset = this.descriptors.filter(d => levels.includes(d.level)).slice(0, 30);
    }

    // Limit to a reasonable size so we don't blow up the LLM context (max ~30 per level)
    return subset.slice(0, 50);
  }
}
