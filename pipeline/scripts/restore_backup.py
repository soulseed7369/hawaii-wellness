"""
Restore script: re-inserts the backup practitioners and centers WITHOUT deleting.
Run this to recover from accidental delete caused by 08_upload_and_upsert.py.
"""
import sys
import json
import os

sys.path.insert(0, '.')

from src.supabase_client import client, SUPABASE_URL
from src.config import OUTPUT_DIR

BUCKET = 'practitioner-images'

def to_practitioner(entity: dict) -> dict:
    return {
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

def to_center(entity: dict) -> dict:
    return {
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

def insert_in_batches(table_name, records, batch_size=50):
    inserted = 0
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        client.table(table_name).insert(batch).execute()
        inserted += len(batch)
        print(f"  Inserted batch {i//batch_size + 1}: {inserted}/{len(records)}")
    return inserted

if __name__ == '__main__':
    print("=== RESTORE: Inserting backup practitioners ===")
    practitioners_file = OUTPUT_DIR / 'practitioners_upsert.jsonl'
    records = []
    with open(practitioners_file) as f:
        for line in f:
            entity = json.loads(line)
            records.append(to_practitioner(entity))
    print(f"Loaded {len(records)} practitioners from backup")
    n = insert_in_batches('practitioners', records)
    print(f"✓ Restored {n} practitioners\n")

    print("=== RESTORE: Inserting backup centers ===")
    centers_file = OUTPUT_DIR / 'centers_upsert.jsonl'
    records = []
    with open(centers_file) as f:
        for line in f:
            entity = json.loads(line)
            records.append(to_center(entity))
    print(f"Loaded {len(records)} centers from backup")
    n = insert_in_batches('centers', records)
    print(f"✓ Restored {n} centers\n")

    print("Done. DB now contains all backup records + the 22 previously targeted practitioners.")
