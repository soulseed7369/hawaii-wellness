#!/usr/bin/env python3
"""
Generate internal link suggestions for articles → practitioners by modality overlap.
Output: pipeline/output/modality_crosslinks.json

Usage:
    cd pipeline
    python scripts/33_generate_crosslinks.py
    python scripts/33_generate_crosslinks.py --dry-run
    python scripts/33_generate_crosslinks.py --limit 3
"""

import json
import sys
import argparse
from pathlib import Path

# Add pipeline src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))
from supabase_client import client

# Canonical modalities (keep in sync with DashboardProfile.tsx)
MODALITIES = [
    'Acupuncture', 'Alternative Therapy', 'Art Therapy', 'Astrology', 'Ayurveda',
    'Birth Doula', 'Breathwork', 'Chiropractic', 'Counseling', 'Craniosacral',
    'Dentistry', 'Energy Healing', 'Family Constellation', 'Fitness', 'Functional Medicine',
    'Hawaiian Healing', 'Herbalism', 'Hypnotherapy', 'IV Therapy', 'Life Coaching',
    'Lomilomi / Hawaiian Healing', 'Longevity', 'Massage', 'Meditation', 'Midwife',
    'Nature Therapy', 'Naturopathic', 'Nervous System Regulation', 'Network Chiropractic',
    'Nutrition', 'Osteopathic', 'Physical Therapy', 'Psychic', 'Psychotherapy', 'Reiki',
    'Ritualist', 'Somatic Therapy', 'Soul Guidance', 'Sound Healing',
    'TCM (Traditional Chinese Medicine)', 'Trauma-Informed Care',
    'Watsu / Water Therapy', "Women's Health", 'Yoga',
]

# Build keyword lookup: modality_lower -> modality
MODALITY_LOOKUP = {m.lower(): m for m in MODALITIES}
# Also add common aliases
ALIASES = {
    'lomilomi': 'Lomilomi / Hawaiian Healing',
    'hawaiian massage': 'Lomilomi / Hawaiian Healing',
    'tcm': 'TCM (Traditional Chinese Medicine)',
    'chinese medicine': 'TCM (Traditional Chinese Medicine)',
    'traditional chinese': 'TCM (Traditional Chinese Medicine)',
    'somatic': 'Somatic Therapy',
    'nervous system': 'Nervous System Regulation',
    'network chiro': 'Network Chiropractic',
    'family constellation': 'Family Constellation',
    'sound bath': 'Sound Healing',
    'watsu': 'Watsu / Water Therapy',
    'water therapy': 'Watsu / Water Therapy',
    'naturopath': 'Naturopathic',
    'herbalist': 'Herbalism',
    'hypnosis': 'Hypnotherapy',
    'life coach': 'Life Coaching',
    'functional': 'Functional Medicine',
    "women's wellness": "Women's Health",
}
MODALITY_LOOKUP.update(ALIASES)


def infer_modalities_from_text(text: str) -> list[str]:
    """Extract modalities mentioned in article text."""
    if not text:
        return []
    text_lower = text.lower()
    found = set()
    for keyword, modality in MODALITY_LOOKUP.items():
        if keyword in text_lower:
            found.add(modality)
    return sorted(found)


def find_practitioners_by_modality(modalities: list[str], limit: int = 5) -> list[dict]:
    """Fetch published practitioners whose modalities overlap with the given list."""
    try:
        resp = client.table('practitioners') \
            .select('id, name, island, modalities, city') \
            .eq('status', 'published') \
            .execute()
        practitioners = resp.data or []
    except Exception as e:
        print(f"  Warning: could not fetch practitioners: {e}", file=sys.stderr)
        return []

    target = set(modalities)
    matches = []
    for p in practitioners:
        p_mods = set(p.get('modalities') or [])
        overlap = len(target & p_mods)
        if overlap > 0:
            matches.append({
                'id': p['id'],
                'name': p['name'],
                'island': p.get('island', ''),
                'city': p.get('city', ''),
                'modalities': p.get('modalities', []),
                'overlap_count': overlap,
                'link': f"/profile/{p['id']}",
            })

    matches.sort(key=lambda x: (-x['overlap_count'], x['name']))
    return matches[:limit]


def main():
    parser = argparse.ArgumentParser(description='Generate article→practitioner crosslink suggestions')
    parser.add_argument('--dry-run', action='store_true', help='Print results without writing file')
    parser.add_argument('--limit', type=int, default=5, help='Max practitioners per article (default: 5)')
    args = parser.parse_args()

    print('Fetching published articles...')
    try:
        resp = client.table('articles') \
            .select('id, slug, title, body') \
            .eq('status', 'published') \
            .execute()
        articles = resp.data or []
    except Exception as e:
        print(f'Error fetching articles: {e}', file=sys.stderr)
        sys.exit(1)

    print(f'Found {len(articles)} published articles')

    crosslinks = {}
    for article in articles:
        body = article.get('body') or ''
        title = article.get('title') or ''
        combined_text = f"{title} {body}"

        inferred_mods = infer_modalities_from_text(combined_text)
        if not inferred_mods:
            print(f"  [{article['slug']}] No modalities detected — skipping")
            continue

        practitioners = find_practitioners_by_modality(inferred_mods, limit=args.limit)
        print(f"  [{article['slug']}] Modalities: {inferred_mods[:3]}... → {len(practitioners)} practitioner matches")

        crosslinks[article['slug']] = {
            'article_id': article['id'],
            'article_title': title,
            'inferred_modalities': inferred_mods,
            'suggested_practitioners': [
                {
                    'id': p['id'],
                    'name': p['name'],
                    'link': p['link'],
                    'city': p['city'],
                    'island': p['island'],
                    'modality_overlap': [m for m in p['modalities'] if m in inferred_mods],
                }
                for p in practitioners
            ],
        }

    print(f'\nGenerated crosslinks for {len(crosslinks)}/{len(articles)} articles')

    if args.dry_run:
        print('\n--- DRY RUN OUTPUT ---')
        print(json.dumps(crosslinks, indent=2)[:2000])
        print('...(truncated)')
        return

    output_dir = Path(__file__).parent.parent / 'output'
    output_dir.mkdir(exist_ok=True)
    output_file = output_dir / 'modality_crosslinks.json'

    with open(output_file, 'w') as f:
        json.dump(crosslinks, f, indent=2)

    print(f'Written to {output_file}')


if __name__ == '__main__':
    main()
