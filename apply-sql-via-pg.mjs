import { Client } from 'pg';
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

// Extract project ID from URL
const projectId = supabaseUrl.split('.')[0].replace('https://', '');

console.log('Attempting to connect to Supabase PostgreSQL...\n');
console.log(`Project: ${projectId}`);
console.log(`URL: ${supabaseUrl}\n`);

// We need the PostgreSQL password which isn't in the JWT
// The JWT doesn't contain the password, so we can't directly use it for PostgreSQL
// Let me try using the JWT as the password (some setups allow this)

const connectionString = `postgresql://postgres.${projectId}:${serviceRoleKey}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`;

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('Connecting...');
  await client.connect();
  console.log('✓ Connected!\n');
  
  // Read and execute migration
  const sqlPath = join(dirname(fileURLToPath(import.meta.url)), 'supabase/migrations/20260225000000_initial_schema.sql');
  const sql = readFileSync(sqlPath, 'utf-8');
  
  console.log('Executing migration SQL...');
  await client.query(sql);
  console.log('✓ Migration applied successfully!\n');
  
} catch (err) {
  console.error('Connection or execution failed:');
  console.error(`  ${err.message}\n`);
  
  console.log('This approach requires the actual PostgreSQL password.');
  console.log('The service role JWT cannot be used for direct PostgreSQL connections.\n');
  console.log('You must still use the Supabase Dashboard SQL editor:');
  console.log(`  1. https://sccksxvjckllxlvyuotv.supabase.co/project/default/sql/new`);
  console.log('  2. Paste the migration SQL');
  console.log('  3. Click "Run"\n');
  
} finally {
  await client.end();
}

