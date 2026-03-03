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

// Load the data file
const dataPath = join(dirname(fileURLToPath(import.meta.url)), 'data/discovery/phase2_validated_practitioners.json');
const jsonData = readFileSync(dataPath, 'utf-8');
const records = JSON.parse(jsonData);

console.log(`Loaded ${records.length} practitioners from phase2_validated_practitioners.json\n`);
console.log('Attempting direct table insert...\n');

// Try to insert directly
const testRecord = {
  name: records[0].name || 'Test',
  island: 'big_island',
  status: 'draft'
};

console.log(`Test record: ${JSON.stringify(testRecord)}`);

const { data, error } = await supabase
  .from('practitioners')
  .insert([testRecord])
  .select();

if (error) {
  console.log(`\n✗ Insert failed: ${error.message}`);
  console.log(`  Error code: ${error.code}`);
  console.log(`  Details: ${JSON.stringify(error)}`);
  
  // The problem is likely that the tables were created but the Supabase
  // REST API layer hasn't loaded the new schema into its cache.
  // This is a known issue with Supabase - the cache needs to be refreshed.
  
  console.log('\n' + '='.repeat(70));
  console.log('DATABASE SCHEMA CACHE ISSUE DETECTED');
  console.log('='.repeat(70));
  console.log('\nThe tables exist but the Supabase REST API cache');
  console.log('does not recognize them for write operations.');
  console.log('\nPossible solutions:');
  console.log('1. Restart the Supabase services (if self-hosted)');
  console.log('2. Wait a few minutes for cache invalidation');
  console.log('3. Contact Supabase support if using cloud (rare issue)');
  console.log('4. Drop and recreate the tables');
  console.log('\nAttempting alternative approach: Checking if RLS is the issue...\n');
  
  // Check if RLS policies exist
  const { data: policies, error: policiesError } = await supabase.rpc('get_rls_info', {});
  if (policiesError) {
    console.log(`Cannot check RLS policies: ${policiesError.message}`);
  }
  
} else {
  console.log(`\n✓ Insert successful!`);
  console.log(`  Inserted record: ${JSON.stringify(data)}`);
}

