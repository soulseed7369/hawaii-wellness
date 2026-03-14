"""
14_claude_classify.py
─────────────────────
Re-classifies low-confidence records from gm_classified.jsonl using Claude
Haiku. Only processes records where _confidence.overall < CONFIDENCE_THRESHOLD
to keep costs minimal — high-confidence records are passed through untouched.

What Claude improves:
  - Modality detection (from name, types, any editorial bio)
  - Practitioner vs center classification (with reasoning)
  - Bio suggestion when missing or generated_stub

Model: claude-haiku-4-5-20251001 (fast, cheap, sufficient for structured tasks)
Cost:  ~$0.001–0.003 per record (input + output tokens)

Output: pipeline/output/gm_classified.jsonl  (overwrites in-place)

Usage:
    cd pipeline
    python scripts/14_claude_classify.py
    python scripts/14_claude_classify.py --threshold 0.75   # wider net
    python scripts/14_claude_classify.py --dry-run          # print without writing
    python scripts/14_claude_classify.py --all              # process every record
"""

from __future__ import annotations
import sys, json, os, time, argparse
from pathlib import Path

import anthropic

sys.path.insert(0, '.')
from src.config import OUTPUT_DIR

# Records below this overall confidence score get sent to Claude
CONFIDENCE_THRESHOLD = 0.60

CANONICAL_MODALITIES = [
    "Acupuncture", "Alternative Therapy", "Astrology", "Ayurveda",
    "Bioenergetics", "Birth Doula", "Breathwork", "Chiropractic", "Counseling",
    "Craniosacral", "Dentistry", "Energy Healing", "Functional Medicine",
    "Gestalt Therapy", "Herbalism", "Hypnotherapy", "Life Coaching",
    "Lomilomi / Hawaiian Healing", "Luminous Practitioner", "Massage",
    "Meditation", "Midwife", "Nature Therapy", "Naturopathic",
    "Nervous System Regulation", "Network Chiropractic", "Nutrition",
    "Osteopathic", "Physical Therapy", "Psychotherapy", "Reiki",
    "Somatic Therapy", "Soul Guidance", "Sound Healing",
    "TCM (Traditional Chinese Medicine)", "Trauma-Informed Care",
    "Watsu / Water Therapy", "Yoga",
]

MODALITIES_STR = "\n".join(f"  - {m}" for m in CANONICAL_MODALITIES)

SYSTEM_PROMPT = f"""You are an expert classifier for a Hawaii holistic wellness directory.
Given a business listing, you return structured JSON with NO other text.

Canonical modalities (use EXACT spelling):
{MODALITIES_STR}

Rules:
- listing_type: "practitioner" (individual person) or "center" (business/studio/clinic)
- modalities: array of 1–4 from canonical list only; default ["Alternative Therapy"] if unclear
- bio: 1–2 sentence description (max 40 words); null if you have no useful info
- confidence: 0.0–1.0 reflecting how certain you are about modality + type
- reason: brief explanation of your classification (for admin review)
"""

def build_prompt(rec: dict) -> str:
    return f"""Classify this wellness listing:

Name: {rec.get("name", "")}
Address: {rec.get("address", "")}
Google types: {", ".join(rec.get("_google_types", []))}
Existing bio: {rec.get("bio") or "(none)"}
Existing modalities: {", ".join(rec.get("modalities", []))}
Current type: {rec.get("_listing_type", "unknown")}

Return JSON only:
{{
  "listing_type": "practitioner" | "center",
  "modalities": ["..."],
  "bio": "...",
  "confidence": 0.0,
  "reason": "..."
}}"""


def classify_with_claude(client: anthropic.Anthropic, rec: dict) -> dict | None:
    try:
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": build_prompt(rec)}],
        )
        raw = msg.content[0].text.strip()
        # Strip markdown code fences if model adds them
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = raw.rstrip("`").strip()
        return json.loads(raw)
    except Exception as e:
        return None


