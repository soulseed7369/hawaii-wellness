"""
25_db_dedup.py
──────────────
Scan the live Supabase DB for duplicate listings and optionally delete them.

Duplicate signals (any ONE = candidate pair):
  1. Exact normalised phone match
  2. Exact normalised website domain match
  3. Domain-root match (catches subdomain variants on non-generic hosts)
  4. Token-sort fuzzy name match (≥ threshold, same island)

For each duplicate pair the script picks the KEEPER automatically — the record
with the higher completeness score (most non-null fields). If scores are equal,
the older record (earlier created_at) is kept.

Output files (always written):
  db_dupes_auto.jsonl    — pairs where we're confident which to delete (auto-deletable)
  db_dupes_review.jsonl  — near-miss pairs / ambiguous cases for manual review

Flags:
  --island       big_island | maui | oahu | kauai | all  (default: all)
  --threshold    fuzzy name match threshold 0-100         (default: 85)
  --apply        delete the lower-quality record from DB  (default: dry-run)
  --review-only  print review pairs only, skip auto-deletes even with --apply

Usage:
    cd pipeline

    # Preview — see what would be deleted, no DB changes (published + draft)
    python3 scripts/25_db_dedup.py

    # Apply — delete confirmed dupes
    python3 scripts/25_db_dedup.py --apply

    # Single island
    python3 scripts/25_db_dedup.py --island big_island --apply

    # Draft listings only
    python3 scripts/25_db_dedup.py --status draft

    # Both published and draft together (finds cross-status dupes too)
    python3 scripts/25_db_dedup.py --status all --apply

    # Looser fuzzy matching (catches more near-misses)
    python3 scripts/25_db_dedup.py --threshold 80
"""

from __future__ import annotations
import sys, json, re, argparse, unicodedata
from pathlib import Path
from difflib import SequenceMatcher
from datetime import datetime

sys.path.insert(0, ".")
from src.config import OUTPUT_DIR
from src.supabase_client import client

ALL_ISLANDS   = ["big_island", "maui", "oahu", "kauai"]
FUZZY_THRESHOLD = 85

# ── Unicode / text normalisation ──────────────────────────────────────────────

# Map Hawaiian special characters and common curly quotes to ASCII equivalents
# so ʻokina (U+02BB) and right-single-quote don't cause dedup misses.
_UNICODE_MAP = str.maketrans({
    "\u02bb": "'",   # ʻ  Hawaiian okina
    "\u02bc": "'",   # ʼ  modifier letter apostrophe
    "\u2018": "'",   # '  left single quotation mark
    "\u2019": "'",   # '  right single quotation mark
    "\u201c": '"',   # "  left double quotation mark
    "\u201d": '"',   # "  right double quotation mark
    "\u2014": "-",   # —  em dash
    "\u2013": "-",   # –  en dash
})

def ascii_fold(text: str) -> str:
    """Fold Hawaiian special chars + curly quotes to ASCII, then NFC-normalise."""
    text = text.translate(_UNICODE_MAP)
    return unicodedata.normalize("NFC", text)


# ── Normalisation helpers (shared with 12_gm_dedup.py) ───────────────────────

def norm_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = re.split(r"(?i)\s*(x|ext|#)\s*\d", raw)[0]
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("1") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) > 10:
        digits = digits[-10:]
    return digits if len(digits) == 10 else None


def norm_domain(url: str | None) -> str | None:
    if not url:
        return None
    url = url.lower().strip()
    url = re.sub(r"^https?://", "", url)
    url = re.sub(r"^www\.", "", url)
    url = url.rstrip("/").split("?")[0].split("#")[0].split("/")[0]
    return url or None


GENERIC_HOSTS = {
    "squarespace.com", "wixsite.com", "weebly.com", "wordpress.com",
    "godaddysites.com", "site123.me", "strikingly.com", "square.site",
    "psychologytoday.com", "yelp.com", "google.com", "facebook.com",
    "instagram.com", "linkedin.com", "healthgrades.com",
}

def domain_root(domain: str | None) -> str | None:
    if not domain:
        return None
    parts = domain.split(".")
    if len(parts) >= 2:
        root = ".".join(parts[-2:])
        if root in GENERIC_HOSTS:
            return None
        return root
    return domain


TITLE_WORDS = r"\b(llc|inc|ltd|dba|dr\.?|lmt|lcsw|rn|phd|md|lac|daom|dom|lmft|mft|msw|apn|np)\b"

def norm_name(name: str) -> str:
    name = ascii_fold(name).lower()
    name = re.sub(TITLE_WORDS, "", name)
    name = re.sub(r"[^\w\s]", " ", name)
    return re.sub(r"\s+", " ", name).strip()


