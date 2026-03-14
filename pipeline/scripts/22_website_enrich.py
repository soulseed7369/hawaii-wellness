"""
22_website_enrich.py
────────────────────
Crawl existing listing websites to fill in missing fields:
  - email
  - phone
  - bio / description  (up to 100 words, from og:description or page text)
  - photo              (og:image URL stored in avatar_url)
  - modalities         (inferred from page text if array is empty)
  - external_booking_url  (Calendly, Acuity, Mindbody, Jane App, etc.)  ← NEW
  - social_links       (Instagram, Facebook, LinkedIn, X)                ← NEW

JSON-LD (Schema.org) is extracted first when available — it's the most
accurate source and avoids regex on messy HTML.

Only touches fields that are currently blank — never overwrites existing data.
Saves results to pipeline/output/website_enrichments.jsonl and optionally
applies them straight to the DB with --apply.

Usage:
    cd pipeline
    python scripts/22_website_enrich.py [--island big_island] [--limit 50]
    python scripts/22_website_enrich.py --apply
    python scripts/22_website_enrich.py --dry-run
"""

from __future__ import annotations
import sys, json, re, time, argparse
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, '.')
from src.config import OUTPUT_DIR
from src.supabase_client import client

REQUEST_TIMEOUT = 10
CRAWL_DELAY     = 0.5
MAX_BIO_WORDS   = 100
CONTACT_PATH    = "/contact"
HEADERS = {
    "User-Agent": "AlohaHealthBot/1.0 (+https://hawaiiwellness.net)",
    "Accept": "text/html,application/xhtml+xml",
}

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(
    r"(?:\+?1[\s.\-]?)?"
    r"(?:\(?\d{3}\)?[\s.\-]?)"
    r"\d{3}[\s.\-]?\d{4}"
)

BOOKING_DOMAINS = [
    "mindbody.io", "mindbodyonline.com", "acuityscheduling.com",
    "calendly.com", "vagaro.com", "janeapp.com", "fullslate.com",
    "setmore.com", "booker.com", "schedulicity.com", "simplybook.me",
    "squarespace.com/appointments", "booksy.com",
]
BOOKING_LINK_WORDS = {"book", "appointment", "schedule", "booking", "reserve"}

SOCIAL_PATTERNS = {
    "instagram": re.compile(r"instagram\.com/([A-Za-z0-9_.]+)"),
    "facebook":  re.compile(r"facebook\.com/([A-Za-z0-9_.]+)"),
    "linkedin":  re.compile(r"linkedin\.com/in/([A-Za-z0-9_\-]+)"),
    "x":         re.compile(r"(?:twitter|x)\.com/([A-Za-z0-9_]+)"),
    "substack":  re.compile(r"([A-Za-z0-9_\-]+)\.substack\.com"),
}

