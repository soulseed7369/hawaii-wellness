#!/usr/bin/env python3
"""
19_centers_cleanup.py
─────────────────────
Three-pass cleanup of the centers table to remove junk, solo practitioners,
and reclassify surviving genuine venues.

A "genuine center" is a physical venue/facility that can host people for
services, classes, or retreats — yoga studios, day spas, retreat centers,
multi-practitioner clinics, etc. Individual solo practitioners (massage
therapists, acupuncturists, counselors) that were mis-scraped as centers
are removed from this table (they are already or should be in practitioners).

Pass 1 — Delete junk:
  Web page title artifacts, off-island locations, non-wellness businesses
  (hotels, coffee farms, restaurants) that slipped through earlier cleaning.

Pass 2 — Remove solo practitioners from centers:
  Records that are clearly a single person's practice based on name patterns:
  credential suffixes, personal name + solo modality, etc.
  Facility names are protected by an override list.

Pass 3 — Reclassify surviving genuine centers by type:
  Update center_type to retreat_center / spa / clinic / wellness_center
  based on name keywords.

Usage
─────
    cd pipeline
    python scripts/19_centers_cleanup.py --dry-run      # preview
    python scripts/19_centers_cleanup.py                 # apply
    python scripts/19_centers_cleanup.py --pass1-only
    python scripts/19_centers_cleanup.py --pass2-only
    python scripts/19_centers_cleanup.py --pass3-only
"""

from __future__ import annotations
import re, argparse, sys
sys.path.insert(0, '.')
from src.supabase_client import client

# ── Hawaii city whitelist ──────────────────────────────────────────────────────
HAWAII_CITIES = {
    # Big Island
    'hilo', 'kailua-kona', 'kona', 'waimea', 'captain cook', 'pahoa', 'pāhoa',
    'holualoa', 'hōlualoa', 'hawi', 'honokaa', 'honokā', 'volcano',
    'waikoloa', 'waikoloa village', 'keaau', 'keaau', 'ocean view', 'kapaau',
    'kawaihae', 'na alehu', 'naalehu', 'milolii', 'kealakekua', 'mountain view',
    'papaikou', 'pepeekeo', 'kurtistown', 'pahala', 'laupahoehoe',
    'hawaii volcanoes national park', 'naalehu',
    # Oahu
    'honolulu', 'waikiki', 'kailua', 'kaneohe', 'pearl city', 'aiea',
    'mililani', 'kapolei', 'ewa beach', 'haleiwa', 'waipahu', 'hawaii kai',
    'manoa', 'nuuanu', 'kaimuki', 'makiki',
    # Maui
    'kahului', 'wailuku', 'lahaina', 'kihei', 'wailea', 'hana', 'makawao',
    'paia', 'haiku', 'kula', 'pukalani', 'napili', 'kapalua',
    # Kauai
    'lihue', 'kapaa', 'kapaa', 'poipu', 'hanalei', 'princeville', 'koloa',
    'waimea', 'hanapepe',
    # Generic
    'none', '', 'hi',
}

# ── Mainland state abbreviations (city-field heuristic) ────────────────────────
MAINLAND_PATTERN = re.compile(
    r'\b(CA|TX|NY|FL|WA|OR|CO|AZ|NV|GA|NC|VA|PA|IL|OH|MI|MN|MA|NJ|MD|MO)\b'
)

# ── Pass 1: Junk patterns ──────────────────────────────────────────────────────

# Web page artifacts — name looks like a URL or page heading
ARTIFACT_PREFIX = re.compile(
    r'^(www\.|https?://|welcome\s+to\s+|schedule\s+appointment|general\s+\d|'
    r'home\s*-\s*|contact\s*-\s*)',
    re.IGNORECASE,
)

