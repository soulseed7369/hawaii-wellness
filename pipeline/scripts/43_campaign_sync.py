#!/usr/bin/env python3
"""
43_campaign_sync.py — Sync email statuses from Resend + detect DB changes (claims, upgrades).

Usage:
  python scripts/43_campaign_sync.py              # Full sync
  python scripts/43_campaign_sync.py --since 24h  # Last 24 hours only
  python scripts/43_campaign_sync.py --email-only  # Only sync Resend statuses
  python scripts/43_campaign_sync.py --db-only     # Only check for claims/upgrades
"""

import argparse
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from src.supabase_client import client
from src.resend_client import get_email_status


def parse_since(since_str: str) -> datetime:
    """Parse a relative time string like '24h', '7d', '1h'."""
    now = datetime.now(timezone.utc)
    if since_str.endswith("h"):
        hours = int(since_str[:-1])
        return now - timedelta(hours=hours)
    elif since_str.endswith("d"):
        days = int(since_str[:-1])
        return now - timedelta(days=days)
    return now - timedelta(hours=24)


def sync_resend_statuses(since: datetime = None):
    """Pull delivery/open/click events from Resend for recent emails."""
    query = client.table("campaign_emails").select("id, outreach_id, resend_id, status")
    query = query.neq("resend_id", None)
    query = query.neq("resend_id", "")

    # Only check emails that haven't reached terminal status
    query = query.in_("status", ["sent", "delivered", "opened"])

    if since:
        query = query.gte("sent_at", since.isoformat())

    result = query.execute()
    emails = result.data or []

    print(f"Checking {len(emails)} emails for status updates...")

    stats = {"delivered": 0, "opened": 0, "clicked": 0, "bounced": 0, "unchanged": 0, "errors": 0}

    for email in emails:
        resend_id = email.get("resend_id")
        if not resend_id:
            continue

        info = get_email_status(resend_id)
        if "error" in info:
            stats["errors"] += 1
            continue

        # Resend returns last_event or we check the events list
        # The SDK returns the email object with delivery info
        new_status = None
        update_data = {}

        # Check for events in the response
        # Resend email object has: id, from, to, subject, created_at, last_event
        last_event = info.get("last_event", "")

        if last_event == "bounced" and email["status"] != "bounced":
            new_status = "bounced"
            update_data["bounced_at"] = datetime.now(timezone.utc).isoformat()
            update_data["bounce_reason"] = info.get("bounce", {}).get("message", "")
            stats["bounced"] += 1
        elif last_event == "clicked" and email["status"] != "clicked":
            new_status = "clicked"
            update_data["clicked_at"] = datetime.now(timezone.utc).isoformat()
            if email["status"] != "opened":
                update_data["opened_at"] = datetime.now(timezone.utc).isoformat()
            stats["clicked"] += 1
        elif last_event == "opened" and email["status"] in ("sent", "delivered"):
            new_status = "opened"
            update_data["opened_at"] = datetime.now(timezone.utc).isoformat()
            stats["opened"] += 1
        elif last_event == "delivered" and email["status"] == "sent":
            new_status = "delivered"
            update_data["delivered_at"] = datetime.now(timezone.utc).isoformat()
            stats["delivered"] += 1
        else:
            stats["unchanged"] += 1
            continue

        if new_status:
            update_data["status"] = new_status
            client.table("campaign_emails").update(update_data).eq("id", email["id"]).execute()

            # Also update outreach row for opens/bounces
            if new_status == "opened":
                client.table("campaign_outreach").update({
                    "status": "email_1_opened",
                    "email_1_opened_at": update_data.get("opened_at"),
                }).eq("id", email["outreach_id"]).eq("status", "email_1_sent").execute()

            elif new_status == "clicked":
                client.table("campaign_outreach").update({
                    "email_1_clicked_at": update_data.get("clicked_at"),
                }).eq("id", email["outreach_id"]).execute()

            elif new_status == "bounced":
                client.table("campaign_outreach").update({
                    "status": "bad_contact",
                    "notes": f"Email bounced: {update_data.get('bounce_reason', 'unknown')}",
                }).eq("id", email["outreach_id"]).execute()

    return stats


