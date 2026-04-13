import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  console.log("Checking DB for schema_test@test.com...");
  
  // Actually, we can't easily query auth.users without service role key, but we can query profiles if email is there
  // Or we can just auth as them, since we have the password!
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'schema_test@test.com',
    password: 'Password123!'
  });
  
  if (authError || !authData.user) {
    console.error("Login failed:", authError);
    return;
  }
  
  const userId = authData.user.id;
  console.log("Logged in! User ID:", userId);
  
  const [profile, skills, errors, journeys] = await Promise.all([
    supabase.from('learner_profiles').select('*').eq('id', userId).single(),
    supabase.from('skill_states').select('*').eq('user_id', userId),
    supabase.from('user_error_profiles').select('*').eq('user_id', userId).single(),
    supabase.from('learning_journeys').select('*').eq('user_id', userId)
  ]);
  
  console.log("--- Learner Profile ---");
  console.log(profile.data);
  
  console.log("\n--- Skill States ---");
  console.log(skills.data);
  
  console.log("\n--- User Error Profiles ---");
  console.log(errors.data);
  
  console.log("\n--- Learning Journeys ---");
  console.log(journeys.data);
}

check().catch(console.error);
