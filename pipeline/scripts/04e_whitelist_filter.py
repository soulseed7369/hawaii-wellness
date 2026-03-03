"""
04e_whitelist_filter.py

Three-stage filter to keep only genuine wellness practitioners/centers:
  1. Block known aggregator / junk domains
  2. Keep only the best (shortest-path) URL per domain
  3. Require at least one wellness keyword in name or bio
"""
import sys
sys.path.insert(0, '.')

import re
import json
from urllib.parse import urlparse
from src.config import OUTPUT_DIR

input_path = OUTPUT_DIR / 'raw_entities.jsonl'
tmp_path   = OUTPUT_DIR / 'raw_entities_whitelist.jsonl'

# ── 1. Aggregator / junk domains to block entirely ───────────────────────────
BLOCKED_DOMAINS = {
    # Listing aggregators
    "healthgrades.com", "zocdoc.com", "vitals.com", "webmd.com",
    "psychologytoday.com", "ratemds.com", "doximity.com",
    "sharecare.com", "threebestrated.com", "hub.biz",
    "yellowpages.com", "yelp.com", "bbb.org", "manta.com",
    "mapquest.com", "superpages.com", "spoke.com",
    # Travel / tourism
    "tripadvisor.com", "lonelyplanet.com", "timeout.com",
    "gohawaii.com", "thingstodohawaii.com", "to-hawaii.com",
    "hawaii-guide.com", "hawaiimagazine.com", "wanderlustprincess.net",
    "explorebigisland.com", "thingstodohawaii.net",
    "hawaiiactivities.com", "experiencevolcano.com",
    # News / media
    "dailymail.co.uk", "huffpost.com", "buzzfeed.com",
    "reddit.com", "quora.com", "wikipedia.org",
    "history.com",
    # Social / general web
    "wordpress.com", "wixpress.com", "blogspot.com",
    "instagram.com", "facebook.com", "twitter.com",
    "linkedin.com", "pinterest.com",
    # Medical institutions / hospitals
    "kaiserpermanente.org", "kaiser.org", "honokaahospital.org",
    "hawaiipacifichealth.org", "bigislandhealthcare.com",
    # Hotels / resorts
    "fairmont.com", "maunakearesort.com", "maunalani.com",
    "fourseasons.com", "hilton.com", "marriott.com",
    "hyatt.com", "sheraton.com",
    # Real estate / rentals
    "hawaiilife.com", "houfy.com", "vrbo.com", "airbnb.com",
    # Other junk
    "usgs.gov", "nps.gov", "hawaii.edu", "uhh.hawaii.edu",
    "kamuelafarmersmarket.com", "hawaiivolcanoexpeditions.com",
    "gridinfo.com", "luminoushealingcenter.com",
    "volcano-hawaii.com", "queensmarketplace.com",
}

# ── 2. Wellness whitelist keywords ───────────────────────────────────────────
# Entity must match at least one of these in name or bio.
WELLNESS_KEYWORDS = [
    # Bodywork & massage
    "massage", "bodywork", "lomi lomi", "lomilomi", "shiatsu",
    "craniosacral", "rolfing", "myofascial", "reflexology",
    "trigger point", "deep tissue", "swedish massage",
    # Movement & yoga
    "yoga", "pilates", "tai chi", "qigong", "dance therapy",
    "somatic", "feldenkrais", "alexander technique",
    # Acupuncture & TCM
    "acupuncture", "acupressure", "traditional chinese medicine",
    "tcm", "herbalist", "herbal medicine", "chinese medicine",
    # Chiropractic & PT
    "chiropractic", "chiropractor", "physical therapy",
    "physical therapist", "osteopath", "osteopathic",
    # Naturopathic & integrative
    "naturopath", "naturopathic", "integrative medicine",
    "functional medicine", "holistic", "homeopathy", "homeopathic",
    # Mental & emotional health
    "therapy", "therapist", "counseling", "counselor",
    "psychotherapy", "psychotherapist", "hypnotherapy",
    "hypnotherapist", "emdr", "trauma", "mental health",
    "life coach", "life coaching", "coaching",
    # Energy & spiritual
    "reiki", "energy healing", "energy work", "sound healing",
    "sound bath", "crystal healing", "chakra", "shamanic",
    "spiritual", "intuitive healing", "breathwork",
    "meditation", "mindfulness",
    # Wellness & spa (genuine)
    "wellness", "healing", "holistic health", "spa",
    "detox", "cleanse", "nutrition", "nutritionist",
    "dietitian", "ayurveda", "ayurvedic",
    # Credentials that signal practitioners
    "lmt", "lac", " nd ", " dc ", "ryt", "ryt200", "ryt500",
    "e-ryt", "yacep", "ntp", "cnc", "cht",
]

def get_domain(url):
    try:
        return urlparse(url).netloc.lower().lstrip('www.')
    except Exception:
        return ''

def url_depth(url):
    """Count path segments — lower = closer to homepage."""
    try:
        path = urlparse(url).path.rstrip('/')
        return len([p for p in path.split('/') if p])
    except Exception:
        return 99

def is_blocked_domain(url):
    domain = get_domain(url)
    for blocked in BLOCKED_DOMAINS:
        if domain == blocked or domain.endswith('.' + blocked):
            return True
    return False

def has_wellness_signal(name, bio):
    text = ((name or '') + ' ' + (bio or '')).lower()
    for kw in WELLNESS_KEYWORDS:
        if re.search(r'\b' + re.escape(kw.strip()) + r'\b', text):
            return True
    return False

# ── Load all entities ─────────────────────────────────────────────────────────
with open(input_path) as f:
    entities = [json.loads(line) for line in f]

total = len(entities)

# ── Stage 1: Block aggregator domains ────────────────────────────────────────
stage1 = []
blocked_domain_count = 0
for e in entities:
    if is_blocked_domain(e.get('website_url', '')):
        blocked_domain_count += 1
    else:
        stage1.append(e)

# ── Stage 2: One entry per domain (keep shortest URL path) ───────────────────
domain_best = {}  # domain → entity with shortest path
for e in stage1:
    url = e.get('website_url', '')
    domain = get_domain(url)
    if not domain:
        continue
    depth = url_depth(url)
    if domain not in domain_best or depth < url_depth(domain_best[domain].get('website_url', '')):
        domain_best[domain] = e

stage2 = list(domain_best.values())
subpage_removed = len(stage1) - len(stage2)

# ── Stage 3: Wellness whitelist ───────────────────────────────────────────────
stage3 = []
no_signal_count = 0
for e in stage2:
    if has_wellness_signal(e.get('name'), e.get('bio')):
        stage3.append(e)
    else:
        no_signal_count += 1

# ── Write output ──────────────────────────────────────────────────────────────
with open(tmp_path, 'w') as f:
    for e in stage3:
        f.write(json.dumps(e) + '\n')

tmp_path.replace(input_path)

print(f'Total input:          {total}')
print(f'Blocked domains:      {blocked_domain_count}')
print(f'Sub-page duplicates:  {subpage_removed}')
print(f'No wellness signal:   {no_signal_count}')
print(f'Final kept:           {len(stage3)}')
