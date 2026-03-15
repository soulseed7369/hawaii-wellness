"""
13_gm_upsert.py
───────────────
Write Google Maps results to Supabase:

  1. gm_new.jsonl          → insert as draft practitioners / centers
  2. gm_enrichments.jsonl  → update only the blank fields in existing records

Never overwrites existing data.  Always inserts new records as 'draft'
so you review and publish them from the Admin panel.

Usage:
    cd pipeline
    python scripts/13_gm_upsert.py [--dry-run]
"""

import sys, json, argparse
from pathlib import Path

sys.path.insert(0, '.')
from src.config          import OUTPUT_DIR
from src.supabase_client import client

BATCH_SIZE = 50


def _column_exists(table: str, column: str) -> bool:
    """Check whether a column exists in the DB, gracefully handling pre-migration state."""
    try:
        # A SELECT of a non-existent column raises a PostgREST error (400)
        resp = client.table(table).select(column).limit(1).execute()
        return True
    except Exception:
        return False


# Probe once at import time — both tables share the same migration, so checking
# one is sufficient.  Falls back to False if DB is unreachable.
try:
    HAS_GOOGLE_PLACE_ID: bool = _column_exists("practitioners", "google_place_id")
except Exception:
    HAS_GOOGLE_PLACE_ID = False

if not HAS_GOOGLE_PLACE_ID:
    print(
        "Warning: google_place_id column not found in DB. "
        "Run migration 20260314000004_google_place_id.sql first to enable Place ID tracking. "
        "Proceeding without it."
    )

# Fields excluded from the DB insert (internal dedup/classification fields)
INTERNAL_FIELDS = {
    "_listing_type", "_place_id", "_google_types",
    "_rating", "_rating_count", "_source_query",
    "image_candidates", "local_image_path", "confidence",
}


def to_practitioner(rec: dict) -> dict:
    row = {
        "name":                 rec.get("name"),
        "phone":                rec.get("phone"),
        "email":                rec.get("email"),
        "address":              rec.get("address"),
        "city":                 rec.get("city"),
        "website_url":          rec.get("website_url"),
        "bio":                  rec.get("bio"),
        "modalities":           rec.get("modalities", []),
        "island":               rec.get("island", "big_island"),
        "status":               "draft",
        "tier":                 "free",
        "owner_id":             None,
        "external_booking_url": rec.get("external_booking_url"),
        "accepts_new_clients":  rec.get("accepts_new_clients", True),
        "lat":                  rec.get("lat"),
        "lng":                  rec.get("lng"),
        "avatar_url":           None,
    }
    if HAS_GOOGLE_PLACE_ID:
        row["google_place_id"] = rec.get("_place_id")
    return row


def to_center(rec: dict) -> dict:
    row = {
        "name":                 rec.get("name"),
        "phone":                rec.get("phone"),
        "email":                rec.get("email"),
        "address":              rec.get("address"),
        "city":                 rec.get("city"),
        "website_url":          rec.get("website_url"),
        "description":          rec.get("bio"),
        "modalities":           rec.get("modalities", []),
        "island":               rec.get("island", "big_island"),
        "status":               "draft",
        "tier":                 "free",
        "owner_id":             None,
        "center_type":          "wellness_center",
        "lat":                  rec.get("lat"),
        "lng":                  rec.get("lng"),
        "avatar_url":           None,
    }
    if HAS_GOOGLE_PLACE_ID:
        row["google_place_id"] = rec.get("_place_id")
    return row


def insert_new(records: list[dict], dry_run: bool) -> tuple[int, int]:
    practitioners = [r for r in records if r.get("_listing_type") != "center"]
    centers       = [r for r in records if r.get("_listing_type") == "center"]

    inserted_p = inserted_c = 0

    for table, recs, converter, label in [
        ("practitioners", practitioners, to_practitioner, "practitioners"),
        ("centers",       centers,       to_center,       "centers"),
    ]:
        if not recs:
            continue

        # Fetch existing names to avoid re-inserting
        if not dry_run:
            existing_resp = client.table(table).select("name").eq(
                "island", recs[0].get("island", "big_island")
            ).execute()
            existing_names = {
                r["name"].lower().strip() for r in (existing_resp.data or [])
            }
        else:
            existing_names = set()

        rows = []
        dupes = 0
        for rec in recs:
            if rec.get("name", "").lower().strip() in existing_names:
                dupes += 1
                continue
            rows.append(converter(rec))
            existing_names.add(rec.get("name", "").lower().strip())

        if dupes:
            print(f"  Skipped {dupes} {label} already in DB (name match)")

        if not rows:
            continue

        if dry_run:
            print(f"  [dry-run] Would insert {len(rows)} {label}")
        else:
            for i in range(0, len(rows), BATCH_SIZE):
                batch = rows[i:i + BATCH_SIZE]
                client.table(table).insert(batch).execute()
            print(f"  Inserted {len(rows)} {label}")

        if table == "practitioners":
            inserted_p += len(rows)
        else:
            inserted_c += len(rows)

    return inserted_p, inserted_c


def apply_enrichments(enrichments: list[dict], dry_run: bool) -> int:
    updated = 0
    # email included — it's the most valuable field for direct marketing
    ENRICH_FIELDS = {"phone", "email", "website_url", "address", "city", "lat", "lng"}

    for enrich in enrichments:
        table  = enrich.get("_db_table")
        db_id  = enrich.get("_db_id")
        if not table or not db_id:
            continue

        patch = {k: v for k, v in enrich.items()
                 if k in ENRICH_FIELDS and v is not None}
        if not patch:
            continue

        if dry_run:
            print(f"  [dry-run] Would update {table}/{db_id}: {list(patch.keys())}")
        else:
            client.table(table).update(patch).eq("id", db_id).execute()

        updated += 1

    return updated


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview changes without writing to DB")
    parser.add_argument("--enrichments-only", action="store_true",
                        help="Skip new inserts; only apply enrichments to existing records")
    args = parser.parse_args()

    new_path    = OUTPUT_DIR / "gm_new.jsonl"
    enrich_path = OUTPUT_DIR / "gm_enrichments.jsonl"

    # ── Insert new records ─────────────────────────────────────────────────────
    new_records = []
    if not args.enrichments_only:
        if new_path.exists():
            with open(new_path) as f:
                for line in f:
                    new_records.append(json.loads(line))
        else:
            print(f"Warning: {new_path} not found — skipping new inserts")

    print(f"\n── Inserting {len(new_records)} new records ──────────────────────")
    ins_p, ins_c = insert_new(new_records, args.dry_run)

    # ── Apply enrichments ──────────────────────────────────────────────────────
    enrichments = []
    if enrich_path.exists():
        with open(enrich_path) as f:
            for line in f:
                enrichments.append(json.loads(line))
    else:
        print(f"Warning: {enrich_path} not found — skipping enrichments")

    print(f"\n── Applying {len(enrichments)} enrichments ───────────────────────")
    updated = apply_enrichments(enrichments, args.dry_run)

    # ── Summary ────────────────────────────────────────────────────────────────
    mode = "[DRY RUN] " if args.dry_run else ""
    print(f"\n{mode}── Summary ────────────────────────────────────────")
    print(f"  {ins_p:>4}  new practitioners inserted (draft)")
    print(f"  {ins_c:>4}  new centers inserted (draft)")
    print(f"  {updated:>4}  existing records enriched with missing fields")
    print(f"\nReview new drafts in the Admin panel → publish when ready.")