MODALITY_KEYWORDS: dict[str, list[str]] = {
    "Acupuncture":              ["acupuncture", "acupuncturist", "acupoint"],
    "Alternative Therapy":      ["holistic", "integrative", "alternative wellness"],
    "Astrology":                ["astrology", "astrologer", "natal chart"],
    "Ayurveda":                 ["ayurveda", "ayurvedic"],
    "Birth Doula":              ["birth doula", "labor support"],
    "Breathwork":               ["breathwork", "pranayama"],
    "Chiropractic":             ["chiropractic", "chiropractor", "spinal adjustment"],
    "Counseling":               ["counseling", "counselor", "lmhc", "lcsw", "mft",
                                 "mental health"],
    "Craniosacral":             ["craniosacral", "cranial sacral", "cst"],
    "Dentistry":                ["dentist", "dental"],
    "Energy Healing":           ["energy healing", "energy work", "biofield"],
    "Functional Medicine":      ["functional medicine", "root cause"],
    "Herbalism":                ["herbal", "herbalism", "botanicals"],
    "Hypnotherapy":             ["hypnotherapy", "hypnosis"],
    "Life Coaching":            ["life coach", "life coaching", "executive coach"],
    "Lomilomi / Hawaiian Healing": ["lomilomi", "lomi lomi", "hawaiian healing", "kahuna"],
    "Massage":                  ["massage", "bodywork", "lmt"],
    "Meditation":               ["meditation", "mindfulness"],
    "Midwife":                  ["midwife", "midwifery"],
    "Nature Therapy":           ["nature therapy", "ecotherapy", "forest bathing"],
    "Naturopathic":             ["naturopathic", "naturopath"],
    "Nervous System Regulation":["nervous system", "polyvagal"],
    "Network Chiropractic":     ["network chiropractic", "network spinal"],
    "Nutrition":                ["nutrition", "nutritionist", "dietitian", "rdn"],
    "Osteopathic":              ["osteopathic", "osteopath"],
    "Physical Therapy":         ["physical therapy", "physiotherapy"],
    "Psychotherapy":            ["psychotherapy", "psychotherapist", "psychologist"],
    "Reiki":                    ["reiki"],
    "Somatic Therapy":          ["somatic", "somatic therapy", "somatic experiencing"],
    "Soul Guidance":            ["soul guidance", "spiritual guidance", "akashic"],
    "Sound Healing":            ["sound healing", "sound bath", "singing bowl"],
    "TCM (Traditional Chinese Medicine)": ["tcm", "traditional chinese medicine",
                                           "chinese medicine"],
    "Trauma-Informed Care":     ["trauma informed", "trauma-informed", "emdr", "ptsd"],
    "Watsu / Water Therapy":    ["watsu", "water therapy", "aquatic bodywork"],
    "Yoga":                     ["yoga", "yogini", "asana", "vinyasa"],
}


# ── HTTP ──────────────────────────────────────────────────────────────────────

def fetch_html(url: str) -> BeautifulSoup | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT,
                         allow_redirects=True)
        if r.status_code != 200:
            return None
        return BeautifulSoup(r.text, "html.parser")
    except Exception:
        return None


