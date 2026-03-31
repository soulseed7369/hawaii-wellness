"""
29_llm_filter.py
────────────────
Uses Claude claude-opus-4-6 (via Anthropic API) to intelligently classify remaining
ambiguous draft listings — specifically those with modalities=['Alternative Therapy']
that were NOT caught by the pattern-based purge in script 28.

For each listing, Opus decides:
  WELLNESS   → keep (real holistic/wellness practitioner or center)
  NON_WELLNESS → delete (clearly not wellness)
  UNCERTAIN  → skip (human review needed)

Usage:
    cd pipeline

    # Dry run — classify but don't delete (default)
    python scripts/29_llm_filter.py --island oahu

    # Actually delete NON_WELLNESS results
    python scripts/29_llm_filter.py --island oahu --apply

    # All islands
    python scripts/29_llm_filter.py --apply

    # Set confidence threshold (default 0.85) — only delete if Opus is ≥85% sure
    python scripts/29_llm_filter.py --island oahu --apply --min-confidence 0.90

    # Batch size (default 20 listings per API call)
    python scripts/29_llm_filter.py --island oahu --batch-size 10

    # Limit total listings processed (for testing)
    python scripts/29_llm_filter.py --island oahu --limit 50

Requirements:
    pip install anthropic
    ANTHROPIC_API_KEY must be set in environment or .env
"""
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

PIPELINE_DIR = Path(__file__).parent.parent
OUTPUT_DIR   = PIPELINE_DIR / "output"
ISLANDS      = ["big_island", "maui", "oahu", "kauai"]

# ── Prompt ────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a data quality assistant for Hawaiʻi Wellness, a directory of wellness practitioners and centers in Hawaiʻi.

Your job is to classify whether each listing belongs in a wellness directory.

WELLNESS businesses include: massage therapists, acupuncturists, yoga instructors, meditation teachers, naturopathic doctors, chiropractors, energy healers, reiki practitioners, sound healers, herbalists, nutritionists, life coaches, therapists/counselors, somatic practitioners, functional medicine doctors, Ayurvedic practitioners, hypnotherapists, breathwork facilitators, doulas, midwives, holistic fitness coaches, retreat centers, wellness spas, and similar healing-focused providers.

NON_WELLNESS businesses include: conventional dentists, general practice family doctors, surf schools, dance studios, ballet schools, churches/chapels, wedding planners, art galleries, tour operators, boat/yacht charters, restaurants, retail shops, farm supply stores, bookstores, construction companies, real estate agencies, insurance companies, law firms, hair/nail salons, gyms focused purely on conventional fitness (bootcamps, crossfit), nonprofit associations, nature conservancies, parks/reserves, talent agencies, catering companies, cleaning services, pest control, and similar.

EDGE CASES — classify as WELLNESS:
- Therapeutic riding / equine therapy → WELLNESS
- Forest bathing / nature therapy → WELLNESS
- Art therapy (when used therapeutically) → WELLNESS
- Holistic dentistry / biological dentistry → WELLNESS (rare but valid)
- Dance/movement therapy → WELLNESS
- Fitness + wellness hybrid (e.g. personal training with mind-body focus) → WELLNESS
- Nutrition counseling → WELLNESS
- Hawaiian healing practitioners (lomilomi, la'au lapa'au) → WELLNESS

EDGE CASES — classify as NON_WELLNESS:
- Standard dental offices → NON_WELLNESS
- Surf schools (even if they mention "wellbeing") → NON_WELLNESS
- Ballet/dance studios (unless explicitly therapeutic) → NON_WELLNESS
- Churches/chapels → NON_WELLNESS
- General gyms without wellness focus → NON_WELLNESS

Respond with a JSON array, one object per listing, in the SAME ORDER as the input.
Each object must have exactly these fields:
{
  "id": "<listing id>",
  "verdict": "WELLNESS" | "NON_WELLNESS" | "UNCERTAIN",
  "confidence": 0.0-1.0,
  "reason": "<one sentence explanation>"
}

