#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run_gm_pipeline.sh
# Runs the full Google Maps ingestion pipeline: search → details → classify
# → dedup → upsert.
#
# Usage:
#   cd pipeline
#   bash scripts/run_gm_pipeline.sh [--island big_island] [--dry-run]
#
# Options:
#   --island    big_island | maui | oahu | kauai   (default: big_island)
#   --dry-run   Run without making API calls or writing to DB
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

ISLAND="big_island"
DRY_RUN=""

for arg in "$@"; do
  case $arg in
    --island=*) ISLAND="${arg#*=}" ;;
    --island)   shift; ISLAND="$1" ;;
    --dry-run)  DRY_RUN="--dry-run" ;;
  esac
done

echo "═══════════════════════════════════════════════════════"
echo " Google Maps Pipeline  |  island=${ISLAND}${DRY_RUN:+  |  DRY RUN}"
echo "═══════════════════════════════════════════════════════"

cd "$(dirname "$0")/.."

# Support both 'python3' and 'python' depending on the system
PYTHON=$(command -v python3 || command -v python)

echo ""
echo "── Step 1/5 · Text search → collect Place IDs ──────────"
$PYTHON scripts/09_gm_search.py --island "$ISLAND" $DRY_RUN

echo ""
echo "── Step 2/5 · Fetch Place Details ──────────────────────"
$PYTHON scripts/10_gm_details.py $DRY_RUN

echo ""
echo "── Step 3/5 · Classify & map modalities ────────────────"
$PYTHON scripts/11_gm_classify.py

echo ""
echo "── Step 4/5 · Dedup against Supabase DB ────────────────"
$PYTHON scripts/12_gm_dedup.py --island "$ISLAND"

echo ""
echo "── Step 5/5 · Upsert to Supabase ───────────────────────"
$PYTHON scripts/13_gm_upsert.py $DRY_RUN

echo ""
echo "═══════════════════════════════════════════════════════"
echo " Done!  Review new drafts in Admin → /admin"
echo "═══════════════════════════════════════════════════════"
