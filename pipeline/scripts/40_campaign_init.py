#!/usr/bin/env python3
"""
40_campaign_init.py — Seed campaign_outreach table from existing practitioner/center listings.

Usage:
  python scripts/40_campaign_init.py                        # All islands
  python scripts/40_campaign_init.py --island big_island    # Single island
  python scripts/40_campaign_init.py --refresh              # Re-sync segments from current DB state
  python scripts/40_campaign_init.py --dry-run              # Preview without writing to DB
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from src.supabase_client import client
from src.config import OUTPUT_DIR

VALID_ISLANDS = ["big_island", "maui", "oahu", "kauai"]


def determine_segment(row: dict) -> str:
    """Determine campaign segment based on listing state."""
    tier = (row.get("tier") or "free").lower()
    has_owner = row.get("owner_id") is not None
    website = (row.get("website_url") or "").strip()

    if tier in ("premium", "featured"):
        return "upgraded"
    if not has_owner:
        return "unclaimed"
    if website:
        return "claimed_has_website"
    return "claimed_no_website"


def determine_phase(segment: str) -> str:
    if segment == "unclaimed":
        return "phase1"
    if segment in ("claimed_has_website", "claimed_no_website", "bundle_prospect"):
        return "phase2"
    return None


def determine_priority(row: dict) -> int:
    """Higher priority = contact sooner. Email presence is most important."""
    score = 0
    if row.get("email"):
        score += 10
    if row.get("phone"):
        score += 5
    # Boost for islands with fewer listings (more personal touch)
    if row.get("island") in ("kauai",):
        score += 2
    return score


def fetch_listings(table: str, island: str = None) -> list:
    """Fetch all listings from a table, optionally filtered by island."""
    query = client.table(table).select(
        "id, name, email, phone, island, city, modalities, website_url, tier, owner_id, status"
    )
    if island:
        query = query.eq("island", island)
    # Only published listings (drafts aren't public-facing)
    query = query.eq("status", "published")
    result = query.execute()
    return result.data or []


def build_outreach_row(listing: dict, listing_type: str) -> dict:
    """Build a campaign_outreach row from a listing."""
    segment = determine_segment(listing)
    return {
        "listing_id": listing["id"],
        "listing_type": listing_type,
        "name": listing.get("name"),
        "email": listing.get("email"),
        "phone": listing.get("phone"),
        "island": listing.get("island"),
        "city": listing.get("city"),
        "modalities": listing.get("modalities") or [],
        "website_url": listing.get("website_url"),
        "tier": listing.get("tier") or "free",
        "has_owner": listing.get("owner_id") is not None,
        "segment": segment,
        "phase": determine_phase(segment),
        "priority": determine_priority(listing),
    }


def get_existing_ids() -> set:
    """Get listing IDs already in campaign_outreach."""
    result = client.table("campaign_outreach").select("listing_id").execute()
    return {row["listing_id"] for row in (result.data or [])}


def refresh_segments():
    """Re-read current listing state and update segments in campaign_outreach."""
    # Fetch all current outreach rows
    outreach = client.table("campaign_outreach").select("id, listing_id, listing_type, segment, status").execute()
    rows = outreach.data or []

    updated = 0
    for row in rows:
        # Skip rows that have already been actioned (don't regress their status)
        if row["status"] in ("claimed", "upgraded", "bundle_sold", "not_interested", "bad_contact"):
            continue

        # Fetch current listing state
        table = "practitioners" if row["listing_type"] == "practitioner" else "centers"
        listing = client.table(table).select(
            "id, owner_id, tier, website_url, email, phone"
        ).eq("id", row["listing_id"]).single().execute()

        if not listing.data:
            continue

        new_segment = determine_segment(listing.data)
        new_phase = determine_phase(new_segment)

        # Check if segment changed
        if new_segment != row["segment"]:
            update_data = {
                "segment": new_segment,
                "phase": new_phase,
                "has_owner": listing.data.get("owner_id") is not None,
                "tier": listing.data.get("tier") or "free",
                "email": listing.data.get("email"),
                "phone": listing.data.get("phone"),
            }

            # If they claimed, record it
            if new_segment != "unclaimed" and row["segment"] == "unclaimed":
                update_data["status"] = "claimed"
                update_data["claimed_at"] = "now()"

            # If they upgraded, record it
            if new_segment == "upgraded" and row["segment"] != "upgraded":
                update_data["status"] = "upgraded"
                update_data["upgraded_at"] = "now()"
                update_data["upgraded_to"] = listing.data.get("tier")

            client.table("campaign_outreach").update(update_data).eq("id", row["id"]).execute()
            updated += 1

    return updated


def main():
    parser = argparse.ArgumentParser(description="Seed campaign_outreach from listings")
    parser.add_argument("--island", choices=VALID_ISLANDS, help="Filter by island")
    parser.add_argument("--refresh", action="store_true", help="Re-sync segments from current DB state")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    args = parser.parse_args()

    if args.refresh:
        print("Refreshing segments from current DB state...")
        updated = refresh_segments()
        print(f"Updated {updated} outreach rows")
        return

    # Fetch existing IDs to avoid duplicates
    existing = get_existing_ids()
    print(f"Already in campaign_outreach: {len(existing)} listings")

    # Fetch practitioners
    practitioners = fetch_listings("practitioners", args.island)
    print(f"Practitioners fetched: {len(practitioners)}")

    # Fetch centers
    centers = fetch_listings("centers", args.island)
    print(f"Centers fetched: {len(centers)}")

    # Build outreach rows
    new_rows = []
    for p in practitioners:
        if p["id"] not in existing:
            new_rows.append(build_outreach_row(p, "practitioner"))
    for c in centers:
        if c["id"] not in existing:
            new_rows.append(build_outreach_row(c, "center"))

    print(f"\nNew rows to insert: {len(new_rows)}")

    # Segment breakdown
    segments = {}
    for row in new_rows:
        seg = row["segment"]
        segments[seg] = segments.get(seg, 0) + 1
    for seg, count in sorted(segments.items()):
        print(f"  {seg}: {count}")

    # Island breakdown
    islands = {}
    for row in new_rows:
        isl = row.get("island") or "unknown"
        islands[isl] = islands.get(isl, 0) + 1
    print("\nBy island:")
    for isl, count in sorted(islands.items()):
        print(f"  {isl}: {count}")

    # Has email (contactable)
    with_email = sum(1 for r in new_rows if r.get("email"))
    print(f"\nWith email (contactable): {with_email}/{len(new_rows)}")

    if args.dry_run:
        print("\n[DRY RUN] No data written to DB.")
        return

    if not new_rows:
        print("\nNothing new to insert.")
        return

    # Insert in batches of 100
    batch_size = 100
    inserted = 0
    for i in range(0, len(new_rows), batch_size):
        batch = new_rows[i:i + batch_size]
        try:
            client.table("campaign_outreach").insert(batch).execute()
            inserted += len(batch)
            print(f"  Inserted batch {i // batch_size + 1}: {len(batch)} rows")
        except Exception as e:
            print(f"  Error inserting batch {i // batch_size + 1}: {e}")

    print(f"\nTotal inserted: {inserted}")


if __name__ == "__main__":
    main()