def token_sort_ratio(a: str, b: str) -> int:
    a_s = " ".join(sorted(norm_name(a).split()))
    b_s = " ".join(sorted(norm_name(b).split()))
    return int(SequenceMatcher(None, a_s, b_s).ratio() * 100)


# ── Field completeness scorer ─────────────────────────────────────────────────

SCORED_FIELDS = [
    "name", "bio", "email", "phone", "website_url", "address",
    "city", "modalities", "avatar_url", "lat", "lng", "session_type",
]

def completeness(rec: dict) -> int:
    score = 0
    for f in SCORED_FIELDS:
        v = rec.get(f)
        if v is None or v == "" or v == [] or v == {}:
            continue
        score += 1
    # Bio quality bonus
    bio = rec.get("bio") or rec.get("description") or ""
    if len(bio.split()) >= 30:
        score += 1
    return score


# ── DB loading ────────────────────────────────────────────────────────────────

def load_all_records(island: str, status_filter: str = "all") -> list[dict]:
    """
    status_filter: 'published' | 'draft' | 'all'
    Defaults to 'all' so cross-status duplicates (e.g. a draft shadowing a
    published record) are caught when running without --status.
    """
    records = []
    for table, bio_col in [("practitioners", "bio"), ("centers", "description")]:
        q = client.table(table).select(
            f"id, name, {bio_col}, email, phone, website_url, address, city, "
            f"modalities, avatar_url, lat, lng, session_type, island, status, created_at"
        ).eq("island", island)
        if status_filter != "all":
            q = q.eq("status", status_filter)
        resp = q.execute()
        for row in (resp.data or []):
            row["_table"] = table
            # Normalise bio field name for completeness scoring
            if bio_col == "description":
                row["bio"] = row.pop("description", None)
            records.append(row)
    return records


# ── Duplicate detection ───────────────────────────────────────────────────────

def find_duplicate_pairs(records: list[dict], threshold: int) -> list[dict]:
    """
    Compare every record against every other record on the same island.
    Returns a list of pair dicts with match metadata.
    Ensures each record only appears in ONE pair (greedy, highest-confidence first).
    """
    # Build lookup indexes for fast O(1) signal checks
    phone_map:  dict[str, list[dict]] = {}
    domain_map: dict[str, list[dict]] = {}
    root_map:   dict[str, list[dict]] = {}

    for rec in records:
        p = norm_phone(rec.get("phone"))
        if p:
            phone_map.setdefault(p, []).append(rec)

        d = norm_domain(rec.get("website_url"))
        if d:
            domain_map.setdefault(d, []).append(rec)
            r = domain_root(d)
            if r:
                root_map.setdefault(r, []).append(rec)

    pairs: list[dict] = []
    seen_ids: set[str] = set()

    def make_pair(a: dict, b: dict, signal: str, confidence: str) -> dict:
        # Always put keeper first (higher completeness, or older if tie)
        score_a = completeness(a)
        score_b = completeness(b)
        if score_a >= score_b:
            keeper, dupe = a, b
        else:
            keeper, dupe = b, a
        return {
            "signal":     signal,
            "confidence": confidence,
            "keeper_id":   keeper["id"],
            "keeper_name": keeper["name"],
            "keeper_table": keeper["_table"],
            "keeper_score": completeness(keeper),
            "dupe_id":    dupe["id"],
            "dupe_name":  dupe["name"],
            "dupe_table": dupe["_table"],
            "dupe_score": completeness(dupe),
            "island":     a.get("island"),
        }

    # 1 & 2. Phone and domain exact matches — high confidence
    for signal, lookup in [("phone_exact", phone_map), ("domain_exact", domain_map)]:
        for key, group in lookup.items():
            if len(group) < 2:
                continue
            # Pair the first occurrence against all others
            a = group[0]
            for b in group[1:]:
                if a["id"] in seen_ids or b["id"] in seen_ids:
                    continue
                pairs.append(make_pair(a, b, f"{signal}:{key}", "high"))
                seen_ids.update([a["id"], b["id"]])

    # 3. Domain-root match — medium confidence
    for root, group in root_map.items():
        if len(group) < 2:
            continue
        a = group[0]
        for b in group[1:]:
            if a["id"] in seen_ids or b["id"] in seen_ids:
                continue
            # Extra check: must be different subdomains, not already caught above
            d_a = norm_domain(a.get("website_url"))
            d_b = norm_domain(b.get("website_url"))
            if d_a == d_b:
                continue   # already caught by domain_exact
            pairs.append(make_pair(a, b, f"domain_root:{root}", "medium"))
            seen_ids.update([a["id"], b["id"]])

    # 4. Fuzzy name match — same island
    # Group by island for efficiency
    by_island: dict[str, list[dict]] = {}
    for rec in records:
        by_island.setdefault(rec.get("island", ""), []).append(rec)

    for island_records in by_island.values():
        n = len(island_records)
        for i in range(n):
            a = island_records[i]
            if a["id"] in seen_ids:
                continue
            best_score, best_b = 0, None
            for j in range(i + 1, n):
                b = island_records[j]
                if b["id"] in seen_ids:
                    continue
                score = token_sort_ratio(a["name"], b["name"])
                if score > best_score:
                    best_score, best_b = score, b

            if best_b is None:
                continue

            if best_score >= threshold:
                pairs.append(make_pair(a, best_b, f"name_fuzzy:{best_score}%", "high"))
                seen_ids.update([a["id"], best_b["id"]])
            elif best_score >= 70:
                # Near-miss — route to review, don't auto-delete
                pairs.append(make_pair(a, best_b, f"name_nearmiss:{best_score}%", "review"))
                seen_ids.update([a["id"], best_b["id"]])

    return pairs


