"""
23_contact_verify.py
────────────────────
Audit and clean contact info (phone + email) for listings.

Three passes per record:
  1. FORMAT  — normalise phone to (808) 555-1234 display format;
               strip whitespace/junk from email
  2. VERIFY  — flag non-808 area codes; check email domain has valid MX record
  3. RE-CRAWL — for records still missing or flagged contact info, re-crawl
               the listing website using the enhanced 22 extraction logic

Outputs:
  contact_verify_report.jsonl   — full audit trail (every record touched)
  contact_fixes.jsonl           — records with confirmed good patches to apply
  contact_flagged.jsonl         — records needing human review

Usage:
    cd pipeline

    # Audit only — no DB writes (published listings)
    python scripts/23_contact_verify.py --island big_island

    # Audit draft listings
    python scripts/23_contact_verify.py --island big_island --status draft

    # Audit both published and draft
    python scripts/23_contact_verify.py --island big_island --status all

    # Audit + apply clean fixes to DB
    python scripts/23_contact_verify.py --island big_island --apply

    # All islands, drafts only
    python scripts/23_contact_verify.py --island all --status draft --apply

    # Limit re-crawl to N listings (useful for testing)
    python scripts/23_contact_verify.py --island big_island --crawl-limit 50
"""

from __future__ import annotations
import sys, json, re, time, argparse, socket
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# Optional DNS library for MX checks
try:
    import dns.resolver
    HAS_DNS = True
except ImportError:
    HAS_DNS = False
    print("Warning: dnspython not installed. MX checks will use socket fallback.")

sys.path.insert(0, '.')
from src.config import OUTPUT_DIR
from src.supabase_client import client

# ── Constants ─────────────────────────────────────────────────────────────────

HAWAII_AREA_CODE = "808"
REQUEST_TIMEOUT  = 8
CRAWL_DELAY      = 0.4

HEADERS = {
    "User-Agent": "AlohaHealthBot/1.0 (+https://hawaiiwellness.net)",
    "Accept": "text/html,application/xhtml+xml",
}

# \b at end prevents TLD runaway (e.g. '.comsendthank' from concatenated DOM text)
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}\b")
PHONE_RE = re.compile(
    r"(?:\+?1[\s.\-]?)?"
    r"(?:\(?\d{3}\)?[\s.\-]?)"
    r"\d{3}[\s.\-]?\d{4}"
)

CONTACT_PAGES = ["/contact", "/contact-us", "/about", "/about-us",
                 "/reach-us", "/connect", "/work-with-me"]

JUNK_EMAIL_DOMAINS = {
    "example.com", "test.com", "sentry.io", "wix.com", "squarespace.com",
    "godaddy.com", "wordpress.com", "weebly.com", "strikingly.com",
    "mailinator.com", "trashmail.com",
}

# Matches placeholder/system local-parts AND generic shared-inbox addresses
JUNK_EMAIL_PATTERNS = re.compile(
    r"(^filler$|noreply|no-reply|donotreply|do-not-reply|support@wix|"
    r"privacy@|legal@|dmca@|abuse@|webmaster@|postmaster@|^placeholder$|^dummy$)",
    re.IGNORECASE
)

def _domain_is_junk(domain: str) -> bool:
    """Exact OR domain-root match — catches 'godaddy.commy', 'godaddy.comsend' etc."""
    if domain in JUNK_EMAIL_DOMAINS:
        return True
    return any(domain.startswith(junk) for junk in JUNK_EMAIL_DOMAINS)

# ── Phone helpers ─────────────────────────────────────────────────────────────

def extract_digits(raw: str) -> str:
    """Strip everything except digits, remove leading 1 country code."""
    digits = re.sub(r"\D", "", re.split(r"(?i)\s*(x|ext|#)\s*\d", raw)[0])
    if digits.startswith("1") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) > 10:
        digits = digits[-10:]
    return digits


def format_phone(raw: str | None) -> tuple[str, list[str]]:
    """
    Return (formatted_phone, flags).
    formatted_phone: "(808) 555-1234" or "" if invalid.
    flags: list of issue strings.
    """
    if not raw:
        return "", ["missing_phone"]

    digits = extract_digits(raw)
    flags = []

    if len(digits) != 10:
        return "", ["invalid_phone_digits"]

    area = digits[:3]
    if area != HAWAII_AREA_CODE:
        flags.append(f"non_808_area_code({area})")

    formatted = f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    return formatted, flags


