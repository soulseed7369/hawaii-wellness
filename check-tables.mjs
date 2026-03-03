import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local
const envPath = join(dirname(fileURLToPath(import.meta.url)), '.env.local');
const envLines = readFileSync(envPath, 'utf-8').split('\n');
const env = {};
for (const line of envLines) {
  if (line.startsWith('#') || !line.includes('=')) continue;
  const [key, value] = line.split('=', 2);
  env[key.trim()] = value.trim();
}

// Validate Supabase credentials
const supabaseUrl = env['SUPABASE_URL'] || env['VITE_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Check if practitioners table exists
const { data, error } = await supabase
  .from('practitioners')
  .select('id')
  .limit(1);

if (error) {
  if (error.message.includes('relation "public.practitioners" does not exist')) {
    console.log('Table "practitioners" does NOT exist - migration needs to be applied');
  } else {
    console.log('Error checking table:', error.message);
  }
} else {
  console.log('Table "practitioners" EXISTS');
  console.log('Sample data:', data);
}
