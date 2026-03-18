"""
24_wellness_filter.py
─────────────────────
Smart wellness/non-wellness classifier for directory cleanup.

Learned from Big Island and Maui audits. Uses a multi-signal approach:
  1. Definitive NON-wellness business type keywords in name (precise, no false positives)
  2. Wellness SIGNAL scoring from modalities + name keywords
  3. Confidence threshold — only deletes high-confidence non-wellness

Usage:
    cd pipeline
    python scripts/24_wellness_filter.py --chunk-file output/oahu_chunk_0.jsonl --apply
    python scripts/24_wellness_filter.py --chunk-file output/oahu_chunk_0.jsonl --dry-run
"""

from __future__ import annotations
import sys, json, re, argparse
from pathlib import Path

sys.path.insert(0, ".")
from src.supabase_client import client

# ── Definitive non-wellness: these exact business types should never appear ───
# Designed to avoid false positives (no bare "coach", "salon", "spa" — those
# appear in legitimate wellness business names).

NON_WELLNESS_EXACT = [
    # Retail chains
    "bath & body works", "bath and body works",
    "costco", "walmart", "target", "cvs pharmacy", "walgreens",
    "office depot", "mattress firm", "ashley furniture",
    "home depot", "lowe's", "best buy", "petco", "petsmart",
    "dollar tree", "family dollar",
    "coach store", "coach outlet",                      # Coach the brand, not coach the person
    "victoria's secret", "gap store", "old navy",
    "gnc store", "vitamin shoppe",                      # GNC/VS as stores (not practitioners)
    # Hotels & resorts
    "marriott resort", "marriott hotel", "marriott waikiki",
    "hilton hotel", "hilton resort", "hilton waikiki",
    "hyatt regency", "hyatt place",
    "westin resort", "westin hotel",
    "sheraton hotel", "sheraton resort",
    "ritz-carlton", "ritz carlton",
    "four seasons",
    "outrigger resort", "outrigger hotel",
    "disney aulani", "aulani disney",
    "moana surfrider",
    "royal hawaiian",
    "halekulani",
    "hotel moana",
    # Fast food / restaurants
    "mcdonald's", "mcdonalds", "subway restaurant",
    "starbucks coffee", "domino's pizza",
    # Non-wellness services
    "tile factory", "tile company",
    "mattress store", "mattress shop",
    "construction company", "construction llc",
    "remodeling company",
    "car rental", "auto rental",
    "pest control",
    "cleaning service", "cleaning company",
    "funeral home", "mortuary",
    "law firm", "law office", "attorneys at law",
    "accounting firm", "tax service",
    "insurance agency",
    "real estate agency",
    "locksmith",
    "plumbing",
    "electrical contractor",
]

