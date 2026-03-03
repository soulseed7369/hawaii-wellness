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

console.log('Detailed error checking:\n');

const { error: practitionersError } = await supabase
  .from('practitioners')
  .select('id', { count: 'exact', head: true });

console.log('Practitioners error:', practitionersError);
console.log('Error message:', practitionersError?.message);
console.log('Error includes "does not exist"?', practitionersError?.message.includes('does not exist'));

