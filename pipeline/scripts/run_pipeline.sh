#!/usr/bin/env bash
set -euo pipefail

# Change to the directory containing this script
cd "$(dirname "$0")/.."

# Handle optional --dry-run flag
DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN="--dry-run"
fi

CURRENT_STEP="init"
trap 'echo "Pipeline failed at step: $CURRENT_STEP"; exit 1' ERR

CURRENT_STEP="Step 0: Brave keyword search"
echo "[$(date '+%H:%M:%S')] $CURRENT_STEP"
python3 scripts/00_brave_search.py

CURRENT_STEP="Step 1: Seed URLs"
echo "[$(date '+%H:%M:%S')] $CURRENT_STEP"
python3 scripts/01_seed_urls.py

CURRENT_STEP="Step 2: Crawl pages"
echo "[$(date '+%H:%M:%S')] $CURRENT_STEP"
python3 scripts/03_crawl_pages.py

CURRENT_STEP="Step 3: Extract entities"
echo "[$(date '+%H:%M:%S')] $CURRENT_STEP"
python3 scripts/04_extract_entities.py

CURRENT_STEP="Step 4: Normalize entities"
echo "[$(date '+%H:%M:%S')] $CURRENT_STEP"
python3 scripts/05_finalize_entities.py

CURRENT_STEP="Step 5: Extract image candidates"
echo "[$(date '+%H:%M:%S')] $CURRENT_STEP"
python3 scripts/06_extract_images.py

CURRENT_STEP="Step 6: Download images"
echo "[$(date '+%H:%M:%S')] $CURRENT_STEP"
python3 scripts/07_download_images.py

CURRENT_STEP="Step 7: Upload and upsert"
echo "[$(date '+%H:%M:%S')] $CURRENT_STEP"
python3 scripts/08_upload_and_upsert.py ${DRY_RUN}

echo "[$(date '+%H:%M:%S')] Pipeline complete!"