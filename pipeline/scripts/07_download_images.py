import sys
import json
import time
import argparse
from pathlib import Path

sys.path.insert(0, '.')

from src.image_process import download_and_resize
from src.config import OUTPUT_DIR

def process_entities(input_file, entity_type):
    with open(input_file, 'r') as f:
        entities = [json.loads(line) for line in f]
    
    downloaded_count = 0
    
    for entity in entities:
        if 'image_candidates' not in entity or not entity['image_candidates']:
            entity['local_image_path'] = None
            continue
            
        for candidate_url in entity['image_candidates']:
            try:
                result_path = download_and_resize(candidate_url, entity.get('website_url', ''))
                if result_path is not None:
                    entity['local_image_path'] = str(result_path)
                    downloaded_count += 1
                    break
            except Exception:
                pass
            time.sleep(0.5)
        else:
            entity['local_image_path'] = None
    
    # Write back to file atomically
    tmp_file = Path(input_file).with_suffix('.tmp')
    with open(tmp_file, 'w') as f:
        for entity in entities:
            f.write(json.dumps(entity) + '\n')
    
    tmp_file.replace(input_file)
    
    return downloaded_count

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--practitioners', default='practitioners_upsert.jsonl')
    parser.add_argument('--centers', default='centers_upsert.jsonl')
    
    args = parser.parse_args()
    
    # Process practitioners
    practitioners_path = OUTPUT_DIR / args.practitioners
    practitioners_count = process_entities(practitioners_path, 'practitioners')
    with open(practitioners_path, 'r') as f:
        total_practitioners = sum(1 for line in f)
    print(f"Downloaded {practitioners_count} / {total_practitioners} images for practitioners")

    # Process centers
    centers_path = OUTPUT_DIR / args.centers
    centers_count = process_entities(centers_path, 'centers')
    with open(centers_path, 'r') as f:
        total_centers = sum(1 for line in f)
    print(f"Downloaded {centers_count} / {total_centers} images for centers")

if __name__ == '__main__':
    main()
