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

console.log('Database Schema Status Check\n');
console.log('=' .repeat(70));

// Try to access the schema by attempting a query
const { error: practitionersError } = await supabase
  .from('practitioners')
  .select('id', { count: 'exact', head: true });

const { error: centersError } = await supabase
  .from('centers')
  .select('id', { count: 'exact', head: true });

const { error: retreatsError } = await supabase
  .from('retreats')
  .select('id', { count: 'exact', head: true });

const { error: articlesError } = await supabase
  .from('articles')
  .select('id', { count: 'exact', head: true });

const tables = [
  { name: 'practitioners', error: practitionersError },
  { name: 'centers', error: centersError },
  { name: 'retreats', error: retreatsError },
  { name: 'articles', error: articlesError }
];

let allExist = true;
for (const table of tables) {
  if (table.error && table.error.message.includes('does not exist')) {
    console.log(`✗ ${table.name.padEnd(20)} MISSING`);
    allExist = false;
  } else if (table.error) {
    console.log(`? ${table.name.padEnd(20)} ERROR: ${table.error.message.substring(0, 40)}`);
    allExist = false;
  } else {
    console.log(`✓ ${table.name.padEnd(20)} EXISTS`);
  }
}

console.log('=' .repeat(70));

if (!allExist) {
  console.log('\n⚠️  DATABASE SCHEMA NOT YET CREATED\n');
  console.log('The following tables are missing:');
  tables.forEach(t => {
    if (t.error && t.error.message.includes('does not exist')) {
      console.log(`  - ${t.name}`);
    }
  });
  
  console.log('\n' + '='.repeat(70));
  console.log('MANUAL SETUP REQUIRED');
  console.log('='.repeat(70));
  console.log('\nThe Supabase REST API does not support executing arbitrary SQL.');
  console.log('You must apply the migration manually:\n');
  console.log('STEP 1: Open Supabase Dashboard');
  console.log(`  → https://sccksxvjckllxlvyuotv.supabase.co/project/default/sql/new\n`);
  console.log('STEP 2: Copy the migration SQL');
  console.log(`  → File: supabase/migrations/20260225000000_initial_schema.sql\n`);
  console.log('STEP 3: Paste into the SQL Editor');
  console.log(`  → Select all the SQL content and paste into the editor\n`);
  console.log('STEP 4: Execute');
  console.log(`  → Click the "Run" button\n`);
  console.log('STEP 5: Run the ingest script');
  console.log(`  → Once tables are created, run: node scripts/agents/ingest-phase2-to-supabase.mjs\n`);
  
  process.exit(1);
} else {
  console.log('\n✓ All tables exist! Ready to run ingest script.\n');
}

