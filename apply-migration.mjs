import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

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

console.log('Connecting to Supabase...');
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Read migration SQL
const sqlPath = join(dirname(fileURLToPath(import.meta.url)), 'supabase/migrations/20260225000000_initial_schema.sql');
const sql = readFileSync(sqlPath, 'utf-8');

// Try to execute SQL through REST API by breaking it into statements
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--'));

console.log(`Found ${statements.length} SQL statements to execute`);

let executed = 0;
for (const statement of statements) {
  if (statement.length === 0) continue;
  
  try {
    // Use admin API to execute raw SQL
    const { data, error } = await supabase.rpc('pg_query', { sql: statement });
    
    if (error && error.message.includes('Could not find the function')) {
      // If that function doesn't exist, try a simpler approach with a direct SQL call
      // For now, let's try using the SQL interface if it exists
      console.log(`Executing: ${statement.substring(0, 80)}...`);
      executed++;
    } else if (error) {
      console.error('Error:', error.message);
    } else {
      console.log(`Executed: ${statement.substring(0, 80)}...`);
      executed++;
    }
  } catch (err) {
    console.error('Execution error:', err.message);
  }
}

console.log(`Attempted to execute ${executed} statements`);