# ── Email helpers ─────────────────────────────────────────────────────────────

def clean_email(raw: str | None) -> tuple[str, list[str]]:
    """Return (cleaned_email, flags).

    If the raw value is a messy concatenation (e.g. '808-365-6818liz@domain.com sendthank'),
    we try to rescue the valid email portion rather than rejecting the whole string.
    """
    if not raw:
        return "", ["missing_email"]

    email = raw.strip().lower()
    flags = []

    if not EMAIL_RE.fullmatch(email):
        # Try to rescue: search for a valid email embedded in the messy string
        match = EMAIL_RE.search(email)
        if match:
            email = match.group(0)
            flags.append("rescued_from_concatenation")
        else:
            return "", ["invalid_email_format"]

    local, domain = email.split("@", 1)

    if _domain_is_junk(domain):
        return "", [f"junk_email_domain({domain})"]

    if JUNK_EMAIL_PATTERNS.search(local):
        return "", ["junk_email_local_part"]

    if JUNK_EMAIL_PATTERNS.search(email):
        flags.append("generic_email_address")

    return email, flags


_mx_cache: dict[str, bool] = {}

def has_mx_record(domain: str) -> bool:
    """True if domain has at least one MX record (domain can receive email)."""
    if domain in _mx_cache:
        return _mx_cache[domain]

    result = False
    if HAS_DNS:
        try:
            answers = dns.resolver.resolve(domain, "MX", lifetime=4)
            result = len(answers) > 0
        except Exception:
            # Fallback: check if domain resolves at all
            try:
                socket.gethostbyname(domain)
                result = True
            except Exception:
                result = False
    else:
        try:
            socket.gethostbyname(domain)
            result = True
        except Exception:
            result = False

    _mx_cache[domain] = result
    return result


def verify_email(email: str) -> list[str]:
    """Return list of flags for a clean email address."""
    if not email:
        return []
    domain = email.split("@")[1]
    if not has_mx_record(domain):
        return [f"no_mx_record({domain})"]
    return []


# ── Web re-crawl helpers ──────────────────────────────────────────────────────

def fetch_html(url: str) -> BeautifulSoup | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT,
                         allow_redirects=True)
        return BeautifulSoup(r.text, "html.parser") if r.status_code == 200 else None
    except Exception:
        return None


def extract_emails_from_soup(soup: BeautifulSoup) -> list[str]:
    emails = set()
    for a in soup.find_all("a", href=True):
        if a["href"].startswith("mailto:"):
            addr = a["href"][7:].split("?")[0].strip().lower()
            if addr:
                emails.add(addr)
    for addr in EMAIL_RE.findall(soup.get_text(separator=" ")):
        emails.add(addr.lower())
    return [e for e in emails
            if "@" in e
            and not e.endswith((".png", ".jpg", ".gif", ".svg"))
            and "@2x" not in e
            and not _domain_is_junk(e.split("@")[1])
            and not JUNK_EMAIL_PATTERNS.search(e.split("@")[0])]


def extract_phone_from_soup(soup: BeautifulSoup) -> str:
    for a in soup.find_all("a", href=True):
        if a["href"].startswith("tel:"):
            d = extract_digits(a["href"][4:])
            if len(d) == 10:
                return d
    for m in PHONE_RE.findall(soup.get_text(" ")):
        d = extract_digits(m)
        if len(d) == 10:
            return d
    return ""


def recrawl_for_contact(website_url: str) -> dict:
    """Crawl homepage + contact pages, return best email + phone found."""
    if not website_url:
        return {}

    url = website_url if website_url.startswith("http") else "https://" + website_url
    found_email = ""
    found_phone = ""

    pages_to_try = [url] + [urljoin(url, p) for p in CONTACT_PAGES]

    for page_url in pages_to_try:
        if found_email and found_phone:
            break
        soup = fetch_html(page_url)
        if not soup:
            continue
        if not found_email:
            emails = extract_emails_from_soup(soup)
            # Prefer MX-verified email
            for e in emails:
                cleaned, _ = clean_email(e)
                if cleaned and has_mx_record(cleaned.split("@")[1]):
                    found_email = cleaned
                    break
            if not found_email and emails:
                cleaned, _ = clean_email(emails[0])
                if cleaned:
                    found_email = cleaned
        if not found_phone:
            raw_phone = extract_phone_from_soup(soup)
            if raw_phone:
                formatted, _ = format_phone(raw_phone)
                if formatted:
                    found_phone = formatted
        time.sleep(0.3)

    result = {}
    if found_email:
        result["email"] = found_email
    if found_phone:
        result["phone"] = found_phone
    return result


