#!/usr/bin/env python3
"""
41_campaign_segment.py — Generate send batches from campaign_outreach.

Usage:
  python scripts/41_campaign_segment.py --island big_island --segment unclaimed --limit 25
  python scripts/41_campaign_segment.py --island maui --segment claimed_no_website --limit 20
  python scripts/41_campaign_segment.py --island oahu --segment claimed_has_website --follow-up
  python scripts/41_campaign_segment.py --stats  # Show segment counts only
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from src.supabase_client import client
from src.config import OUTPUT_DIR

VALID_ISLANDS = ["big_island", "maui", "oahu", "kauai"]
VALID_SEGMENTS = ["unclaimed", "claimed_has_website", "claimed_no_website", "bundle_prospect"]


def show_stats():
    """Display current segment and status counts."""
    result = client.table("campaign_outreach").select("segment, status, island, email").execute()
    rows = result.data or []

    # Segment × Island matrix
    matrix = {}
    for row in rows:
        seg = row["segment"]
        isl = row.get("island") or "unknown"
        matrix.setdefault(seg, {})
        matrix[seg][isl] = matrix[seg].get(isl, 0) + 1

    print("=== Segment × Island ===")
    islands = sorted(set(isl for seg_data in matrix.values() for isl in seg_data.keys()))
    header = f"{'Segment':<25}" + "".join(f"{isl:>14}" for isl in islands) + f"{'Total':>10}"
    print(header)
    print("-" * len(header))
    for seg in sorted(matrix.keys()):
        vals = [matrix[seg].get(isl, 0) for isl in islands]
        total = sum(vals)
        print(f"{seg:<25}" + "".join(f"{v:>14}" for v in vals) + f"{total:>10}")

    # Status breakdown
    statuses = {}
    for row in rows:
        st = row["status"]
        statuses[st] = statuses.get(st, 0) + 1

    print("\n=== Status Breakdown ===")
    for st, count in sorted(statuses.items(), key=lambda x: -x[1]):
        print(f"  {st:<20} {count:>6}")

    # Contactable (has email)
    with_email = sum(1 for r in rows if r.get("email") and "@" in (r["email"] or ""))
    print(f"\nContactable (has email): {with_email}/{len(rows)}")


def generate_batch(island: str, segment: str, limit: int, follow_up: bool = False) -> list:
    """Query the next batch of contacts to email."""
    query = client.table("campaign_outreach").select("*")
    query = query.eq("island", island)
    query = query.eq("segment", segment)

    if follow_up:
        # Follow-up: contacts who got email 1 but haven't replied
        query = query.in_("status", ["email_1_sent", "email_1_opened"])
    else:
        # New sends: not yet contacted
        query = query.eq("status", "not_contacted")

    # Must have email
    query = query.neq("email", None)

    # Highest priority first
    query = query.order("priority", desc=True)
    query = query.order("created_at", desc=False)
    query = query.limit(limit)

    result = query.execute()
    return result.data or []


def queue_batch(contacts: list, batch_id: str):
    """Mark contacts as email_queued and assign batch_id."""
    ids = [c["id"] for c in contacts]
    if not ids:
        return

    for cid in ids:
        client.table("campaign_outreach").update({
            "status": "email_queued",
            "batch_id": batch_id,
        }).eq("id", cid).execute()


def main():
    parser = argparse.ArgumentParser(description="Generate campaign send batches")
    parser.add_argument("--island", choices=VALID_ISLANDS, help="Island to target")
    parser.add_argument("--segment", choices=VALID_SEGMENTS, help="Segment to target")
    parser.add_argument("--limit", type=int, default=25, help="Max contacts per batch (default: 25)")
    parser.add_argument("--follow-up", action="store_true", help="Generate follow-up batch instead of new sends")
    parser.add_argument("--stats", action="store_true", help="Show segment statistics only")
    parser.add_argument("--no-queue", action="store_true", help="Generate batch file without marking as queued")
    args = parser.parse_args()

    if args.stats:
        show_stats()
        return

    if not args.island or not args.segment:
        print("Error: --island and --segment are required (unless using --stats)")
        parser.print_help()
        sys.exit(1)

    kind = "follow-up" if args.follow_up else "new"
    print(f"Generating {kind} batch: {args.island} / {args.segment} / limit {args.limit}")

    contacts = generate_batch(args.island, args.segment, args.limit, args.follow_up)
    print(f"Found {len(contacts)} contacts")

    if not contacts:
        print("No contacts matching criteria.")
        return

    # Generate batch ID
    batch_id = f"{args.island}_{args.segment}_{datetime.now().strftime('%Y%m%d_%H%M')}"

    # Add batch_id to each contact for tracking
    for c in contacts:
        c["batch_id"] = batch_id

    # Save batch file
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    batch_file = OUTPUT_DIR / f"batch_{batch_id}.json"
    with open(batch_file, "w") as f:
        json.dump(contacts, f, indent=2, default=str)
    print(f"Batch saved: {batch_file}")

    # Preview
    print(f"\n--- Batch Preview ({len(contacts)} contacts) ---")
    for i, c in enumerate(contacts[:10], 1):
        mod = (c.get("modalities") or [""])[0] if c.get("modalities") else ""
        print(f"  {i}. {c['name']} — {mod}, {c.get('city', '?')} — {c.get('email', 'no email')}")
    if len(contacts) > 10:
        print(f"  ... and {len(contacts) - 10} more")

    # Queue in DB unless --no-queue
    if not args.no_queue:
        queue_batch(contacts, batch_id)
        print(f"\nMarked {len(contacts)} contacts as 'email_queued' with batch_id={batch_id}")
    else:
        print("\n[--no-queue] Contacts NOT marked as queued in DB.")

    print(f"\nNext step: python scripts/42_campaign_send.py --batch {batch_file}")


if __name__ == "__main__":
    main()
