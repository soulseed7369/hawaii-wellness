"""
22p_parallel_enrich.py
──────────────────────
Parallel version of 22_website_enrich.py.
Uses ThreadPoolExecutor to crawl multiple listings concurrently.

Default: 8 workers (adjust with --workers).
With 8 workers and ~2s per listing, 2000 listings ≈ 8 minutes.

Usage:
    cd pipeline
    python scripts/22p_parallel_enrich.py --island oahu --apply
    python scripts/22p_parallel_enrich.py --island oahu --workers 12 --apply
    python scripts/22p_parallel_enrich.py --island oahu --status all --apply
    python scripts/22p_parallel_enrich.py --island oahu --dry-run
"""

from __future__ import annotations
import sys, json, time, argparse, threading, datetime, importlib.util
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, ".")
from src.config import OUTPUT_DIR
from src.supabase_client import client

# Load the original script as a module without executing __main__
_spec = importlib.util.spec_from_file_location(
    "enrich22",
    Path(__file__).parent / "22_website_enrich.py",
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)  # type: ignore[union-attr]

crawl_listing  = _mod.crawl_listing
fetch_listings = _mod.fetch_listings
normalise_url  = _mod.normalise_url

# ── Progress tracking ──────────────────────────────────────────────────────────

_lock       = threading.Lock()
_done_count = 0
_total      = 0
_ok         = 0
_skipped    = 0
_errors     = 0
_start_time = time.time()


def _log(symbol: str, name: str, url: str, fields: list[str] | None = None) -> None:
    global _done_count, _ok, _skipped, _errors
    elapsed = time.time() - _start_time
    rate    = _done_count / elapsed if elapsed > 0 else 0
    eta_s   = int((_total - _done_count) / rate) if rate > 0 else 0
    eta     = f"{eta_s // 60}m{eta_s % 60:02d}s"
    suffix  = f"✓ {fields}" if fields else ("enriched_at only" if symbol == "-" else "ERROR")
    print(
        f"  [{_done_count}/{_total}] {name[:44]:<44} {url[:30]:<30} {symbol} {suffix}"
        f"  | rate={rate:.1f}/s  ETA={eta}",
        flush=True,
    )


def process_one(rec: dict, apply: bool, score_leads: bool) -> dict | None:
    """Crawl one listing, apply to DB immediately if --apply, return result dict."""
    global _done_count, _ok, _skipped, _errors
    name = rec.get("name", "?")
    url  = normalise_url(rec.get("website_url", "")) or "(no website)"

    try:
        patch = crawl_listing(rec, score_leads=score_leads)
    except Exception as e:
        with _lock:
            _done_count += 1
            _errors     += 1
            _log("✗", name, url)
        print(f"     ↳ {e}", flush=True)
        return None

    if patch is None:
        patch = {"enriched_at": datetime.datetime.utcnow().isoformat() + "Z"}

    content_fields = [k for k in patch if not k.startswith("_") and k != "enriched_at"]

    result = {
        "_db_id":    rec["id"],
        "_db_table": rec["_table"],
        "_name":     name,
        "_url":      url,
        **patch,
    }

    # Apply to DB immediately (don't wait until the end)
    if apply:
        db_patch = {k: v for k, v in result.items() if not k.startswith("_")}
        try:
            client.table(rec["_table"]).update(db_patch).eq("id", rec["id"]).execute()
        except Exception as e:
            print(f"  DB error for {name}: {e}", flush=True)

    with _lock:
        _done_count += 1
        if content_fields:
            _ok += 1
            _log("✓", name, url, content_fields)
        else:
            _skipped += 1
            _log("-", name, url)

    return result


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--island",  default="oahu",
                        choices=["big_island", "maui", "oahu", "kauai"])
    parser.add_argument("--status",  default="published",
                        choices=["published", "draft", "all"])
    parser.add_argument("--limit",   type=int, default=0)
    parser.add_argument("--workers", type=int, default=8,
                        help="Number of parallel crawl workers (default: 8)")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply",   action="store_true",
                        help="Write enrichments to DB in real-time as each listing is processed")
    parser.add_argument("--score-leads", action="store_true")
    parser.add_argument("--out",     type=Path,
                        default=OUTPUT_DIR / "website_enrichments_oahu.jsonl",
                        help="Output JSONL path")
    args = parser.parse_args()

    print(f"\n[22p] Fetching {args.status} Oahu listings needing enrichment…")
    listings = fetch_listings(args.island, args.status,
                              include_no_website=args.score_leads)
    print(f"[22p] {len(listings)} listings to crawl  |  {args.workers} workers\n")

    if args.limit:
        listings = listings[:args.limit]
        print(f"[22p] Limited to {args.limit}\n")

    _total = len(listings)
    _start_time = time.time()
    results: list[dict] = []

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(process_one, rec, args.apply and not args.dry_run, args.score_leads): rec
            for rec in listings
        }
        for fut in as_completed(futures):
            r = fut.result()
            if r is not None:
                with _lock:
                    results.append(r)

    # Save JSONL
    if not args.dry_run and results:
        with open(args.out, "w") as f:
            for r in results:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"\n[22p] Saved {len(results)} records → {args.out}")

    elapsed = time.time() - _start_time
    print(f"\n── Summary ─────────────────────────────────────────────")
    print(f"  {_ok:>4}  enriched   {_skipped:>4}  nothing new   {_errors:>4}  errors")
    print(f"  Elapsed: {int(elapsed // 60)}m{int(elapsed % 60):02d}s")
    if not args.dry_run and _ok and not args.apply:
        print(f"\n  Review → {args.out}")
        print("  Re-run with --apply to write to DB.")