Be decisive. Only use UNCERTAIN when there is genuinely insufficient information (e.g. name only, no bio, ambiguous business type). When in doubt between WELLNESS and NON_WELLNESS, prefer UNCERTAIN over a wrong deletion."""

USER_PROMPT_TEMPLATE = """Classify the following {n} listings. Return a JSON array with one result per listing in order.

{listings_json}"""


def load_anthropic_client():
    """Load Anthropic client, checking .env if ANTHROPIC_API_KEY not in environment."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        # Try loading from .env and .env.local
        for env_name in [".env", ".env.local"]:
            env_path = PIPELINE_DIR.parent / env_name
            if env_path.exists():
                for line in env_path.read_text().splitlines():
                    if line.startswith("ANTHROPIC_API_KEY="):
                        api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
            if api_key:
                break
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY not found. Set it in your environment or .env file."
        )
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except ImportError:
        raise RuntimeError("anthropic package not installed. Run: pip install anthropic --break-system-packages")


def classify_batch(client, batch: list[dict]) -> list[dict]:
    """Send a batch of listings to Opus for classification. Returns list of verdict dicts."""
    listings_for_prompt = []
    for rec in batch:
        entry = {
            "id": rec["id"],
            "name": rec.get("name", ""),
            "bio": (rec.get("bio") or rec.get("description") or "")[:300],
            "modalities": rec.get("modalities", []),
            "website": rec.get("website_url", "") or "",
        }
        listings_for_prompt.append(entry)

    user_msg = USER_PROMPT_TEMPLATE.format(
        n=len(batch),
        listings_json=json.dumps(listings_for_prompt, indent=2, ensure_ascii=False)
    )

    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}]
    )

    raw = response.content[0].text.strip()

    # Extract JSON array from response (handle markdown code fences)
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    results = json.loads(raw)
    return results


