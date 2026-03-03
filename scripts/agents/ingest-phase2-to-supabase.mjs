import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local
const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env.local');
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

const supabase = createClient(supabaseUrl, serviceRoleKey);

// City coordinates map
const cityCoordinates = {
  'kailua-kona': { lat: 19.6400, lng: -155.9969 },
  'kona': { lat: 19.6400, lng: -155.9969 },
  'hilo': { lat: 19.7241, lng: -155.0868 },
  'waimea': { lat: 20.0131, lng: -155.6691 },
  'waikoloa': { lat: 19.9208, lng: -155.7868 },
  'pahoa': { lat: 19.4966, lng: -154.9442 },
  'keaau': { lat: 19.6161, lng: -155.0358 },
  'captain cook': { lat: 19.5011, lng: -155.9220 },
  'kealakekua': { lat: 19.5222, lng: -155.9239 },
  'naalehu': { lat: 19.0633, lng: -155.5872 },
  'ocean view': { lat: 19.0966, lng: -155.7408 },
  'honokaa': { lat: 20.0786, lng: -155.4680 },
  'mountain view': { lat: 19.5564, lng: -155.1084 },
  'kamuela': { lat: 20.0131, lng: -155.6691 }
};

// Parse CLI flags
let dryRun = false;
let limit = Infinity;

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--dry-run') dryRun = true;
  if (arg.startsWith('--limit')) {
    const parts = arg.split('=');
    if (parts[1]) {
      limit = parseInt(parts[1], 10);
    } else if (i + 1 < process.argv.length) {
      limit = parseInt(process.argv[++i], 10);
    }
  }
}

// Read JSON data
const jsonPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'discovery', 'phase2_validated_practitioners.json');
try {
  const jsonData = readFileSync(jsonPath, 'utf-8');
  const records = JSON.parse(jsonData);
  
  let insertedCount = 0;
  let skippedNoName = 0;
  let skippedDuplicates = 0;
  let failedCount = 0;
  let processedCount = 0;
  
  for (const record of records) {
    if (processedCount >= limit) break;
    processedCount++;
    
    // Skip if name is missing
    if (!record.name || typeof record.name !== 'string' || record.name.trim() === '') {
      skippedNoName++;
      continue;
    }
    
    // Check for duplicates in Supabase
    const { data: existing, error } = await supabase
      .from('practitioners')
      .select('*')
      .eq('name', record.name)
      .eq('city', record.town)
      .limit(1);
    
    if (error) {
      console.error(`Error checking duplicates for ${record.name} in ${record.town}:`, error.message);
      failedCount++;
      continue;
    }
    
    if (existing && existing.length > 0) {
      skippedDuplicates++;
      continue;
    }
    
    // Prepare insert data
    const modalities = new Set();
    if (record.practitioner_type) {
      modalities.add(record.practitioner_type);
    }
    if (record.specialties && Array.isArray(record.specialties)) {
      for (const specialty of record.specialties) {
        if (typeof specialty === 'string') {
          modalities.add(specialty.trim());
        }
      }
    }
    
    const cityKey = record.town?.toLowerCase();
    const coords = cityCoordinates[cityKey] || { lat: null, lng: null };
    
    const insertData = {
      name: record.name,
      bio: record.bio_excerpt || null,
      phone: record.phone || null,
      email: record.email || null,
      website_url: record.website || null,
      address: record.address || null,
      city: record.town || null,
      island: 'big_island',
      modalities: Array.from(modalities),
      status: 'draft',
      owner_id: null,
      tier: 'free',
      lat: coords.lat,
      lng: coords.lng
    };
    
    // Execute insert or dry run
    if (dryRun) {
      console.log(`Dry run - Would insert: ${JSON.stringify(insertData, null, 2)}`);
      insertedCount++;
    } else {
      try {
        const { error: insertError } = await supabase
          .from('practitioners')
          .insert([insertData]);
        
        if (insertError) {
          console.error(`Insert error for ${record.name} in ${record.town}:`, insertError.message);
          failedCount++;
        } else {
          insertedCount++;
        }
      } catch (err) {
        console.error(`Unexpected error for ${record.name} in ${record.town}:`, err.message);
        failedCount++;
      }
    }
  }
  
  // Output summary
  console.log(`\nSummary:`);
  console.log(`Inserted: ${insertedCount}`);
  console.log(`Skipped (no name): ${skippedNoName}`);
  console.log(`Skipped (duplicate): ${skippedDuplicates}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Total processed: ${processedCount}`);
  
} catch (err) {
  console.error('Error processing JSON file:', err.message);
  process.exit(1);
}
