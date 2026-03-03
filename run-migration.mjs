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

const supabaseUrl = env['SUPABASE_URL'] || env['VITE_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Read migration SQL
const sqlPath = join(dirname(fileURLToPath(import.meta.url)), 'supabase/migrations/20260225000000_initial_schema.sql');
const sqlContent = readFileSync(sqlPath, 'utf-8');

// Since we can't execute SQL directly through the API, let's check if we can
// insert into a test table to verify the connection works
console.log('Testing Supabase connection...');

// Try to query a built-in table (information_schema)
const { data: testData, error: testError } = await supabase.rpc('get_version', {});

if (testError) {
  console.log('RPC test failed, trying direct query instead...');
  
  // Since RPC doesn't work, we need to manually create tables
  // Let's use the REST API to create a stored function that can execute our SQL
  
  // Actually, let's try a different approach: check if tables exist first
  const { data: schemaData, error: schemaError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');
  
  if (schemaError) {
    console.error('Cannot query information_schema:', schemaError.message);
    console.log('\nMigration cannot be applied via REST API.');
    console.log('Please apply the migration manually:');
    console.log('1. Go to: https://sccksxvjckllxlvyuotv.supabase.co/project/default/sql/new');
    console.log('2. Paste the contents of supabase/migrations/20260225000000_initial_schema.sql');
    console.log('3. Click "Run"');
    console.log('\nOr use Supabase CLI: supabase db push');
  }
} else {
  console.log('PostgreSQL version:', testData);
}

// Let's try another approach: call pg_catalog queries directly via the query endpoint
// For now, output instructions
console.log('\n=== Migration Instructions ===');
console.log('The Supabase REST API does not support executing arbitrary SQL.');
console.log('Please use one of these methods:');
console.log('');
console.log('Method 1 (Fastest): Supabase Dashboard');
console.log('  1. Open: https://sccksxvjckllxlvyuotv.supabase.co/project/default/sql/new');
console.log('  2. Copy & paste the migration SQL');
console.log('  3. Click "Run"');
console.log('');
console.log('Method 2: Supabase CLI');
console.log('  1. Install: npm install -g supabase');
console.log('  2. Run: supabase db push');
console.log('');
console.log('Method 3: Direct PostgreSQL connection');
console.log('  See your Supabase project settings for connection string');
console.log('');
console.log('For now, proceeding with ingest assuming tables will be created...');