def run(island: str | None, apply: bool, min_confidence: float, batch_size: int, limit: int | None):
    import sys; sys.path.insert(0, str(PIPELINE_DIR))
    from src.supabase_client import client as db

    print("Loading Anthropic client...")
    anthropic_client = load_anthropic_client()
    print("✓ Anthropic API connected")

    islands = [island] if island else ISLANDS
    all_results = []
    total_deleted = 0
    total_kept = 0
    total_uncertain = 0

    for isl in islands:
        print(f"\n{'='*60}")
        print(f"  Island: {isl}")
        print(f"{'='*60}")

        for table in ["practitioners", "centers"]:
            bio_col = "bio" if table == "practitioners" else "description"

            r = (db.table(table)
                 .select(f"id, name, {bio_col}, modalities, website_url")
                 .eq("island", isl)
                 .eq("status", "draft")
                 .execute())
            rows = r.data

            # Target: alt-therapy defaults only (pattern-based pass already ran on these)
            # We skip Dentistry here — those were handled in script 28
            candidates = [x for x in rows if x.get("modalities") == ["Alternative Therapy"]]

            if limit:
                candidates = candidates[:limit]

            print(f"\n  [{table}]  {len(candidates)} alt-therapy drafts to classify")

            if not candidates:
                continue

            # Process in batches
            to_delete = []
            for i in range(0, len(candidates), batch_size):
                batch = candidates[i:i + batch_size]
                batch_num = i // batch_size + 1
                total_batches = (len(candidates) + batch_size - 1) // batch_size
                print(f"    Batch {batch_num}/{total_batches} ({len(batch)} listings)...", end=" ", flush=True)

                try:
                    verdicts = classify_batch(anthropic_client, batch)
                except Exception as e:
                    print(f"ERROR: {e}")
                    continue

                # Match verdicts back to records by id
                verdict_map = {v["id"]: v for v in verdicts}

                for rec in batch:
                    verdict_data = verdict_map.get(rec["id"])
                    if not verdict_data:
                        print(f"WARNING: no verdict for {rec['id']}")
                        continue

                    verdict = verdict_data.get("verdict", "UNCERTAIN")
                    confidence = verdict_data.get("confidence", 0.0)
                    reason = verdict_data.get("reason", "")

                    result_row = {
                        "id": rec["id"],
                        "name": rec.get("name", ""),
                        "bio": (rec.get(bio_col) or "")[:150],
                        "verdict": verdict,
                        "confidence": confidence,
                        "reason": reason,
                        "table": table,
                        "island": isl,
                    }
                    all_results.append(result_row)

                    if verdict == "NON_WELLNESS" and confidence >= min_confidence:
                        to_delete.append(rec["id"])
                    elif verdict == "UNCERTAIN":
                        total_uncertain += 1
                    else:
                        total_kept += 1

                non_wellness_in_batch = sum(
                    1 for v in verdicts
                    if v.get("verdict") == "NON_WELLNESS" and v.get("confidence", 0) >= min_confidence
                )
                print(f"✓  ({non_wellness_in_batch} flagged non-wellness)")

                # Polite rate limiting
                if i + batch_size < len(candidates):
                    time.sleep(1)

            print(f"\n  [{table}]  flagged for deletion: {len(to_delete)}")

            if apply and to_delete:
                for i in range(0, len(to_delete), 50):
                    batch_ids = to_delete[i:i + 50]
                    db.table(table).delete().in_("id", batch_ids).execute()
                total_deleted += len(to_delete)
                print(f"    Deleted {len(to_delete)} records.")
            elif to_delete:
                print(f"    DRY RUN — would delete {len(to_delete)} (pass --apply to confirm)")

    # Summary
    print(f"\n{'='*60}")
    if apply:
        print(f"  DONE — deleted {total_deleted} non-wellness listings")
    else:
        print(f"  DRY RUN — would delete {sum(1 for r in all_results if r['verdict'] == 'NON_WELLNESS' and r['confidence'] >= min_confidence)} listings")
    print(f"  Kept as WELLNESS: {total_kept}")
    print(f"  UNCERTAIN (needs review): {total_uncertain}")
    print(f"{'='*60}\n")

    # Save full results log
    OUTPUT_DIR.mkdir(exist_ok=True)
    log_path = OUTPUT_DIR / "llm_filter_results.jsonl"
    with open(log_path, "w") as f:
        for row in all_results:
            f.write(json.dumps(row) + "\n")
    print(f"  Full results saved → {log_path}")

    # Save uncertain-only list for manual review
    uncertain_path = OUTPUT_DIR / "llm_filter_uncertain.jsonl"
    uncertain_rows = [r for r in all_results if r["verdict"] == "UNCERTAIN"]
    with open(uncertain_path, "w") as f:
        for row in uncertain_rows:
            f.write(json.dumps(row) + "\n")
    if uncertain_rows:
        print(f"  Uncertain listings → {uncertain_path}  ({len(uncertain_rows)} records need manual review)")


def main():
    parser = argparse.ArgumentParser(description="LLM-based classification of ambiguous draft listings using Claude Opus")
    parser.add_argument("--island",         choices=ISLANDS, help="Limit to one island")
    parser.add_argument("--apply",          action="store_true", help="Actually delete NON_WELLNESS results (default: dry-run)")
    parser.add_argument("--min-confidence", type=float, default=0.85,
                        help="Minimum confidence to delete (default: 0.85)")
    parser.add_argument("--batch-size",     type=int, default=20,
                        help="Listings per API call (default: 20)")
    parser.add_argument("--limit",          type=int, default=None,
                        help="Max listings to process per table/island (for testing)")
    args = parser.parse_args()

    run(args.island, args.apply, args.min_confidence, args.batch_size, args.limit)


if __name__ == "__main__":
    main()
