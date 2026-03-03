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

// Create fresh client
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } }
});

console.log('Supabase Connection Diagnostic\n');
console.log('=' .repeat(70));

console.log('\n1. Testing basic connectivity...');
const { data: auth, error: authError } = await supabase.auth.getUser();
if (authError) {
  console.log(`   Auth status: Error - ${authError.message}`);
} else {
  console.log(`   Auth status: Connected with service role`);
}

console.log('\n2. Checking table access...');
const tablesToCheck = ['practitioners', 'centers', 'retreats', 'articles'];

for (const table of tablesToCheck) {
  try {
    const { data, error, status } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`   ${table.padEnd(15)} Error: ${error.message.substring(0, 50)}`);
    } else {
      console.log(`   ${table.padEnd(15)} ✓ Accessible`);
    }
  } catch (err) {
    console.log(`   ${table.padEnd(15)} Exception: ${err.message.substring(0, 50)}`);
  }
}

console.log('\n3. Testing insert capability...');
const { data: insertResult, error: insertError } = await supabase
  .from('practitioners')
  .insert({
    name: 'Test Practitioner',
    island: 'big_island',
    status: 'draft'
  })
  .select('*');

if (insertError) {
  console.log(`   Insert test failed: ${insertError.message}`);
  console.log(`   Status code: ${insertError.code || 'unknown'}`);
  
  // Try checking if table is in public schema
  console.log('\n4. Checking schema visibility...');
  const { data: schemas, error: schemaError } = await supabase.rpc('get_tables_info', {});
  if (schemaError) {
    console.log(`   Cannot query schema info: ${schemaError.message}`);
  } else {
    console.log(`   Available tables:`, schemas);
  }
} else {
  console.log(`   ✓ Insert successful! Created test record.`);
  if (insertResult && insertResult[0]) {
    console.log(`   Record ID: ${insertResult[0].id}`);
  }
}

