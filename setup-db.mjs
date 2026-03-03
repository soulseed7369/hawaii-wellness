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

console.log('Setting up database schema...\n');

// Read the migration file
const sqlPath = join(dirname(fileURLToPath(import.meta.url)), 'supabase/migrations/20260225000000_initial_schema.sql');
const sqlContent = readFileSync(sqlPath, 'utf-8');

// Parse the SQL into individual statements more carefully
// This regex matches complete SQL statements (handles comments, strings, etc.)
const statements = [];
let current = '';
let inString = false;
let inMultilineComment = false;
let stringChar = null;

for (let i = 0; i < sqlContent.length; i++) {
  const char = sqlContent[i];
  const nextChar = sqlContent[i + 1];
  const prevChar = i > 0 ? sqlContent[i - 1] : '';
  
  // Handle multiline comments
  if (!inString && !inMultilineComment && char === '/' && nextChar === '*') {
    inMultilineComment = true;
    current += char;
    i++; // Skip next char
    continue;
  }
  if (inMultilineComment && char === '*' && nextChar === '/') {
    inMultilineComment = true;
    current += char + nextChar;
    i++; // Skip next char
    continue;
  }
  
  // Handle strings
  if (!inMultilineComment && (char === "'" || char === '"') && prevChar !== '\\') {
    if (!inString) {
      inString = true;
      stringChar = char;
    } else if (char === stringChar) {
      inString = false;
      stringChar = null;
    }
  }
  
  current += char;
  
  // Statement terminator
  if (!inString && !inMultilineComment && char === ';') {
    const trimmed = current.trim();
    if (trimmed && !trimmed.startsWith('--')) {
      statements.push(trimmed);
    }
    current = '';
  }
}

// Add any remaining statement
if (current.trim() && !current.trim().startsWith('--')) {
  statements.push(current.trim());
}

console.log(`Found ${statements.length} SQL statements\n`);

// Since we can't execute via REST API, we'll need to create each table individually
// Let's start with the practitioners table
const createPractitionersTable = `
CREATE TABLE IF NOT EXISTS practitioners (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name                 text NOT NULL,
  modalities           text[] NOT NULL DEFAULT '{}',
  bio                  text,
  island               text NOT NULL DEFAULT 'big_island',
  region               text,
  city                 text,
  address              text,
  lat                  numeric(9,6),
  lng                  numeric(9,6),
  phone                text,
  email                text,
  website_url          text,
  external_booking_url text,
  accepts_new_clients  boolean DEFAULT true,
  status               text NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','published','archived')),
  tier                 text NOT NULL DEFAULT 'free'
                         CHECK (tier IN ('free','premium','featured')),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);
`;

// Try to verify if tables exist by attempting to query them
console.log('Checking if practitioners table exists...');
const { data: practitionersCheck, error: practitionersError } = await supabase
  .from('practitioners')
  .select('id')
  .limit(1);

if (practitionersError && practitionersError.message.includes('does not exist')) {
  console.log('✗ Practitioners table does NOT exist');
  console.log('\nIMPORTANT: The database schema must be created manually.');
  console.log('This requires direct SQL execution which is not available via the REST API.\n');
  console.log('Please do ONE of the following:\n');
  console.log('1. EASIEST - Use Supabase Dashboard:');
  console.log('   - Go to: https://sccksxvjckllxlvyuotv.supabase.co/project/default/sql/new');
  console.log('   - Open file: supabase/migrations/20260225000000_initial_schema.sql');
  console.log('   - Copy the entire content and paste it into the SQL editor');
  console.log('   - Click "Run"');
  console.log('');
  console.log('2. Use Supabase CLI (requires installation):');
  console.log('   - supabase db push');
  console.log('');
  console.log('3. Use psql directly (requires PostgreSQL connection):');
  console.log('   - Get connection string from Supabase project settings');
  console.log('   - psql <connection_string> < supabase/migrations/20260225000000_initial_schema.sql');
  console.log('');
  console.log('After creating the schema, run the ingest script again.');
  process.exit(1);
} else if (practitionersError) {
  console.log('✗ Error checking table:', practitionersError.message);
  process.exit(1);
} else {
  console.log('✓ Practitioners table EXISTS');
  console.log('  Ready to proceed with data ingest\n');
}

