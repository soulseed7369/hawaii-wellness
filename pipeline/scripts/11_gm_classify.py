"""
11_gm_classify.py
─────────────────
Convert raw Google Maps Place Detail records (gm_raw.jsonl) into the JSONL
schema used by the existing pipeline.

New in this version:
  - Confidence scoring per field (modality, type, bio) stored in _confidence
  - Bio extracted from editorial summary with fallback to type-based stub
  - _review_flags list highlights fields admins should check
  - _bio_source indicates where the bio came from

Output:
    pipeline/output/gm_classified.jsonl

Usage:
    cd pipeline
    python scripts/11_gm_classify.py [--min-ratings 0]
"""

from __future__ import annotations
import sys, json, re, argparse
from pathlib import Path

sys.path.insert(0, '.')
from src.config import OUTPUT_DIR, BIG_ISLAND_TOWNS, ISLAND_TOWN_LISTS

# ── Island detection ───────────────────────────────────────────────────────────
_CITY_TO_ISLAND: dict[str, str] = {}
for _island, _towns in ISLAND_TOWN_LISTS.items():
    for _town in _towns:
        _CITY_TO_ISLAND[_town.lower()] = _island
for _town in BIG_ISLAND_TOWNS:
    _CITY_TO_ISLAND[_town.lower()] = "big_island"


def detect_island(city: str, fallback: str) -> str:
    return _CITY_TO_ISLAND.get(city.lower().strip(), fallback)


# ── Canonical modalities ──────────────────────────────────────────────────────
MODALITIES = [
    'Acupuncture', 'Alternative Therapy', 'Astrology', 'Ayurveda',
    'Bioenergetics', 'Birth Doula', 'Breathwork', 'Chiropractic', 'Counseling',
    'Craniosacral', 'Dentistry', 'Energy Healing', 'Functional Medicine',
    'Gestalt Therapy', 'Herbalism', 'Hypnotherapy', 'Life Coaching',
    'Lomilomi / Hawaiian Healing', 'Luminous Practitioner', 'Massage',
    'Meditation', 'Midwife', 'Nature Therapy', 'Naturopathic',
    'Nervous System Regulation', 'Network Chiropractic', 'Nutrition',
    'Osteopathic', 'Physical Therapy', 'Psychotherapy', 'Reiki',
    'Somatic Therapy', 'Soul Guidance', 'Sound Healing',
    'TCM (Traditional Chinese Medicine)', 'Trauma-Informed Care',
    'Watsu / Water Therapy', 'Yoga',
]

TYPE_TO_MODALITIES: dict[str, list[str]] = {
    "spa":            ["Massage"],
    "beauty_salon":   ["Massage"],
    "physiotherapist":["Physical Therapy"],
    "gym":            ["Yoga"],
    "yoga_studio":    ["Yoga"],
    "chiropractor":   ["Chiropractic"],
    "dentist":        ["Dentistry"],
    "doctor":         [],
    "health":         [],
    "point_of_interest": [],
    "establishment":  [],
}