# Names that are plainly descriptions, not business names
GENERIC_DESCRIPTION = re.compile(
    r'^(massage\s+services?|yoga\s+classes?\s+in|naturopathic\s+healing\s+services?|'
    r'holistic\s+healing\s+center\s+in|medical\s+wellness\s+&?\s+aesthetics|'
    r'detoxification\s+&?\s+lifestyle|level\s+\d+\s*[-–]\s*\d+\s+sound|'
    r'big\s+island,?\s+hawaii|your\s+hawaiian\s+retreat|'
    r'somatic\s+education\s+for|you\s+owe\s+yourself|complete\s+yoga\s+training|'
    r'advanced\s+wellness\s+and\s+recovery\s+[-–|]|'
    r'healing\s+experiences\s+in\s+hawaii|a\s+peaceful\s+sanctuary\s+awaits|'
    r"hawaii\s+counseling\s+&?\s+education\s+center\s+welcomes).*",
    re.IGNORECASE,
)

# HTML encoding artifacts
HTML_ENTITY = re.compile(r'&[a-z]+;|â|Å|ð|ü|û', re.IGNORECASE)

# Non-wellness businesses
NON_WELLNESS = re.compile(
    r'\b(coffee\s+farm|coffee\s+living|trading\s+co\b|volcano\s+house|'
    r'outrigger\s+kona\s+resort|healing\s+noni|kuaiwi\s+farm|'
    r'sacred\s+grounds\s+coffee|kona\s+coffee\s+living|kokolulu\s+farm|'
    r'pharm\s+east\s+inc|whitehaven\s+farm|national\s+park)\b',
    re.IGNORECASE,
)

# Protect genuine retreat farms from NON_WELLNESS
RETREAT_FARM_OVERRIDE = re.compile(
    r'\b(retreats?|wellness|healing|sanctuary|yoga|ayurveda|cancer)\b',
    re.IGNORECASE,
)

# ── Pass 2: Solo practitioner patterns ────────────────────────────────────────

# Credentials that indicate a single licensed individual
CREDENTIAL_SUFFIX = re.compile(
    r'\b(L\.?M\.?T\.?|L\.?Ac\.?|L\.?C\.?S\.?W\.?|L\.?M\.?F\.?T\.?|M\.?F\.?T\.?|'
    r'D\.?C\.?|Ph\.?D\.?|Psy\.?D\.?|R\.?N\.?|N\.?P\.?|N\.?D\.?|R\.?Y\.?T\.?|'
    r'C\.?H\.?C\.?|M\.?D\.?|D\.?O\.?|O\.?T\.?R\.?|P\.?T\.?)'
    r'(?:\b|,|\s|\))',
    re.IGNORECASE,
)

# "PlaceName Modality" pattern — small practice name + solo service, no facility word.
# Requires exactly TWO words before the modality (not three) to avoid catching
# "Cornerstone Community Chiropractic", "South Kona Chiropractic", etc.
SOLO_NAME_MODALITY = re.compile(
    r'^[A-Za-z\u02BB\u2018\u2019\-]+\s+[A-Za-z\u02BB\u2018\u2019\-]+'  # exactly two words
    r'\s+(Acupuncture|Massage(\s+Therapy)?|Reiki|Healing|Hypnosis|Naturopathic)\s*$',
    re.IGNORECASE,
)
# Three-word modality names — only match when the first two words look like a person name
# (Title Case, short, no location words)
SOLO_THREE_WORD = re.compile(
    r'^[A-Z][a-z]{2,10}\s+[A-Z][a-z]{2,10}\s+[A-Z][a-z]{2,10}'  # TitleCase TitleCase TitleCase
    r'\s*(Acupuncture|Massage|Counseling|Therapy|Reiki|Chiropractic|Coaching)\s*$',
)

# "By [Name]" patterns
BY_NAME = re.compile(r'\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+', re.IGNORECASE)

# Clearly personal name business: "John Smith LLC" or "John Smith, [credential]"
# Uses proper case matching (not IGNORECASE) to avoid catching org names like "CARE Hawaii, Inc."
PERSON_LLC = re.compile(
    r'^[A-Z][a-z]{1,12}(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]{1,15}'  # TitleCase First [M.] Last
    r'(?:,\s*|\s+)(LLC|L\.L\.C\.|PLLC|Inc\.?|R\(S\))',
    # No IGNORECASE — requires proper title-case person names
)

