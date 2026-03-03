import { readFileSync, writeFileSync } from 'fs';

const inputPath = 'data/discovery/brave_discovery_results_big_island.json';
const outputPath = inputPath;
const droppedPath = 'data/discovery/brave_discovery_dropped_final.json';

const data = JSON.parse(readFileSync(inputPath, 'utf-8'));

const kept = [];
const dropped = [];

for (const entry of data) {
  const townDetected = entry.town_detected;
  const confidenceScore = entry.confidence_score;
  const domain = (entry.domain || '').toLowerCase();

  let keep = false;

  // Condition 1: town_detected is not null AND confidence_score >= 0.5
  if (townDetected !== null && confidenceScore >= 0.5) {
    keep = true;
  } 
  // Condition 2: town_detected is null BUT domain contains specific keywords
  else if (townDetected === null) {
    const keywords = ['big-island', 'bigisland', 'hawaii-island', 'hawaiiisland'];
    if (keywords.some(k => domain.includes(k))) {
      keep = true;
    }
  }

  if (keep) {
    kept.push(entry);
  } else {
    dropped.push(entry);
  }
}

writeFileSync(outputPath, JSON.stringify(kept, null, 2));
writeFileSync(droppedPath, JSON.stringify(dropped, null, 2));

console.log(`Original count: ${data.length}`);
console.log(`Kept: ${kept.length}`);
console.log(`Dropped: ${dropped.length}`);

const townCounts = new Map();
for (const entry of kept) {
  const town = entry.town_detected;
  if (town !== null) {
    townCounts.set(town, (townCounts.get(town) || 0) + 1);
  }
}

console.log('\nBreakdown of kept records by town_detected:');
for (const [town, count] of [...townCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${town}: ${count}`);
}

if (townCounts.size === 0) {
  console.log('  (No town-specific matches, all kept are domain-based)');
}