# ── Keyword GROUPS in name that signal non-wellness (whole-word match) ────────
# Each tuple: (pattern, description)
NON_WELLNESS_PATTERNS: list[tuple[re.Pattern, str]] = [
    # Retail/commercial
    (re.compile(r'\bretail\b', re.I),              "retail"),
    (re.compile(r'\bsupermarket\b', re.I),         "supermarket"),
    (re.compile(r'\bgrocery\b', re.I),             "grocery"),
    (re.compile(r'\bpharmacy\b', re.I),            "pharmacy"),
    (re.compile(r'\bdrug\s*store\b', re.I),        "drugstore"),
    (re.compile(r'\boptical\b', re.I),             "optical"),
    # Hospitality (but not wellness retreat/spa)
    (re.compile(r'\b(hotel|motel|inn\b|hostel)\b', re.I), "hotel"),
    (re.compile(r'\bresort\s+&\s+spa\b', re.I),   "resort spa"),
    (re.compile(r'\bresort\s+spa\b', re.I),        "resort spa"),
    # Services clearly outside wellness
    (re.compile(r'\btattoo\b', re.I),              "tattoo"),
    (re.compile(r'\bpiercing\b', re.I),            "piercing"),
    (re.compile(r'\bbarber\s*shop\b', re.I),       "barbershop"),
    (re.compile(r'\bhair\s*salon\b', re.I),        "hair salon"),
    (re.compile(r'\bnail\s*salon\b', re.I),        "nail salon"),
    (re.compile(r'\bwedding\b', re.I),             "wedding"),
    (re.compile(r'\bbridal\b', re.I),              "bridal"),
    (re.compile(r'\bflori(st|shop)\b', re.I),      "florist"),
    (re.compile(r'\bdog\s*training\b', re.I),      "dog training"),
    (re.compile(r'\bvet(erinar)?\b', re.I),        "veterinary"),
    (re.compile(r'\bpet\s*(clinic|hospital|care)\b', re.I), "pet care"),
    (re.compile(r'\b(condo(minium)?|apartment)\b', re.I), "condo"),
    (re.compile(r'\breal\s*estate\b', re.I),       "real estate"),
    (re.compile(r'\blocksmith\b', re.I),           "locksmith"),
    (re.compile(r'\bplumb(ing|er)\b', re.I),       "plumbing"),
    (re.compile(r'\belectri(c(al)?|cian)\b', re.I),"electrical"),
    (re.compile(r'\bpest\s*control\b', re.I),      "pest control"),
    (re.compile(r'\bfuneral\b', re.I),             "funeral"),
    (re.compile(r'\bmortuary\b', re.I),            "mortuary"),
    (re.compile(r'\btire\s*(center|shop|store)\b', re.I), "tire shop"),
    (re.compile(r'\bauto\s*(repair|shop|service|body)\b', re.I), "auto repair"),
    (re.compile(r'\bcar\s*wash\b', re.I),          "car wash"),
    (re.compile(r'\bphotograph(y|er)\b', re.I),    "photography"),
    (re.compile(r'\bprint(ing|shop)\b', re.I),     "print shop"),
    (re.compile(r'\boffice\s*supply\b', re.I),     "office supply"),
    (re.compile(r'\bstapl(es|e\s*store)\b', re.I),"staples"),
    (re.compile(r'\bpool\s*(supply|service)\b', re.I), "pool supply"),
    (re.compile(r'\btile\s*(factory|shop|store)\b', re.I), "tile store"),
    (re.compile(r'\bcarpet\b', re.I),              "carpet"),
    (re.compile(r'\bfurniture\b', re.I),           "furniture"),
    (re.compile(r'\bappliance\b', re.I),           "appliance"),
    (re.compile(r'\bjewel(ry|er)\b', re.I),        "jewelry"),
    (re.compile(r'\bclothing\s*store\b', re.I),    "clothing store"),
    (re.compile(r'\buniform\s*(store|shop)\b', re.I), "uniform store"),
]

# ── Wellness signals in name (any one = probably keep) ────────────────────────
WELLNESS_NAME_SIGNALS = re.compile(
    r'\b(wellness|healing|therapy|therapist|healer|holistic|integrative|'
    r'massage|yoga|pilates|meditation|reiki|acupuncture|acupunct|chiropractic|'
    r'chiropractor|naturopath|naturopathic|ayurved|nutrition|nutritionist|'
    r'dietitian|physical\s*therapy|hypnotherapy|hypnosis|counseling|counselor|'
    r'psycholog|psychotherap|psychiatr|somatic|breathwork|sound\s*bath|'
    r'sound\s*heal|lomi|lomilomi|doula|midwife|midwifery|osteopath|'
    r'functional\s*medicine|energy\s*heal|reiki|herbali|craniosacral|'
    r'coach(ing)?|fitness|personal\s*train|life\s*coach|health\s*coach|'
    r'wellness\s*coach|mind(ful|body)|spirit(ual|uality)|sacred|'
    r'iv\s*therapy|iv\s*drip|longevity|biohack|'
    r'dr\.|md|lac|lmt|lcsw|lmft|lmhc|dpt|nd|dc|pa-c|cnm|rdn|rn|'
    r'clinic|center|institute|practice|office|studio)\b',
    re.I
)