# FACILITY OVERRIDE — if name contains any of these, it's a venue, NOT a solo practitioner
FACILITY_OVERRIDE = re.compile(
    r'\b(studio|studios|retreat|spa\b|clinic|institute|academy|'
    r'collective|school|sanctuary|oasis|wellness\s+center|'
    r'health\s+center|healing\s+center|arts\s+center|'
    r'meditation\s+center|yoga\s+center|center\s+for|'
    r'house\b|farm\s+retreat|campus|practice|associates)\b',
    re.IGNORECASE,
)

# ── Pass 3: center_type reclassification ──────────────────────────────────────

RETREAT_PATTERN = re.compile(
    r'\b(retreat|sanctuary|immersion|journey|camp\b)\b',
    re.IGNORECASE,
)
SPA_PATTERN = re.compile(
    r'\b(spa\b|day\s+spa|beauty\s+lounge|facial|aesthetics?|sauna|bath\b|'
    r'beauty\b|nail\b|wax\b|sento)\b',
    re.IGNORECASE,
)
CLINIC_PATTERN = re.compile(
    r'\b(clinic|healthcare|health\s+care|health\s+center|medical|'
    r'chiropractic\s+center|naturopathic\s+clinic|integrative\s+medicine|'
    r'physical\s+therapy|rehab|rehabilitation|primary\s+care|family\s+health|'
    r'mental\s+health|counseling\s+center)\b',
    re.IGNORECASE,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def clean_name(name: str) -> str:
    return name.strip() if name else ''


def is_off_island(row: dict) -> bool:
    city = (row.get('city') or '').strip().lower()
    address = (row.get('address') or '').strip()
    if city and city not in HAWAII_CITIES:
        # Allow unknown cities on Big Island (e.g. small towns not in our list)
        # Only flag if city matches a known mainland pattern
        if MAINLAND_PATTERN.search(city) or MAINLAND_PATTERN.search(address):
            return True
        # Flag cities that clearly sound non-Hawaiian
        if city not in HAWAII_CITIES and len(city) > 0 and city != 'none':
            # Check if it looks like a mainland city (contains state or known cities)
            if MAINLAND_PATTERN.search(address):
                return True
    return False


def is_junk(name: str, row: dict) -> tuple[bool, str]:
    """Return (should_delete, reason)."""
    n = clean_name(name)

    if not n or len(n) < 4:
        return True, 'too short / empty'

    if ARTIFACT_PREFIX.match(n):
        return True, 'web page artifact prefix'

    if GENERIC_DESCRIPTION.match(n):
        return True, 'generic description name'

    if HTML_ENTITY.search(n):
        return True, 'HTML encoding artifact'

    if NON_WELLNESS.search(n) and not RETREAT_FARM_OVERRIDE.search(n):
        return True, 'non-wellness business'

    # Off-island city (only flag unambiguous cases)
    city = (row.get('city') or '').strip().lower()
    if city and city not in HAWAII_CITIES and city not in ('', 'none'):
        address = (row.get('address') or '')
        if MAINLAND_PATTERN.search(address) or MAINLAND_PATTERN.search(city):
            return True, f'off-island city: {city}'
        # Specific known mainland cities
        if city in ('fremont', 'san jose', 'los angeles', 'new york', 'seattle',
                    'portland', 'denver', 'chicago', 'austin', 'miami'):
            return True, f'mainland city: {city}'

    return False, ''


def is_solo_practitioner(name: str) -> tuple[bool, str]:
    """Return (should_remove, reason)."""
    n = clean_name(name)

    # Facility override — always keep
    if FACILITY_OVERRIDE.search(n):
        return False, ''

    if CREDENTIAL_SUFFIX.search(n):
        return True, 'credential suffix'

    if SOLO_NAME_MODALITY.match(n):
        return True, 'two-word name + solo modality'

    if SOLO_THREE_WORD.match(n):
        return True, 'three-word title-case + solo modality'

    if PERSON_LLC.match(n):
        return True, 'personal name + LLC/Inc'

    if BY_NAME.search(n):
        return True, '"by [name]" pattern'

    return False, ''


def classify_center_type(name: str) -> str:
    n = clean_name(name)
    if RETREAT_PATTERN.search(n):
        return 'retreat_center'
    if SPA_PATTERN.search(n):
        return 'spa'
    if CLINIC_PATTERN.search(n):
        return 'clinic'
    return 'wellness_center'


# ── Main ──────────────────────────────────────────────────────────────────────

def run(args):
    dry = args.dry_run
    do_pass1 = args.pass1_only or (not args.pass2_only and not args.pass3_only)
    do_pass2 = args.pass2_only or (not args.pass1_only and not args.pass3_only)
    do_pass3 = args.pass3_only or (not args.pass1_only and not args.pass2_only)

    # Fetch all draft centers
    print("Fetching draft centers...")
    result = client.table('centers').select(
        'id,name,center_type,city,address,island,status'
    ).eq('status', 'draft').execute()
    centers = result.data
    print(f"  Found {len(centers)} draft centers\n")

    junk_ids   = []
    solo_ids   = []
    retype_map = {}  # id → new center_type

    for c in centers:
        name = clean_name(c.get('name') or '')

        # Pass 1 check
        junk, reason1 = is_junk(name, c)
        if junk:
            junk_ids.append((c['id'], name, reason1))
            continue

        # Pass 2 check
        solo, reason2 = is_solo_practitioner(name)
        if solo:
            solo_ids.append((c['id'], name, reason2))
            continue

        # Pass 3: reclassify type
        new_type = classify_center_type(name)
        if new_type != c.get('center_type'):
            retype_map[c['id']] = (name, c.get('center_type'), new_type)

    # ── Print summary ─────────────────────────────────────────────────────────
    print("=" * 70)
    print(f"PASS 1 — Junk to delete: {len(junk_ids)}")
    for id_, name, reason in sorted(junk_ids, key=lambda x: x[2]):
        print(f"  [{reason}]  {name[:80]}")

    print()
    print(f"PASS 2 — Solo practitioners to remove: {len(solo_ids)}")
    for id_, name, reason in sorted(solo_ids, key=lambda x: x[2]):
        print(f"  [{reason}]  {name[:80]}")

    print()
    print(f"PASS 3 — center_type updates: {len(retype_map)}")
    for id_, (name, old_type, new_type) in list(retype_map.items())[:30]:
        print(f"  {old_type} → {new_type}  |  {name[:60]}")
    if len(retype_map) > 30:
        print(f"  ... and {len(retype_map) - 30} more")

    surviving = len(centers) - len(junk_ids) - len(solo_ids)
    print()
    print(f"SUMMARY (draft centers)")
    print(f"  Before:    {len(centers)}")
    print(f"  Deleted:   {len(junk_ids) + len(solo_ids)}  "
          f"(junk: {len(junk_ids)}, solo practitioners: {len(solo_ids)})")
    print(f"  Remaining: {surviving}")
    print()

    if dry:
        print("DRY RUN — no changes applied.")
        return

    # ── Apply ─────────────────────────────────────────────────────────────────
    if do_pass1 and junk_ids:
        ids = [x[0] for x in junk_ids]
        print(f"Deleting {len(ids)} junk centers...")
        client.table('centers').delete().in_('id', ids).execute()
        print("  Done.")

    if do_pass2 and solo_ids:
        ids = [x[0] for x in solo_ids]
        print(f"Deleting {len(ids)} solo-practitioner centers...")
        client.table('centers').delete().in_('id', ids).execute()
        print("  Done.")

    if do_pass3 and retype_map:
        print(f"Updating center_type for {len(retype_map)} records...")
        for id_, (name, old_type, new_type) in retype_map.items():
            client.table('centers').update({'center_type': new_type}).eq('id', id_).execute()
        print("  Done.")

    # Final count
    result2 = client.table('centers').select('id', count='exact').eq('status', 'draft').execute()
    print(f"\nDraft centers after cleanup: {result2.count}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Clean up centers table')
    parser.add_argument('--dry-run',     action='store_true', help='Preview only')
    parser.add_argument('--pass1-only',  action='store_true', help='Only run Pass 1 (junk)')
    parser.add_argument('--pass2-only',  action='store_true', help='Only run Pass 2 (solo)')
    parser.add_argument('--pass3-only',  action='store_true', help='Only run Pass 3 (retype)')
    args = parser.parse_args()
    run(args)
