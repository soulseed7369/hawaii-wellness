import { readFileSync, writeFileSync } from 'fs';
import fetch from 'node-fetch';

const CONFIG = {
  LM_STUDIO_URL: 'http://192.168.68.68:1234/v1/chat/completions',
  LLM_MODEL: 'qwen/qwen3-8b',
  INPUT_FILE: 'data/discovery/phase2_practitioners_raw_big_island.json',
  OUTPUT_FILE: 'data/discovery/phase2_validated_practitioners.json',
  REPORT_FILE: 'data/discovery/phase2_validation_report.json',
  DELAY_MS: 800,
  TIMEOUT_MS: 60000
};

const BIG_ISLAND_TOWNS = new Set([
  'kailua-kona', 'kona', 'kealakekua', 'captain cook', 
  'waikoloa', 'hilo', 'pahoa', 'keaau', 'mountain view', 
  'waimea', 'honokaa', 'ocean view', 'naalehu', 
  'kamuela', 'kawaihae', 'kohala', 'hamakua', 'laupahoehoe',
  'holualoa', 'kealakekua', 'puako', 'napoopoo', 'milolii',
  'pahala', 'volcano', 'hawi', 'kapaau', 'waipio'
]);

// Rule-based pre-filter: discard obvious non-practitioners
const NOISE_PATTERNS = [
  /electric|scuba|collision|auto center|auto body|elopement|car wash|tire|plumbing|roofing/i,
  /travel guide|tours\.com|bigislandguide/i,
];

function ruleBasedCheck(record) {
  const name = String(record.name || '');
  const bio = String(
    typeof record.bio_excerpt === 'object' 
      ? JSON.stringify(record.bio_excerpt) 
      : (record.bio_excerpt || '')
  );
  const website = String(record.website || '');
  
  // Discard if name matches noise patterns
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(name)) return { keep: false, reason: 'noise_pattern_name' };
  }
  
  // Discard if name looks like a URL
  if (name.startsWith('http') || name.startsWith('www.')) {
    return { keep: false, reason: 'name_is_url' };
  }
  
  // Discard if name looks like a question/blog title
  if (name.startsWith('What ') || name.startsWith('How ') || name.startsWith('Why ')) {
    return { keep: false, reason: 'name_is_question' };
  }
  
  // Discard if bio mentions Kauai without Big Island mention
  if (/kauai/i.test(bio) && !/big island|hawaii island|kailua.kona|hilo|waimea/i.test(bio)) {
    return { keep: false, reason: 'kauai_not_big_island' };
  }
  
  // Discard pure duplicates
  if (record.extraction_method === 'duplicate') {
    return { keep: false, reason: 'duplicate_record' };
  }
  
  return { keep: true, reason: null };
}

// Extract town from address string
function extractTown(address) {
  if (!address) return null;
  const addr = String(address).toLowerCase();
  for (const town of BIG_ISLAND_TOWNS) {
    if (addr.includes(town)) {
      // Capitalize properly
      if (town === 'kailua-kona') return 'Kailua-Kona';
      if (town === 'kona') return 'Kailua-Kona';
      if (town === 'kamuela') return 'Waimea';
      return town.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  // Check for HI zip codes in address - not useful for town
  return null;
}

// Guess practitioner type from name/bio/website
function guessPractitionerType(record) {
  const text = [record.name, record.bio_excerpt, record.website].join(' ').toLowerCase();
  if (/acupuncture|acupressure|tcm|oriental medicine/i.test(text)) return 'acupuncture';
  if (/massage|lomi|bodywork|rolfing|shiatsu|craniosacral/i.test(text)) return 'massage';
  if (/chiropractic|chiropractor/i.test(text)) return 'chiropractic';
  if (/yoga|meditation|retreat|breathwork/i.test(text)) return 'yoga';
  if (/naturopath|naturopathic|integrative|functional medicine/i.test(text)) return 'naturopathic';
  if (/psycholog|therapist|counselor|mental health|therapy/i.test(text)) return 'therapy';
  if (/nutrition|dietitian|herbalist/i.test(text)) return 'nutrition';
  if (/birth|doula|midwife/i.test(text)) return 'doula';
  return null;
}

async function callLLM(record) {
  const systemPrompt = "/no_think\nYou are a data quality validator for a Hawaii Big Island wellness directory. Respond ONLY with a valid JSON object, no other text.";
  
  const userPrompt = `Is this a legitimate wellness/health practitioner on the Big Island of Hawaii?
Respond ONLY with this JSON (no markdown, no explanation):
{"keep": true_or_false, "confidence": 0.0_to_1.0, "reason": "brief reason", "suggested_town": "town_or_null", "suggested_type": "type_or_null"}

Record name: ${record.name}
Address: ${record.address || ''}
Bio: ${String(typeof record.bio_excerpt === 'object' ? (record.bio_excerpt?.text || '') : (record.bio_excerpt || '')).slice(0, 200)}
Website: ${record.website || ''}`;

  try {
    const response = await fetch(CONFIG.LM_STUDIO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 200
      }),
      timeout: CONFIG.TIMEOUT_MS
    });

    if (!response.ok) throw new Error(`LLM API error: ${response.status}`);

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content ?? '';
    
    // Strip <think> blocks if present
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    // Extract JSON from markdown if needed
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error(`No JSON in response: ${content.slice(0, 100)}`);
    
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      keep: parsed.keep !== false,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      reason: parsed.reason || 'llm_validated',
      suggested_town: parsed.suggested_town || null,
      suggested_type: parsed.suggested_type || null
    };
  } catch (error) {
    console.error(`LLM error for "${record.name}":`, error.message);
    return null; // null = no LLM result, fall back to rule-based
  }
}

