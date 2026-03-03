#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';

const REQUIRED_HEADER = 'type,name,modality_or_type,phone,email,address,city,region,island,website_url,booking_url,source_name,source_url';

const VALID_TYPES = ['practitioner', 'center', 'retreat'];
const VALID_ISLANDS = ['big_island', 'maui', 'kauai', 'oahu'];

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: node scripts/validate-csv.mjs <csvfile>');
  process.exit(1);
}

const csvPath = args[0];
let fileContent;
try {
  fileContent = fs.readFileSync(csvPath, 'utf8');
} catch (err) {
  console.error(`Error reading file: ${err.message}`);
  process.exit(1);
}

const lines = fileContent.split('\n').filter(line => line.trim() !== '');
if (lines.length < 1) {
  console.error('File is empty');
  process.exit(1);
}

const header = lines[0];
if (header !== REQUIRED_HEADER) {
  console.error(`Header mismatch. Expected: ${REQUIRED_HEADER}`);
  process.exit(1);
}

let validCount = 0;
let errorCount = 0;
const errors = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  const fields = line.split(',');
  
  if (fields.length !== 13) {
    errors.push({ row: i + 1, message: `Wrong number of columns: expected 13, got ${fields.length}` });
    errorCount++;
    continue;
  }

  const [type, name, modality_or_type, phone, email, address, city, region, island, website_url, booking_url, source_name, source_url] = fields;

  if (!name.trim()) {
    errors.push({ row: i + 1, message: 'Name is required' });
    errorCount++;
    continue;
  }

  if (!VALID_TYPES.includes(type)) {
    errors.push({ row: i + 1, message: `Invalid type: ${type}. Must be one of: ${VALID_TYPES.join(', ')}` });
    errorCount++;
    continue;
  }

  if (!VALID_ISLANDS.includes(island)) {
    errors.push({ row: i + 1, message: `Invalid island: ${island}. Must be one of: ${VALID_ISLANDS.join(', ')}` });
    errorCount++;
    continue;
  }

  if (website_url && !website_url.startsWith('http://') && !website_url.startsWith('https://')) {
    errors.push({ row: i + 1, message: 'Website URL must start with http:// or https://' });
    errorCount++;
    continue;
  }

  if (booking_url && !booking_url.startsWith('http://') && !booking_url.startsWith('https://')) {
    errors.push({ row: i + 1, message: 'Booking URL must start with http:// or https://' });
    errorCount++;
    continue;
  }

  validCount++;
}

const totalRows = lines.length - 1;

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`Row ${error.row}: ${error.message}`);
  }
}

console.log(`Total rows: ${totalRows}`);
console.log(`Valid rows: ${validCount}`);
console.log(`Error count: ${errorCount}`);

if (errorCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
