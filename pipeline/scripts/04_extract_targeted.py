"""
04_extract_targeted.py — Extract practitioners from the 4 target domains.

Handles two page types:
  1. Individual profile pages (malamaikeola.com/{name})  → one entity per page
  2. Team listing pages (malamaponomassage, malamachiropractic) → multiple entities per page

Usage:
  cd pipeline && python3 scripts/04_extract_targeted.py
"""
import sys
sys.path.insert(0, ".")

import json
import re
import sqlite3
from pathlib import Path
from bs4 import BeautifulSoup
from src.config import DB_PATH, OUTPUT_DIR
from src.extract import (extract_entity, extract_team_practitioners, extract_phone,
                          extract_town, detect_modalities, extract_bio_from_page,
                          extract_json_ld, extract_name, extract_address, detect_island)

OUTPUT_FILE = OUTPUT_DIR / "raw_entities_targeted.jsonl"

# ── Target domain config ──────────────────────────────────────────────────────

TARGET_DOMAINS = {
    "malamaikeola.com": {
        "mode": "profiles",          # individual profile pages
        "skip_paths": {"", "/", "/team", "/about-1", "/services", "/ayurveda",
                       "/breathwork", "/yoga", "/new-page", "/team-1", "/contact",
                       "/team-1/"},
    },
    "malamaponomassage.com": {
        "mode": "team",              # team listing page
        "team_url": "https://www.malamaponomassage.com/team",
        "shared_city": "Kailua-Kona",
        "shared_island": "big_island",
        "default_modalities": ["Massage"],
    },
    "malamachiropractic.com": {
        "mode": "team",
        "team_url": "https://www.malamachiropractic.com/us/",
        "shared_city": "Kailua-Kona",
        "shared_island": "big_island",
        "default_modalities": [],
        # Chiropractic injected per-practitioner based on credential in raw name
    },
}

# Business-name patterns to skip (not individual practitioners)
BUSINESS_NAME_RE = re.compile(
    r'\b(LLC|Inc|Co\.|Corp|Center|Clinic|Studio|Spa|Retreat|Collective|'
    r'Association|Institute|School|Services|Esthetics|Massage Therapy)\b',
    re.IGNORECASE
)

# Skip names that are 4+ words and look generic/nav items
SKIP_NAME_RE = re.compile(
    r'^(Meet Our|Ready for|Skilled|Services|About|Contact|Home|Gallery|'
    r'Massage Therapists|Our Team|The Team|Staff|Welcome|Book Now)',
    re.IGNORECASE
)

# hawaiiacupuncture.org has no individual practitioner pages — skip

# ── Helpers ───────────────────────────────────────────────────────────────────

def domain_of(url: str) -> str:
    from urllib.parse import urlparse
    host = urlparse(url).netloc
    return host.replace("www.", "")

def path_of(url: str) -> str:
    from urllib.parse import urlparse
    return urlparse(url).path.rstrip("/")


def _get_focused_text(soup) -> str:
    """Get only the meaningful practitioner content sections (Services + About),
    not nav/footer, to avoid false positive modality matches."""
    parts = []
    # H1/H2 text (practitioner name + credentials) — include both in case H1 is missing
    for tag in ['h1', 'h2']:
        el = soup.find(tag)
        if el:
            parts.append(el.get_text(separator=' ', strip=True))
            break  # Only take first heading found
    # Page title (often has "Name | Specialty — Org")
    title = soup.find('title')
    if title:
        parts.append(title.text)
    # Services/Offerings section
    for heading in soup.find_all(['h2', 'h3']):
        ht = heading.get_text(strip=True).lower()
        if any(kw in ht for kw in ['service', 'treatment', 'session', 'offering', 'specialty', 'practice']):
            for sib in heading.next_siblings:
                if not hasattr(sib, 'name'):
                    continue
                if sib.name in ['h1', 'h2', 'h3']:
                    break
                parts.append(sib.get_text(separator=' ', strip=True))
    # About section
    for heading in soup.find_all(['h2', 'h3']):
        ht = heading.get_text(strip=True).lower()
        if 'about' in ht:
            for sib in heading.next_siblings:
                if not hasattr(sib, 'name'):
                    continue
                if sib.name in ['h1', 'h2', 'h3']:
                    break
                parts.append(sib.get_text(separator=' ', strip=True))
    # Also grab substantial paragraph text (avoids nav link text but captures bios/services)
    for p in soup.find_all('p'):
        t = p.get_text(strip=True)
        if t and 25 < len(t) < 400:
            parts.append(t)
    return ' '.join(parts)


