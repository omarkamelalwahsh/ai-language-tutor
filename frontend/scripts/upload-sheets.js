import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data/question_banks');

async function uploadSheets() {
  console.log(`===============================================`);
  console.log(`🚀 Starting Database Upload of Generation Sheets`);
  console.log(`===============================================`);

  if (!fs.existsSync(DATA_DIR)) {
    console.log("❌ No data directory found. Please run the generation script first.");
    process.exit(1);
  }

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('_sheet.json'));
  if (files.length === 0) {
    console.log("❌ No sheets found to upload.");
    process.exit(0);
  }

  let totalUploaded = 0;

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`⏳ Uploading ${data.length} questions from ${file}...`);

    let successCount = 0;
    for (const item of data) {
      try {
        await pool.query(
          `INSERT INTO question_bank_items 
          (external_id, skill, task_type, target_cefr, difficulty, prompt, stimulus, answer_key) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (external_id) DO NOTHING`,
          [
            item.external_id,
            item.skill,
            item.task_type,
            item.target_cefr,
            item.difficulty,
            item.prompt,
            item.stimulus || null,
            item.answer_key
          ]
        );
        successCount++;
      } catch (err) {
        console.error(`❌ Error inserting ${item.external_id}: ${err.message}`);
      }
    }
    console.log(`✅ Finished ${file}. Successfully uploaded ${successCount} items.`);
    totalUploaded += successCount;
  }
  
  console.log(`\n🎉 Upload Complete! Database now contains ${totalUploaded} new items from the sheets.`);
  await pool.end();
}

uploadSheets().catch(err => {
  console.error("Critical upload error:", err);
  process.exit(1);
});
