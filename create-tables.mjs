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

console.log('Attempting to create database tables via REST API workarounds...\n');

// Try approach 1: Create a stored procedure that the ingest script can call
// First, let's try using RPC with execute_sql or similar
console.log('Attempt 1: Checking for available RPC functions...');
const { data: rpcs, error: rpcsError } = await supabase.rpc('list_rpc_functions', {}).catch(e => ({ error: e }));

if (rpcsError) {
  console.log('  ✗ list_rpc_functions not available\n');
} else {
  console.log('  ✓ Available functions:', rpcs);
}

// Try approach 2: Check if there's a sql_exec or similar function
console.log('Attempt 2: Trying sql_exec function...');
const sqlPath = join(dirname(fileURLToPath(import.meta.url)), 'supabase/migrations/20260225000000_initial_schema.sql');
const sqlContent = readFileSync(sqlPath, 'utf-8');

const { data: sqlResult, error: sqlError } = await supabase
  .rpc('sql_exec', { sql: sqlContent })
  .catch(e => ({ error: { message: e.message } }));

if (sqlError && sqlError.message.includes('does not exist')) {
  console.log('  ✗ sql_exec function does not exist\n');
  
  // Try approach 3: Use http endpoint
  console.log('Attempt 3: Trying HTTP POST to SQL endpoint...');
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: sqlContent }),
    });
    
    const responseText = await response.text();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response: ${responseText.substring(0, 200)}\n`);
  } catch (err) {
    console.log(`  ✗ Error: ${err.message}\n`);
  }
} else if (sqlError) {
  console.log(`  ✗ Error: ${sqlError.message}\n`);
} else {
  console.log(`  ✓ SQL executed successfully!`);
  console.log(`  Result: `, sqlResult);
}

console.log('\n' + '='.repeat(70));
console.log('RECOMMENDATION:');
console.log('='.repeat(70));
console.log('\nSince direct SQL execution is not available via REST API,');
console.log('the migration must be applied manually through the Supabase dashboard.\n');
console.log('This is a limitation of the Supabase REST API design.\n');
console.log('✓ Navigate to: https://sccksxvjckllxlvyuotv.supabase.co/project/default/sql/new');
console.log('✓ Copy the migration file: supabase/migrations/20260225000000_initial_schema.sql');
console.log('✓ Paste into the SQL editor and click "Run"\n');

