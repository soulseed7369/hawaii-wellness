"""
26_extract_names.py
───────────────────
Parse first_name / last_name from existing practitioner `name` fields.

The Google Maps pipeline often writes business names like
  "Jane Doe, LMT"
  "Dr. Sarah Nakamura, ND"
  "Healing Touch Massage – Kona"
  "John Smith Acupuncture"
into the `name` column.  This script attempts to extract the personal name
portion and writes first_name / last_name when confident enough.

Strategy (in order of confidence):
  1. JSON-LD Person on their website   (if already enriched — reads existing data)
  2. Format: "<Name>, <Credentials>"   — high confidence
  3. Format: "Dr. / Mr. / Ms. <Name>"  — high confidence
  4. Name ends after N words before modality/business keyword  — medium
  5. Two-word name with no business keywords                   — medium
  6. Anything else                                             — skip (low confidence)

Only writes to rows where first_name IS NULL.
Never overwrites existing first_name values.

Output:
    pipeline/output/name_extractions.jsonl

Usage:
    cd pipeline
    python scripts/26_extract_names.py [--island big_island] [--dry-run]
    python scripts/26_extract_names.py --island all --apply
"""

from __future__ import annotations
import sys, json, re, argparse
from pathlib import Path

sys.path.insert(0, '.')
from src.config import OUTPUT_DIR, ISLAND_TOWN_LISTS, BIG_ISLAND_TOWNS
from src.supabase_client import client

# ── Credential / title patterns ───────────────────────────────────────────────

TITLE_PREFIX_RE = re.compile(
    r"^(?:Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?|Rev\.?|Haku|Kahuna)\s+",
    re.IGNORECASE
)

CREDENTIAL_SUFFIXES_RE = re.compile(
    r"\b(PhD|Ph\.D\.?|MD|M\.D\.?|DO|DC|ND|RN|RN-BC|LMT|LAc|L\.Ac\.|"
    r"LCSW|LMFT|LMHC|MFT|MHC|LPCC|"
    r"RYT[-\s]?\d*|E-RYT[-\s]?\d*|CYT|RCYT|RPYT|YTT[-\s]?\d*|"
    r"CPC|NTP|RDN|LD|OTR|OTR/L|PT|DPT|CHt|CBP|CST|SEP|"
    r"EMDR|Dipl\.?\s*Ac\.?|Dipl\.?\s*OM|"
    r"M\.?S\.?|MA|MBA|MPH|MDiv|BS|BA|BScN|"
    r"CNC|CHN|FNLP|AFMCP|IFMCP|"
    r"Board\s+Certified|Board-Certified|"
    r"III|IV|Jr\.?|Sr\.?)\b[,.]?",
    re.IGNORECASE
)

# Business keywords that indicate the name field is NOT a personal name
BUSINESS_KEYWORDS = [
    # Wellness / health modality words
    "acupuncture", "acupuncturist", "massage", "therapy", "therapist", "therapeutic",
    "chiropractic", "chiropractor", "yoga", "studio", "healing", "healer",
    "wellness", "health", "holistic", "integrative", "naturopath", "naturopathic",
    "reiki", "energy", "meditation", "breathwork", "nutrition", "nutritionist",
    "counseling", "counselor", "psychotherapy", "psychotherapist",
    "ayurveda", "ayurvedic", "herbalist", "herbal", "osteopath", "osteopathic",
    "physical therapy", "physio", "bodywork", "craniosacral", "somatic",
    "lomilomi", "lomi", "hawaiian", "sound", "singing", "bowl", "doula",
    "midwife", "midwifery", "coaching", "coach", "hypno", "hypnotherapy",
    # Business structure words
    "center", "centre", "clinic", "institute", "practice", "associates",
    "group", "collective", "sanctuary", "retreat", "spa", "studio", "school",
    "services", "solutions", "care", "healing arts", "arts", "works",
    "hawaii", "kona", "hilo", "maui", "oahu", "kauai", "aloha", "island",
    # Additional business/descriptor words missed in v1
    "medicine", "medical", "functional", "integrative",
    "beauty", "lounge", "luxe", "lux", "fit", "fitness",
    "journey", "journeys", "path", "way", "ways",
    "training", "trained", "certified",
    # Punctuation that indicates a business composite name
    " & ", " and ", " + ",
]