NAME_KEYWORDS: list[tuple[str, str]] = [
    ("acupunct",         "Acupuncture"),
    ("acupressure",      "Acupuncture"),
    ("tcm",              "TCM (Traditional Chinese Medicine)"),
    ("chinese medicine", "TCM (Traditional Chinese Medicine)"),
    ("ayurved",          "Ayurveda"),
    ("massage",          "Massage"),
    ("lomi",             "Massage"),
    ("lomilomi",         "Lomilomi / Hawaiian Healing"),
    ("kahuna",           "Lomilomi / Hawaiian Healing"),
    ("rolfing",          "Somatic Therapy"),
    ("reiki",            "Reiki"),
    ("sound heal",       "Sound Healing"),
    ("sound bath",       "Sound Healing"),
    ("singing bowl",     "Sound Healing"),
    ("breathwork",       "Breathwork"),
    ("breath work",      "Breathwork"),
    ("yoga",             "Yoga"),
    ("pilates",          "Yoga"),
    ("meditation",       "Meditation"),
    ("mindfulness",      "Meditation"),
    ("chiropractic",     "Chiropractic"),
    ("chiropract",       "Chiropractic"),
    ("network chiro",    "Network Chiropractic"),
    ("network spinal",   "Network Chiropractic"),
    ("naturopath",       "Naturopathic"),
    ("functional med",   "Functional Medicine"),
    ("integrative med",  "Functional Medicine"),
    ("nutrition",        "Nutrition"),
    ("nutritionist",     "Nutrition"),
    ("dietitian",        "Nutrition"),
    ("osteopath",        "Osteopathic"),
    ("physical therapy", "Physical Therapy"),
    ("physiotherap",     "Physical Therapy"),
    ("craniosacral",     "Craniosacral"),
    ("cranial sacral",   "Craniosacral"),
    ("somatic",          "Somatic Therapy"),
    ("trauma",           "Trauma-Informed Care"),
    ("emdr",             "Trauma-Informed Care"),
    ("psychotherap",     "Psychotherapy"),
    ("counseling",       "Counseling"),
    ("counsellor",       "Counseling"),
    ("therapist",        "Counseling"),
    ("life coach",       "Life Coaching"),
    ("wellness coach",   "Life Coaching"),
    ("health coach",     "Life Coaching"),
    ("hypno",            "Hypnotherapy"),
    ("energy heal",      "Energy Healing"),
    ("energy work",      "Energy Healing"),
    ("biofield",         "Energy Healing"),
    ("herbali",          "Herbalism"),
    ("herbal ",          "Herbalism"),
    ("doula",            "Birth Doula"),
    ("midwife",          "Midwife"),
    ("midwifer",         "Midwife"),
    ("watsu",            "Watsu / Water Therapy"),
    ("aquatic therapy",  "Watsu / Water Therapy"),
    ("astrology",        "Astrology"),
    ("astrologer",       "Astrology"),
    ("bioenergetic",     "Bioenergetics"),
    ("nervous system",   "Nervous System Regulation"),
    ("polyvagal",        "Nervous System Regulation"),
    ("gestalt",          "Gestalt Therapy"),
    ("soul guid",        "Soul Guidance"),
    ("akashic",          "Soul Guidance"),
    ("dental",           "Dentistry"),
    ("dentist",          "Dentistry"),
    ("nature therapy",   "Nature Therapy"),
    ("ecotherapy",       "Nature Therapy"),
    ("forest bath",      "Nature Therapy"),
    ("spa",              "Massage"),
]

CENTER_TYPES = {"spa", "gym", "yoga_studio", "health", "wellness_center"}
PRACTITIONER_TYPES = {"physiotherapist", "chiropractor", "dentist", "doctor"}
CENTER_NAME_KEYWORDS = [
    "center", "centre", "studio", "clinic", "spa", "wellness",
    "institute", "school", "collective", "sanctuary", "retreat",
    "holistic", "integrative", "associates", "group", "practice",
]


# ── Inference ─────────────────────────────────────────────────────────────────

def infer_modalities(name: str, types: list[str]) -> tuple[list[str], float]:
    """Return (modalities, confidence 0–1)."""
    found = set()
    name_lower = name.lower()
    kw_hits = 0

    for kw, modality in NAME_KEYWORDS:
        if kw in name_lower:
            found.add(modality)
            kw_hits += 1

    for t in types:
        for m in TYPE_TO_MODALITIES.get(t, []):
            found.add(m)

    valid = [m for m in MODALITIES if m in found]

    if not valid:
        valid = ["Alternative Therapy"]
        confidence = 0.25
    elif kw_hits >= 2:
        confidence = 0.95
    elif kw_hits == 1:
        confidence = 0.75
    else:
        # only type-based
        confidence = 0.55

    return valid, confidence


def classify_type(name: str, types: list[str]) -> tuple[str, float]:
    """Return (type, confidence 0–1)."""
    name_lower = name.lower()
    type_match = any(t in CENTER_TYPES for t in types)
    prac_match  = any(t in PRACTITIONER_TYPES for t in types)
    name_match  = any(kw in name_lower for kw in CENTER_NAME_KEYWORDS)

    if type_match and name_match:
        return "center", 0.95
    if type_match:
        return "center", 0.80
    if prac_match:
        return "practitioner", 0.85
    if name_match:
        return "center", 0.70
    return "practitioner", 0.55


def extract_bio(raw: dict, name: str, listing_type: str,
                modalities: list[str]) -> tuple[str | None, str, float]:
    """Return (bio_text, source, confidence)."""
    # Best: Google editorial summary
    editorial = (raw.get("editorial_summary") or {}).get("overview", "").strip()
    if editorial and len(editorial) > 20:
        return editorial, "google_editorial", 0.90

    # Fallback: generate a minimal stub from classification so bio is never null
    if modalities and modalities != ["Alternative Therapy"]:
        mod_str = " and ".join(modalities[:2])
        if listing_type == "center":
            stub = (f"{name} is a wellness center in Hawaii offering "
                    f"{mod_str} services.")
        else:
            stub = (f"{name} is a {mod_str} practitioner based in Hawaii.")
        return stub, "generated_stub", 0.30

    return None, "none", 0.0


