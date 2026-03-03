"""
04d_filter_stale.py
Remove entities whose websites show a last-updated year before 2022.
Pages with no detectable date are kept (benefit of the doubt).
"""
import sys
sys.path.insert(0, '.')

import re
import json
import sqlite3
from pathlib import Path
from src.config import OUTPUT_DIR, DB_PATH

input_path = OUTPUT_DIR / 'raw_entities.jsonl'
tmp_path   = OUTPUT_DIR / 'raw_entities_stale_filtered.jsonl'
CACHE_DIR  = Path(__file__).parent.parent / 'cache'
MIN_YEAR   = 2022

# ── Date detection ────────────────────────────────────────────────────────────
DATE_PATTERNS = [
    # JSON-LD dateModified / datePublished / dateCreated
    r'"date(?:Modified|Published|Created)"\s*:\s*"(\d{4})',
    # Meta tag content with ISO date
    r'<meta[^>]+content="(\d{4})-\d{2}-\d{2}',
    # Copyright year (last year in range like © 2018–2024)
    r'(?:©|copyright|&copy;|&#169;)\s*(?:\d{4}\s*[-–—]\s*)?(\d{4})',
    # Explicit "last updated" text
    r'(?:last[\s\-]updated?|last[\s\-]modified|revised)\D{0,20}(\d{4})',
    # Schema.org in text
    r'"@type"\s*:\s*"[^"]+",\s*"[^"]*[Dd]ate[^"]*"\s*:\s*"(\d{4})',
]

def detect_latest_year(html):
    """Return the most recent plausible year found in html, or None."""
    years = []
    for pat in DATE_PATTERNS:
        for m in re.finditer(pat, html, re.IGNORECASE):
            try:
                y = int(m.group(1))
                if 2000 <= y <= 2030:
                    years.append(y)
            except (ValueError, IndexError):
                continue
    return max(years) if years else None

# ── Build URL → local cache path mapping from DB ─────────────────────────────
url_to_cache = {}
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
cur.execute('SELECT url, html_path FROM pages WHERE html_path IS NOT NULL')
for url, html_path in cur.fetchall():
    fname = Path(html_path).name
    local = CACHE_DIR / fname
    url_to_cache[url] = local
conn.close()

# ── Filter ────────────────────────────────────────────────────────────────────
total = kept = removed = no_cache = no_date = 0

with open(input_path) as fin, open(tmp_path, 'w') as fout:
    for line in fin:
        entity = json.loads(line)
        total += 1
        url = entity.get('website_url', '')

        cache_file = url_to_cache.get(url)
        if not cache_file or not cache_file.exists():
            # No cached HTML — keep it
            no_cache += 1
            kept += 1
            fout.write(json.dumps(entity) + '\n')
            continue

        html = cache_file.read_text(errors='ignore')
        year = detect_latest_year(html)

        if year is None:
            # No date detectable — keep it
            no_date += 1
            kept += 1
            fout.write(json.dumps(entity) + '\n')
        elif year >= MIN_YEAR:
            kept += 1
            fout.write(json.dumps(entity) + '\n')
        else:
            removed += 1
            print(f'  STALE ({year}): {entity.get("name")} — {url}')

# Replace original
tmp_path.replace(input_path)

print()
print(f'Total:      {total}')
print(f'Kept:       {kept}')
print(f'  — no cache file:  {no_cache}')
print(f'  — no date found:  {no_date}')
print(f'Removed:    {removed}  (last updated before {MIN_YEAR})')
