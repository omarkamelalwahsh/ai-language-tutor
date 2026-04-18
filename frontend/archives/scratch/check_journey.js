import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkJourney() {
  console.log("Checking journey_steps schema...");
  
  const { data, error } = await supabase
    .from('journey_steps')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("journey_steps row:", data[0]);
  }
}

checkJourney().catch(console.error);
