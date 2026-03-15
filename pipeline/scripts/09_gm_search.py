"""
09_gm_search.py
───────────────
Run Google Maps Text Search (Places API New) across modality × city
combinations for the specified island. Also performs nearby-place searches
radiating out from each discovered practitioner to catch co-located listings
that don't match modality keywords.

Collects unique Place IDs → pipeline/output/gm_place_ids.jsonl.

Usage:
    cd pipeline
    python scripts/09_gm_search.py [--island big_island] [--dry-run]
    python scripts/09_gm_search.py --island all       # all 4 islands
    python scripts/09_gm_search.py --skip-nearby      # faster, fewer results
"""

import sys, json, time, argparse, os, requests
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, '.')
from src.config import OUTPUT_DIR

load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / '.env')

GM_TEXT_SEARCH   = "https://places.googleapis.com/v1/places:searchText"
GM_NEARBY_SEARCH = "https://places.googleapis.com/v1/places:searchNearby"
GM_API_KEY       = os.environ.get('GM_API_KEY', '')
if not GM_API_KEY:
    raise EnvironmentError("GM_API_KEY is not set. Add it to your .env file.")

SEARCH_FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.types"
NEARBY_RADIUS_M   = 3000   # 3 km radial from each seed point

# ── Primary modality queries ──────────────────────────────────────────────────
MODALITY_QUERIES = [
    # Core
    "acupuncture", "acupuncturist", "massage therapist", "massage therapy",
    "yoga studio", "yoga teacher", "naturopath", "naturopathic doctor",
    "chiropractor", "chiropractic", "counselor therapist", "psychotherapist",
    "ayurveda", "reiki healer", "sound healing", "holistic health practitioner",
    "wellness center", "breathwork", "life coach wellness",
    "energy healer", "herbalist", "doula midwife", "osteopath",
    "physical therapist", "functional medicine", "craniosacral therapy",
    "somatic therapy", "meditation teacher", "nutrition coach",
    # Extended coverage
    "lomilomi massage", "hawaiian healing", "kahuna bodywork",
    "hypnotherapist", "hypnosis therapy",
    "traditional chinese medicine practitioner", "chinese medicine",
    "sound bath", "singing bowl healing",
    "trauma therapist", "somatic experiencing",
    "holistic nutritionist", "integrative nutrition",
    "birth doula", "homebirth midwife",
    "watsu water therapy", "aquatic bodywork",
    "network chiropractic", "network spinal analysis",
    "astrologer", "spiritual counselor", "soul coach",
    "nature therapy", "ecotherapy",
    "nervous system regulation",
    # Broad catch-alls
    "holistic healer", "wellness practitioner", "integrative health",
    "alternative medicine", "health coach",
    "day spa", "retreat center wellness",
    "healing arts hawaii", "energy medicine",
    # Fitness & personal training specifics
    "personal trainer", "personal training", "crossfit", "crossfit gym",
    "strength training coach", "strength coach", "boot camp fitness",
    "bootcamp fitness", "HIIT trainer", "high intensity training",
    "functional fitness trainer", "functional fitness coach",
    # Spiritual healing & ceremonies
    "shaman", "shamanic healer", "medium psychic", "tarot reader",
    "astrologer hawaii", "spiritual healer", "soul guide",
    "ceremonialist", "plant medicine", "plant medicine guide",
    "cacao ceremony", "sacred ceremony", "ceremonial guide",
    "psychic reader", "intuitive healer", "clairvoyant",
    "spiritual counselor hawaii", "spirit guide",
    # Body modalities & specialized massage
    "rolfing", "structural integration", "myofascial release",
    "trigger point therapy", "thai massage", "thai bodywork",
    "swedish massage", "deep tissue massage", "deep tissue therapy",
    "sports massage", "sports massage therapist", "prenatal massage",
    "postnatal massage", "pregnancy massage", "massage for athletes",
    # Mental health & nervous system
    "EMDR therapist", "somatic therapist", "trauma therapist",
    "somatic experiencing practitioner", "IFS therapist",
    "internal family systems", "polyvagal therapy",
    "nervous system regulation practitioner",
    # Hawaiian traditions & culture
    "lomilomi", "la'au lapa'au", "ho'oponopono practitioner",
    "kahuna healer", "traditional hawaiian healing",
    "hawaiian cultural healer", "lomi lomi massage",
    # Longevity, biohacking & advanced therapies
    "functional medicine doctor", "integrative medicine doctor",
    "longevity clinic", "longevity medicine", "anti-aging medicine",
    "NAD therapy", "NAD+ therapy", "peptide therapy",
    "ozone therapy", "hyperbaric oxygen therapy", "hyperbaric chamber",
    "biohacking coach", "longevity coach", "anti-aging coach",
    "IV therapy clinic", "IV drip therapy", "vitamin infusion",
    # Art & creative therapies
    "art therapy", "art therapist", "expressive art therapy",
    "creative therapy", "dance therapy", "movement therapy",
    # Additional modality coverage
    "family constellation therapist", "constellation work",
    "systemic constellation", "nature-based therapy",
    "forest bathing guide", "wilderness therapy",
    "equine therapy", "equine therapist", "horse therapy",
    # Women's health specialties
    "womens health practitioner", "women's health doctor",
    "pelvic floor therapist", "pelvic health", "fertility specialist",
    "menopause specialist", "postpartum support", "postpartum doula",
    # Dentistry & oral health
    "holistic dentist", "biological dentist", "integrative dentist",
    "dentist hawaii", "cosmetic dentist",
]