async function processRecords(records, dryRun) {
  const validatedRecords = [];
  const rejected = [];
  const report = {
    total: records.length,
    kept: 0,
    rejected: 0,
    avg_confidence: 0,
    rejection_reasons: {},
    towns_fixed: 0,
    types_fixed: 0
  };

  let confidenceSum = 0;
  const processLimit = dryRun ? 5 : records.length;

  for (let i = 0; i < processLimit; i++) {
    const record = records[i];
    console.log(`[${i+1}/${processLimit}] Validating: ${record.name}`);

    // Step 1: Rule-based pre-filter
    const ruleResult = ruleBasedCheck(record);
    
    let keep = ruleResult.keep;
    let confidence = keep ? 0.7 : 0.95; // high confidence when rule says discard
    let reason = ruleResult.reason || 'rule_passed';
    let suggestedTown = null;
    let suggestedType = null;

    // Step 2: Extract town from address (always run)
    suggestedTown = extractTown(record.address);
    suggestedType = guessPractitionerType(record);

    // Step 3: LLM check for records that passed rules (ambiguous cases)
    if (keep) {
      const llmResult = await callLLM(record);
      if (llmResult) {
        keep = llmResult.keep;
        confidence = llmResult.confidence;
        reason = llmResult.reason;
        if (llmResult.suggested_town) suggestedTown = llmResult.suggested_town;
        if (llmResult.suggested_type) suggestedType = llmResult.suggested_type;
      }
    }

    // Apply suggestions
    if (suggestedTown && !record.town) {
      record.town = suggestedTown;
      report.towns_fixed++;
    }
    if (suggestedType && (!record.practitioner_type || record.practitioner_type === 'unknown')) {
      record.practitioner_type = suggestedType;
      report.types_fixed++;
    }

    // Decode HTML entities in name
    record.name = record.name.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');

    record._validation_keep = keep;
    record._validation_confidence = confidence;
    record._validation_reason = reason;

    if (keep) {
      validatedRecords.push(record);
      report.kept++;
    } else {
      rejected.push({ name: record.name, reason });
      report.rejected++;
      report.rejection_reasons[reason] = (report.rejection_reasons[reason] || 0) + 1;
    }

    confidenceSum += confidence;
    if (i < processLimit - 1 && keep) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_MS));
    }
  }

  report.avg_confidence = processLimit > 0 ? confidenceSum / processLimit : 0;
  report.rejected_list = rejected;

  return { validatedRecords, report };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  try {
    console.log(`Reading input file: ${CONFIG.INPUT_FILE}`);
    const rawData = readFileSync(CONFIG.INPUT_FILE, 'utf-8');
    const records = JSON.parse(rawData);

    if (!Array.isArray(records)) throw new Error('Input file does not contain an array of records');

    console.log(`Found ${records.length} records to validate${dryRun ? ' (dry-run: first 5 only)' : ''}`);

    const { validatedRecords, report } = await processRecords(records, dryRun);

    if (!dryRun) {
      writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(validatedRecords, null, 2));
      console.log(`\nWrote ${validatedRecords.length} validated records to: ${CONFIG.OUTPUT_FILE}`);
      writeFileSync(CONFIG.REPORT_FILE, JSON.stringify(report, null, 2));
      console.log(`Wrote report to: ${CONFIG.REPORT_FILE}`);
    }

    console.log('\n=== VALIDATION SUMMARY ===');
    console.log(`Total: ${report.total}`);
    console.log(`Kept: ${report.kept}`);
    console.log(`Rejected: ${report.rejected}`);
    console.log(`Avg confidence: ${report.avg_confidence.toFixed(3)}`);
    console.log(`Towns filled: ${report.towns_fixed}`);
    console.log(`Types fixed: ${report.types_fixed}`);
    if (report.rejected_list?.length) {
      console.log('\nRejected records:');
      report.rejected_list.forEach(r => console.log(`  - ${r.name}: ${r.reason}`));
    }

    if (dryRun) {
      console.log('\n[DRY-RUN] No files written. Kept records:');
      validatedRecords.forEach(r => console.log(`  * ${r.name} | ${r.town || '?'} | ${r.practitioner_type} | conf:${r._validation_confidence}`));
    }
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main().catch(err => { console.error('Unhandled:', err); process.exit(1); });