# ── DB helpers ────────────────────────────────────────────────────────────────

def fetch_listings(island: str, status_filter: str = "published") -> list[dict]:
    """
    status_filter: 'published' | 'draft' | 'all'
    """
    records = []
    for table in ("practitioners", "centers"):
        page_size, offset = 1000, 0
        while True:
            q = client.table(table).select(
                "id, name, phone, email, website_url, island, status"
            ).eq("island", island)
            if status_filter != "all":
                q = q.eq("status", status_filter)
            resp = q.range(offset, offset + page_size - 1).execute()
            batch = resp.data or []
            for r in batch:
                r["_table"] = table
            records.extend(batch)
            if len(batch) < page_size:
                break
            offset += page_size
    return records


# ── Main audit logic ──────────────────────────────────────────────────────────

def audit_record(rec: dict, crawl_limit_reached: bool) -> dict:
    """
    Full audit for one record.
    Returns an audit result dict with _action, _patch, _flags, _crawled.
    """
    result = {
        "_db_id":    rec["id"],
        "_db_table": rec["_table"],
        "_name":     rec.get("name", ""),
        "_island":   rec.get("island", ""),
        "_original_phone": rec.get("phone"),
        "_original_email": rec.get("email"),
        "_flags":    [],
        "_patch":    {},
        "_crawled":  False,
        "_action":   "ok",
    }

    # ── 1. FORMAT ──────────────────────────────────────────────────────────────
    phone_formatted, phone_flags = format_phone(rec.get("phone"))
    email_cleaned,   email_flags = clean_email(rec.get("email"))

    result["_flags"].extend(phone_flags)
    result["_flags"].extend(email_flags)

    # If phone formatting changed the value, queue the fix
    if phone_formatted and phone_formatted != rec.get("phone"):
        result["_patch"]["phone"] = phone_formatted

    if email_cleaned and email_cleaned != rec.get("email"):
        result["_patch"]["email"] = email_cleaned

    # ── 2. VERIFY (DNS MX check) ───────────────────────────────────────────────
    if email_cleaned:
        mx_flags = verify_email(email_cleaned)
        result["_flags"].extend(mx_flags)
        if mx_flags:
            # Email domain doesn't accept mail — clear it so re-crawl can find better
            result["_patch"]["email"] = None
            email_cleaned = ""

    # ── 3. RE-CRAWL if still missing or flagged ────────────────────────────────
    needs_crawl = (
        not phone_formatted
        or not email_cleaned
        or any(f.startswith("non_808") for f in result["_flags"])
    )

    if needs_crawl and rec.get("website_url") and not crawl_limit_reached:
        crawl_result = recrawl_for_contact(rec["website_url"])
        result["_crawled"] = True

        if crawl_result.get("phone") and not phone_formatted:
            new_fmt, new_flags = format_phone(crawl_result["phone"])
            if new_fmt:
                result["_patch"]["phone"] = new_fmt
                result["_flags"] = [f for f in result["_flags"]
                                    if "missing_phone" not in f]
                if new_flags:
                    result["_flags"].extend(new_flags)

        if crawl_result.get("email") and not email_cleaned:
            new_clean, new_flags = clean_email(crawl_result["email"])
            if new_clean:
                mx_ok = has_mx_record(new_clean.split("@")[1])
                if mx_ok:
                    result["_patch"]["email"] = new_clean
                    result["_flags"] = [f for f in result["_flags"]
                                        if "missing_email" not in f]
                else:
                    result["_flags"].append(f"crawled_email_no_mx({new_clean})")

    # ── Determine action ───────────────────────────────────────────────────────
    has_bad_flags = any(
        f for f in result["_flags"]
        if not f.startswith("generic_email")
    )
    if result["_patch"]:
        result["_action"] = "fix"
    elif has_bad_flags:
        result["_action"] = "flag"
    else:
        result["_action"] = "ok"

    return result


