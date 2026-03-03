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

console.log('=== MIGRATION SETUP REQUIRED ===\n');
console.log('The Supabase project requires database schema setup via direct SQL execution.');
console.log('The REST API does not support executing arbitrary SQL statements.\n');

console.log('PROJECT DETAILS:');
console.log(`URL: ${supabaseUrl}`);
console.log(`Project ID: ${supabaseUrl.split('.')[0].replace('https://', '')}\n`);

const sqlPath = join(dirname(fileURLToPath(import.meta.url)), 'supabase/migrations/20260225000000_initial_schema.sql');
const sqlContent = readFileSync(sqlPath, 'utf-8');

console.log('MIGRATION FILE: supabase/migrations/20260225000000_initial_schema.sql');
console.log(`Size: ${sqlContent.length} bytes\n`);

console.log('=' .repeat(70));
console.log('CHOOSE ONE OF THESE OPTIONS:');
console.log('=' .repeat(70));

console.log(`\n▶ OPTION 1: Supabase Web Dashboard (EASIEST)\n`);
console.log(`  1. Visit: ${supabaseUrl}/project/default/sql/new`);
console.log(`  2. Create a new SQL query`);
console.log(`  3. Copy-paste the migration file contents below`);
console.log(`  4. Click "Run"\n`);

console.log('▶ OPTION 2: Supabase CLI\n');
console.log('  1. Install: npm install -g supabase');
console.log('  2. In project directory, run: supabase db push');
console.log(`  3. Link your project: supabase link --project-ref sccksxvjckllxlvyuotv\n`);

console.log('▶ OPTION 3: PostgreSQL CLI (psql)\n');
console.log('  Get your PostgreSQL connection string from Supabase:');
console.log(`  - Dashboard > Project Settings > Database > Connection string`);
console.log(`  Then run: psql "<connection_string>" < supabase/migrations/20260225000000_initial_schema.sql\n`);

console.log('=' .repeat(70));
console.log('MIGRATION SQL CONTENT:');
console.log('=' .repeat(70));
console.log(sqlContent);
console.log('=' .repeat(70));

console.log('\n⚠️  After applying the migration, run the ingest script:');
console.log('   npm run ingest  OR  node scripts/agents/ingest-phase2-to-supabase.mjs\n');

