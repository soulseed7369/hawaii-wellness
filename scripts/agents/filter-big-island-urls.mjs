import { readFileSync } from 'fs';
import { writeFile } from 'fs/promises';

const BIG_ISLAND_TOWNS = [
  'kailua-kona', 'kona', 'kealakekua', 'captain cook', 'waikoloa', 'hilo', 
  'pahoa', 'keaau', 'mountain view', 'waimea', 'honokaa', 'ocean view', 
  'naalehu', 'big island', 'hawaii island', 'hawaii big island', 'kohala', 
  'puna', 'hamakua', 'kau'
];

const BIG_ISLAND_ZIPS = [
  '96720', '96740', '96743', '96745', '96750', '96755', '96760', '96771', 
  '96772', '96773', '96774', '96776', '96778', '96781', '96785'
];

const OTHER_ISLAND_SIGNALS = [
  'oahu', 'honolulu', 'waikiki', 'maui', 'lahaina', 'kihei', 'kauai', 'lihue', 
  'molokai', 'lanai', 'oʻahu', 'māui', 'kauaʻi'
];

try {
  const inputPath = 'data/discovery/brave_discovery_results_big_island.json';
  const rawData = readFileSync(inputPath, 'utf-8');
  const records = JSON.parse(rawData);

  const kept = [];
  const discarded = [];
  const reasonCounts = {};

  for (const record of records) {
    const combined = (
      (record.url || '') + ' ' + 
      (record.title || '') + ' ' + 
      (record.snippet || '')
    ).toLowerCase();

    let reason = null;
    let keep = false;

    const hasOtherSignal = OTHER_ISLAND_SIGNALS.some(signal => 
      combined.includes(signal.toLowerCase())
    );

    if (hasOtherSignal) {
      reason = 'other_island_signal';
    } else {
      const hasTown = BIG_ISLAND_TOWNS.some(town => 
        combined.includes(town.toLowerCase())
      );

      if (hasTown) {
        keep = true;
      } else {
        const hasZip = BIG_ISLAND_ZIPS.some(zip => combined.includes(zip));

        if (hasZip) {
          keep = true;
        } else {
          const hasConfidence = record.confidence_score >= 0.5 && 
                               record.town_detected !== null && 
                               record.town_detected !== undefined;

          if (hasConfidence) {
            keep = true;
          } else {
            reason = 'no_matching_criteria';
          }
        }
      }
    }

    if (keep) {
      kept.push(record);
    } else {
      discarded.push(record);
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
  }

  await writeFile(
    'data/discovery/brave_discovery_results_big_island.json',
    JSON.stringify(kept, null, 2)
  );

  await writeFile(
    'data/discovery/brave_discovery_discarded.json',
    JSON.stringify(discarded, null, 2)
  );

  console.log(`Original count: ${records.length}`);
  console.log(`Kept: ${kept.length}`);
  console.log(`Discarded: ${discarded.length}`);
  console.log('Discard reasons breakdown:');
  for (const [reason, count] of Object.entries(reasonCounts).sort()) {
    console.log(`  ${reason}: ${count}`);
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
