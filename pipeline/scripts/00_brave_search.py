import sys
import os
import json
import time
import requests
from urllib.parse import urlparse

sys.path.insert(0, '.')

from dotenv import load_dotenv
from src.config import BASE_DIR, BIG_ISLAND_TOWNS
from src.storage import init_db, enqueue_url

load_dotenv(dotenv_path=BASE_DIR.parent / '.env')

BRAVE_API_KEY = os.environ.get('BRAVE_API_KEY')
if not BRAVE_API_KEY:
    raise KeyError("BRAVE_API_KEY not found in .env")

BRAVE_URL = 'https://api.search.brave.com/res/v1/web/search'

# Modalities × anchor towns → grid of targeted searches
MODALITIES = [
    'acupuncture',
    'massage therapist',
    'yoga instructor',
    'naturopathic doctor',
    'chiropractor',
    'network chiropractor',
    'reiki practitioner',
    'holistic health',
    'physical therapist',
    'counseling therapist',
    'nutrition counselor',
    'ayurveda',
    'sound healing',
    'breathwork',
    'craniosacral therapy',
    'osteopathic doctor',
    'astrologer',
    'somatic experiencing',
    'somatic therapy',
    'energy healing',
    'soul guide',
    'watsu water therapy',
    'functional medicine',
    'hypnotherapy',
    'herbalist',
    'luminous practitioner',
    'gestalt therapy',
    'bioenergetics',
]

ANCHOR_TOWNS = [
    'Kailua-Kona',
    'Hilo',
    'Waimea',
    'Pahoa',
    'Captain Cook',
    'Waikoloa',
    'Holualoa',
    'Hawi',
    'Honokaa',
    'Volcano',
]

# Broad "Big Island" sweeps for wellness centers and retreats
BROAD_QUERIES = [
    'wellness center Big Island Hawaii',
    'healing center Big Island Hawaii',
    'yoga retreat Big Island Hawaii',
    'holistic spa Big Island Hawaii',
    'meditation retreat Big Island Hawaii',
    'ayurveda retreat Big Island Hawaii',
    'health practitioner Big Island Hawaii directory',
]

# Domains to skip (social, review sites, aggregators that block bots)
SKIP_DOMAINS = {
    'yelp.com', 'facebook.com', 'instagram.com', 'twitter.com',
    'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
    'google.com', 'bing.com', 'amazon.com', 'tripadvisor.com',
    'angieslist.com', 'thumbtack.com', 'bark.com', 'houzz.com',
    'bbb.org', 'yellowpages.com', 'whitepages.com', 'mapquest.com',
    'nextdoor.com',
}


def is_skippable(url: str) -> bool:
    try:
        domain = urlparse(url).netloc.lower().lstrip('www.')
        return any(skip in domain for skip in SKIP_DOMAINS)
    except Exception:
        return True


def brave_search(query: str, count: int = 10, retries: int = 3) -> list:
    headers = {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY,
    }
    params = {'q': query, 'count': count, 'country': 'US'}
    for attempt in range(retries):
        resp = requests.get(BRAVE_URL, headers=headers, params=params, timeout=15)
        if resp.status_code == 429:
            wait = 2 ** (attempt + 1)   # 2s, 4s, 8s
            print(f"    Rate-limited, waiting {wait}s...")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        results = resp.json().get('web', {}).get('results', [])
        return [r['url'] for r in results if r.get('url')]
    raise Exception(f"Brave API returned 429 after {retries} retries")


init_db()

queued = 0
skipped = 0
queries_run = 0

# Grid: modality × anchor town
grid_queries = [
    f'{mod} {town} Hawaii'
    for mod in MODALITIES
    for town in ANCHOR_TOWNS
]

all_queries = grid_queries + BROAD_QUERIES
print(f"Running {len(all_queries)} Brave searches "
      f"({len(MODALITIES)} modalities × {len(ANCHOR_TOWNS)} towns + {len(BROAD_QUERIES)} broad)...")

for query in all_queries:
    try:
        urls = brave_search(query, count=10)
        new_this_query = 0
        for url in urls:
            if not is_skippable(url):
                domain = urlparse(url).netloc
                enqueue_url(url, domain, depth=0)
                queued += 1
                new_this_query += 1
            else:
                skipped += 1
        queries_run += 1
        print(f"  [{queries_run}/{len(all_queries)}] '{query}' → {new_this_query} queued")
        time.sleep(1.1)   # ~1 req/s — safe for Brave free tier (1 req/s limit)
    except Exception as e:
        print(f"  Error for '{query}': {e}")

print(f"\nDone. {queued} URLs queued, {skipped} skipped. "
      f"({queries_run}/{len(all_queries)} queries succeeded)")
