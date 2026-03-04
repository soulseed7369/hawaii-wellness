"""
17_cleanup_medicine_and_islands.py
────────────────────────────────────
Two cleanup passes on all DRAFT records:

Pass 1 — Remove conventional medicine listings
  Deletes practitioners and centers that are clearly conventional medical
  practices: MDs, hospitals, dentists, pharmacies, optometrists, urgent care,
  OB/GYN, pediatricians, dermatologists, etc.  Holistic-adjacent specialties
  that overlap (e.g. functional-medicine MDs, osteopaths, naturopaths) are
  intentionally kept.

Pass 2 — Fix island assignments based on city name
  The Google Maps pipeline defaulted everything to big_island.  This pass
  reads the city field and assigns the correct island if the city is
  unambiguously on Maui, Oʻahu, Kauaʻi, or Molokaʻi.

Usage
─────
    cd pipeline
    python scripts/17_cleanup_medicine_and_islands.py --dry-run   # preview
    python scripts/17_cleanup_medicine_and_islands.py              # apply
    python scripts/17_cleanup_medicine_and_islands.py --pass1-only
    python scripts/17_cleanup_medicine_and_islands.py --pass2-only
"""

from __future__ import annotations
import re, argparse, sys
sys.path.insert(0, '.')
from src.supabase_client import client

# ── Pass 1: Conventional-medicine patterns ─────────────────────────────────────

# Modalities that are purely conventional medicine (not holistic / integrative)
CONVENTIONAL_MODALITIES = {
    'dentistry', 'dental', 'orthodontics', 'oral surgery',
    'general practice', 'family medicine', 'internal medicine',
    'emergency medicine', 'urgent care', 'hospital',
    'ob/gyn', 'obstetrics', 'gynecology', 'pediatrics', 'pediatric',
    'dermatology', 'cardiology', 'oncology', 'urology', 'neurology',
    'ophthalmology', 'optometry', 'gastroenterology', 'nephrology',
    'orthopedics', 'radiology', 'anesthesiology', 'pathology',
    'plastic surgery', 'surgery', 'vascular surgery',
    'pharmacy', 'pharmacist', 'laboratory', 'dialysis',
}

# Name patterns that flag a conventional medicine listing
CONVENTIONAL_NAME = re.compile(
    r'\b('
    # Hospital / emergency / clinic
    r'hospital|medical\s+center|urgent\s?care|emergency|er\b|'
    # Dental
    r'dental|dentist|orthodont|oral\s+surgery|endodont|periodont|'
    r'dentures?|implants?\s+center|'
    # Pharmacy / lab
    r'pharmacy|pharmacist|drug\s+store|cvs\b|walgreens?|rite\s+aid|'
    r'laboratory|clinical\s+lab|blood\s+test|'
    # Eye / optometry
    r'optometr|ophthalmol|eye\s+care|eye\s+clinic|vision\s+center|'
    # Conventional specialties
    r'ob[\s\-]?gyn|obstetrics?|gynecolog|pediatric|paediatric|'
    r'dermatolog|cardiology|oncolog|chemotherapy|dialysis|'
    r'orthopedic|orthopaedic|podiatr|podiatry\s+center|'
    r'urology|gastroenterol|gastro\s+clinic|colonoscopy|'
    r'radiology|imaging\s+center|mri\b|x[\s\-]?ray|'
    r'plastic\s+surgery|cosmetic\s+surgery|liposuction|'
    r'general\s+surgery|surgical\s+center|'
    # Conventional primary care
    r'family\s+medicine|internal\s+medicine|primary\s+care\s+clinic|'
    r'primary\s+care\s+physician|general\s+practitioner|'
    r'kaiser\b|queens?\s+medical|straub\b|pali\s+momi|'
    r'adventist|hilo\s+medical|maui\s+health|'
    # Veterinary
    r'veterinar|animal\s+hospital|pet\s+clinic|vet\s+clinic'
    r')\b',
    re.IGNORECASE,
)

# Conventional MD/DO credential pattern — flag names that end in or contain
# ", MD" / ", M.D." / "(MD)" etc. and have no holistic override.
# Note: DO (osteopath) can be holistic — handled via HOLISTIC_OVERRIDE.
MD_CREDENTIAL = re.compile(
    r'(?:,\s*|\s+|\()(?:M\.?D\.?)(?:\)|,|\s|$)',
    re.IGNORECASE,
)

