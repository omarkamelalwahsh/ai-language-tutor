import { createClient } from '@supabase/supabase-js';

// Get Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ SUPABASE CONFIGURATION ERROR:\n' +
    'The "VITE_SUPABASE_URL" or "VITE_SUPABASE_ANON_KEY" environment variables are missing.\n' +
    '1. Check your local `.env` file.\n' +
    '2. If deployed on Vercel/Netlify, add them to the Project Settings -> Environment Variables dashboard.\n' +
    '3. Re-deploy the application after adding the variables.'
  );
}

// Create the client. If keys are missing, it will use empty strings but won't crash until a call is made.
// We use fallback to empty strings instead of placeholder.supabase.co to avoid DNS resolution errors.
export const supabase = createClient(
  supabaseUrl || 'https://missing-url.supabase.co',
  supabaseAnonKey || 'missing-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
