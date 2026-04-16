import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .limit(1);

  if (error) {
    if (error.code === '42P01') {
      console.log('Table "assessments" does NOT exist.');
    } else {
      console.error('Error fetching assessments:', error);
    }
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns in "assessments":', Object.keys(data[0]));
  } else {
    // If no data, we can try to get column names from information_schema
    const { data: cols, error: colError } = await supabase.rpc('get_table_columns', { table_name: 'assessments' });
    if (colError) {
      console.log('Could not fetch columns via RPC. Trying raw query...');
      // Since I can't run raw SQL easily via JS client without an RPC, 
      // I'll try to insert a dummy row to trigger a schema error or see if I can get some info.
       console.log('No data found in "assessments" to infer columns.');
    } else {
      console.log('Columns in "assessments":', cols);
    }
  }
}

inspect();
