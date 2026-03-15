"""
24_normalize_modalities.py
──────────────────────────
Normalize modality values in the live DB to match the canonical list
defined in the frontend (DashboardProfile.tsx / AdminPanel.tsx).

Two types of fixes:
  1. Case fixes    — lowercase/variant spellings of canonical values
                     e.g. 'massage' → 'Massage', 'craniosacral' → 'Craniosacral'
  2. Synonym remaps — non-canonical terms that map to a canonical equivalent
                     e.g. 'Massage Therapist' → 'Massage', 'therapy' → 'Psychotherapy'

Records with modalities that can't be mapped are printed for manual review
but never modified automatically.

Usage:
    cd pipeline

    # Preview — show every fix, no DB writes
    python3 scripts/24_normalize_modalities.py

    # Apply fixes to DB
    python3 scripts/24_normalize_modalities.py --apply

    # Published listings only
    python3 scripts/24_normalize_modalities.py --status published --apply

    # Draft listings only
    python3 scripts/24_normalize_modalities.py --status draft --apply
"""

from __future__ import annotations
import sys, json, argparse
from pathlib import Path
from collections import Counter

sys.path.insert(0, ".")
from src.config import OUTPUT_DIR
from src.supabase_client import client

# ── Canonical list (source of truth = DashboardProfile.tsx / AdminPanel.tsx) ──

CANONICAL = {
    'Acupuncture', 'Alternative Therapy', 'Art Therapy', 'Astrology', 'Ayurveda',
    'Birth Doula', 'Breathwork', 'Chiropractic', 'Counseling',
    'Craniosacral', 'Dentistry', 'Energy Healing', 'Family Constellation',
    'Functional Medicine', 'Hawaiian Healing', 'Herbalism', 'Hypnotherapy',
    'IV Therapy', 'Life Coaching', 'Lomilomi / Hawaiian Healing', 'Longevity',
    'Massage', 'Meditation', 'Midwife', 'Nature Therapy', 'Naturopathic',
    'Nervous System Regulation', 'Network Chiropractic', 'Nutrition',
    'Osteopathic', 'Physical Therapy', 'Psychic', 'Psychotherapy', 'Reiki',
    'Ritualist', 'Somatic Therapy', 'Soul Guidance', 'Sound Healing',
    'TCM (Traditional Chinese Medicine)', 'Trauma-Informed Care',
    'Watsu / Water Therapy', "Women's Health", 'Yoga',
}

# ── Normalization map ─────────────────────────────────────────────────────────
# Key   = value found in DB (exact match, case-sensitive)
# Value = canonical replacement

NORMALIZE: dict[str, str] = {
    # ── Case fixes ─────────────────────────────────────────────────────────────
    'massage':          'Massage',
    'acupuncture':      'Acupuncture',
    'counseling':       'Counseling',
    'chiropractic':     'Chiropractic',
    'craniosacral':     'Craniosacral',
    'reiki':            'Reiki',
    'naturopathic':     'Naturopathic',
    'nutrition':        'Nutrition',
    'yoga':             'Yoga',
    'meditation':       'Meditation',
    'breathwork':       'Breathwork',
    'herbalism':        'Herbalism',

    # ── Synonym remaps ─────────────────────────────────────────────────────────
    'Massage Therapy':        'Massage',
    'Massage Therapist':      'Massage',
    'massage therapy':        'Massage',
    'Wellness Coach':         'Life Coaching',
    'wellness coach':         'Life Coaching',
    'Integrative Healthcare': 'Alternative Therapy',
    'integrative healthcare': 'Alternative Therapy',
    'Psychologist':           'Psychotherapy',
    'psychologist':           'Psychotherapy',
    'therapy':                'Psychotherapy',   # user decision: generic 'therapy' → Psychotherapy
    'Acupuncture Clinic':     'Acupuncture',
    'acupuncture clinic':     'Acupuncture',
    'Longevity Medicine':     'Longevity',
    'longevity':              'Longevity',
}


def normalize_modalities(mods: list[str]) -> tuple[list[str], list[str], list[str]]:
    """
    Returns (normalized_list, changes_made, unmapped_values).
    normalized_list  — the corrected array to write back
    changes_made     — human-readable descriptions of each fix applied
    unmapped_values  — values that are neither canonical nor in NORMALIZE map
    """
    result, changes, unmapped = [], [], []
    seen = set()  # deduplicate within the array

    for m in mods:
        if m in seen:
            changes.append(f"removed duplicate '{m}'")
            continue

        if m in CANONICAL:
            result.append(m)
            seen.add(m)
        elif m in NORMALIZE:
            canonical = NORMALIZE[m]
            if canonical not in seen:
                result.append(canonical)
                seen.add(canonical)
                changes.append(f"'{m}' → '{canonical}'")
            else:
                changes.append(f"removed '{m}' (already have '{canonical}')")
        else:
            # Unknown — keep as-is but flag for review
            result.append(m)
            seen.add(m)
            unmapped.append(m)

    return result, changes, unmapped


ALL_ISLANDS = ["big_island", "maui", "oahu", "kauai"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--status", default="all",
                        choices=["published", "draft", "all"],
                        help="Which listings to normalize (default: all)")
    parser.add_argument("--island", default="all",
                        choices=ALL_ISLANDS + ["all"])
    parser.add_argument("--apply",  action="store_true",
                        help="Write fixes to DB (default: dry-run)")
    args = parser.parse_args()

    islands = ALL_ISLANDS if args.island == "all" else [args.island]

    total_fixed = 0
    total_records = 0
    unmapped_counts: Counter = Counter()
    review_records: list[dict] = []

    for table in ("practitioners", "centers"):
        for island in islands:
            q = client.table(table).select(
                "id, name, modalities, island, status"
            ).eq("island", island).not_.is_("modalities", "null")
            if args.status != "all":
                q = q.eq("status", args.status)
            rows = q.execute().data or []

            for rec in rows:
                mods = rec.get("modalities") or []
                if not mods:
                    continue

                total_records += 1
                normalized, changes, unmapped = normalize_modalities(mods)

                if unmapped:
                    for u in unmapped:
                        unmapped_counts[u] += 1
                    review_records.append({
                        "id":       rec["id"],
                        "name":     rec["name"],
                        "table":    table,
                        "island":   rec.get("island"),
                        "status":   rec.get("status"),
                        "unmapped": unmapped,
                    })

                if changes:
                    total_fixed += 1
                    tag = "APPLY" if args.apply else "DRY"
                    print(f"  [{tag}] {rec['name'][:45]:<45} [{table[:4]}] [{rec.get('status','?')}]")
                    for c in changes:
                        print(f"         {c}")

                    if args.apply:
                        client.table(table).update(
                            {"modalities": normalized}
                        ).eq("id", rec["id"]).execute()

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n── Summary ──────────────────────────────────────")
    print(f"  {total_records:4d}  records scanned")
    print(f"  {total_fixed:4d}  records {'updated' if args.apply else 'would be updated'}")

    if unmapped_counts:
        print(f"\n── Unmapped values (not in canonical list or normalize map) ──")
        print(f"  These were left as-is. Add them to CANONICAL or NORMALIZE in this script.")
        for val, cnt in unmapped_counts.most_common():
            print(f"  {cnt:3d}×  '{val}'")

    # Write review file
    if review_records:
        out = OUTPUT_DIR / "modality_review.jsonl"
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        with open(out, "w") as f:
            for r in review_records:
                f.write(json.dumps(r) + "\n")
        print(f"\n  → {len(review_records)} records with unmapped values saved to modality_review.jsonl")

    if not args.apply:
        print(f"\n  Run with --apply to write changes to DB.")
