import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findQuestion() {
  console.log("Searching for question...");
  const { data, error } = await supabase
    .from('question_bank_items')
    .select('*')
    .ilike('prompt', '%What time does the library close on Saturday%');

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Results:", JSON.stringify(data, null, 2));
}

findQuestion();
