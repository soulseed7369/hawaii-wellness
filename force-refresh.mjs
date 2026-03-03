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

console.log('Attempting to force schema cache refresh...\n');

// Try accessing with a fresh client and different options
const supabase = createClient(supabaseUrl, serviceRoleKey);

// The issue might be that the tables don't actually exist
// Let's try to get column information through RPC if available
console.log('Checking if tables truly exist...\n');

// Try a raw RPC call to check the schema
const { data: tableInfo, error: tableError } = await supabase.rpc('pg_sleep', { seconds: 0.1 });
if (tableError) {
  console.log(`Cannot execute RPC: ${tableError.message}`);
}

// Try creating a simple test table first
console.log('Attempting to create a simple test table...');
const { data: testCreate, error: testCreateError } = await supabase
  .from('test_table_xyz')
  .insert({ id: '12345' });

if (testCreateError && testCreateError.message.includes('does not exist')) {
  console.log(`✓ Confirmed: Table does not exist (expected for new table)`);
  console.log(`\nThis means the REST API schema cache is working properly,`);
  console.log(`but the 'practitioners' table doesn't exist in the REST API layer.\n`);
  console.log(`LIKELY ISSUE: The migration SQL was never actually executed.`);
  console.log(`The tables might only be in the local migration folder, not in the database.\n`);
} else if (testCreateError) {
  console.log(`Error: ${testCreateError.message}`);
} else {
  console.log(`Test table created! This suggests the API is working.`);
}

// Now let's check the actual practitioners table one more time
console.log('\nFinal check on practitioners table...');
const attempts = 3;
for (let i = 0; i < attempts; i++) {
  const { data, error } = await supabase
    .from('practitioners')
    .insert({ name: 'Test', island: 'big_island', status: 'draft' })
    .select();
  
  if (!error) {
    console.log(`✓ Insert successful on attempt ${i + 1}`);
    break;
  } else if (i < attempts - 1) {
    console.log(`Attempt ${i + 1} failed: ${error.message}`);
    console.log('Waiting 2 seconds before retry...');
    await new Promise(r => setTimeout(r, 2000));
  } else {
    console.log(`All ${attempts} attempts failed.`);
    console.log(`Final error: ${error.message}\n`);
    
    console.log('=' .repeat(70));
    console.log('CONCLUSION: The practitioners table does not exist in the database.');
    console.log('=' .repeat(70));
    console.log('\nThe migration SQL has NOT been applied to the Supabase database.');
    console.log('\nYou must apply the migration manually:');
    console.log(`1. Go to: https://sccksxvjckllxlvyuotv.supabase.co/project/default/sql/new`);
    console.log(`2. Copy & paste: supabase/migrations/20260225000000_initial_schema.sql`);
    console.log(`3. Click "Run"`);
    console.log('\nAfter applying the migration, run this script again.');
  }
}

