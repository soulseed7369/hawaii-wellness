"""
12_gm_dedup.py
──────────────
Compare classified Google Maps results against the existing Supabase DB.

Produces three output files:
  gm_new.jsonl          — genuinely new listings (insert as draft)
  gm_enrichments.jsonl  — existing records with blank fields we can fill
  gm_review.jsonl       — edge cases / near-matches for manual review

Matching logic (any ONE signal = duplicate):
  1. Phone number match  (aggressive 10-digit normalisation, handles extensions)
  2. Website domain match (strips protocol/www/trailing slash; subdomain fuzzy)
  3. Token-sort fuzzy name match (>= threshold, same island)

Usage:
    cd pipeline
    python scripts/12_gm_dedup.py [--island big_island] [--threshold 85]
"""

from __future__ import annotations
import sys, json, re, argparse
from pathlib import Path
from difflib import SequenceMatcher

sys.path.insert(0, '.')
from src.config   import OUTPUT_DIR
from src.supabase_client import client

FUZZY_THRESHOLD = 85

# ── Normalisation helpers ──────────────────────────────────────────────────────

def norm_phone(raw: str | None) -> str | None:
    """Aggressive: strips extensions, handles 11-digit with country code,
    takes last 10 digits if too long."""
    if not raw:
        return None
    # Remove everything after 'x', 'ext', '#' (extensions)
    raw = re.split(r'(?i)\s*(x|ext|#)\s*\d', raw)[0]
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("1") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) > 10:
        digits = digits[-10:]
    return digits if len(digits) == 10 else None


def norm_domain(url: str | None) -> str | None:
    """Normalise URL to bare domain (no protocol, no www, no path, no query)."""
    if not url:
        return None
    url = url.lower().strip()
    url = re.sub(r"^https?://", "", url)
    url = re.sub(r"^www\.", "", url)
    url = url.rstrip("/").split("?")[0].split("#")[0].split("/")[0]
    return url or None


def domain_root(domain: str | None) -> str | None:
    """Return the registrable root (e.g. 'yoga.squarespace.com' → 'squarespace.com').
    Skips generic hosting platforms to avoid false positives."""
    if not domain:
        return None
    GENERIC_HOSTS = {
        "squarespace.com", "wixsite.com", "weebly.com", "wordpress.com",
        "godaddysites.com", "site123.me", "strikingly.com",
    }
    parts = domain.split(".")
    if len(parts) >= 2:
        root = ".".join(parts[-2:])
        if root in GENERIC_HOSTS:
            return None   # don't match on generic hosts
        return root
    return domain


def norm_name(name: str) -> str:
    name = name.lower()
    name = re.sub(r"\b(llc|inc|ltd|dba|dr\.?|lmt|lcsw|rn|phd|md|lac|daom|dom)\b", "", name)
    name = re.sub(r"[^\w\s]", " ", name)
    return re.sub(r"\s+", " ", name).strip()


def token_sort_ratio(a: str, b: str) -> int:
    """Token-sort fuzzy ratio: order-independent word matching."""
    a_tokens = sorted(norm_name(a).split())
    b_tokens = sorted(norm_name(b).split())
    a_sorted = " ".join(a_tokens)
    b_sorted = " ".join(b_tokens)
    return int(SequenceMatcher(None, a_sorted, b_sorted).ratio() * 100)


# ── DB loading ────────────────────────────────────────────────────────────────

def load_db_records(island: str) -> list[dict]:
    records = []
    for table in ("practitioners", "centers"):
        resp = client.table(table).select(
            "id, name, phone, website_url, email, address, city, lat, lng, island, status, google_place_id"
        ).eq("island", island).execute()
        for row in (resp.data or []):
            row["_table"] = table
            records.append(row)
    return records