# Holistic terms — if these appear in the name, do NOT delete even if a
# conventional keyword also matched (e.g. "Integrative Medicine Center")
HOLISTIC_OVERRIDE = re.compile(
    r'\b('
    r'integrative|functional|naturopath|holistic|alternative|'
    r'wellness|healing|acupuncture|chiropractic|ayurved|'
    r'homeopath|herbal|energy|reiki|somatic|massage|craniosacral|'
    r'osteopath|chinese\s+medicine|tcm|ayurveda|yoga|meditation|'
    r'breathwork|hypnotherapy|nutrition|coaching|counseling|therapy|'
    r'regenerative|biologic|stem\s+cell|peptide|'  # advanced integrative treatments
    r'l\.?ac\b|lac\b'                              # Licensed Acupuncturist credential
    r')\b',
    re.IGNORECASE,
)

# Modalities that are kept even if name looks conventional
HOLISTIC_MODALITIES = {
    'acupuncture', 'chiropractic', 'massage', 'naturopathic', 'reiki',
    'osteopathic', 'ayurveda', 'yoga', 'meditation', 'breathwork',
    'nutrition', 'herbalism', 'energy healing', 'craniosacral',
    'functional medicine', 'somatic therapy', 'counseling', 'psychotherapy',
    'hypnotherapy', 'life coaching', 'tcm', 'sound healing',
    'trauma informed services', 'network chiropractic',
}


def is_conventional(name: str, modalities: list[str]) -> bool:
    """
    Return True if this listing is an unambiguously conventional medical listing
    (hospital, urgent care, dental, orthopedic, etc.) — these are auto-deleted.
    Does NOT flag MDs here; use is_md_candidate() for those.
    """
    name = name.strip() if name else ''
    mods_lower = {m.lower() for m in (modalities or [])}

    # If any holistic modality is present, keep it
    if mods_lower & HOLISTIC_MODALITIES:
        return False

    # If name contains a holistic override keyword, keep it
    if HOLISTIC_OVERRIDE.search(name):
        return False

    # If name matches a conventional institution pattern, it's conventional
    if CONVENTIONAL_NAME.search(name):
        return True

    # If all modalities are purely conventional, it's conventional
    if mods_lower and mods_lower.issubset(CONVENTIONAL_MODALITIES):
        return True

    return False


def is_md_candidate(name: str, modalities: list[str]) -> bool:
    """
    Return True if this listing appears to be a conventional MD but is NOT
    already caught by is_conventional() — meaning it needs human review.
    """
    name = name.strip() if name else ''

    # Already caught by the main filter — don't double-flag
    if is_conventional(name, modalities):
        return False

    # Must contain an MD credential
    if not MD_CREDENTIAL.search(name):
        return False

    # If holistic override present, keep it — not a candidate for deletion
    if HOLISTIC_OVERRIDE.search(name):
        return False

    return True


# ── Pass 2: City → island mapping ─────────────────────────────────────────────

