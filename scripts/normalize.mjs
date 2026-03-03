#!/usr/bin/env node
import fs from 'fs';
import readline from 'readline';

const VALID_TYPES = ['practitioner', 'center', 'retreat'];
const HTML_REGEX = /<[^>]+>/g;

function stripHtml(text) {
  if (!text) return text;
  return String(text).replace(HTML_REGEX, '');
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return null;
}

function normalizeUrl(url) {
  if (!url || String(url).trim() === '') return null;
  const normalized = String(url).trim();
  const lower = normalized.toLowerCase();
  if (lower.startsWith('https://')) {
    return normalized;
  }
  if (lower.startsWith('http://')) {
    return 'https://' + normalized.substring(7);
  }
  return null;
}

function getCenterType(modalityStr) {
  if (!modalityStr) return 'wellness_center';
  const lower = String(modalityStr).toLowerCase();
  if (lower.includes('retreat')) return 'retreat_center';
  if (lower.includes('spa')) return 'spa';
  if (lower.includes('clinic') || lower.includes('medical')) return 'clinic';
  if (lower.includes('yoga') || lower.includes('wellness')) return 'wellness_center';
  return 'wellness_center';
}

function parseModalities(modalityStr) {
  if (!modalityStr) return [];
  return String(modalityStr)
    .split(',')
    .map(m => m.trim())
    .filter(m => m.length > 0);
}

async function main() {
  const inputPath = process.argv[2];
  
  if (!inputPath) {
    console.error('Usage: node normalize.mjs <input.csv>');
    process.exit(1);
  }

  const fileStream = fs.createReadStream(inputPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const results = [];
  let headerLine = true;
  const headers = [];
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    
    if (headerLine) {
      headers.push(...line.split(',').map(h => h.trim()));
      headerLine = false;
      continue;
    }

    if (!line.trim()) continue;

    const fields = line.split(',').map(f => f.trim());
    if (fields.length !== headers.length) {
      console.error(`Warning: Line ${lineNum} has ${fields.length} fields, expected ${headers.length}`);
      continue;
    }

    const row = {};
    headers.forEach((header, idx) => {
      row[header] = stripHtml(fields[idx]);
    });

    const type = row.type;
    if (!VALID_TYPES.includes(type)) {
      console.error(`Warning: Skipping row ${lineNum} with invalid type: ${type}`);
      continue;
    }

    const now = new Date().toISOString();
    const phone = normalizePhone(row.phone);
    const website = normalizeUrl(row.website_url);
    const booking = normalizeUrl(row.booking_url);

    const baseObject = {
      type,
      name: row.name,
      island: row.island,
      city: row.city,
      region: row.region,
      address: row.address,
      phone,
      email: row.email,
      website_url: website,
      status: 'draft',
      owner_id: null,
      _source_name: row.source_name,
      _source_url: row.source_url,
      _scraped_at: now
    };

    let output;

    if (type === 'practitioner') {
      output = {
        ...baseObject,
        external_booking_url: booking,
        modalities: parseModalities(row.modality_or_type),
        bio: null,
        accepts_new_clients: true
      };
    } else if (type === 'center') {
      output = {
        ...baseObject,
        external_website_url: website,
        center_type: getCenterType(row.modality_or_type),
        description: null
      };
    } else if (type === 'retreat') {
      output = {
        ...baseObject,
        type: 'retreat',
        title: row.name,
        registration_url: booking,
        venue_name: null,
        start_date: null,
        end_date: null,
        starting_price: null,
        description: null
      };
    }

    results.push(output);
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
