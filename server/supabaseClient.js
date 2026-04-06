import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ucrcrrqktybczualmsdw.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error(
        '❌ SERVER CONFIGURATION ERROR:\n' +
        'The "SUPABASE_SERVICE_ROLE_KEY" environment variable is missing.\n' +
        '1. Go to your Supabase Dashboard -> Project Settings -> API.\n' +
        '2. Copy the "service_role" secret key (NOT the anon key).\n' +
        '3. Add it to your Vercel Environment Variables as "SUPABASE_SERVICE_ROLE_KEY".\n' +
        '4. Redeploy the project.'
    );
}

// Service role client allows bypassing RLS for server-side auth/admin logic.
// We fallback to a dummy string to avoid library errors, but actual calls will fail with a 401/403.
export const supabase = createClient(supabaseUrl, supabaseKey || 'missing-service-key');

export default supabase;