# Characters/patterns that clearly indicate non-personal name
BUSINESS_NAME_RE = re.compile(
    r"(?:"
    r"[&+]"                       # ampersand or plus
    r"|\b(?:LLC|Inc\.?|Ltd\.?|Co\.?|Corp\.?|DBA)\b"  # legal entities
    r"|\b(?:center|centre|clinic|studio|spa|institute|retreat|sanctuary|"
    r"collective|associates|group|services|practice|hawaii|aloha)\b"
    r")",
    re.IGNORECASE
)

# Common Hawaiian / Polynesian name prefixes (should be kept together)
HAWAIIAN_NAME_PREFIXES = {"Koa", "Kai", "Koa", "Liko", "Manu", "Nalu", "Pono",
                           "Hoku", "Lani", "Mele", "Keola", "Kekoa", "Kahale"}

# Words that are never valid as a first name — articles, prepositions, etc.
INVALID_FIRST_WORDS = frozenset({
    "The", "A", "An", "My", "Our", "Your",
    "New", "All", "One", "Big", "True", "Pure",
    "Holy", "Sacred", "Best", "Happy", "Healthy",
    "Trained", "Certified", "Licensed",
})

# Words that are never valid anywhere inside a personal name
INVALID_NAME_WORDS = frozenset({
    "By", "And", "Or", "For", "Of", "In", "At", "To",
    "With", "From", "On",
})


# ── Core parsing ──────────────────────────────────────────────────────────────

def _strip_after_dash(name: str) -> str:
    """Remove everything after ' – ', ' - ', ' | ' (business location suffixes)."""
    for sep in [" – ", " — ", " | ", " · "]:
        if sep in name:
            name = name.split(sep)[0].strip()
    return name


def _strip_location_suffix(name: str) -> str:
    """Remove common location/branding suffixes."""
    suffixes_re = re.compile(
        r",?\s*(?:Big Island|Kona|Hilo|Waimea|Maui|Oahu|Kauai|Hawaii|HI|Honolulu|"
        r"Lahaina|Kihei|Kapaa|Lihue|Princeville|Hanalei|Poipu)\b.*$",
        re.IGNORECASE
    )
    return suffixes_re.sub("", name).strip()


def parse_personal_name(raw_name: str) -> tuple[str, str, float] | None:
    """
    Return (first_name, last_name, confidence) or None if we can't extract
    a personal name with enough confidence.

    confidence: 0.0–1.0
      0.90+  = very confident (credential suffix or title prefix pattern)
      0.70   = medium (2-word name, no business keywords)
      <0.70  = don't write
    """
    name = raw_name.strip()

    # Pre-clean: strip location/dash suffixes
    name = _strip_after_dash(name)
    name = _strip_location_suffix(name)

    # If it looks like a business name, bail early
    if BUSINESS_NAME_RE.search(name):
        return None

    # Check for business keywords in lower-case
    name_lower = name.lower()
    if any(bk in name_lower for bk in BUSINESS_KEYWORDS):
        return None

    # ── HIGH CONFIDENCE: "Name, Credentials" ────────────────────────────────
    # e.g. "Jane Doe, LMT, RYT-200"
    comma_split = name.split(",", 1)
    if len(comma_split) == 2:
        candidate, rest = comma_split[0].strip(), comma_split[1].strip()
        # Check if everything after the comma looks like credentials
        cleaned_rest = CREDENTIAL_SUFFIXES_RE.sub("", rest).strip().strip(",").strip()
        if len(cleaned_rest) <= 3:  # Only credentials/spaces left after stripping
            parts = candidate.split()
            if 2 <= len(parts) <= 3:
                return parts[0], " ".join(parts[1:]), 0.92

    # ── HIGH CONFIDENCE: Title prefix ─────────────────────────────────────
    # e.g. "Dr. Sarah Nakamura"
    title_m = TITLE_PREFIX_RE.match(name)
    if title_m:
        remainder = name[title_m.end():].strip()
        # Remove any trailing credentials
        remainder = CREDENTIAL_SUFFIXES_RE.sub("", remainder).strip().strip(",")
        parts = remainder.split()
        if 2 <= len(parts) <= 3:
            return parts[0], " ".join(parts[1:]), 0.90

    # ── MEDIUM CONFIDENCE: plain "FirstName LastName" ──────────────────────
    # Strip any trailing credentials first
    cleaned = CREDENTIAL_SUFFIXES_RE.sub("", name).strip().strip(",").strip()
    parts = cleaned.split()

    # Exactly 2 or 3 parts (handles middle names / hyphenated)
    if 2 <= len(parts) <= 3:
        # Reject articles, prepositions, and descriptor words as first names
        if parts[0] in INVALID_FIRST_WORDS:
            return None
        # Reject any part that is a preposition/conjunction (e.g. "By", "And")
        if any(p in INVALID_NAME_WORDS for p in parts):
            return None
        # Validate all parts look like name components (capitalized, letters only)
        valid = all(
            re.match(r"^[A-ZÀ-Ö][a-zà-ö]+(?:-[A-ZÀ-Ö][a-zà-ö]+)?$", p)
            for p in parts
        )
        if valid:
            return parts[0], " ".join(parts[1:]), 0.72

    return None