def build_indexes(db_records: list[dict]):
    phones, domains, domain_roots, place_ids = {}, {}, {}, {}
    name_index = {}  # token -> [list of db_record indices]

    for idx, rec in enumerate(db_records):
        # Index by google_place_id (exact match)
        pid = rec.get("google_place_id")
        if pid:
            place_ids[pid] = rec
        # Index by phone
        p = norm_phone(rec.get("phone"))
        if p:
            phones[p] = rec
        # Index by domain
        d = norm_domain(rec.get("website_url"))
        if d:
            domains[d] = rec
            r = domain_root(d)
            if r:
                domain_roots[r] = rec

        # Build inverted name index: token -> [record indices]
        # Tokenize normalized name, keeping only tokens 3+ chars to avoid noise
        name_tokens = norm_name(rec["name"]).split()
        for token in name_tokens:
            if len(token) >= 3:  # minimum 3 chars to avoid noise ("of", "at", "dr", etc.)
                if token not in name_index:
                    name_index[token] = []
                name_index[token].append(idx)

    return phones, domains, domain_roots, place_ids, name_index


# ── Match logic ───────────────────────────────────────────────────────────────

def find_match(gm: dict, db_records: list[dict],
               phone_idx: dict, domain_idx: dict, root_idx: dict, place_idx: dict,
               name_idx: dict,
               threshold: int) -> tuple[dict | None, str]:

    # 0. Google Place ID — perfect exact match
    gm_place_id = gm.get("_place_id")
    if gm_place_id and gm_place_id in place_idx:
        return place_idx[gm_place_id], "place_id_exact"

    # 1. Phone — exact normalised match
    gm_phone = norm_phone(gm.get("phone"))
    if gm_phone and gm_phone in phone_idx:
        return phone_idx[gm_phone], "phone_exact"

    # 2. Domain — exact normalised match
    gm_domain = norm_domain(gm.get("website_url"))
    if gm_domain and gm_domain in domain_idx:
        return domain_idx[gm_domain], "website_exact"

    # 3. Domain root match (catches subdomain variants on non-generic hosts)
    gm_root = domain_root(gm_domain)
    if gm_root and gm_root in root_idx:
        return root_idx[gm_root], "website_root"

    # 4. Token-sort name fuzzy match (same island, token-indexed for speed)
    # OPTIMIZATION: use inverted name_index to reduce fuzzy comparisons from O(N) to O(candidates).
    # Instead of comparing against all db_records, we gather candidates from the index and only
    # fuzzy-match those. For a typical Oahu dataset (2,400 DB × 300 new = 720k comparisons),
    # this reduces to ~2,400 × 5-50 candidates = 12-120k comparisons (60-6000x speedup).
    gm_island = gm.get("island", "big_island")
    gm_tokens = norm_name(gm["name"]).split()

    # Collect candidate record indices by looking up each token in the index
    candidate_indices = set()
    for token in gm_tokens:
        if len(token) >= 3 and token in name_idx:
            candidate_indices.update(name_idx[token])

    # If no candidates found via index, fall back to a small sample scan or skip fuzzy matching
    if not candidate_indices:
        # No name token overlap — fuzzy matching unlikely to succeed, skip
        return None, ""

    # Now only fuzzy-match against candidates that share at least one token
    best_score, best_rec = 0, None
    for idx in candidate_indices:
        rec = db_records[idx]
        if rec.get("island") != gm_island:
            continue
        score = token_sort_ratio(gm["name"], rec["name"])
        if score > best_score:
            best_score, best_rec = score, rec

    if best_score >= threshold:
        return best_rec, f"name_fuzzy({best_score}%)"

    # 5. Near-miss: 70–84% — flag for review rather than silently dropping
    if best_score >= 70 and best_rec:
        return best_rec, f"name_nearmiss({best_score}%)"

    return None, ""