# Nearby-search place types — broad net from seed points
NEARBY_INCLUDE_TYPES = [
    "wellness_center", "spa", "gym", "yoga_studio", "chiropractor",
    "physiotherapist", "health", "beauty_salon", "doctor", "point_of_interest",
]

ISLAND_CITIES = {
    "big_island": [
        "Hilo Hawaii", "Kailua-Kona Hawaii", "Waimea Hawaii",
        "Captain Cook Hawaii", "Pahoa Hawaii", "Holualoa Hawaii",
        "Hawi Hawaii", "Honokaa Hawaii", "Volcano Hawaii",
        "Waikoloa Hawaii", "Keaau Hawaii", "Kealakekua Hawaii",
        "Ocean View Hawaii", "Naalehu Hawaii",
    ],
    "maui": [
        "Kahului Maui Hawaii", "Kihei Maui Hawaii", "Lahaina Maui Hawaii",
        "Paia Maui Hawaii", "Makawao Maui Hawaii", "Wailuku Maui Hawaii",
        "Haiku Maui Hawaii", "Kula Maui Hawaii", "Hana Maui Hawaii",
        "Napili Maui Hawaii", "Wailea Maui Hawaii", "Pukalani Maui Hawaii",
        "Waikapu Maui Hawaii", "Spreckelsville Maui Hawaii",
    ],
    "oahu": [
        "Honolulu Hawaii", "Waikiki Hawaii", "Kailua Oahu Hawaii",
        "Kaneohe Hawaii", "Pearl City Hawaii", "Kapolei Hawaii",
        "Haleiwa Hawaii", "Mililani Hawaii", "Hawaii Kai Hawaii",
        "Manoa Honolulu Hawaii", "Kaimuki Honolulu Hawaii",
        "Moiliili Honolulu Hawaii", "Kakaako Honolulu Hawaii",
        "Nuuanu Honolulu Hawaii", "Salt Lake Honolulu Hawaii",
        "Aiea Hawaii", "Kalihi Honolulu Hawaii", "Waimanalo Hawaii",
        "Makiki Honolulu Hawaii", "Kapahulu Honolulu Hawaii",
        "Palolo Honolulu Hawaii", "Punchbowl Honolulu Hawaii",
        "Ewa Beach Hawaii", "Downtown Honolulu Hawaii",
    ],
    "kauai": [
        "Lihue Kauai Hawaii", "Kapaa Kauai Hawaii", "Hanalei Kauai Hawaii",
        "Princeville Kauai Hawaii", "Poipu Kauai Hawaii", "Koloa Kauai Hawaii",
        "Hanapepe Kauai Hawaii", "Waimea Kauai Hawaii", "Kilauea Kauai Hawaii",
        "Kalaheo Kauai Hawaii", "Anahola Kauai Hawaii",
    ],
}

