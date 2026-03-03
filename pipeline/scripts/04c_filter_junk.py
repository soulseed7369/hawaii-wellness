"""
04c_filter_junk.py
Remove non-wellness / out-of-scope entities from raw_entities.jsonl.
Checks entity name and bio against blocklists.
"""
import sys
sys.path.insert(0, '.')

import json
import re
from pathlib import Path
from src.config import OUTPUT_DIR

input_path = OUTPUT_DIR / 'raw_entities.jsonl'
tmp_path   = OUTPUT_DIR / 'raw_entities_filtered.jsonl'

# ── Blocked keywords (matched against name + bio, lowercased) ────────────────
# Any entity whose name OR bio contains one of these is removed.

BLOCKED_NAME_KEYWORDS = [
    # Tours & sightseeing
    "tour", "tours", "sightseeing", "expedition", "expeditions",
    "volcano tour", "helicopter", "zipline", "snorkel",
    "whale watch", "whale watching", "bird watch", "birdwatching",
    "manta ray", "boat tour", "kayak tour", "submarine",
    "hike", "hiking", "hikes", "beach", "beaches", "snorkeling",
    "explore big island", "things to do",
    # Lodging
    "hotel", "resort", "lodge", "lodging", "inn", "motel",
    "bed and breakfast", "b&b", "vacation rental", "airbnb",
    "hostel", "suites", "villas",
    # Specific hotel brands
    "fairmont", "mauna lani", "mauna kea resort", "four seasons",
    "hilton", "marriott", "hyatt", "sheraton", "westin", "wyndham",
    "ritz-carlton", "ritz carlton",
    # Real estate
    "real estate", "realty", "realtor", "properties llc",
    "homes for sale", "property management",
    # Weddings & events
    "wedding", "weddings", "bridal", "event planning", "event venue",
    # Restaurants & food
    "restaurant", "cafe", "coffee shop", "brewery", "winery",
    "bakery", "catering", "food truck", "luau", "luaus",
    "bistro", "grill", "steakhouse", "sushi", "pizza",
    "farmers market", "food experience", "food tour",
    # Agriculture
    "farm", "farms", "ranch", "nursery", "coffee farm",
    "macadamia", "cattle",
    # Adventure & outdoor
    "adventure", "zip line", "surfing school", "surf lessons",
    "scuba", "diving", "parasail", "atv tour", "horseback",
    # Trades & home services
    "plumbing", "plumber", "electrician", "hvac", "roofing",
    "landscaping", "auto mechanic", "auto repair", "car wash",
    "pest control", "painting contractor",
    # Medical institutions
    "hospital", "medical center", "laboratory", "lab services",
    "urgent care", "emergency room",
    "kaiser permanente", "kaiser", "honokaa hospital",
    # Education
    "university", "college", "school", "community college",
    "uh hilo", "university of hawaii",
    # Government & non-profit institutions
    "historical society", "history museum", "usgs", "national park service",
    "county of hawaii", "state of hawaii",
    "historical", "history of", "renewable energy", "energy plant",
    "power plant", "solar farm",
    # Arts & culture (non-wellness)
    "art center", "art gallery", "art museum", "theater", "theatre",
    "cinema", "concert",
    # Travel
    "travel guide", "travel agency", "travel agent", "tourism",
    "visitor center", "visitors bureau",
    "lonely planet", "travel blog", "explore big island",
    "hawaii magazine",
    # Aggregator / list articles
    "best naturopathic", "top 10", "top 20", "20 best", "10 best",
    "best doctors in", "find a doctor", "find doctors",
    "spa treatment menu", "spa menu",
    # Family / general health
    "family health center", "family medicine", "family practice",
    "primary care", "pediatric", "pediatrics",
    # Other junk
    "insurance", "law firm", "attorney", "lawyer",
    "accounting", "accountant", "tax services",
    "bank", "credit union", "financial services",
    "grocery", "supermarket", "hardware store",
    "car rental", "limousine", "taxi",
    "print shop", "copy center",
    # Music / media / unrelated content
    "musician", "musicians", "photography", "photographer",
    "videos", "news", "songs", "instagram",
    # Nature / outdoor non-wellness
    "trail", "trails", "plants", "pets",
    # Food
    "meat",
    # Misc junk
    "map", "hands",
    # Geographic redirects — these belong in island field, not in directory
    "honolulu", "oahu", "maui",
    # Specific junk phrases
    "captain cook monument", "land use", "geothermal",
    "black friday", "holiday special", "nothing found",
    "spa treatment menu", "spa menu",
    "renewable energy", "energy plant",
    "family health",
]

