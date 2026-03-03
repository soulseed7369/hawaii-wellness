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

console.log('Testing different query styles:\n');

// Test 1: SELECT with head: true
console.log('Test 1: select() with head: true');
const { data: d1, error: e1 } = await supabase
  .from('practitioners')
  .select('id', { count: 'exact', head: true });
console.log('Data:', d1);
console.log('Error:', e1?.message);

// Test 2: SELECT without head
console.log('\nTest 2: select() without head');
const { data: d2, error: e2 } = await supabase
  .from('practitioners')
  .select('id')
  .limit(1);
console.log('Data:', d2);
console.log('Error:', e2?.message);

// Test 3: INSERT
console.log('\nTest 3: insert()');
const { data: d3, error: e3 } = await supabase
  .from('practitioners')
  .insert({ name: 'Test', island: 'big_island', status: 'draft' })
  .select();
console.log('Data:', d3);
console.log('Error:', e3?.message);

