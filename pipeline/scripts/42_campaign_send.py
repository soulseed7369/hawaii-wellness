#!/usr/bin/env python3
"""
42_campaign_send.py — Send campaign emails via Resend.

Usage:
  python scripts/42_campaign_send.py --batch output/batch_big_island_unclaimed_20260318_1400.json
  python scripts/42_campaign_send.py --batch output/batch_*.json --dry-run
  python scripts/42_campaign_send.py --queued                  # Send all 'email_queued' contacts
  python scripts/42_campaign_send.py --test --to marcus@test.com  # Send test email
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from src.supabase_client import client
from src.resend_client import send_email, SEND_DELAY_SECONDS
from src.email_templates import render_email, SEGMENT_TO_TEMPLATE
from src.config import OUTPUT_DIR

import time


def load_batch(batch_path: str) -> list:
    """Load contacts from a batch JSON file."""
    with open(batch_path) as f:
        return json.load(f)


def fetch_queued() -> list:
    """Fetch all contacts with status='email_queued'."""
    result = client.table("campaign_outreach").select("*").eq("status", "email_queued").execute()
    return result.data or []


def send_to_contact(contact: dict, dry_run: bool = False, is_follow_up: bool = False) -> dict:
    """Send an email to a single contact. Returns result dict."""
    email = contact.get("email", "")
    name = contact.get("name", "")
    segment = contact.get("segment", "unclaimed")

    if not email or "@" not in email:
        return {"status": "skipped", "reason": "no valid email"}

    # Determine template
    template_name = SEGMENT_TO_TEMPLATE.get(segment, "phase1_claim")
    if is_follow_up:
        template_name = "follow_up"

    # Render email
    subject, html_body, text_body = render_email(contact, template_name)

    if dry_run:
        return {
            "status": "dry_run",
            "template": template_name,
            "subject": subject,
            "to": email,
            "preview": text_body[:200],
        }

    # Send via Resend
    result = send_email(
        to_email=email,
        to_name=name,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        tags={
            "campaign": "aloha_launch",
            "segment": segment,
            "island": contact.get("island", "unknown"),
            "batch_id": contact.get("batch_id", ""),
        },
    )

    if result.get("success"):
        # Update campaign_outreach
        is_email_2 = contact.get("status") in ("email_1_sent", "email_1_opened")
        update_data = {}
        if is_email_2 or is_follow_up:
            update_data["status"] = "email_2_sent"
            update_data["email_2_sent_at"] = datetime.now(timezone.utc).isoformat()
            update_data["email_2_template"] = template_name
        else:
            update_data["status"] = "email_1_sent"
            update_data["email_1_sent_at"] = datetime.now(timezone.utc).isoformat()
            update_data["email_1_template"] = template_name

        client.table("campaign_outreach").update(update_data).eq("id", contact["id"]).execute()

        # Log to campaign_emails
        client.table("campaign_emails").insert({
            "outreach_id": contact["id"],
            "resend_id": result.get("id", ""),
            "to_email": email,
            "to_name": name,
            "subject": subject,
            "template": template_name,
            "body_preview": text_body[:200],
            "status": "sent",
        }).execute()

        return {
            "status": "sent",
            "resend_id": result.get("id"),
            "template": template_name,
            "to": email,
        }
    else:
        # Mark as bad_contact if email bounced immediately
        error = result.get("error", "")
        if "bounce" in error.lower() or "invalid" in error.lower():
            client.table("campaign_outreach").update({
                "status": "bad_contact",
                "notes": f"Send failed: {error}",
            }).eq("id", contact["id"]).execute()

        return {
            "status": "failed",
            "error": error,
            "to": email,
        }


def send_test(to_email: str):
    """Send a test email to verify Resend is working."""
    test_contact = {
        "name": "Test Practitioner",
        "email": to_email,
        "city": "Kailua-Kona",
        "island": "big_island",
        "modalities": ["Massage"],
        "listing_id": "test-123",
        "segment": "unclaimed",
    }

    subject, html_body, text_body = render_email(test_contact, "phase1_claim")
    result = send_email(
        to_email=to_email,
        to_name="Test",
        subject=f"[TEST] {subject}",
        html_body=html_body,
        text_body=text_body,
    )

    if result.get("success"):
        print(f"Test email sent to {to_email} — Resend ID: {result.get('id')}")
    else:
        print(f"Test email FAILED: {result.get('error')}")


def main():
    parser = argparse.ArgumentParser(description="Send campaign emails via Resend")
    parser.add_argument("--batch", help="Path to batch JSON file")
    parser.add_argument("--queued", action="store_true", help="Send all email_queued contacts")
    parser.add_argument("--follow-up", action="store_true", help="Send as follow-up (email 2)")
    parser.add_argument("--dry-run", action="store_true", help="Preview emails without sending")
    parser.add_argument("--test", action="store_true", help="Send a test email")
    parser.add_argument("--to", help="Email address for test send")
    args = parser.parse_args()

    if args.test:
        if not args.to:
            print("Error: --to is required with --test")
            sys.exit(1)
        send_test(args.to)
        return

    # Load contacts
    if args.batch:
        contacts = load_batch(args.batch)
        print(f"Loaded {len(contacts)} contacts from {args.batch}")
    elif args.queued:
        contacts = fetch_queued()
        print(f"Found {len(contacts)} queued contacts")
    else:
        print("Error: specify --batch <file> or --queued")
        parser.print_help()
        sys.exit(1)

    if not contacts:
        print("No contacts to send to.")
        return

    # Send
    sent = 0
    failed = 0
    skipped = 0
    results = []

    for i, contact in enumerate(contacts):
        result = send_to_contact(contact, args.dry_run, args.follow_up)
        results.append(result)

        status = result["status"]
        if status == "sent":
            sent += 1
        elif status == "failed":
            failed += 1
        elif status == "skipped":
            skipped += 1

        # Progress indicator
        if (i + 1) % 5 == 0 or i == len(contacts) - 1:
            print(f"  [{i + 1}/{len(contacts)}] sent={sent} failed={failed} skipped={skipped}")

        # Rate limit
        if not args.dry_run and i < len(contacts) - 1:
            time.sleep(SEND_DELAY_SECONDS)

    # Summary
    print(f"\n=== Send Complete ===")
    print(f"  Total:   {len(contacts)}")
    print(f"  Sent:    {sent}")
    print(f"  Failed:  {failed}")
    print(f"  Skipped: {skipped}")

    if args.dry_run:
        print(f"  [DRY RUN] No emails actually sent.")
        # Show first few previews
        print(f"\n--- Email Previews ---")
        for r in results[:3]:
            if r["status"] == "dry_run":
                print(f"\n  To: {r['to']}")
                print(f"  Subject: {r['subject']}")
                print(f"  Template: {r['template']}")
                print(f"  Preview: {r['preview']}...")

    # Save results log
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    log_file = OUTPUT_DIR / f"send_log_{datetime.now().strftime('%Y%m%d_%H%M')}.json"
    with open(log_file, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nResults saved: {log_file}")


if __name__ == "__main__":
    main()