# Island-wide queries catch rural practitioners not tied to a specific city
ISLAND_WIDE_QUERIES = {
    "big_island": [
        "holistic practitioner Big Island Hawaii",
        "wellness healer Big Island Hawaii",
        "massage therapist Big Island Hawaii",
        "yoga teacher Big Island Hawaii",
        "energy healing Big Island Hawaii",
        "acupuncture Big Island Hawaii",
        "shaman Big Island Hawaii",
        "spiritual healer Big Island Hawaii",
        "trauma therapist Big Island Hawaii",
        "personal trainer Big Island Hawaii",
        "psychic medium Big Island Hawaii",
        "lomilomi Big Island Hawaii",
    ],
    "maui": [
        "holistic practitioner Maui Hawaii",
        "wellness healer Maui Hawaii",
        "acupuncture Maui Hawaii",
        "yoga teacher Maui Hawaii",
        "massage therapist Maui Hawaii",
        "energy healing Maui Hawaii",
        "breathwork Maui Hawaii",
        "plant medicine guide Maui",
        "spiritual counselor Maui Hawaii",
        "nervous system regulation Maui",
        "longevity medicine Maui Hawaii",
        "functional medicine Maui Hawaii",
    ],
    "oahu": [
        "holistic practitioner Oahu Hawaii",
        "wellness healer Oahu Hawaii",
        "acupuncture Oahu Hawaii",
        "massage therapist Oahu Hawaii",
        "yoga teacher Honolulu Hawaii",
        "naturopath Honolulu Hawaii",
        "energy healing Oahu Hawaii",
        "breathwork Honolulu Hawaii",
        "somatic therapist Oahu Hawaii",
        "family constellation Honolulu",
        "IV therapy clinic Oahu Hawaii",
        "integrative medicine Honolulu Hawaii",
    ],
    "kauai": [
        "holistic practitioner Kauai Hawaii",
        "wellness healer Kauai Hawaii",
        "massage therapist Kauai Hawaii",
        "acupuncture Kauai Hawaii",
        "yoga teacher Kauai Hawaii",
        "energy healing Kauai Hawaii",
        "shamanic healer Kauai",
        "nature therapy Kauai Hawaii",
        "sound healing Kauai Hawaii",
        "birth doula Kauai Hawaii",
        "midwife Kauai Hawaii",
        "hawaiian healing Kauai",
    ],
}

# Cities where denser practitioner populations warrant deeper pagination (3 pages instead of 2)
DENSITY_BOOST_CITIES = {
    "Honolulu Hawaii",
    "Waikiki Hawaii",
    "Kailua-Kona Hawaii",
    "Hilo Hawaii",
    "Lahaina Maui Hawaii",
    "Kihei Maui Hawaii",
    "Kapaa Kauai Hawaii",
}


def text_search(query: str, page_token: str = None) -> dict:
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GM_API_KEY,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    }
    body = {"textQuery": query}
    if page_token:
        body["pageToken"] = page_token
    resp = requests.post(GM_TEXT_SEARCH, headers=headers, json=body, timeout=15)
    resp.raise_for_status()
    return resp.json()


def nearby_search(lat: float, lng: float) -> dict:
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GM_API_KEY,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    }
    body = {
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": NEARBY_RADIUS_M,
            }
        },
        "includedTypes": NEARBY_INCLUDE_TYPES,
        "maxResultCount": 20,
    }
    resp = requests.post(GM_NEARBY_SEARCH, headers=headers, json=body, timeout=15)
    resp.raise_for_status()
    return resp.json()


def parse_places(data: dict, island: str, source_query: str) -> list[dict]:
    out = []
    for place in data.get("places", []):
        pid = place.get("id")
        if not pid:
            continue
        loc = place.get("location", {})
        out.append({
            "place_id":     pid,
            "name":         place.get("displayName", {}).get("text", ""),
            "address":      place.get("formattedAddress", ""),
            "lat":          loc.get("latitude"),
            "lng":          loc.get("longitude"),
            "types":        place.get("types", []),
            "source_query": source_query,
            "island":       island,
        })
    return out