# Blocked URL domain fragments — removes known junk domains entirely
BLOCKED_URL_FRAGMENTS = [
    "fairmont.com",
    "maunakearesort.com",
    "maunalani.com",
    "fourseasons.com",
    "hilton.com",
    "marriott.com",
    "hyatt.com",
    "sheraton.com",
    "usgs.gov",
    "uhh.hawaii.edu",
    "hawaii.edu",
    "nps.gov",
    "konaweb.com",       # general directory, not wellness
    "yellowpages.com",
    "yelp.com",
    "healthgrades.com",
    "zocdoc.com",
    "vitals.com",
    "webmd.com",
    "psychology today.com",
    "psychologytoday.com",
    "ratemds.com",
    "doximity.com",
    "hawaiimagazine.com",
    "lonelyplanet.com",
    "wanderlustprincess.net",
    "tripadvisor.com",
    "timeout.com",
    "thingstodohawaii.com",
    "gohawaii.com",
    "explorebigisland.com",
    "kaiserpermanente.org",
    "kaiser.org",
    "honokaahospital.org",
    "kamuelafarmersmarket.com",
    "hawaiivolcanoexpeditions.com",
    "hawaiilife.com",
    "houfy.com",
    "threebestrated.com",
    "history.com",
    "luminoushealingcenter.com",
    "gridinfo.com",
    "hawaiipacifichealth.org",
    "bigislandhealthcare.com",
    "wixpress.com",
    "volcano-hawaii.com",
    "queensmarketplace.com",
]

def is_junk(entity):
    name = (entity.get('name') or '').lower()
    bio  = (entity.get('bio')  or '').lower()
    url  = (entity.get('website_url') or '').lower()
    text = name + ' ' + bio

    # Check URL blocklist
    for frag in BLOCKED_URL_FRAGMENTS:
        if frag in url:
            return True, f'blocked domain: {frag}'

    # Check keyword blocklist against name+bio
    for kw in BLOCKED_NAME_KEYWORDS:
        # Use word-boundary match to avoid false positives (e.g. "tours" in "detours")
        pattern = r'\b' + re.escape(kw) + r'\b'
        if re.search(pattern, text):
            return True, f'blocked keyword: {kw}'

    return False, None

# ── Run filter ────────────────────────────────────────────────────────────────
total = kept = removed = 0
removal_reasons = {}

with open(input_path) as fin, open(tmp_path, 'w') as fout:
    for line in fin:
        entity = json.loads(line)
        total += 1
        junk, reason = is_junk(entity)
        if junk:
            removed += 1
            removal_reasons[reason] = removal_reasons.get(reason, 0) + 1
        else:
            kept += 1
            fout.write(json.dumps(entity) + '\n')

# Replace original
tmp_path.replace(input_path)

# ── Deduplication pass ────────────────────────────────────────────────────────
dedup_entities = []
seen_urls = set()
seen_names = set()
dupes = 0

with open(input_path) as f:
    for line in f:
        entity = json.loads(line)
        url_key  = (entity.get('website_url') or '').lower().rstrip('/')
        name_key = re.sub(r'\s+', ' ', (entity.get('name') or '').lower().strip())
        if url_key and url_key in seen_urls:
            dupes += 1
            continue
        if name_key and name_key in seen_names:
            dupes += 1
            continue
        if url_key:
            seen_urls.add(url_key)
        if name_key:
            seen_names.add(name_key)
        dedup_entities.append(entity)

with open(input_path, 'w') as f:
    for entity in dedup_entities:
        f.write(json.dumps(entity) + '\n')

print(f'Total:      {total}')
print(f'Kept:       {kept}')
print(f'Removed:    {removed}')
print(f'Duplicates: {dupes}')
print(f'Final:      {kept - dupes}')
print()
print('Top removal reasons:')
for reason, count in sorted(removal_reasons.items(), key=lambda x: -x[1])[:20]:
    print(f'  {count:4d}  {reason}')
