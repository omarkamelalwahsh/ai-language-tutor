import { QuestionBankItem, CEFRLevel } from '../types/efset';

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalItems: number;
    skillDistribution: Record<string, number>;
  };
}

export class BankValidator {
  /**
   * Validates a set of question banks for production readiness.
   */
  public static validate(banks: Record<CEFRLevel, QuestionBankItem[]>): ValidationReport {
    const report: ValidationReport = {
       isValid: true,
       errors: [],
       warnings: [],
       stats: { totalItems: 0, skillDistribution: {} }
    };

    const seenIds = new Set<string>();
    const REQUIRED_SKILLS = ['listening', 'reading', 'writing', 'speaking'];
    const MIN_PER_BANK = 15; // Safeguard

    for (const [level, items] of Object.entries(banks) as [CEFRLevel, QuestionBankItem[]][]) {
       if (items.length < MIN_PER_BANK) {
          report.errors.push(`Bank ${level} has too few items (${items.length}). Min required: ${MIN_PER_BANK}`);
          report.isValid = false;
       }

       const levelSkills = new Set<string>();

       for (const item of items) {
          report.stats.totalItems++;
          report.stats.skillDistribution[item.skill] = (report.stats.skillDistribution[item.skill] || 0) + 1;
          levelSkills.add(item.skill);

          // 1. Unique IDs
          if (seenIds.has(item.id)) {
             report.errors.push(`Duplicate ID found: ${item.id} in bank ${level}`);
             report.isValid = false;
          }
          seenIds.add(item.id);

          // 2. Audio Validation
          if ((item.skill === 'listening' || item.task_type.includes('listening')) && !item.audio_url) {
             report.errors.push(`Listening task ${item.id} is missing audio_url.`);
             report.isValid = false;
          }

          // 3. Response Mode Validation
          if (item.skill === 'speaking' && item.response_mode === 'multiple_choice') {
             report.warnings.push(`Speaking task ${item.id} is marked as multiple_choice. This provides low evidence signal.`);
          }
          
          if (item.response_mode === 'audio' && !item.audio_url && item.skill !== 'speaking') {
             // Speaking audio is user-generated, but listening audio must be pre-provided
             report.errors.push(`Audio response task ${item.id} requires stimulus audio_url.`);
             report.isValid = false;
          }
       }

       // 4. Skill Coverage
       for (const skill of REQUIRED_SKILLS) {
          if (!levelSkills.has(skill)) {
             report.errors.push(`Bank ${level} is missing core skill: ${skill}`);
             report.isValid = false;
          }
       }
    }

    return report;
  }
}
