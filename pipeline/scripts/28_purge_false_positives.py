"""
28_purge_false_positives.py
───────────────────────────
Deletes clearly non-wellness draft listings from the DB.

Targets ONLY records that are:
  - status = 'draft'
  - modalities = ['Alternative Therapy']   (never re-classified away from default)
  - Match at least one HARD non-wellness signal in name or bio/description

Hard signals are phrases that only appear in non-wellness businesses.
We do NOT delete on soft signals (e.g. "garden", "farm") since those can be
legitimate wellness providers (herb farms, retreat centers in gardens, etc.).

Usage:
    cd pipeline
    python scripts/28_purge_false_positives.py --island kauai        # dry-run
    python scripts/28_purge_false_positives.py --island kauai --apply
    python scripts/28_purge_false_positives.py --apply               # all islands
    python scripts/28_purge_false_positives.py --island kauai --verbose --apply
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

PIPELINE_DIR = Path(__file__).parent.parent
OUTPUT_DIR   = PIPELINE_DIR / "output"
ISLANDS      = ["big_island", "maui", "oahu", "kauai"]

# ── Non-wellness signal patterns ──────────────────────────────────────────────
# Each entry: (label, pattern_list)
# A listing matches if ANY pattern in ANY group hits the name OR bio.
# We use substring matching on lowercased text.

NON_WELLNESS_BIO_PHRASES = [
    # Retail / commerce
    ("retail",          ["retail chain", "retail store", "shopping center", "shopping mall",
                          "shopping destination", "boutiques, gift shops", "boutiques and gift",
                          "shops and restaurants", "gift shops & restaurants",
                          "jewelry, surf", "clothing & gift", "50 stores",
                          "grocery store", "supermarket", "hardware store",
                          "farm supply", "farm supplies", "feed store", "feed & supply",
                          "bookstore", "book store", "booksellers"]),
    # Tourist attractions
    ("attraction",      ["lighthouse", "pier built", "bayside dock", "lookout point",
                          "panoramic views of the surrounding valley",
                          "sweeping, panoramic views", "national wildlife refuge",
                          "state wilderness park", "arboretum", "historic site",
                          "plantation-era village", "circa-1913", "19th century",
                          "forest reserve", "nature reserve", "national forest",
                          "botanical garden", "nature conservancy"]),
    # Food & beverage — NOTE: avoid bare "dining" since retreat centers say "dining options"
    ("food_bev",        ["restaurant", "eatery", "dining options", "fine dining", "café", "coffee roaster",
                          "rum distillery", "distillery", "juice bar",
                          "chocolate tours", "tasting tours", "luau",
                          "polynesian buffet", "traditional feasting"]),
    # Adventure / outdoor recreation
    ("adventure",       ["zip line", "tubing in canals", "adventure outfit",
                          "backcountry adventures", "surf academy", "surf school",
                          "surfing lessons", "surf lessons", "surf instructor",
                          "learn to surf", "surf camp", "surfing camp",
                          "kayak tour", "snorkel tour",
                          "snorkeling tour", "whale watching", "eco tour",
                          "helicopter tour", "boat tour", "horseback riding tours", "ziplining"]),
    # Nurseries / landscaping
    ("nursery",         ["nursery offers", "landscaping services", "exotic plants",
                          "flowering trees & shrubs", "common & exotic plants",
                          "orchid varieties", "ground cover & sod",
                          "nursery for unique palms"]),
    # Arts / galleries / entertainment (non-healing)
    ("entertainment",   ["tv & radio station", "live educational experiences for kids",
                          "art gallery", "art galleries", "fine art gallery",
                          "gallery kauai", "gallery hawaii",
                          "surf, clothing & gift", "storybook theatre",
                          "wedding photography", "tropical weddings",
                          "south shore weddings", "aloha weddings",
                          "wedding planning", "wedding venue", "wedding coordinator",
                          "wedding and event", "wedding services", "bridal services",
                          "dance studio", "dance academy", "dance school",
                          "dance lessons", "dance classes", "performing arts school",
                          "ballet company", "ballet school", "ballet academy",
                          "ballet classes", "ballet studio"]),
    # Non-healing religious / civic
    ("civic",           ["coworking space", "coworking", "humane society",
                          "spectrum store", "internet provider",
                          "real estate", "property management", "law firm",
                          "legal services", "attorney at law", "insurance services",
                          "auto repair", "auto detailing", "car repair",
                          "cleaning services", "janitorial", "maid service",
                          "united way", "hospitality association", "trade association",
                          "industry association", "chamber of commerce",
                          "construction company", "general contractor", "building contractor",
                          "construction services", "roofing", "electrical contractor"]),
    # Ranch / stable / farm tours (non-herbal)
    ("ranch",           ["country stables", "horseback riding", "ranch tours",
                          "jurassic", "ranch kauai", "cjm stables"]),
    # Cannabis / dispensary
    ("cannabis",        ["cannabis dispensary", "marijuana dispensary", "recreational cannabis",
                          "shop cannabis", "cannabis products", "cannabis store"]),
    # Senior care / assisted living (not wellness practitioners)
    ("senior_care",     ["senior care", "assisted living", "memory care",
                          "senior living facility", "elder care facility",
                          "senior housing", "retirement community"]),
    # Hair / nail / beauty salons
    ("beauty_salon",    ["hair salon", "nail salon", "beauty salon", "hair cutting",
                          "haircuts and styling", "barber shop", "nail studio"]),
    # Conventional medicine (not functional/holistic)
    ("conventional_med", ["family medicine", "primary care physician", "general practitioner",
                           "family doctor", "internal medicine clinic", "urgent care clinic",
                           "emergency room", "hospital services", "dental office",
                           "dental clinic", "general dentistry", "cosmetic dentistry",
                           "teeth whitening services", "orthodontics", "oral surgery"]),
    # Religious venues
    ("religious",       ["church services", "sunday services", "worship services",
                          "congregation", "parish", "diocese", "chapel services",
                          "christian fellowship", "evangelical", "baptist church",
                          "catholic church", "protestant church"]),
    # Surfing schools / camps
    ("surf_school",     ["surf school", "surf academy", "surf camp", "surfing school",
                          "surfing academy", "surfing camp", "learn to surf",
                          "surf instructor certification", "surf coaching"]),
]

# Name-level signals: if name alone matches, it's definitely not wellness.
# Used only when bio is empty/short.
NON_WELLNESS_NAME_PATTERNS = [
    # Big-box retail
    r"\btarget\b",
    r"\bsubway\b",
    r"\bwalmart\b",
    r"\bcostco\b",
    r"\bhome depot\b",
    # Surf shops / schools (not wellness)
    r"surf (co|academy|shop|hawaii|school|lesson|camp)\b",
    r"surf co\.?\b",
    r"\bsurfing\b.*(school|academy|camp|lesson|class)",
    r"(learn to surf|surf instructor)",
    # Landmarks / attractions
    r"\blighthouse\b",
    r"\bpier\b",
    r"\blookout\b",
    r"national park",
    r"state park",
    r"wildlife refuge",
    r"\barboretum\b",
    r"forest reserve",
    r"nature reserve",
    r"(national|state) forest",
    # Shopping
    r"shopping (center|village|mall)\b",
    # Landscaping / nursery
    r"\bnursery\b",
    r"& landscaping",
    # Food / beverage
    r"\broastery\b",
    r"chocolate tours?",
    r"\bcatering\b",
    r"food truck",
    # Farm supplies / feed stores
    r"farm (supply|supplies|store)",
    r"feed (store|supply|& supply|and supply)",
    # Books / retail shops (non-wellness)
    r"native books",
    r"book(store|s) (hawaii|kauai|maui|oahu)",
    r"native hawaiian books",
    # Adventure / tours
    r"backcountry adventures?",
    r"(eco|snorkel|kayak|whale)[- ]?tours?",
    r"adventure tours?",
    r"helicopter tours?",
    # Civic / services
    r"humane society",
    r"\bcoworking\b",
    r"united way",
    r"hospitality association",
    r"(trade|industry|business|hospitality|tourism) association",
    r"chamber of commerce",
    # Weddings / events
    r"\bweddings?\b",
    r"wedding (planning|venue|coordinator|services|company|studio)",
    r"bridal (studio|boutique|services)",
    r"destination (weddings?|wedding)",
    # Dance / performing arts
    r"dance (studio|academy|school|classes?|company|center|hawaii)",
    r"destination dance",
    r"performing arts (school|academy|center|studio)",
    r"\bballet\b.*(studio|school|academy|company|hawaii|center|classes?)",
    r"(hawaii|honolulu|maui|kauai).*(ballet|dance academy|dance school)",
    # Churches / chapels (religious venues, not wellness centers)
    r"\bchapel\b",
    r"\bchurch\b",
    r"\bcathedral\b",
    r"\bparish\b",
    r"\bcongregation\b",
    r"(baptist|methodist|lutheran|presbyterian|episcopal|evangelical|catholic) (church|fellowship)",
    # Dentists / dental offices
    r"\bdental (clinic|office|center|group|care|associates|studio)\b",
    r"\bdentistry\b",
    r"\bdentist\b",
    r"\borders?\b",  # sometimes listed as "dental"
    r"orthodont(ic|ics|ist)",
    r"oral (surgery|surgeon|health center)",
    r"\bperiodon",
    r"endodont",
    r"(family|cosmetic|general) dentist",
    # Conventional medicine (not holistic)
    r"family (medicine|practice|doctor|physician|clinic)",
    r"primary care (clinic|center|physician)",
    r"(internal medicine|general practice) clinic",
    r"urgent care (clinic|center)",
    # Bootcamp (fitness bootcamp, not wellness — be careful: avoid "yoga bootcamp" etc.)
    r"(military|fitness|workout|crossfit|hiit) bootcamp",
    r"bootcamp (hawaii|fitness|training|gym)\b",
    r"\bbootcamp (kauai|maui|oahu|big island|hilo|kona)\b",
    # Construction / trades
    r"construction (co|company|group|services|hawaii|llc|inc)\b",
    r"general (contractor|contracting)",
    r"(roofing|plumbing|electrical|hvac) (contractor|services|company|hawaii)",
    r"\bbuilders?\b.*(hawaii|group|inc|llc|construction)",
    # Cannabis
    r"\bdispensary\b",
    r"\bcannabis\b",
    r"\bmarijuana\b",
    # Equestrian (exclude therapeutic horsemanship — that's a real wellness modality)
    r"(?<!therapeutic )\bhorsemanship\b(?! of hawaii| therapy| program)",
    r"(horse|equestrian) (center|ranch|academy|club)(?! therapy| program)",
    # Hair / beauty
    r"hair (salon|studio|bar)",
    r"nail (salon|spa|bar|studio)",
    r"barber ?shop",
    # Legal / finance / real estate
    r"law (firm|office|group|center)",
    r"\battorneys?\b",
    r"real estate",
    r"\binsurance\b",
    # Trades
    r"\bplumbing\b",
    r"auto (repair|detailing|body|shop)",
    r"cleaning (services?|company|crew)",
    # Tattoo / nightlife
    r"tattoo\b",
    r"\bluau\b",
    r"\bnightclub\b",
    r"\bbar & grill\b",
    # Ocean / water sports (not therapy)
    r"yacht (charter|tours?|rental)",
    r"boat (charter|tours?|rental)",
    r"(catamaran|sailboat) (tours?|charter)",
    r"electric foil",
    r"\bfoiling\b",
    r"beach tours?",
    r"ocean tours?",
    r"snorkel(ing)? tours?",
    r"surf (lessons?|tours?|rental)",
    # Talent / entertainment
    r"talent agency",
    r"talent management",
    r"\bshowcase\b.*talent",
    r"entertainment agency",
    # Gardens / conservation (non-wellness)
    r"nature conservancy",
    r"botanical garden",
    r"botanical gardens",
    r"(national|state) (garden|park|monument|forest)",
    r"arboretum",
    r"wildlife (sanctuary|refuge|center)",
    # Shows / performances
    r"\bshows?\b.*(luau|polynesian|dinner|hawaii)",
    r"(dinner|luau|polynesian) show",
    # Pest control / home services
    r"pest control",
    r"(termite|rodent) (control|treatment)",
    r"\blandscap(ing|er)\b",
    # Financial / business services
    r"\baccounting\b",
    r"(cpa|certified public accountant)",
    r"financial (planning|advisor|services)",
    r"mortgage",
    r"\bbankrupt",
    # Retail / food
    r"grocery",
    r"(convenience|liquor) store",
    r"food (truck|delivery|catering)",
    r"\bdeli\b",
    r"\bpizza\b",
    r"\bbakery\b",
    # Associations (non-wellness orgs)
    r"(hotel|hospitality|restaurant|retail|tourism|construction|real estate) association",
    r"(employers|business|industry|trade) association",
    r"(hawaii|hawaii state|statewide) association of\b",
]

_NAME_PATS = [re.compile(p, re.IGNORECASE) for p in NON_WELLNESS_NAME_PATTERNS]


def hits_bio(text: str) -> list[str]:
    """Return list of signal labels matched in bio/description text."""
    if not text:
        return []
    t = text.lower()
    matched = []
    for label, phrases in NON_WELLNESS_BIO_PHRASES:
        for phrase in phrases:
            if phrase in t:
                matched.append(f"{label}:{phrase}")
                break
    return matched


def hits_name(name: str) -> list[str]:
    """Return list of pattern strings matched in listing name."""
    matched = []
    for pat in _NAME_PATS:
        if pat.search(name):
            matched.append(pat.pattern)
    return matched


# ── Main ──────────────────────────────────────────────────────────────────────

def run(island: str | None, apply: bool, verbose: bool):
    import sys; sys.path.insert(0, str(PIPELINE_DIR))
    from src.supabase_client import client

    islands = [island] if island else ISLANDS
    total_flagged = 0
    total_deleted = 0
    log_rows = []

    for isl in islands:
        print(f"\n{'='*60}")
        print(f"  Island: {isl}")
        print(f"{'='*60}")

        for table in ["practitioners", "centers"]:
            bio_col = "bio" if table == "practitioners" else "description"

            r = (client.table(table)
                 .select(f"id, name, {bio_col}, modalities, website_url")
                 .eq("island", isl)
                 .eq("status", "draft")
                 .execute())
            rows = r.data

            # Target 1: never-classified alt-therapy defaults
            alt_rows = [x for x in rows if x.get("modalities") == ["Alternative Therapy"]]

            # Target 2: Dentistry-only listings (dentistry is not a wellness modality we support)
            dentistry_rows = [x for x in rows
                              if x.get("modalities") == ["Dentistry"]
                              or x.get("modalities") == ["Dentistry", "Alternative Therapy"]
                              or x.get("modalities") == ["Alternative Therapy", "Dentistry"]]

            target_rows = list({r["id"]: r for r in alt_rows + dentistry_rows}.values())

            flagged = []
            for rec in target_rows:
                name = rec.get("name", "") or ""
                bio  = rec.get(bio_col, "") or ""

                bio_signals  = hits_bio(bio)
                name_signals = hits_name(name)  # always check name, regardless of bio
                signals = bio_signals + name_signals

                if signals:
                    flagged.append({
                        "id":      rec["id"],
                        "name":    name,
                        "bio":     bio[:120],
                        "signals": signals,
                        "table":   table,
                        "island":  isl,
                    })

            print(f"\n  [{table}]  {len(alt_rows)} alt-only + {len(dentistry_rows)} dentistry drafts ({len(target_rows)} total) → {len(flagged)} flagged for deletion")

            for rec in flagged:
                total_flagged += 1
                log_rows.append(rec)
                if verbose or not apply:
                    print(f"    ✗ {rec['name'][:50]}")
                    print(f"      signals: {rec['signals']}")
                    if rec['bio']:
                        print(f"      bio:     {rec['bio'][:100]}")

            if apply and flagged:
                ids = [r["id"] for r in flagged]
                # Delete in batches of 50
                for i in range(0, len(ids), 50):
                    batch = ids[i:i+50]
                    client.table(table).delete().in_("id", batch).execute()
                total_deleted += len(flagged)
                print(f"    Deleted {len(flagged)} records.")

    print(f"\n{'='*60}")
    if apply:
        print(f"  DONE — deleted {total_deleted} false-positive draft listings")
    else:
        print(f"  DRY RUN — would delete {total_flagged} listings (pass --apply to confirm)")
    print(f"{'='*60}\n")

    # Save log
    OUTPUT_DIR.mkdir(exist_ok=True)
    log_path = OUTPUT_DIR / "purge_false_positives.jsonl"
    with open(log_path, "w") as f:
        for row in log_rows:
            f.write(json.dumps(row) + "\n")
    print(f"  Log saved → {log_path}")


def main():
    parser = argparse.ArgumentParser(description="Purge non-wellness false positives from draft listings")
    parser.add_argument("--island",  choices=ISLANDS, help="Limit to one island")
    parser.add_argument("--apply",   action="store_true", help="Actually delete (default: dry-run)")
    parser.add_argument("--verbose", action="store_true", help="Show all flagged records")
    args = parser.parse_args()

    run(args.island, args.apply, args.verbose)


if __name__ == "__main__":
    main()
