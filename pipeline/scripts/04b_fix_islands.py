"""
04b_fix_islands.py
Re-detect island for all entities in raw_entities.jsonl without re-running the full crawl.
Updates the 'island' field in-place.
"""
import sys
sys.path.insert(0, '.')

import json
from pathlib import Path
from src.extract import detect_island
from src.config import OUTPUT_DIR

input_path = OUTPUT_DIR / 'raw_entities.jsonl'
tmp_path = OUTPUT_DIR / 'raw_entities_fixed.jsonl'

counts = {}
total = 0

with open(input_path) as fin, open(tmp_path, 'w') as fout:
    for line in fin:
        entity = json.loads(line)
        city = entity.get('city')
        address = entity.get('address')
        island = detect_island(city, address)
        entity['island'] = island
        counts[island] = counts.get(island, 0) + 1
        total += 1
        fout.write(json.dumps(entity) + '\n')

# Replace original
tmp_path.replace(input_path)

print(f'Total entities: {total}')
for island, count in sorted(counts.items(), key=lambda x: -x[1]):
    print(f'  {island}: {count}')