def normalize_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("1") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) > 10:
        digits = digits[-10:]  # handle extensions
    return digits if len(digits) == 10 else raw


def extract_city_from_address(address: str) -> str:
    parts = [p.strip() for p in address.split(",")]
    return parts[-2] if len(parts) >= 2 else ""


def build_review_flags(rec: dict, mod_conf: float, type_conf: float,
                       bio_conf: float) -> list[str]:
    flags = []
    if mod_conf < 0.50:
        flags.append("low_modality_confidence")
    if type_conf < 0.65:
        flags.append("uncertain_listing_type")
    if bio_conf < 0.35:
        flags.append("missing_bio")
    if not rec.get("email"):
        flags.append("missing_email")
    if not rec.get("phone"):
        flags.append("missing_phone")
    if not rec.get("website_url"):
        flags.append("missing_website")
    return flags


def convert(raw: dict) -> dict | None:
    name    = raw.get("name", "").strip()
    types   = raw.get("types", [])
    address = raw.get("formatted_address", "")
    island  = raw.get("island", "big_island")

    city   = raw.get("_city") or extract_city_from_address(address)
    island = detect_island(city, island)

    if raw.get("business_status") == "PERMANENTLY_CLOSED":
        return None

    phone   = normalize_phone(
        raw.get("formatted_phone_number") or raw.get("international_phone_number")
    )
    website = raw.get("website") or ""
    lat     = raw.get("geometry", {}).get("location", {}).get("lat", 0)
    lng     = raw.get("geometry", {}).get("location", {}).get("lng", 0)

    modalities, mod_conf   = infer_modalities(name, types)
    listing_type, type_conf = classify_type(name, types)
    bio, bio_source, bio_conf = extract_bio(raw, name, listing_type, modalities)

    overall_confidence = round(
        0.5 * mod_conf + 0.3 * type_conf + 0.2 * bio_conf, 3
    )

    review_flags = build_review_flags(
        {"email": None, "phone": phone, "website_url": website},
        mod_conf, type_conf, bio_conf
    )

    return {
        # ── Core listing fields ──────────────────────────────────────────────
        "name":                 name,
        "phone":                phone,
        "email":                None,
        "address":              address,
        "city":                 city,
        "website_url":          website,
        "bio":                  bio,
        "modalities":           modalities,
        "island":               island,
        "status":               "draft",
        "tier":                 "free",
        "owner_id":             None,
        "external_booking_url": None,
        "accepts_new_clients":  True,
        "lat":                  lat,
        "lng":                  lng,
        # ── Pipeline metadata (prefixed _) ──────────────────────────────────
        "_listing_type":  listing_type,
        "_place_id":      raw.get("place_id"),
        "_google_types":  types,
        "_rating":        raw.get("rating"),
        "_rating_count":  raw.get("user_ratings_total", 0),
        "_source_query":  raw.get("source_query", ""),
        "_bio_source":    bio_source,
        # ── Confidence scores ────────────────────────────────────────────────
        "_confidence": {
            "modality": round(mod_conf, 2),
            "type":     round(type_conf, 2),
            "bio":      round(bio_conf, 2),
            "overall":  overall_confidence,
        },
        "_review_flags":  review_flags,
        # Legacy field kept for backward compat with downstream scripts
        "confidence":     overall_confidence,
        "image_candidates":  [],
        "local_image_path":  None,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-ratings", type=int, default=0)
    args = parser.parse_args()

    raw_path = OUTPUT_DIR / "gm_raw.jsonl"
    out_path = OUTPUT_DIR / "gm_classified.jsonl"

    if not raw_path.exists():
        print(f"Error: {raw_path} not found. Run 10_gm_details.py first.")
        sys.exit(1)

    practitioners, centers, skipped = [], [], 0
    low_confidence = 0

    with open(raw_path) as f:
        for line in f:
            raw = json.loads(line)
            rec = convert(raw)
            if rec is None:
                skipped += 1
                continue
            if (rec.get("_rating_count") or 0) < args.min_ratings:
                skipped += 1
                continue
            if rec["_confidence"]["overall"] < 0.50:
                low_confidence += 1
            if rec["_listing_type"] == "center":
                centers.append(rec)
            else:
                practitioners.append(rec)

    with open(out_path, "w") as f:
        for rec in practitioners + centers:
            f.write(json.dumps(rec) + "\n")

    total = len(practitioners) + len(centers)
    print(f"✓ Classified {len(practitioners)} practitioners + {len(centers)} centers")
    print(f"  {low_confidence}/{total} records have low overall confidence (<0.50) → flagged for Claude review")
    print(f"  Skipped {skipped} (permanently closed or below min-ratings)")
    print(f"  Output → {out_path}")
