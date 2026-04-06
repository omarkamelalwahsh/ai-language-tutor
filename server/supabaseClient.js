import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ucrcrrqktybczualmsdw.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error('❌ Supabase service role key is missing in .env');
}

// Service role client allows bypassing RLS for server-side auth/admin logic
export const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
