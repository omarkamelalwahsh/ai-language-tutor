import fs from 'fs';
import path from 'path';
import pool from '../server/db.js';

async function migrateAllBanks() {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  let totalSuccess = 0;
  let totalFail = 0;

  console.log(`🔄 Starting mass migration of all 6 EFSET bank files...`);

  for (const level of levels) {
    const filePath = path.join(process.cwd(), `src/data/banks/${level}.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Bank file ${level}.json not found, skipping...`);
      continue;
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const questions = JSON.parse(rawData);
    console.log(`➡️ Found ${questions.length} questions in ${level}.json. Inserting...`);

    for (const q of questions) {
      try {
        await pool.query(
          `INSERT INTO question_bank_items 
          (external_id, skill, task_type, target_cefr, difficulty, prompt, stimulus, answer_key) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            q.id,
            q.skill,
            q.task_type,
            q.target_cefr || level,
            q.difficulty || 0.5,
            q.prompt,
            q.stimulus || null,
            JSON.stringify(q.answer_key)
          ]
        );
        totalSuccess++;
      } catch (err: any) {
        console.error(`❌ Failed to insert ${q.id}:`, err.message);
        totalFail++;
      }
    }
  }

  console.log(`\n✅ Migration finished!`);
  console.log(`   Successfully inserted: ${totalSuccess} real EFSET questions!`);
  console.log(`   Failed to insert: ${totalFail}`);

  await pool.end();
}

migrateAllBanks();
