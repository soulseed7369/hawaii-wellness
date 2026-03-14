#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run_gm_pipeline.sh
# Full Google Maps ingestion pipeline: search → details → classify →
# Claude re-classify → dedup → upsert
#
# Usage:
#   cd pipeline
#   bash scripts/run_gm_pipeline.sh [--island big_island] [--dry-run]
#   bash scripts/run_gm_pipeline.sh --island all          # all 4 islands
#   bash scripts/run_gm_pipeline.sh --skip-nearby         # faster, fewer results
#   bash scripts/run_gm_pipeline.sh --skip-claude         # skip Haiku step
#
# Options:
#   --island      big_island | maui | oahu | kauai | all  (default: big_island)
#   --dry-run     No API calls, no DB writes
#   --skip-nearby Skip radial nearby-search pass in step 1 (faster)
#   --skip-claude Skip Claude Haiku re-classification in step 3b
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

ISLAND="big_island"
DRY_RUN=""
SKIP_NEARBY=""
SKIP_CLAUDE=""

for arg in "$@"; do
  case $arg in
    --island=*) ISLAND="${arg#*=}" ;;
    --island)   shift; ISLAND="$1" ;;
    --dry-run)      DRY_RUN="--dry-run" ;;
    --skip-nearby)  SKIP_NEARBY="--skip-nearby" ;;
    --skip-claude)  SKIP_CLAUDE="1" ;;
  esac
done

echo "═══════════════════════════════════════════════════════"
echo " Google Maps Pipeline  |  island=${ISLAND}${DRY_RUN:+  |  DRY RUN}"
echo "═══════════════════════════════════════════════════════"

cd "$(dirname "$0")/.."
PYTHON=$(command -v python3 || command -v python)

echo ""
echo "── Step 1/6 · Text search + nearby radial → Place IDs ──"
$PYTHON scripts/09_gm_search.py --island "$ISLAND" $DRY_RUN $SKIP_NEARBY

echo ""
echo "── Step 2/6 · Fetch Place Details ──────────────────────"
$PYTHON scripts/10_gm_details.py $DRY_RUN

echo ""
echo "── Step 3/6 · Classify & confidence scoring ─────────────"
$PYTHON scripts/11_gm_classify.py

echo ""
if [ -z "$SKIP_CLAUDE" ]; then
  echo "── Step 3b/6 · Claude Haiku re-classify low-confidence ──"
  $PYTHON scripts/14_claude_classify.py
  echo ""
else
  echo "── Step 3b/6 · [Skipped — --skip-claude flag set] ───────"
  echo ""
fi

echo "── Step 4/6 · Dedup against Supabase DB ─────────────────"
$PYTHON scripts/12_gm_dedup.py --island "$ISLAND"

echo ""
echo "── Step 5/6 · Upsert to Supabase ────────────────────────"
$PYTHON scripts/13_gm_upsert.py $DRY_RUN

echo ""
echo "── Step 6/6 · Website enrichment (email, phone, bio) ────"
echo "    Run separately: python scripts/22_website_enrich.py --island $ISLAND --apply"
echo "    (Skipped here to avoid overloading a single pipeline run)"

echo ""
echo "═══════════════════════════════════════════════════════"
echo " Done!  Review new drafts in Admin → /admin"
echo " Near-miss review candidates → pipeline/output/gm_review.jsonl"
echo "═══════════════════════════════════════════════════════"
