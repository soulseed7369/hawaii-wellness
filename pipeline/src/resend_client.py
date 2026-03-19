"""
Resend API wrapper for the Aloha Health Hub campaign.
Handles sending, tracking, and error handling.
"""

import os
import time
import json
from pathlib import Path
from dotenv import load_dotenv

# Load env from project root
load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / '.env')

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
RESEND_FROM = os.environ.get('RESEND_FROM', 'aloha@hawaiiwellness.net')
RESEND_REPLY_TO = os.environ.get('RESEND_REPLY_TO', 'aloha@hawaiiwellness.net')

# Rate limit: 2 seconds between sends (cold email best practice)
SEND_DELAY_SECONDS = 2.0


def _get_resend():
    """Lazy import resend SDK."""
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        return resend
    except ImportError:
        raise ImportError("resend package not installed. Run: pip install resend")


def send_email(
    to_email: str,
    to_name: str,
    subject: str,
    html_body: str,
    text_body: str = "",
    tags: dict = None,
) -> dict:
    """
    Send a single email via Resend.
    Returns dict with 'id' (Resend message ID) on success, or 'error' on failure.
    """
    if not RESEND_API_KEY:
        return {"error": "RESEND_API_KEY not set in environment"}

    resend = _get_resend()

    params = {
        "from": f"Marcus from Hawaii Wellness <{RESEND_FROM}>",
        "to": [f"{to_name} <{to_email}>" if to_name else to_email],
        "reply_to": RESEND_REPLY_TO,
        "subject": subject,
        "html": html_body,
    }

    if text_body:
        params["text"] = text_body

    if tags:
        # Resend supports tags as list of {name, value} dicts
        params["tags"] = [{"name": k, "value": str(v)} for k, v in tags.items()]

    try:
        result = resend.Emails.send(params)
        return {"id": result.get("id", result.get("data", {}).get("id", "")), "success": True}
    except Exception as e:
        return {"error": str(e), "success": False}


def send_batch(contacts: list, render_fn, dry_run: bool = False) -> list:
    """
    Send emails to a list of contacts.
    render_fn(contact) should return (subject, html_body, text_body).
    Returns list of results with contact info and send status.
    """
    results = []

    for i, contact in enumerate(contacts):
        email = contact.get("email", "")
        name = contact.get("name", "")

        if not email or "@" not in email:
            results.append({
                "contact": contact,
                "status": "skipped",
                "reason": "no valid email",
            })
            continue

        subject, html_body, text_body = render_fn(contact)

        if dry_run:
            results.append({
                "contact": contact,
                "status": "dry_run",
                "subject": subject,
                "preview": text_body[:200],
            })
            continue

        result = send_email(
            to_email=email,
            to_name=name,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            tags={
                "campaign": "aloha_launch",
                "segment": contact.get("segment", "unknown"),
                "island": contact.get("island", "unknown"),
                "batch_id": contact.get("batch_id", ""),
            },
        )

        results.append({
            "contact": contact,
            "status": "sent" if result.get("success") else "failed",
            "resend_id": result.get("id", ""),
            "error": result.get("error", ""),
            "subject": subject,
        })

        # Rate limit between sends
        if i < len(contacts) - 1 and not dry_run:
            time.sleep(SEND_DELAY_SECONDS)

    return results


def get_email_status(resend_id: str) -> dict:
    """Get delivery status for a sent email."""
    if not RESEND_API_KEY or not resend_id:
        return {"error": "Missing API key or resend_id"}

    resend = _get_resend()

    try:
        result = resend.Emails.get(resend_id)
        return result
    except Exception as e:
        return {"error": str(e)}


def get_batch_statuses(resend_ids: list) -> list:
    """Get delivery statuses for multiple emails. Rate-limited."""
    results = []
    for rid in resend_ids:
        if rid:
            result = get_email_status(rid)
            results.append({"resend_id": rid, **result})
            time.sleep(0.5)  # Rate limit API calls
    return results