# ── Canonical wellness modalities (if ANY are present, strong keep signal) ───
WELLNESS_MODALITIES = {
    'Acupuncture', 'Alternative Therapy', 'Art Therapy', 'Astrology', 'Ayurveda',
    'Birth Doula', 'Breathwork', 'Chiropractic', 'Counseling', 'Craniosacral',
    'Dentistry', 'Energy Healing', 'Family Constellation', 'Fitness',
    'Functional Medicine', 'Hawaiian Healing', 'Herbalism', 'Hypnotherapy',
    'IV Therapy', 'Life Coaching', 'Lomilomi / Hawaiian Healing', 'Longevity',
    'Massage', 'Meditation', 'Midwife', 'Nature Therapy', 'Naturopathic',
    'Nervous System Regulation', 'Network Chiropractic', 'Nutrition',
    'Osteopathic', 'Physical Therapy', 'Psychic', 'Psychotherapy', 'Reiki',
    'Ritualist', 'Somatic Therapy', 'Soul Guidance', 'Sound Healing',
    'TCM (Traditional Chinese Medicine)', 'Trauma-Informed Care',
    'Watsu / Water Therapy', "Women's Health", 'Yoga',
}

# Modalities that are assigned too broadly and don't count as a strong signal
WEAK_MODALITIES = {'Alternative Therapy'}


def classify(rec: dict) -> tuple[str, str]:
    """
    Returns ('keep'|'remove', reason).
    """
    name  = rec.get('name', '') or ''
    mods  = set(rec.get('modalities') or [])
    bio   = rec.get('_bio', '') or ''

    name_lower = name.lower().strip()

    # 1. Strong wellness signals → always keep
    strong_mods = mods - WEAK_MODALITIES
    if strong_mods:
        return 'keep', f"has_modalities:{','.join(list(strong_mods)[:2])}"

    if WELLNESS_NAME_SIGNALS.search(name):
        return 'keep', 'wellness_name_signal'

    if WELLNESS_NAME_SIGNALS.search(bio[:200]):
        return 'keep', 'wellness_bio_signal'

    # 2. Exact match non-wellness business names
    for exact in NON_WELLNESS_EXACT:
        if exact in name_lower:
            return 'remove', f"exact_match:{exact}"

    # 3. Pattern match non-wellness keywords in name
    for pattern, label in NON_WELLNESS_PATTERNS:
        if pattern.search(name):
            return 'remove', f"pattern:{label}"

    # 4. No modalities AND no wellness signal in name/bio → flag as uncertain
    # Only remove if confidence is high (exact/pattern match above)
    # Otherwise: keep (admin can review)
    return 'keep', 'no_signal_but_no_clear_exclusion'


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--chunk-file', required=True, type=Path)
    parser.add_argument('--apply',   action='store_true',
                        help='Delete confirmed non-wellness rows from DB')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    records = [json.loads(l) for l in args.chunk_file.read_text().splitlines() if l.strip()]
    total = len(records)

    keep_list   = []
    remove_list = []

    for rec in records:
        action, reason = classify(rec)
        rec['_action'] = action
        rec['_reason'] = reason
        if action == 'remove':
            remove_list.append(rec)
        else:
            keep_list.append(rec)

    print(f"\n[24] {args.chunk_file.name}: {total} listings")
    print(f"  KEEP:   {len(keep_list)}")
    print(f"  REMOVE: {len(remove_list)}")
    print()

    # Show what will be removed
    for rec in remove_list:
        print(f"  ✗ [{rec['_table'][:4]}] {rec['name'][:55]:<55} → {rec['_reason']}")

    if args.apply and not args.dry_run:
        deleted = 0
        for rec in remove_list:
            try:
                client.table(rec['_table']).delete().eq('id', rec['id']).execute()
                deleted += 1
            except Exception as e:
                print(f"  DB error deleting {rec['name']}: {e}")
        print(f"\n[24] Deleted {deleted} non-wellness listings from DB.")

    # Save results
    out = args.chunk_file.with_name(args.chunk_file.stem + '_classified.jsonl')
    with open(out, 'w') as f:
        for r in records:
            f.write(json.dumps({k: v for k, v in r.items() if not k.startswith('_bio')}) + '\n')
    print(f"[24] Results → {out}")
