import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data/question_banks');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadSheets() {
  console.log(`===============================================`);
  console.log(`🚀 Starting REST Upload of Generation Sheets`);
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

    // Batch insert for performance and REST stability
    const batchSize = 50;
    let successCount = 0;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize).map((item: any) => ({
        external_id: item.external_id,
        skill: item.skill,
        task_type: item.task_type,
        level: item.target_cefr, // <-- Mapping fixed here
        difficulty: item.difficulty,
        prompt: item.prompt,
        stimulus: item.stimulus || null,
        answer_key: item.answer_key
      }));

      const { data: inserted, error } = await supabase
        .from('question_bank_items')
        .upsert(batch, { onConflict: 'external_id' })
        .select('id');

      if (error) {
        console.error(`❌ Error inserting batch in ${file}:`, error.message);
      } else if (inserted) {
        successCount += inserted.length;
      }
    }
    
    console.log(`✅ Finished ${file}. Successfully uploaded ${successCount} items.`);
    totalUploaded += successCount;
  }
  
  console.log(`\n🎉 Upload Complete! Database now contains ${totalUploaded} new items from the sheets.`);
}

uploadSheets().catch(err => {
  console.error("Critical upload error:", err);
  process.exit(1);
});
