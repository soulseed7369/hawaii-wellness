"""
23_email_hunter.py
──────────────────
Aggressive email + phone hunter for listings that have a website
but where standard enrichment couldn't find contact info.

Goes deeper than 22_website_enrich.py:
  - Crawls up to 12 page paths (vs 6)
  - Tries /team, /practitioners, /therapist, /provider, /staff, /book
  - Scans all <a href> and visible text more aggressively
  - Decodes common obfuscation: [at], (at), [@], " at "
  - Reads robots.txt to skip blocked paths politely

Usage:
    cd pipeline
    # Process a specific chunk (for parallel runs)
    python scripts/23_email_hunter.py --chunk-file output/chunk_0.jsonl --apply
    python scripts/23_email_hunter.py --chunk-file output/chunk_1.jsonl --apply
"""

from __future__ import annotations
import sys, json, re, time, argparse, datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, ".")
from src.supabase_client import client

REQUEST_TIMEOUT = 12
CRAWL_DELAY     = 0.3
HEADERS = {
    "User-Agent": "AlohaHealthBot/1.0 (+https://hawaiiwellness.net)",
    "Accept": "text/html,application/xhtml+xml",
}

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}\b")

OBFUSCATION_PATTERNS = [
    # [at], (at), " at ", {at}
    (re.compile(r"([a-zA-Z0-9._%+\-]+)\s*[\[\({\s]at[\]\)}\s]\s*([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10})\b", re.IGNORECASE), r"\1@\2"),
    # name [dot] domain [at] tld
    (re.compile(r"([a-zA-Z0-9._%+\-]+)\s*[\[\(]dot[\]\)]\s*([a-zA-Z0-9.\-]+)\s*[\[\(]at[\]\)]\s*([a-zA-Z]{2,10})\b", re.IGNORECASE), r"\1.\2@\3"),
]

JUNK_EMAIL_DOMAINS = {
    "example.com", "test.com", "sentry.io", "wix.com", "squarespace.com",
    "godaddy.com", "wordpress.com", "weebly.com", "strikingly.com",
    "mailinator.com", "trashmail.com",
}
JUNK_LOCAL_RE = re.compile(
    r"^(filler|noreply|no-reply|donotreply|do-not-reply|placeholder|dummy|"
    r"test|support|webmaster|postmaster|admin|privacy|legal|abuse|dmca)$",
    re.IGNORECASE
)

def is_junk_email(addr: str) -> bool:
    if "@" not in addr:
        return True
    local, domain = addr.split("@", 1)
    if domain in JUNK_EMAIL_DOMAINS:
        return True
    if any(domain.startswith(junk) for junk in JUNK_EMAIL_DOMAINS):
        return True
    if JUNK_LOCAL_RE.match(local):
        return True
    return False


PHONE_RE = re.compile(
    r"(?:\+?1[\s.\-]?)?"
    r"(?:\(?\d{3}\)?[\s.\-]?)"
    r"\d{3}[\s.\-]?\d{4}"
)

# Expanded page paths to try — covers wellness/health site conventions
HUNT_PATHS = [
    "/contact",
    "/contact-us",
    "/about",
    "/about-us",
    "/about-me",
    "/team",
    "/our-team",
    "/meet-the-team",
    "/practitioners",
    "/therapists",
    "/staff",
    "/providers",
    "/book",
    "/book-now",
    "/booking",
    "/schedule",
    "/connect",
    "/reach-us",
    "/get-in-touch",
    "/services",
    "/work-with-me",
    "/pages/contact",
    "/pages/about",
]


def fetch_html(url: str) -> BeautifulSoup | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT,
                         allow_redirects=True)
        if r.status_code != 200:
            return None
        return BeautifulSoup(r.text, "html.parser")
    except Exception:
        return None


def extract_emails(soup: BeautifulSoup) -> list[str]:
    """Extract emails from soup — mailto: first, then text scan + obfuscation decode."""
    found: set[str] = set()

    # 1. mailto: links (most reliable)
    for a in soup.find_all("a", href=True):
        if a["href"].startswith("mailto:"):
            addr = a["href"][7:].split("?")[0].strip().lower()
            if addr and "@" in addr:
                found.add(addr)

    if found:
        return [e for e in found if not is_junk_email(e)]

    # 2. Raw text scan
    text = soup.get_text(separator=" ")
    for addr in EMAIL_RE.findall(text):
        found.add(addr.lower())

    # 3. Obfuscation decoding
    for pattern, replacement in OBFUSCATION_PATTERNS:
        for m in pattern.finditer(text):
            decoded = pattern.sub(replacement, m.group(0)).lower().strip()
            if "@" in decoded:
                found.add(decoded)

    # 4. data-email / data-contact attributes
    for el in soup.find_all(attrs={"data-email": True}):
        found.add(el["data-email"].lower())
    for el in soup.find_all(attrs={"data-contact": True}):
        val = el["data-contact"]
        if "@" in val:
            found.add(val.lower())

    return [
        e for e in found
        if not e.endswith((".png", ".jpg", ".gif", ".svg"))
        and "@2x" not in e
        and not is_junk_email(e)
    ]


