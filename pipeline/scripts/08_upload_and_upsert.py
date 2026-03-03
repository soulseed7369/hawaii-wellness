import sys
import json
import os
import hashlib
import argparse
from pathlib import Path
from typing import Optional

sys.path.insert(0, '.')

from src.supabase_client import client, SUPABASE_URL
from src.config import OUTPUT_DIR

BUCKET = 'practitioner-images'

def upload_image(local_path: str) -> "Optional[str]":
    try:
        with open(local_path, 'rb') as f:
            file_bytes = f.read()
        storage_filename = os.path.basename(local_path)
        client.storage.from_(BUCKET).upload(
            path=storage_filename,
            file=file_bytes,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
        return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{storage_filename}"
    except Exception as e:
        print(f"Warning: Failed to upload image {local_path}: {e}")
        return None

def to_practitioner(entity: dict) -> dict:
    result = {
        'name': entity.get('name'),
        'phone': entity.get('phone'),
        'email': entity.get('email'),
        'address': entity.get('address'),
        'city': entity.get('city'),
        'website_url': entity.get('website_url'),
        'bio': entity.get('bio'),
        'island': entity.get('island'),
        'status': entity.get('status'),
        'tier': entity.get('tier'),
        'owner_id': entity.get('owner_id'),
        'external_booking_url': entity.get('external_booking_url'),
        'accepts_new_clients': entity.get('accepts_new_clients'),
        'lat': entity.get('lat'),
        'lng': entity.get('lng'),
        'avatar_url': entity.get('avatar_url'),
        'region': entity.get('region'),
        'modalities': entity.get('modalities')
    }
    return result

def to_center(entity: dict) -> dict:
    result = {
        'description': entity.get('bio'),
        'external_website_url': entity.get('external_booking_url'),
        'center_type': 'wellness_center',
        'region': None,
        'name': entity.get('name'),
        'phone': entity.get('phone'),
        'email': entity.get('email'),
        'address': entity.get('address'),
        'city': entity.get('city'),
        'website_url': entity.get('website_url'),
        'island': entity.get('island'),
        'status': entity.get('status'),
        'tier': entity.get('tier'),
        'owner_id': entity.get('owner_id'),
        'lat': entity.get('lat'),
        'lng': entity.get('lng'),
        'avatar_url': entity.get('avatar_url')
    }
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--practitioners', default='practitioners_upsert.jsonl')
    parser.add_argument('--centers', default='centers_upsert.jsonl')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    try:
        client.storage.create_bucket(BUCKET, options={'public': True})
    except:
        pass

    for filename, table_name, converter in [
        (args.practitioners, 'practitioners', to_practitioner),
        (args.centers, 'centers', to_center)
    ]:
        file_path = OUTPUT_DIR / filename
        if not file_path.exists():
            continue

        records = []
        with open(file_path, 'r') as f:
            for line in f:
                entity = json.loads(line)
                if 'local_image_path' in entity and entity['local_image_path'] is not None:
                    if not args.dry_run:
                        avatar_url = upload_image(entity['local_image_path'])
                    else:
                        avatar_url = f"[dry-run: {entity['local_image_path']}]"
                    entity['avatar_url'] = avatar_url
                else:
                    entity['avatar_url'] = None
                records.append(converter(entity))

        if not records:
            print(f"No records for {table_name}, skipping.")
            continue

        if not args.dry_run:
            # Fetch names already in DB for this island+status to avoid duplicates
            existing = client.table(table_name).select('name').eq('island', 'big_island').eq('status', 'draft').execute()
            existing_names = {r['name'].lower().strip() for r in (existing.data or [])}

            new_records = [r for r in records if (r.get('name') or '').lower().strip() not in existing_names]
            update_records = [r for r in records if (r.get('name') or '').lower().strip() in existing_names]

            # Insert truly new records
            if new_records:
                client.table(table_name).insert(new_records).execute()
            # Update existing records by name
            for rec in update_records:
                client.table(table_name).update(rec).eq('name', rec['name']).eq('island', 'big_island').eq('status', 'draft').execute()

            print(f"Upserted {len(records)} {table_name} ({len(new_records)} new, {len(update_records)} updated)")
        else:
            print(f"Dry-run: {len(records)} {table_name}")

    print("Done.")