def build_enrichment(gm: dict, db: dict, reason: str) -> dict | None:
    def blank(v):
        return v is None or v == "" or v == 0

    enrichments = {}
    if blank(db.get("phone"))       and gm.get("phone"):
        enrichments["phone"] = gm["phone"]
    if blank(db.get("website_url")) and gm.get("website_url"):
        enrichments["website_url"] = gm["website_url"]
    if blank(db.get("address"))     and gm.get("address"):
        enrichments["address"] = gm["address"]
    if blank(db.get("city"))        and gm.get("city"):
        enrichments["city"] = gm["city"]
    if blank(db.get("lat")) or db.get("lat") == 0:
        if gm.get("lat") and gm["lat"] != 0:
            enrichments["lat"] = gm["lat"]
    if blank(db.get("lng")) or db.get("lng") == 0:
        if gm.get("lng") and gm["lng"] != 0:
            enrichments["lng"] = gm["lng"]
    if not enrichments:
        return None
    return {
        "_db_id":        db["id"],
        "_db_table":     db["_table"],
        "_db_name":      db["name"],
        "_match_reason": reason,
        "_gm_place_id":  gm.get("_place_id"),
        **enrichments,
    }


ALL_ISLANDS = ["big_island", "maui", "oahu", "kauai"]


def run_dedup_for_island(island: str, gm_records: list[dict], threshold: int):
    island_gm = [r for r in gm_records if r.get("island") == island]
    if not island_gm:
        return [], [], [], 0

    db_records = load_db_records(island)
    phone_idx, domain_idx, root_idx, place_idx, name_idx = build_indexes(db_records)
    print(f"  [{island}] {len(db_records)} DB records, {len(island_gm)} GM records")

    new_records, enrichments, review_records = [], [], []

    for gm in island_gm:
        match, reason = find_match(
            gm, db_records, phone_idx, domain_idx, root_idx, place_idx, name_idx, threshold
        )
        if match is None:
            new_records.append(gm)
        elif "nearmiss" in reason:
            # Flag near-misses for human review rather than silently deduping
            review_records.append({
                **gm,
                "_review_reason": reason,
                "_possible_match_name": match.get("name"),
                "_possible_match_id":   match.get("id"),
            })
        else:
            enrich = build_enrichment(gm, match, reason)
            if enrich:
                enrichments.append(enrich)

    skipped = len(island_gm) - len(new_records) - len(enrichments) - len(review_records)
    return new_records, enrichments, review_records, skipped


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--island",    default="big_island",
                        choices=ALL_ISLANDS + ["all"])
    parser.add_argument("--threshold", type=int, default=FUZZY_THRESHOLD)
    args = parser.parse_args()

    classified_path = OUTPUT_DIR / "gm_classified.jsonl"
    if not classified_path.exists():
        print(f"Error: {classified_path} not found. Run 11_gm_classify.py first.")
        sys.exit(1)

    gm_records = []
    with open(classified_path) as f:
        for line in f:
            gm_records.append(json.loads(line))

    islands = ALL_ISLANDS if args.island == "all" else [args.island]
    all_new, all_enrichments, all_review = [], [], []
    total_skipped = 0

    print("Loading DB records…")
    for island in islands:
        new, enrich, review, skipped = run_dedup_for_island(
            island, gm_records, args.threshold
        )
        all_new.extend(new)
        all_enrichments.extend(enrich)
        all_review.extend(review)
        total_skipped += skipped

    for path, records in [
        (OUTPUT_DIR / "gm_new.jsonl",         all_new),
        (OUTPUT_DIR / "gm_enrichments.jsonl", all_enrichments),
        (OUTPUT_DIR / "gm_review.jsonl",      all_review),
    ]:
        with open(path, "w") as f:
            for rec in records:
                f.write(json.dumps(rec) + "\n")

    print(f"\n── Results ───────────────────────────────────────────")
    print(f"  {len(all_new):>4}  new listings         → gm_new.jsonl")
    print(f"  {len(all_enrichments):>4}  enrichable records   → gm_enrichments.jsonl")
    print(f"  {len(all_review):>4}  near-miss review     → gm_review.jsonl")
    print(f"  {total_skipped:>4}  exact duplicates (skipped)")
