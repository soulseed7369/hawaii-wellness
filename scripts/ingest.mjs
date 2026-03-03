#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
const envPath = join(process.cwd(), '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.trim() === '' || line.startsWith('#')) continue;
    const [key, value] = line.split('=', 2);
    process.env[key.trim()] = value?.trim().replace(/^["'](.*)["']$/, '$1') || '';
  }
} catch (err) {
  // Ignore if .env.local doesn't exist
}

// Validate environment
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Parse command line arguments
const args = process.argv.slice(2);
const filePath = args[0];
const isDryRun = args.includes('--dry-run');

if (!filePath) {
  console.error('Usage: node scripts/ingest.mjs <normalized.json> [--dry-run]');
  process.exit(1);
}

// Read and parse JSON file
const rawData = readFileSync(filePath, 'utf8');
let records;
try {
  records = JSON.parse(rawData);
} catch (err) {
  console.error('Error parsing JSON:', err.message);
  process.exit(1);
}

if (!Array.isArray(records)) {
  console.error('Error: JSON file must contain an array');
  process.exit(1);
}

// Load city centroids
const centroidsPath = join(process.cwd(), 'data', 'city-centroids.json');
let cityCentroids = {};
try {
  const centroidsData = readFileSync(centroidsPath, 'utf8');
  cityCentroids = JSON.parse(centroidsData);
} catch (err) {
  console.error('Warning: Could not load city centroids:', err.message);
}

// Helper to get required field
function getRequiredField(record, field, type) {
  if (type === 'retreats' && field === 'name') return record.title;
  return record[field];
}

// Helper to get unique key for deduplication
function getUniqueKey(record, type) {
  const name = getRequiredField(record, 'name', type);
  const city = record.city;
  const island = record.island;
  return `${name}|${city}|${island}`;
}

// Helper to apply city centroid fallback
function applyCityCentroidFallback(record) {
  if (record.lat && record.lng) return record;
  
  const city = record.city?.toLowerCase();
  if (!city || !cityCentroids[city]) return record;
  
  const centroid = cityCentroids[city];
  return {
    ...record,
    lat: centroid.lat,
    lng: centroid.lng
  };
}

// Helper to strip metadata fields
function stripMetadataFields(record, type) {
  const stripped = { ...record };
  delete stripped._source_name;
  delete stripped._source_url;
  delete stripped._scraped_at;
  delete stripped.type;
  
  if (type === 'retreats') {
    delete stripped.name; // retreats use title instead
  }
  
  return stripped;
}

// Helper to prepare insert data
function prepareInsertData(record, type) {
  const prepared = stripMetadataFields(record, type);
  
  // Apply city centroid fallback
  const withCentroid = applyCityCentroidFallback(prepared);
  
  // Set common fields
  withCentroid.owner_id = null;
  withCentroid.status = record.status || 'draft';
  withCentroid.tier = 'free';
  
  return withCentroid;
}

// Helper to get table name
function getTableName(type) {
  switch (type) {
    case 'practitioner': return 'practitioners';
    case 'center': return 'centers';
    case 'retreat': return 'retreats';
    default: return type;
  }
}

// Helper to check if record exists
async function checkExists(record, type) {
  const tableName = getTableName(type);
  const name = getRequiredField(record, 'name', type);
  const city = record.city;
  const island = record.island;
  
  let query = supabase
    .from(tableName)
    .select('id')
    .eq('island', island);
  
  if (type === 'retreat') {
    query = query.eq('title', name).eq('city', city);
  } else {
    query = query.eq('name', name).eq('city', city);
  }
  
  const { data, error } = await query.maybeSingle();
  
  if (error && error.code !== 'PGRST116') {
    console.error(`Error checking existence for ${tableName}:`, error.message);
    return true; // Assume exists to avoid duplicate insert
  }
  
  return !!data;
}

// Process records in batches
async function processRecords(records) {
  const batchSize = 100;
  let total = records.length;
  let inserted = 0;
  let skippedDuplicate = 0;
  let skippedInvalid = 0;
  let errors = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    for (const record of batch) {
      const type = record.type;
      
      // Validate required fields
      if (!type || !['practitioner', 'center', 'retreat'].includes(type)) {
        console.warn(`Skipping record: invalid type "${type}"`);
        skippedInvalid++;
        continue;
      }
      
      const requiredFields = ['name', 'island'];
      if (type === 'retreat') {
        requiredFields[0] = 'title';
      }
      
      let isValid = true;
      for (const field of requiredFields) {
        if (!record[field]) {
          console.warn(`Skipping record: missing required field "${field}"`);
          isValid = false;
          break;
        }
      }
      
      if (!isValid) {
        skippedInvalid++;
        continue;
      }
      
      // Check for duplicates
      const exists = await checkExists(record, type);
      if (exists) {
        skippedDuplicate++;
        continue;
      }
      
      // Prepare data for insert
      const tableName = getTableName(type);
      const insertData = prepareInsertData(record, type);
      
      if (isDryRun) {
        console.log(`Would insert into ${tableName}:`, JSON.stringify(insertData, null, 2));
        inserted++;
      } else {
        const { data, error } = await supabase
          .from(tableName)
          .insert([insertData])
          .select();
          
        if (error) {
          console.error(`Error inserting into ${tableName}:`, error.message);
          errors++;
        } else {
          inserted++;
        }
      }
    }
  }
  
  console.log('\nSummary:');
  console.log(`Total records: ${total}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (duplicate): ${skippedDuplicate}`);
  console.log(`Skipped (invalid): ${skippedInvalid}`);
  console.log(`Errors: ${errors}`);
  
  return errors > 0 ? 1 : 0;
}

// Run the ingestion
processRecords(records).then(exitCode => {
  process.exit(exitCode);
}).catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});