# These are *unambiguous* assignments — cities that exist only on one island.
# Big Island cities are intentionally omitted here because many existing records
# are already correctly set to big_island; we only correct wrongly assigned ones.
CITY_TO_ISLAND: dict[str, str] = {
    # Maui (including Molokai, Lanai under maui county — using 'maui' island value)
    'kahului':      'maui',
    'wailuku':      'maui',
    'lahaina':      'maui',
    'kihei':        'maui',
    'wailea':       'maui',
    'hana':         'maui',
    'makawao':      'maui',
    'paia':         'maui',
    "pa'ia":        'maui',
    'haiku':        'maui',
    'kula':         'maui',
    'pukalani':     'maui',
    'napili':       'maui',
    'kapalua':      'maui',
    'kaanapali':    'maui',
    "ka'anapali":   'maui',
    'spreckelsville': 'maui',
    'haliimaile':   'maui',
    'ulupalakua':   'maui',
    'maalaea':      'maui',
    'haiku-pauwela': 'maui',
    'kahakuloa':    'maui',
    'lanai city':   'maui',
    'lanai':        'maui',

    # Oahu
    'honolulu':     'oahu',
    'waikiki':      'oahu',
    'kailua':       'oahu',    # Note: Kailua-Kona is Big Island — handled below
    'kaneohe':      'oahu',
    "kāne'ohe":     'oahu',
    'pearl city':   'oahu',
    'aiea':         'oahu',
    'mililani':     'oahu',
    'kapolei':      'oahu',
    'ewa beach':    'oahu',
    "ewa":          'oahu',
    'haleiwa':      'oahu',
    'waipahu':      'oahu',
    'hawaii kai':   'oahu',
    'manoa':        'oahu',
    'nuuanu':       'oahu',
    'kaimuki':      'oahu',
    'moiliili':     'oahu',
    'makiki':       'oahu',
    'palolo':       'oahu',
    'aina haina':   'oahu',
    'niu valley':   'oahu',
    'kahala':       'oahu',
    'diamond head': 'oahu',
    'waimanalo':    'oahu',
    'laie':         'oahu',
    'hauula':       'oahu',
    'pupukea':      'oahu',
    'sunset beach': 'oahu',
    'north shore':  'oahu',
    'mililani town': 'oahu',
    'kalihi':       'oahu',
    'liliha':       'oahu',
    'salt lake':    'oahu',
    'moanalua':     'oahu',
    'pearl harbor': 'oahu',
    'ewa gentry':   'oahu',
    'ko olina':     'oahu',
    "ko 'olina":    'oahu',
    'kapalama':     'oahu',

    # Kauai
    'lihue':        'kauai',
    "līhu'e":       'kauai',
    'kapaa':        'kauai',
    "kapa'a":       'kauai',
    'hanalei':      'kauai',
    'princeville':  'kauai',
    'poipu':        'kauai',
    "po'ipū":       'kauai',
    'koloa':        'kauai',
    'hanapepe':     'kauai',
    'eleele':       'kauai',
    "'ele'ele":     'kauai',
    'kalaheo':      'kauai',
    'lawai':        'kauai',
    'anahola':      'kauai',
    'kilauea':      'kauai',   # note: Kilauea Kauai, not Big Island volcano
    'waimea':       'kauai',   # note: Waimea Kauai — BUT see below
    'waipouli':     'kauai',
    'kealia':       'kauai',
    'omao':         'kauai',
    'puhi':         'kauai',
    'nawiliwili':   'kauai',

    # Molokai
    'kaunakakai':   'molokai',
    'hoolehua':     'molokai',
    "ho'olehua":    'molokai',
    'maunaloa':     'molokai',
    'kualapuu':     'molokai',
    "kuala'pu'u":   'molokai',
    'halawa':       'molokai',
    'pukoo':        'molokai',
    'kamalo':       'molokai',

    # Big Island (explicit, to fix records already misassigned)
    'hilo':         'big_island',
    'kailua-kona':  'big_island',
    'kona':         'big_island',
    'waimea':       'big_island',  # will be overridden per-row by full city check
    'captain cook': 'big_island',
    'pahoa':        'big_island',
    'holualoa':     'big_island',
    'hawi':         'big_island',
    'honokaa':      'big_island',
    'volcano':      'big_island',
    'waikoloa':     'big_island',
    'keaau':        'big_island',
    'ocean view':   'big_island',
    'kapaau':       'big_island',
    'kawaihae':     'big_island',
    'na alehu':     'big_island',
    'milolii':      'big_island',
    'kealakekua':   'big_island',
    'mountain view': 'big_island',
    'kurtistown':   'big_island',
    'pepeekeo':     'big_island',
    'papaikou':     'big_island',
    'laupahoehoe':  'big_island',
    'ninole':       'big_island',
    'pahala':       'big_island',
    'naalehu':      'big_island',
    'discovery harbor': 'big_island',
    'ocean view':   'big_island',
    'hookena':      'big_island',
    'honaunau':     'big_island',
    'kailua kona':  'big_island',
    'keauhou':      'big_island',
}

# Ambiguous cities that we skip (could be multiple islands) — "kailua" can
# be Oahu or Big Island; "waimea" can be Kauai or Big Island.
# We resolve these by checking the address or leaving as-is.
AMBIGUOUS_CITIES = {'kailua', 'waimea', 'kilauea'}


def city_to_island(city: str, address: str | None) -> str | None:
    """Return the island slug for a city, or None if ambiguous/unknown."""
    if not city:
        return None
    city_lc = city.strip().lower()

    # Disambiguate kailua: if address has "Kona" or city is "Kailua-Kona" → Big Island
    if 'kailua' in city_lc:
        if 'kona' in city_lc or 'kona' in (address or '').lower():
            return 'big_island'
        # plain "Kailua" with no Kona indicator → assume Oahu
        return 'oahu'

    # Disambiguate waimea: address or city with "HI 96796" or Kauai streets → kauai
    if 'waimea' in city_lc:
        addr_lc = (address or '').lower()
        if 'kauai' in addr_lc or '96796' in addr_lc:
            return 'kauai'
        # Default to Big Island (more listings there)
        return 'big_island'

    # Kilauea: if address has Kauai zip codes (967xx range for Kauai is 96701–96769)
    if 'kilauea' in city_lc:
        addr_lc = (address or '').lower()
        if 'kauai' in addr_lc:
            return 'kauai'
        return 'big_island'

    return CITY_TO_ISLAND.get(city_lc)


