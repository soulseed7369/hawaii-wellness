import sys
import json
import re
import hashlib
import argparse
from pathlib import Path

sys.path.insert(0, '.')

from src.image_extract import extract_image_candidates
from src.config import OUTPUT_DIR, CACHE_DIR

def process_entities(input_file, entity_type):
    updated_count = 0
    
    # Read all entities first
    entities = []
    with open(input_file, 'r') as f:
        for line in f:
            entities.append(json.loads(line.strip()))
    
    # Process each entity
    for entity in entities:
        website_url = entity.get('website_url')
        if not website_url:
            continue
            
        # Generate cache filename
        filename = hashlib.md5(website_url.encode()).hexdigest() + '.html'
        html_path = CACHE_DIR / filename
        
        # Check if cached HTML exists
        if not html_path.exists():
            entity['image_candidates'] = []
            continue
            
        # Read HTML content
        try:
            with open(html_path, 'r') as f:
                html_content = f.read()
        except Exception:
            entity['image_candidates'] = []
            continue
            
        # Extract image candidates
        candidates = extract_image_candidates(website_url, html_content)
        entity['image_candidates'] = candidates
        
        updated_count += 1
    
    # Write back to file using atomic write
    tmp_file = Path(str(input_file) + '.tmp')
    with open(tmp_file, 'w') as f:
        for entity in entities:
            f.write(json.dumps(entity) + '\n')
    
    # Atomic rename
    tmp_file.rename(input_file)
    
    return updated_count

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--practitioners', default='practitioners_upsert.jsonl')
    parser.add_argument('--centers', default='centers_upsert.jsonl')
    
    args = parser.parse_args()
    
    practitioners_count = process_entities(OUTPUT_DIR / args.practitioners, 'practitioner')
    centers_count = process_entities(OUTPUT_DIR / args.centers, 'center')
    
    print(f"Added image candidates to {practitioners_count} practitioners, {centers_count} centers")

if __name__ == '__main__':
    main()