# ── DB helpers ────────────────────────────────────────────────────────────────

ALL_ISLANDS = ["big_island", "maui", "oahu", "kauai"]


def fetch_practitioners_needing_names(island: str) -> list[dict]:
    """Return practitioners where first_name IS NULL."""
    records = []
    page_size, offset = 1000, 0
    while True:
        q = (
            client.table("practitioners")
            .select("id, name, first_name, last_name, website_url, island")
            .is_("first_name", "null")
        )
        if island != "all":
            q = q.eq("island", island)
        resp = q.range(offset, offset + page_size - 1).execute()
        batch = resp.data or []
        records.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--island", default="big_island",
                        choices=ALL_ISLANDS + ["all"])
    parser.add_argument("--dry-run", action="store_true",
                        help="Print results but don't write anything")
    parser.add_argument("--apply", action="store_true",
                        help="Apply extracted names to DB immediately")
    parser.add_argument("--min-confidence", type=float, default=0.70,
                        help="Minimum confidence threshold (default: 0.70)")
    args = parser.parse_args()

    out_path = OUTPUT_DIR / "name_extractions.jsonl"

    print(f"\n[26] Fetching practitioners with null first_name (island={args.island})…")
    records = fetch_practitioners_needing_names(args.island)
    print(f"[26] {len(records)} practitioners to process\n")

    results: list[dict] = []
    parsed = skipped = low_conf = 0

    for rec in records:
        raw = rec.get("name", "").strip()
        result = parse_personal_name(raw)

        if result is None:
            skipped += 1
            continue

        first, last, conf = result
        if conf < args.min_confidence:
            low_conf += 1
            continue

        print(f"  {'[DRY] ' if args.dry_run else ''}  {raw!r:<50} → {first!r} {last!r}  ({conf:.2f})")

        results.append({
            "_db_id":     rec["id"],
            "_db_table":  "practitioners",
            "_raw_name":  raw,
            "_confidence": conf,
            "first_name": first,
            "last_name":  last,
        })
        parsed += 1

    if not args.dry_run and results:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            for r in results:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"\n[26] Saved {len(results)} name extractions → {out_path}")

    if args.apply and results and not args.dry_run:
        print("\n[26] Applying to DB…")
        applied = 0
        for r in results:
            db_id = r["_db_id"]
            patch = {"first_name": r["first_name"], "last_name": r["last_name"]}
            try:
                client.table("practitioners").update(patch).eq("id", db_id).execute()
                applied += 1
            except Exception as e:
                print(f"  DB error for {r['_raw_name']}: {e}")
        print(f"[26] Applied {applied} name records")

    mode = "[DRY RUN] " if args.dry_run else ""
    total = parsed + skipped + low_conf
    print(f"\n{mode}── Summary ────────────────────────────────────────────────")
    print(f"  {parsed:>4}  names extracted   ({args.min_confidence:.0%}+ confidence)")
    print(f"  {low_conf:>4}  low confidence    (below {args.min_confidence:.0%}, skipped)")
    print(f"  {skipped:>4}  business names    (could not identify personal name)")
    print(f"  {total:>4}  total processed")
    if not args.dry_run and parsed and not args.apply:
        print(f"\n  Review → {out_path}")
        print("  Run with --apply to write to DB.")