# ── Helpers ────────────────────────────────────────────────────────────────────

def fetch_all(table: str) -> list[dict]:
    rows, offset = [], 0
    while True:
        res = (
            client.table(table)
            .select('id,name,modalities,city,address,island,status')
            .eq('status', 'draft')
            .range(offset, offset + 999)
            .execute()
        )
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    return rows


# ── Main ───────────────────────────────────────────────────────────────────────

def run(dry_run: bool, pass1: bool, pass2: bool):
    stats = {
        'p_deleted': 0, 'c_deleted': 0,
        'p_island_fixed': 0, 'c_island_fixed': 0,
        'md_flagged': 0,
    }
    md_review_list: list[dict] = []

    # ── PASS 1: Remove conventional medicine ──────────────────────────────────
    if pass1:
        print('\n━━━ PASS 1: Removing conventional medicine listings ━━━')
        for table, stat_key in [('practitioners', 'p_deleted'), ('centers', 'c_deleted')]:
            rows = fetch_all(table)
            print(f'  Scanning {len(rows)} draft {table}…')
            for row in rows:
                name = row.get('name', '')
                mods = row.get('modalities') or []

                if is_conventional(name, mods):
                    if dry_run:
                        print(f'    [dry-run] DELETE {table}: {name!r}')
                    else:
                        try:
                            client.table(table).delete().eq('id', row['id']).execute()
                            print(f'    DELETED {table}: {name!r}')
                            stats[stat_key] += 1
                        except Exception as e:
                            print(f'    ERROR deleting {name!r}: {e}')
                    if dry_run:
                        stats[stat_key] += 1

                elif is_md_candidate(name, mods):
                    md_review_list.append({
                        'table': table,
                        'id': row['id'],
                        'name': name,
                        'city': row.get('city', ''),
                        'island': row.get('island', ''),
                    })
                    stats['md_flagged'] += 1

    # ── PASS 2: Fix island assignments ────────────────────────────────────────
    if pass2:
        print('\n━━━ PASS 2: Fixing island assignments based on city ━━━')
        for table, stat_key in [('practitioners', 'p_island_fixed'), ('centers', 'c_island_fixed')]:
            rows = fetch_all(table)
            print(f'  Scanning {len(rows)} draft {table}…')
            for row in rows:
                correct = city_to_island(row.get('city') or '', row.get('address'))
                if correct and correct != row.get('island'):
                    name = row['name']
                    old = row.get('island', '?')
                    if dry_run:
                        print(f'    [dry-run] FIX island {table}: {name!r}  {old} → {correct}')
                    else:
                        try:
                            client.table(table).update({'island': correct}).eq('id', row['id']).execute()
                            print(f'    FIXED {table}: {name!r}  {old} → {correct}')
                            stats[stat_key] += 1
                        except Exception as e:
                            print(f'    ERROR fixing island for {name!r}: {e}')
                    if dry_run:
                        stats[stat_key] += 1

    # ── Summary ───────────────────────────────────────────────────────────────
    print('\n━━━ SUMMARY ━━━')
    if dry_run:
        print('  (dry-run — no changes made)')
    print(f"  Practitioners deleted (conventional medicine): {stats['p_deleted']}")
    print(f"  Centers deleted (conventional medicine):       {stats['c_deleted']}")
    print(f"  Practitioner island fixes:                     {stats['p_island_fixed']}")
    print(f"  Center island fixes:                           {stats['c_island_fixed']}")
    print(f"  MD listings flagged for manual review:         {stats['md_flagged']}")

    if md_review_list:
        print('\n━━━ MDs FOR YOUR REVIEW (not auto-deleted) ━━━')
        print('  Search these names in the admin panel and delete the ones that are')
        print('  purely conventional doctors (no holistic practice).\n')
        for r in md_review_list:
            print(f"  [{r['table']}] {r['name']!r}  —  {r['city']} ({r['island']})")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Remove conventional medicine and fix island assignments')
    parser.add_argument('--dry-run',     action='store_true', help='Preview only, no DB writes')
    parser.add_argument('--pass1-only',  action='store_true', help='Only remove conventional medicine')
    parser.add_argument('--pass2-only',  action='store_true', help='Only fix island assignments')
    args = parser.parse_args()

    do_pass1 = not args.pass2_only
    do_pass2 = not args.pass1_only

    run(dry_run=args.dry_run, pass1=do_pass1, pass2=do_pass2)
