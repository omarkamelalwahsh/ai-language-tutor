import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || `https://ucrcrrqktybczualmsdw.supabase.co`;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateAllBanks() {
  try {
    console.log('🚀 Starting Universal Migration via Supabase SDK (HTTPS 443)...');

    // 1. Migrate Questions
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    let totalSuccess = 0;
    let totalFail = 0;

    for (const level of levels) {
      const filePath = path.join(process.cwd(), `src/data/banks/${level}.json`);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Bank file ${level}.json not found, skipping...`);
        continue;
      }

      const rawData = fs.readFileSync(filePath, 'utf-8');
      const questions = JSON.parse(rawData);
      console.log(`➡️ Found ${questions.length} questions in ${level}.json. Upserting to Supabase...`);

      // Prepare questions for bulk upsert
      const formattedQuestions = questions.map(q => ({
          external_id: q.id,
          skill: q.skill,
          task_type: q.task_type,
          target_cefr: q.target_cefr || level,
          difficulty: q.difficulty || 0.5,
          prompt: q.prompt,
          stimulus: q.stimulus || null,
          answer_key: q.answer_key
      }));

      // Bulk upsert via API (443)
      const { error } = await supabase
        .from('question_bank_items')
        .upsert(formattedQuestions, { onConflict: 'external_id' });

      if (error) {
        console.error(`❌ Failed to upsert ${level} questions:`, error.message);
        totalFail += questions.length;
      } else {
        console.log(`✅ Successfully synced ${level} questions!`);
        totalSuccess += questions.length;
      }
    }

    console.log(`\n✅ SDK Migration finished!`);
    console.log(`   Successfully processed: ${totalSuccess} items`);
    console.log(`   Failed: ${totalFail}`);

  } catch (err: any) {
    console.error('Migration failed:', err.message);
  }
}

migrateAllBanks();