def apply_claude_result(rec: dict, result: dict) -> dict:
    """Merge Claude's result into the record, preserving existing high-conf fields."""
    updated = dict(rec)

    # Only update modalities if Claude is more confident
    existing_mod_conf = rec.get("_confidence", {}).get("modality", 0)
    if result.get("confidence", 0) > existing_mod_conf + 0.1:
        updated["modalities"] = result.get("modalities", rec["modalities"])
        updated["_listing_type"] = result.get("listing_type", rec["_listing_type"])

    # Update bio if missing or stub
    bio_source = rec.get("_bio_source", "none")
    if bio_source in ("none", "generated_stub") and result.get("bio"):
        updated["bio"] = result["bio"]
        updated["_bio_source"] = "claude_haiku"

    # Update confidence and add Claude metadata
    updated["_confidence"] = {
        **rec.get("_confidence", {}),
        "claude_overall": result.get("confidence", 0),
    }
    updated["_claude_reason"] = result.get("reason", "")
    updated["_claude_classified"] = True

    return updated


if __name__ == "__main__":
    import re

    parser = argparse.ArgumentParser()
    parser.add_argument("--threshold", type=float, default=CONFIDENCE_THRESHOLD,
                        help="Overall confidence below which to send to Claude")
    parser.add_argument("--dry-run",  action="store_true",
                        help="Print what would change, don't write files")
    parser.add_argument("--all",      action="store_true",
                        help="Process every record regardless of confidence")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        # Check project root .env
        env_path = Path(__file__).resolve().parents[2] / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("ANTHROPIC_API_KEY="):
                    api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break

    if not api_key:
        print("Error: ANTHROPIC_API_KEY not set in environment or .env file.")
        sys.exit(1)

    claude = anthropic.Anthropic(api_key=api_key)

    in_path = OUTPUT_DIR / "gm_classified.jsonl"
    if not in_path.exists():
        print(f"Error: {in_path} not found. Run 11_gm_classify.py first.")
        sys.exit(1)

    records = []
    with open(in_path) as f:
        for line in f:
            records.append(json.loads(line))

    to_classify = [
        r for r in records
        if args.all or r.get("_confidence", {}).get("overall", 1.0) < args.threshold
    ]

    print(f"\n[14] {len(records)} total records")
    print(f"[14] {len(to_classify)} below confidence threshold {args.threshold} → sending to Claude Haiku")
    print(f"[14] {len(records) - len(to_classify)} passed through unchanged\n")

    updated_map: dict[str, dict] = {}  # place_id → updated record
    classified = skipped = errors = 0

    for i, rec in enumerate(to_classify, 1):
        name = rec.get("name", "?")
        print(f"  [{i}/{len(to_classify)}] {name[:60]}", end=" … ", flush=True)

        result = classify_with_claude(claude, rec)
        if result is None:
            print("✗ error")
            errors += 1
        else:
            updated = apply_claude_result(rec, result)
            updated_map[rec.get("_place_id", rec.get("name"))] = updated
            mods = result.get("modalities", [])
            print(f"✓ {result.get('listing_type')} | {mods} (conf {result.get('confidence', 0):.2f})")
            classified += 1

        # Polite rate limiting
        time.sleep(0.1)

    # Merge updates back into full record list
    final_records = []
    for rec in records:
        key = rec.get("_place_id", rec.get("name"))
        final_records.append(updated_map.get(key, rec))

    print(f"\n── Summary ────────────────────────────────────────────")
    print(f"  {classified:>4}  classified by Claude Haiku")
    print(f"  {errors:>4}  errors")
    print(f"  {len(records) - len(to_classify):>4}  passed through (high confidence)")

    if not args.dry_run:
        with open(in_path, "w") as f:
            for rec in final_records:
                f.write(json.dumps(rec) + "\n")
        print(f"\n✓ Updated {in_path}")
    else:
        print("\n[dry-run] No files written.")