def looks_like_profile(url: str, config: dict) -> bool:
    path = path_of(url)
    skip = config.get("skip_paths", set())
    if path in skip:
        return False
    # Skip resource/utility-looking paths
    skip_keywords = ["category", "tag", "page-", "blog", "news", "event",
                     "gallery", "contact", "book", "schedule", "faq", "policy",
                     "privacy", "terms", "cart", "checkout", "shop", "store"]
    low = path.lower()
    return not any(k in low for k in skip_keywords)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)

    all_entities = []

    for dom, config in TARGET_DOMAINS.items():
        print(f"\n── {dom} ({config['mode']}) ──")

        if config["mode"] == "profiles":
            # Get all crawled pages for this domain
            rows = conn.execute(
                "SELECT url, html_path FROM pages WHERE url LIKE ? AND html_path IS NOT NULL",
                (f"%{dom}%",)
            ).fetchall()

            for url, html_path in rows:
                if not looks_like_profile(url, config):
                    print(f"  skip  {url}")
                    continue
                try:
                    html = open(html_path).read()
                except FileNotFoundError:
                    print(f"  missing cache: {html_path}")
                    continue

                entity = extract_entity(url, html)
                if not entity:
                    print(f"  no entity: {url}")
                    continue

                # Skip org/center names
                name = entity.get("name", "")
                if BUSINESS_NAME_RE.search(name):
                    print(f"  business name skipped: {name!r}")
                    continue
                if any(kw in name.lower() for kw in ["malama", "hawaii", "aloha", "center",
                                                       "clinic", "collective", "studio", "r&r"]):
                    print(f"  org name skipped: {name!r} ({url})")
                    continue

                # Re-detect modalities using only focused text (services + bio)
                # to avoid nav/footer false positives
                soup_focused = BeautifulSoup(html, 'html.parser')
                focused_text = _get_focused_text(soup_focused)
                entity['modalities'] = detect_modalities(focused_text, entity.get('bio') or '')

                print(f"  ✓ {name!r}  modalities={entity['modalities']}")
                all_entities.append(entity)

        elif config["mode"] == "team":
            team_url = config["team_url"]
            row = conn.execute(
                "SELECT html_path FROM pages WHERE url = ?", (team_url,)
            ).fetchone()
            if not row:
                print(f"  team page not cached: {team_url}")
                continue

            try:
                html = open(row[0]).read()
            except FileNotFoundError:
                print(f"  missing cache: {row[0]}")
                continue

            phone = extract_phone(html)
            shared_city = config.get("shared_city", "Kailua-Kona")
            shared_island = config.get("shared_island", "big_island")
            default_modalities = config.get("default_modalities", [])

            practitioners = extract_team_practitioners(
                url=team_url,
                html=html,
                shared_phone=phone,
                shared_city=shared_city,
                shared_island=shared_island,
            )

            for p in practitioners:
                # Skip non-practitioners
                if BUSINESS_NAME_RE.search(p['name']) or SKIP_NAME_RE.match(p['name']):
                    print(f"  skip non-person: {p['name']!r}")
                    continue
                # Merge default modalities (e.g. Massage for malamaponomassage)
                for m in default_modalities:
                    if m not in p["modalities"]:
                        p["modalities"].append(m)
                # Use the website URL from config (team page) as homepage link
                p['website_url'] = config['team_url'].rsplit('/', 1)[0] + '/'
                print(f"  ✓ {p['name']!r}  modalities={p['modalities']}")
                all_entities.append(p)

    # Write output
    with open(OUTPUT_FILE, "w") as f:
        for e in all_entities:
            f.write(json.dumps(e) + "\n")

    print(f"\nTotal extracted: {len(all_entities)}")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