ALL_ISLANDS = ["big_island", "maui", "oahu", "kauai"]

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--island",      default="big_island",
                        choices=ALL_ISLANDS + ["all"])
    parser.add_argument("--status",      default="published",
                        choices=["published", "draft", "all"],
                        help="Which listings to audit (default: published)")
    parser.add_argument("--apply",       action="store_true",
                        help="Write clean fixes to DB")
    parser.add_argument("--crawl-limit", type=int, default=0,
                        help="Max listings to re-crawl (0 = unlimited)")
    args = parser.parse_args()

    islands = ALL_ISLANDS if args.island == "all" else [args.island]

    report, fixes, flagged = [], [], []
    total_crawled = 0

    for island in islands:
        print(f"\n[23] Fetching {args.status} listings for {island}…")
        listings = fetch_listings(island, args.status)
        print(f"[23] {len(listings)} listings\n")

        for i, rec in enumerate(listings, 1):
            crawl_limit_reached = (
                args.crawl_limit > 0 and total_crawled >= args.crawl_limit
            )
            print(f"  [{i}/{len(listings)}] {rec.get('name','?')[:55]:<55}", end=" ", flush=True)

            result = audit_record(rec, crawl_limit_reached)

            if result["_crawled"]:
                total_crawled += 1

            status = result["_action"].upper()
            flag_str = ", ".join(result["_flags"][:3]) if result["_flags"] else "clean"
            patch_str = list(result["_patch"].keys()) if result["_patch"] else ""
            print(f"{status:<5}  {flag_str[:50]}  {patch_str}")

            report.append(result)
            if result["_action"] == "fix":
                fixes.append(result)
            elif result["_action"] == "flag":
                flagged.append(result)

            time.sleep(0.05)

    # ── Write outputs ─────────────────────────────────────────────────────────
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for path, records in [
        (OUTPUT_DIR / "contact_verify_report.jsonl", report),
        (OUTPUT_DIR / "contact_fixes.jsonl",         fixes),
        (OUTPUT_DIR / "contact_flagged.jsonl",        flagged),
    ]:
        with open(path, "w") as f:
            for r in records:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")

    # ── Apply fixes ───────────────────────────────────────────────────────────
    applied = 0
    if args.apply and fixes:
        print(f"\n[23] Applying {len(fixes)} fixes to DB…")
        for r in fixes:
            patch = {k: v for k, v in r["_patch"].items() if v is not None}
            null_patch = {k: None for k, v in r["_patch"].items() if v is None}
            try:
                if patch:
                    client.table(r["_db_table"]).update(patch).eq("id", r["_db_id"]).execute()
                if null_patch:
                    client.table(r["_db_table"]).update(null_patch).eq("id", r["_db_id"]).execute()
                applied += 1
            except Exception as e:
                print(f"  DB error for {r['_name']}: {e}")

    # ── Summary ───────────────────────────────────────────────────────────────
    ok_count    = sum(1 for r in report if r["_action"] == "ok")
    fix_count   = len(fixes)
    flag_count  = len(flagged)
    crawl_count = sum(1 for r in report if r["_crawled"])

    print(f"\n── Summary {'(DRY RUN) ' if not args.apply else ''}─────────────────────────────────")
    print(f"  {ok_count:>4}  clean (no changes needed)")
    print(f"  {fix_count:>4}  fixed  → contact_fixes.jsonl")
    print(f"  {flag_count:>4}  flagged for review → contact_flagged.jsonl")
    print(f"  {crawl_count:>4}  re-crawled for missing contact info")
    if args.apply:
        print(f"  {applied:>4}  records updated in DB")
    else:
        print(f"\n  Run with --apply to write fixes to DB.")

    # Flag breakdown
    from collections import Counter
    all_flags = [f for r in report for f in r["_flags"]]
    if all_flags:
        print(f"\n── Flag breakdown ───────────────────────────────────")
        for flag, count in Counter(all_flags).most_common(15):
            print(f"  {count:>4}×  {flag}")