def normalise_url(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return ""
    if not raw.startswith(("http://", "https://")):
        return "https://" + raw
    return raw


# ── JSON-LD ───────────────────────────────────────────────────────────────────

def extract_json_ld(soup: BeautifulSoup) -> dict:
    """Return first relevant Schema.org JSON-LD block, or {}."""
    RELEVANT_TYPES = {
        "Person", "LocalBusiness", "MedicalBusiness", "HealthAndBeautyBusiness",
        "MassageTherapist", "MedicalClinic", "Physician",
    }
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            schema_type = data.get("@type", "")
            if isinstance(schema_type, list):
                schema_type = schema_type[0]
            if schema_type in RELEVANT_TYPES:
                return data
        except Exception:
            pass
    return {}


def enrich_from_json_ld(json_ld: dict) -> dict:
    """Extract structured fields from JSON-LD."""
    out = {}
    if json_ld.get("email"):
        out["email"] = json_ld["email"].replace("mailto:", "").strip()
    if json_ld.get("telephone"):
        out["phone"] = json_ld["telephone"]
    if json_ld.get("description") and len(json_ld["description"]) > 20:
        out["bio"] = truncate_words(json_ld["description"], MAX_BIO_WORDS)
    # Image
    img = json_ld.get("image")
    if img:
        out["avatar_url"] = img if isinstance(img, str) else img.get("url", "")
    # Social profiles from sameAs
    same_as = json_ld.get("sameAs", [])
    if isinstance(same_as, str):
        same_as = [same_as]
    social = extract_social_from_urls(same_as)
    if social:
        out["_social_links"] = social
    return out


# ── Social profiles ───────────────────────────────────────────────────────────

def extract_social_from_urls(urls: list[str]) -> dict:
    social = {}
    for url in urls:
        for platform, pattern in SOCIAL_PATTERNS.items():
            if pattern.search(url):
                social[platform] = url
                break
    return social


def extract_social_from_soup(soup: BeautifulSoup) -> dict:
    """Scan all <a> hrefs for social media profile links."""
    social = {}
    for a in soup.find_all("a", href=True):
        href = a["href"]
        for platform, pattern in SOCIAL_PATTERNS.items():
            if platform not in social and pattern.search(href):
                social[platform] = href
    return social


# ── Booking URL ───────────────────────────────────────────────────────────────

def extract_booking_url(soup: BeautifulSoup, base_url: str) -> str:
    """Find external booking/appointment links."""
    for a in soup.find_all("a", href=True):
        href = a["href"].lower()
        text = a.get_text().lower().strip()
        # Booking platform domains
        if any(bd in href for bd in BOOKING_DOMAINS):
            return a["href"] if a["href"].startswith("http") else urljoin(base_url, a["href"])
        # Link text implies booking
        if any(w in text for w in BOOKING_LINK_WORDS):
            full = a["href"] if a["href"].startswith("http") else urljoin(base_url, a["href"])
            # Only return if it goes off-site or has 'book' in the path
            parsed = urlparse(full)
            if any(bd in parsed.netloc for bd in BOOKING_DOMAINS):
                return full
    return ""


# ── Standard extractions ──────────────────────────────────────────────────────

def truncate_words(text: str, n: int) -> str:
    words = text.split()
    return " ".join(words[:n]) + ("…" if len(words) > n else "")


# Secondary pages to crawl when homepage lacks contact info (priority order)
CONTACT_PAGES = ["/contact", "/contact-us", "/about", "/about-us", "/reach-us", "/connect"]

def extract_emails(soup: BeautifulSoup) -> list[str]:
    emails = set()
    for a in soup.find_all("a", href=True):
        if a["href"].startswith("mailto:"):
            addr = a["href"][7:].split("?")[0].strip().lower()
            if addr:
                emails.add(addr)
    for addr in EMAIL_RE.findall(soup.get_text()):
        emails.add(addr.lower())
    return [e for e in emails
            if not e.endswith((".png", ".jpg", ".gif", ".svg"))
            and "sentry" not in e and "example" not in e
            and "@2x" not in e and "wix" not in e
            and "squarespace" not in e]


def hunt_contact_info(base_url: str) -> tuple[str, str]:
    """Aggressively crawl multiple contact-related pages until email + phone found.
    Returns (email, phone) — either may be empty string if not found."""
    found_email = ""
    found_phone = ""

    for path in CONTACT_PAGES:
        if found_email and found_phone:
            break
        soup = fetch_html(urljoin(base_url, path))
        if not soup:
            continue
        if not found_email:
            emails = extract_emails(soup)
            if emails:
                found_email = emails[0]
        if not found_phone:
            phone = extract_phone(soup)
            if phone:
                found_phone = phone

    return found_email, found_phone


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


def extract_bio(soup: BeautifulSoup) -> str:
    og = soup.find("meta", property="og:description")
    if og and og.get("content", "").strip():
        return truncate_words(og["content"].strip(), MAX_BIO_WORDS)
    md = soup.find("meta", attrs={"name": "description"})
    if md and md.get("content", "").strip():
        return truncate_words(md["content"].strip(), MAX_BIO_WORDS)
    for tag in ["main", "article", "section", "div"]:
        for container in soup.find_all(tag):
            for p in container.find_all("p"):
                text = p.get_text(" ").strip()
                if len(text.split()) >= 15:
                    return truncate_words(text, MAX_BIO_WORDS)
    return ""


def extract_photo(soup: BeautifulSoup, base_url: str) -> str:
    og = soup.find("meta", property="og:image")
    if og and og.get("content", "").strip():
        return urljoin(base_url, og["content"].strip())
    tw = soup.find("meta", attrs={"name": "twitter:image"})
    if tw and tw.get("content", "").strip():
        return urljoin(base_url, tw["content"].strip())
    for img in soup.find_all("img", src=True):
        src = img.get("src", "")
        if any(src.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp"]):
            if not any(skip in src.lower() for skip in ["logo", "icon", "badge", "pixel", "1x1"]):
                w = img.get("width") or img.get("data-width") or "0"
                try:
                    if int(str(w).replace("px", "")) >= 200:
                        return urljoin(base_url, src)
                except Exception:
                    return urljoin(base_url, src)
    return ""


def infer_modalities(text: str) -> list[str]:
    lower = text.lower()
    return [m for m, kws in MODALITY_KEYWORDS.items() if any(kw in lower for kw in kws)]


# ── Helpers ───────────────────────────────────────────────────────────────────

def is_blank(v) -> bool:
    if v is None or v == "":
        return True
    if isinstance(v, list) and len(v) == 0:
        return True
    return False


def bio_is_thin(bio: str | None) -> bool:
    return not bio or len(bio.split()) < 10


def needs_enrichment(rec: dict) -> bool:
    return (
        is_blank(rec.get("email"))
        or is_blank(rec.get("phone"))
        or bio_is_thin(rec.get("bio") or rec.get("description"))
        or is_blank(rec.get("avatar_url"))
        or is_blank(rec.get("modalities"))
        or is_blank(rec.get("external_booking_url"))
        or is_blank(rec.get("social_links"))
    )


# ── Main crawl logic ──────────────────────────────────────────────────────────

def crawl_listing(rec: dict) -> dict | None:
    raw_url = rec.get("website_url", "")
    if not raw_url:
        return None

    url  = normalise_url(raw_url)
    soup = fetch_html(url)
    if soup is None:
        return None

    patch: dict = {}
    bio_field = "description" if rec.get("_table") == "centers" else "bio"

    # ── 1. JSON-LD — most reliable source ────────────────────────────────────
    json_ld = extract_json_ld(soup)
    if json_ld:
        ld = enrich_from_json_ld(json_ld)
        if ld.get("email") and is_blank(rec.get("email")):
            patch["email"] = ld["email"]
        if ld.get("phone") and is_blank(rec.get("phone")):
            patch["phone"] = ld["phone"]
        existing_bio = rec.get("bio") or rec.get("description")
        if ld.get("bio") and bio_is_thin(existing_bio):
            patch[bio_field] = ld["bio"]
        if ld.get("avatar_url") and is_blank(rec.get("avatar_url")):
            patch["avatar_url"] = ld["avatar_url"]
        if ld.get("_social_links"):
            patch["_social_links_ld"] = ld["_social_links"]

    # ── 2. Standard HTML extraction for anything still blank ─────────────────
    # Email — try homepage first, then hunt across multiple contact pages
    if is_blank(rec.get("email")) and "email" not in patch:
        emails = extract_emails(soup)
        if emails:
            patch["email"] = emails[0]
        else:
            hunted_email, hunted_phone = hunt_contact_info(url)
            if hunted_email:
                patch["email"] = hunted_email
            # Opportunistically capture phone too if found during contact hunt
            if hunted_phone and is_blank(rec.get("phone")) and "phone" not in patch:
                patch["phone"] = hunted_phone

    # Phone — try homepage, then hunt if still missing
    if is_blank(rec.get("phone")) and "phone" not in patch:
        phone = extract_phone(soup)
        if phone:
            patch["phone"] = phone
        else:
            _, hunted_phone = hunt_contact_info(url)
            if hunted_phone:
                patch["phone"] = hunted_phone

    existing_bio = rec.get("bio") or rec.get("description")
    if bio_is_thin(existing_bio) and bio_field not in patch:
        bio = extract_bio(soup)
        if bio:
            patch[bio_field] = bio

    if is_blank(rec.get("avatar_url")) and "avatar_url" not in patch:
        photo = extract_photo(soup, url)
        if photo:
            patch["avatar_url"] = photo

    if is_blank(rec.get("modalities")):
        mods = infer_modalities(soup.get_text(" "))
        if mods:
            patch["modalities"] = mods

    # ── 3. Booking URL ────────────────────────────────────────────────────────
    if is_blank(rec.get("external_booking_url")):
        booking = extract_booking_url(soup, url)
        if booking:
            patch["external_booking_url"] = booking

    # ── 4. Social links ───────────────────────────────────────────────────────
    if is_blank(rec.get("social_links")):
        social = extract_social_from_soup(soup)
        if not social and "_social_links_ld" in patch:
            social = patch.pop("_social_links_ld")
        elif "_social_links_ld" in patch:
            social.update(patch.pop("_social_links_ld"))
        if social:
            patch["social_links"] = social
    else:
        patch.pop("_social_links_ld", None)

    return patch if patch else None


# ── DB fetch ──────────────────────────────────────────────────────────────────

def fetch_listings(island: str) -> list[dict]:
    records = []
    for table, bio_col in [("practitioners", "bio"), ("centers", "description")]:
        page_size, offset = 1000, 0
        while True:
            resp = client.table(table).select(
                f"id, name, website_url, email, phone, {bio_col}, avatar_url, "
                f"modalities, island, external_booking_url, social_links"
            ).eq("island", island).not_.is_("website_url", "null").neq(
                "website_url", ""
            ).range(offset, offset + page_size - 1).execute()
            batch = resp.data or []
            for r in batch:
                r["_table"] = table
                r["_bio_col"] = bio_col
                if bio_col == "description":
                    r["bio"] = r.pop("description", None)
            records.extend(batch)
            if len(batch) < page_size:
                break
            offset += page_size
    return [r for r in records if needs_enrichment(r)]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--island",  default="big_island",
                        choices=["big_island", "maui", "oahu", "kauai"])
    parser.add_argument("--limit",   type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply",   action="store_true")
    args = parser.parse_args()

    out_path = OUTPUT_DIR / "website_enrichments.jsonl"

    print(f"\n[22] Fetching listings needing enrichment for island={args.island}…")
    listings = fetch_listings(args.island)
    print(f"[22] {len(listings)} listings to crawl\n")

    if args.limit:
        listings = listings[:args.limit]
        print(f"[22] Limited to {args.limit}\n")

    results: list[dict] = []
    ok = skipped = errors = 0

    for i, rec in enumerate(listings, 1):
        name = rec.get("name", "?")
        url  = normalise_url(rec.get("website_url", ""))
        print(f"  [{i}/{len(listings)}] {name[:50]:<50} {url[:35]}", end=" … ", flush=True)
        try:
            patch = crawl_listing(rec)
        except Exception as e:
            print(f"ERROR: {e}")
            errors += 1
            time.sleep(CRAWL_DELAY)
            continue

        if not patch:
            print("nothing new")
            skipped += 1
        else:
            print(f"✓ {list(patch.keys())}")
            results.append({
                "_db_id":    rec["id"],
                "_db_table": rec["_table"],
                "_name":     name,
                "_url":      url,
                **patch,
            })
            ok += 1
        time.sleep(CRAWL_DELAY)

    if not args.dry_run and results:
        with open(out_path, "w") as f:
            for r in results:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"\n[22] Saved {len(results)} enrichment records → {out_path}")

    if args.apply and results and not args.dry_run:
        print("\n[22] Applying enrichments to DB…")
        applied = 0
        for r in results:
            table = r["_db_table"]
            db_id = r["_db_id"]
            patch = {k: v for k, v in r.items() if not k.startswith("_")}
            try:
                client.table(table).update(patch).eq("id", db_id).execute()
                applied += 1
            except Exception as e:
                print(f"  DB error for {r['_name']}: {e}")
        print(f"[22] Applied {applied} records")

    mode = "[DRY RUN] " if args.dry_run else ""
    print(f"\n{mode}── Summary ────────────────────────────────────────────")
    print(f"  {ok:>4}  enriched   {skipped:>4}  nothing new   {errors:>4}  errors")
    if not args.dry_run and ok and not args.apply:
        print(f"\n  Review → {out_path}")
        print("  Run with --apply to write to DB.")
