#!/bin/bash
# Daily campaign workflow — run from pipeline/ directory
# Usage: bash scripts/run_campaign.sh

set -e
cd "$(dirname "$0")/.."

echo "======================================="
echo "  Hawaii Wellness — Campaign Sync"
echo "  $(date '+%Y-%m-%d %H:%M')"
echo "======================================="

echo ""
echo "=== Step 1: Sync Resend email statuses + detect DB changes ==="
python scripts/43_campaign_sync.py --since 48h

echo ""
echo "=== Step 2: Refresh segments (detect new claims/upgrades) ==="
python scripts/40_campaign_init.py --refresh

echo ""
echo "=== Step 3: Show current segment stats ==="
python scripts/41_campaign_segment.py --stats

echo ""
echo "=== Step 4: Export dashboard data ==="
python scripts/44_campaign_export.py

echo ""
echo "======================================="
echo "  Sync complete — open campaign-dashboard.html"
echo "======================================="
