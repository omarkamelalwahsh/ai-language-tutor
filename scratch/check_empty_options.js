import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkEmptyOptions() {
  console.log("Checking for MCQ questions with empty options...");
  
  // We check for questions where task_type is mcq AND options is empty
  const { data, error } = await supabase
    .from('question_bank_items')
    .select('id, prompt, options, answer_key')
    .eq('task_type', 'mcq');

  if (error) {
    console.error("Error:", error);
    return;
  }

  const emptyOptions = data.filter(q => !q.options || q.options.length === 0);
  console.log(`Found ${emptyOptions.length} questions with empty top-level options.`);
  
  if (emptyOptions.length > 0) {
    emptyOptions.slice(0, 5).forEach(q => {
      console.log(`- ID: ${q.id} | Prompt: ${q.prompt}`);
    });
  }
}

checkEmptyOptions();