# ── Delete helper ─────────────────────────────────────────────────────────────

def delete_record(table: str, record_id: str) -> bool:
    try:
        client.table(table).delete().eq("id", record_id).execute()
        return True
    except Exception as e:
        print(f"    ✗ delete failed: {e}")
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scan live DB for duplicate listings")
    parser.add_argument("--island",    default="all", choices=ALL_ISLANDS + ["all"])
    parser.add_argument("--status",    default="all",
                        choices=["published", "draft", "all"],
                        help="Which listings to scan (default: all — catches cross-status dupes)")
    parser.add_argument("--threshold", type=int, default=FUZZY_THRESHOLD,
                        help="Fuzzy name match threshold (default 85)")
    parser.add_argument("--apply",       action="store_true",
                        help="Actually delete dupes from DB (default: dry-run)")
    parser.add_argument("--review-only", action="store_true",
                        help="Print review pairs only, skip high-confidence auto-deletes")
    args = parser.parse_args()

    islands = ALL_ISLANDS if args.island == "all" else [args.island]

    auto_pairs:   list[dict] = []
    review_pairs: list[dict] = []

    print(f"Loading DB records (status={args.status})…")
    for island in islands:
        records = load_all_records(island, args.status)
        print(f"  {island}: {len(records)} records")
        pairs = find_duplicate_pairs(records, args.threshold)
        for p in pairs:
            if p["confidence"] == "review":
                review_pairs.append(p)
            else:
                auto_pairs.append(p)

    # ── Write output files ────────────────────────────────────────────────────
    auto_path   = OUTPUT_DIR / "db_dupes_auto.jsonl"
    review_path = OUTPUT_DIR / "db_dupes_review.jsonl"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with open(auto_path, "w") as f:
        for p in auto_pairs:
            f.write(json.dumps(p) + "\n")
    with open(review_path, "w") as f:
        for p in review_pairs:
            f.write(json.dumps(p) + "\n")

    # ── Print report ──────────────────────────────────────────────────────────
    print(f"\n── Duplicate Report {'(DRY RUN — pass --apply to delete)' if not args.apply else '(LIVE)'}  ──")
    print(f"  {len(auto_pairs):>3}  confident duplicates  → db_dupes_auto.jsonl")
    print(f"  {len(review_pairs):>3}  near-misses           → db_dupes_review.jsonl")

    if auto_pairs and not args.review_only:
        print(f"\n── Auto-deletable duplicates ──────────────────────────────────────────")
        deleted = 0
        for p in auto_pairs:
            action = ""
            if args.apply:
                ok = delete_record(p["dupe_table"], p["dupe_id"])
                action = "  ✓ DELETED" if ok else "  ✗ FAILED"
                if ok:
                    deleted += 1
            else:
                action = "  (dry-run)"

            print(
                f"  [{p['signal']}]\n"
                f"    KEEP  ({p['keeper_score']} fields) {p['keeper_name']:40s} [{p['keeper_table']}] {p['keeper_id']}\n"
                f"    DUPE  ({p['dupe_score']} fields) {p['dupe_name']:40s} [{p['dupe_table']}] {p['dupe_id']}{action}\n"
            )
        if args.apply:
            print(f"  Deleted {deleted}/{len(auto_pairs)} duplicate records.")

    if review_pairs:
        print(f"\n── Near-miss pairs (manual review needed) ─────────────────────────────")
        for p in review_pairs:
            print(
                f"  [{p['signal']}]\n"
                f"    A  ({p['keeper_score']} fields) {p['keeper_name']:40s} [{p['keeper_table']}] {p['keeper_id']}\n"
                f"    B  ({p['dupe_score']} fields) {p['dupe_name']:40s} [{p['dupe_table']}] {p['dupe_id']}\n"
            )
        print(f"  → Review these manually in the Admin panel. No automatic action taken.")

    if not auto_pairs and not review_pairs:
        print("\n  ✓ No duplicates found.")