def sync_db_changes():
    """Detect listings that have been claimed or upgraded since last sync."""
    # Get all outreach rows that are still in active outreach statuses
    result = client.table("campaign_outreach").select(
        "id, listing_id, listing_type, segment, status"
    ).in_("status", [
        "not_contacted", "email_queued", "email_1_sent", "email_1_opened",
        "email_2_sent", "replied", "call_scheduled", "called", "sms_sent"
    ]).execute()

    rows = result.data or []
    print(f"Checking {len(rows)} active outreach rows for DB changes...")

    stats = {"newly_claimed": 0, "newly_upgraded": 0, "segment_changed": 0}

    for row in rows:
        table = "practitioners" if row["listing_type"] == "practitioner" else "centers"

        try:
            listing = client.table(table).select(
                "id, owner_id, tier, website_url"
            ).eq("id", row["listing_id"]).single().execute()
        except Exception:
            continue

        if not listing.data:
            continue

        ld = listing.data
        has_owner = ld.get("owner_id") is not None
        tier = (ld.get("tier") or "free").lower()
        website = (ld.get("website_url") or "").strip()

        update_data = {}

        # Check for claim (was unclaimed, now has owner)
        if row["segment"] == "unclaimed" and has_owner:
            update_data["status"] = "claimed"
            update_data["has_owner"] = True
            update_data["claimed_at"] = datetime.now(timezone.utc).isoformat()

            # Re-segment
            if tier in ("premium", "featured"):
                update_data["segment"] = "upgraded"
                update_data["upgraded_at"] = datetime.now(timezone.utc).isoformat()
                update_data["upgraded_to"] = tier
                stats["newly_upgraded"] += 1
            elif website:
                update_data["segment"] = "claimed_has_website"
            else:
                update_data["segment"] = "claimed_no_website"

            stats["newly_claimed"] += 1

        # Check for upgrade (was free, now premium/featured)
        elif row["segment"] in ("claimed_has_website", "claimed_no_website", "bundle_prospect"):
            if tier in ("premium", "featured"):
                update_data["status"] = "upgraded"
                update_data["segment"] = "upgraded"
                update_data["upgraded_at"] = datetime.now(timezone.utc).isoformat()
                update_data["upgraded_to"] = tier
                stats["newly_upgraded"] += 1

            # Check for website changes (might need re-segment)
            elif row["segment"] == "claimed_no_website" and website:
                update_data["segment"] = "claimed_has_website"
                update_data["website_url"] = website
                stats["segment_changed"] += 1
            elif row["segment"] == "claimed_has_website" and not website:
                update_data["segment"] = "claimed_no_website"
                update_data["website_url"] = None
                stats["segment_changed"] += 1

        if update_data:
            client.table("campaign_outreach").update(update_data).eq("id", row["id"]).execute()

    return stats


def main():
    parser = argparse.ArgumentParser(description="Sync campaign statuses")
    parser.add_argument("--since", default="48h", help="Look back period (e.g., '24h', '7d')")
    parser.add_argument("--email-only", action="store_true", help="Only sync Resend email statuses")
    parser.add_argument("--db-only", action="store_true", help="Only check for claim/upgrade changes")
    args = parser.parse_args()

    since = parse_since(args.since)
    print(f"Syncing since: {since.strftime('%Y-%m-%d %H:%M UTC')}")

    if not args.db_only:
        print("\n=== Resend Email Sync ===")
        email_stats = sync_resend_statuses(since)
        print(f"  Delivered: {email_stats['delivered']}")
        print(f"  Opened:    {email_stats['opened']}")
        print(f"  Clicked:   {email_stats['clicked']}")
        print(f"  Bounced:   {email_stats['bounced']}")
        print(f"  Unchanged: {email_stats['unchanged']}")
        if email_stats['errors']:
            print(f"  Errors:    {email_stats['errors']}")

    if not args.email_only:
        print("\n=== DB Change Detection ===")
        db_stats = sync_db_changes()
        print(f"  Newly claimed:   {db_stats['newly_claimed']}")
        print(f"  Newly upgraded:  {db_stats['newly_upgraded']}")
        print(f"  Segment changed: {db_stats['segment_changed']}")

    print("\nSync complete.")


if __name__ == "__main__":
    main()
