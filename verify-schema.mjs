import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const envPath = join(dirname(fileURLToPath(import.meta.url)), '.env.local');
const envLines = readFileSync(envPath, 'utf-8').split('\n');
const env = {};
for (const line of envLines) {
  if (line.startsWith('#') || !line.includes('=')) continue;
  const [key, value] = line.split('=', 2);
  env[key.trim()] = value.trim();
}

const supabaseUrl = env['SUPABASE_URL'] || env['VITE_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];
const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log('Verifying practitioners table exists...\n');

// Try to fetch one record
const { data, error, status, statusText } = await supabase
  .from('practitioners')
  .select('*')
  .limit(1);

if (error) {
  console.log(`Error: ${error.message}`);
  console.log(`Status: ${status} ${statusText}`);
  
  // Try a simpler query
  console.log('\nTrying count query...');
  const { data: countData, error: countError } = await supabase
    .from('practitioners')
    .select('id', { count: 'exact', head: true });
  
  if (countError) {
    console.log(`Count error: ${countError.message}`);
  } else {
    console.log(`✓ Table exists with count data`);
  }
} else {
  console.log(`✓ Successfully queried practitioners table`);
  console.log(`  Records found: ${data ? data.length : 0}`);
  if (data && data.length > 0) {
    console.log(`  Sample: ${JSON.stringify(data[0]).substring(0, 100)}...`);
  }
}

