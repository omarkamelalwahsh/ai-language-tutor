import fs from 'fs';
import path from 'path';
import { QUESTION_BANK } from '../src/data/assessment-questions';
import { QuestionBankItem } from '../src/types/efset';

const outDir = path.join(__dirname, '../src/data/banks');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const banks: Record<string, QuestionBankItem[]> = {
    'A1': [], 'A2': [], 'B1': [], 'B2': [], 'C1': [], 'C2': []
};

QUESTION_BANK.forEach(q => {
    let cefr = q.difficulty as string;
    if (!banks[cefr]) {
        // e.g. Pre-A1 or something
        cefr = 'A1'; 
    }

    // Default weight mapping
    const ep: any = {};
    if (q.primarySkill) {
        ep[q.primarySkill] = { weight: 1.0, direct: true };
    }
    (q.secondarySkills || []).forEach(s => {
        ep[s] = { weight: 0.3, direct: false };
    });

    const item: QuestionBankItem = {
        id: q.id,
        skill: q.primarySkill || q.skill,
        task_type: q.type,
        target_cefr: cefr as any,
        difficulty: 0.5, // Default within band
        response_mode: ['short_text', 'listening_summary'].includes(q.type) ? 'typed' : 'multiple_choice',
        prompt: q.prompt,
        answer_key: Array.isArray(q.correctAnswer) ? q.correctAnswer[0] : (q.correctAnswer || ''),
        evidence_policy: ep
    };

    banks[cefr].push(item);
});

// Since C2 might be empty in the source, let's add a dummy if needed
if (banks['C2'].length === 0) {
    banks['C2'].push({
        id: 'c2-read-01',
        skill: 'reading',
        task_type: 'reading_mcq',
        target_cefr: 'C2',
        difficulty: 0.8,
        response_mode: 'multiple_choice',
        prompt: 'Read a dense philosophical text and answer...',
        answer_key: 'A',
        evidence_policy: { reading: { weight: 1.0, direct: true } }
    });
}

Object.keys(banks).forEach(band => {
    const filePath = path.join(outDir, `${band}.json`);
    fs.writeFileSync(filePath, JSON.stringify(banks[band], null, 2));
    console.log(`Wrote ${banks[band].length} items to ${band}.json`);
});
