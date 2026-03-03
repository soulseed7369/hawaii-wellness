import sys
sys.path.insert(0, '.')

import json
from pathlib import Path
from src.normalize import normalize_entity
from src.config import OUTPUT_DIR
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--input', default='raw_entities.jsonl')
parser.add_argument('--output-practitioners', default='practitioners_upsert.jsonl')
parser.add_argument('--output-centers', default='centers_upsert.jsonl')
args = parser.parse_args()

input_path = OUTPUT_DIR / args.input
practitioners_path = OUTPUT_DIR / args.output_practitioners
centers_path = OUTPUT_DIR / args.output_centers

practitioners = []
centers = []

with open(input_path, 'r') as f:
    for line in f:
        entity = json.loads(line)
        normalized = normalize_entity(entity)
        if not normalized:
            continue
        name = entity.get('name') or ''
        bio = entity.get('bio') or ''
        if any(keyword in name.lower() or keyword in bio.lower() for keyword in ['center', 'clinic', 'retreat', 'studio', 'spa', 'wellness center', 'healing center', 'chiropractic']):
                centers.append(normalized)
        else:
            practitioners.append(normalized)

with open(practitioners_path, 'w') as f:
    for entity in practitioners:
        f.write(json.dumps(entity) + '\n')

with open(centers_path, 'w') as f:
    for entity in centers:
        f.write(json.dumps(entity) + '\n')

discarded = sum(1 for _ in open(input_path, 'r')) - len(practitioners) - len(centers)
print(f'Practitioners: {len(practitioners)}, Centers: {len(centers)}, Discarded: {discarded}')