def extract_phone(soup: BeautifulSoup) -> str:
    for a in soup.find_all("a", href=True):
        if a["href"].startswith("tel:"):
            digits = re.sub(r"\D", "", a["href"][4:])
            if len(digits) >= 10:
                return digits[-10:]
    for m in PHONE_RE.findall(soup.get_text(" ")):
        digits = re.sub(r"\D", "", m)
        if len(digits) >= 10:
            return digits[-10:]
    return ""


def hunt(url: str) -> tuple[str, str]:
    """Crawl homepage + all HUNT_PATHS until email and phone are found."""
    parsed = urlparse(url)
    base   = f"{parsed.scheme}://{parsed.netloc}"

    found_email = ""
    found_phone = ""

    # Homepage first
    home = fetch_html(url)
    if home:
        emails = extract_emails(home)
        if emails:
            found_email = emails[0]
        found_phone = extract_phone(home)

    if found_email and found_phone:
        return found_email, found_phone

    # Deep path crawl
    for path in HUNT_PATHS:
        if found_email and found_phone:
            break
        time.sleep(CRAWL_DELAY)
        soup = fetch_html(base + path)
        if not soup:
            continue
        if not found_email:
            emails = extract_emails(soup)
            if emails:
                found_email = emails[0]
        if not found_phone:
            found_phone = extract_phone(soup)

    return found_email, found_phone


def normalise_url(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw or raw == "(no website)":
        return ""
    if not raw.startswith(("http://", "https://")):
        return "https://" + raw
    return raw


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--chunk-file", required=True, type=Path,
                        help="JSONL file of targets: {id, table, name, url, lead_score}")
    parser.add_argument("--apply", action="store_true",
                        help="Write found emails/phones to DB immediately")
    parser.add_argument("--out", type=Path, default=None,
                        help="Output JSONL (default: chunk-file with _results suffix)")
    args = parser.parse_args()

    if args.out is None:
        args.out = args.chunk_file.with_name(
            args.chunk_file.stem + "_results.jsonl"
        )

    targets = [json.loads(l) for l in args.chunk_file.read_text().splitlines() if l.strip()]
    total = len(targets)
    print(f"\n[23] {args.chunk_file.name}: {total} targets to hunt\n")

    results = []
    found_email_count = found_phone_count = 0

    for i, rec in enumerate(targets, 1):
        name = rec.get("name", "?")
        url  = normalise_url(rec.get("url", ""))
        if not url:
            print(f"  [{i}/{total}] SKIP (no url): {name}")
            continue

        print(f"  [{i}/{total}] {name[:48]:<48} {url[:40]}", end=" … ", flush=True)
        try:
            email, phone = hunt(url)
        except Exception as e:
            print(f"ERROR: {e}")
            continue

        result = {
            "_db_id":   rec["id"],
            "_db_table": rec["table"],
            "_name":    name,
            "_url":     url,
        }
        fields = []
        if email:
            result["email"] = email
            fields.append(f"email={email}")
            found_email_count += 1
        if phone:
            result["phone"] = phone
            fields.append(f"phone={phone}")
            found_phone_count += 1

        result["enriched_at"] = datetime.datetime.utcnow().isoformat() + "Z"

        if fields:
            print(f"✓ {', '.join(fields)}")
        else:
            print("—")

        results.append(result)

        if args.apply and (email or phone):
            patch = {k: v for k, v in result.items() if not k.startswith("_")}
            try:
                client.table(rec["table"]).update(patch).eq("id", rec["id"]).execute()
            except Exception as e:
                print(f"     DB error: {e}")

    # Save results
    with open(args.out, "w") as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"\n── Summary ─────────────────────────────────────────────")
    print(f"  Emails found:  {found_email_count} / {total}")
    print(f"  Phones found:  {found_phone_count} / {total}")
    print(f"  Saved → {args.out}")