def collect_place_ids(island: str, dry_run: bool, skip_nearby: bool) -> list[dict]:
    cities       = ISLAND_CITIES.get(island, [])
    wide_queries = ISLAND_WIDE_QUERIES.get(island, [])
    seen_ids     = set()
    results      = []

    # Build full query list: modality × city  +  island-wide
    all_queries = [(q, city) for city in cities for q in MODALITY_QUERIES]
    all_queries += [(q, None) for q in wide_queries]
    total = len(all_queries)

    for i, (modality, city) in enumerate(all_queries, 1):
        query = f"{modality} {city}" if city else modality
        print(f"[{i}/{total}] {query}")
        if dry_run:
            time.sleep(0.02)
            continue
        try:
            page_token = None
            pages = 0
            # Determine max pages: 3 for density-boost cities, 2 otherwise
            max_pages = 3 if city in DENSITY_BOOST_CITIES else 2
            while pages < max_pages:
                data = text_search(query, page_token)
                for p in parse_places(data, island, query):
                    if p["place_id"] not in seen_ids:
                        seen_ids.add(p["place_id"])
                        results.append(p)
                page_token = data.get("nextPageToken")
                if not page_token:
                    break
                pages += 1
                time.sleep(2.0)
        except Exception as e:
            print(f"  ✗ {e}")
        time.sleep(0.15)

    if skip_nearby or dry_run:
        return results

    # ── Nearby radial pass ───────────────────────────────────────────────────
    print(f"\n── Nearby radial pass ({len(results)} seed points) ──────────")
    seen_cells: set[str] = set()
    nearby_added = 0

    for rec in list(results):
        lat, lng = rec.get("lat"), rec.get("lng")
        if not lat or not lng:
            continue
        # ~500 m grid cell dedup — avoids hammering same area repeatedly
        cell = f"{round(lat * 200)},{round(lng * 200)}"
        if cell in seen_cells:
            continue
        seen_cells.add(cell)
        try:
            data = nearby_search(lat, lng)
            for p in parse_places(data, island, f"nearby({lat:.4f},{lng:.4f})"):
                if p["place_id"] not in seen_ids:
                    seen_ids.add(p["place_id"])
                    results.append(p)
                    nearby_added += 1
            time.sleep(0.2)
        except Exception as e:
            print(f"  ✗ Nearby ({lat:.3f},{lng:.3f}): {e}")

    print(f"  ✓ Nearby pass added {nearby_added} unique places")
    return results


ALL_ISLANDS = ["big_island", "maui", "oahu", "kauai"]

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--island", default="big_island",
                        choices=ALL_ISLANDS + ["all"])
    parser.add_argument("--dry-run",     action="store_true")
    parser.add_argument("--skip-nearby", action="store_true",
                        help="Skip radial nearby-search pass (faster)")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path   = OUTPUT_DIR / "gm_place_ids.jsonl"
    islands    = ALL_ISLANDS if args.island == "all" else [args.island]
    all_results: list[dict] = []
    global_seen: set[str]   = set()

    for island in islands:
        for p in collect_place_ids(island, args.dry_run, args.skip_nearby):
            if p["place_id"] not in global_seen:
                global_seen.add(p["place_id"])
                all_results.append(p)

    if not args.dry_run:
        with open(out_path, "w") as f:
            for item in all_results:
                f.write(json.dumps(item) + "\n")
        print(f"\n✓ Saved {len(all_results)} unique place IDs → {out_path}")
    else:
        city_count = sum(len(ISLAND_CITIES.get(i, [])) for i in islands)
        total_q    = (len(MODALITY_QUERIES) * city_count
                      + sum(len(ISLAND_WIDE_QUERIES.get(i, [])) for i in islands))
        print(f"\nDry-run: ~{total_q} text searches + nearby passes across {islands}")
