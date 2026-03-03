from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
CACHE_DIR = BASE_DIR / "cache"
OUTPUT_DIR = BASE_DIR / "output"
DB_PATH = BASE_DIR / "pipeline.db"

@dataclass
class CrawlPolicy:
    max_depth: int = 2
    batch_size: int = 20
    delay_seconds: float = 1.5
    user_agent: str = "AlohaHealthBot/1.0"

BIG_ISLAND_TOWNS = [
    "kailua-kona", "kona", "hilo", "waimea", "kamuela", "pahoa", "keaau",
    "captain cook", "kealakekua", "naalehu", "ocean view", "honokaa",
    "mountain view", "waikoloa", "holualoa", "volcano", "hawi", "kapaau",
    "laupahoehoe", "pahala", "kawaihae"
]

BIG_ISLAND_ZIPS = [
    "96740", "96720", "96743", "96778", "96749", "96760", "96725", "96704",
    "96726", "96737", "96738", "96750", "96755", "96759", "96761", "96764",
    "96771", "96772", "96773", "96774", "96776", "96777", "96780", "96783"
]

ALLOWED_DOMAINS = [
    "wellnessbigisland.com",
    "bigislandwellness.org",
    "hawaiiwellness.net",
    "alohawellness.info"
]

OAHU_TOWNS = [
    "honolulu", "waikiki", "kailua", "kaneohe", "pearl city", "aiea",
    "mililani", "kapolei", "ewa beach", "ewa", "haleiwa", "waipahu",
    "hawaii kai", "manoa", "nuuanu", "palolo", "kaimuki", "moiliili",
    "salt lake", "aliamanu", "makalapa", "pearl harbor", "wahiawa",
    "wheeler", "schofield", "maunawili", "lanikai", "waimanalo",
    "makapuu", "portlock", "aina haina", "niu valley", "kuliouou"
]

MAUI_TOWNS = [
    "lahaina", "kihei", "wailea", "kahului", "wailuku", "hana",
    "makawao", "paia", "haiku", "kula", "upcountry", "pukalani",
    "spreckelsville", "napili", "kapalua", "honokowai", "kaanapali",
    "maalaea", "keokea", "omaopio", "olinda", "haiku-pauwela", "lanai city"
]

KAUAI_TOWNS = [
    "lihue", "kapaa", "hanalei", "princeville", "poipu", "koloa",
    "hanapepe", "waimea", "eleele", "kalaheo", "lawai", "omao",
    "puhi", "anahola", "kilauea", "haena", "wainiha"
]

MOLOKAI_TOWNS = [
    "kaunakakai", "hoolehua", "maunaloa", "kualapuu", "halawa",
    "pukoo", "kamalo", "wavecrest"
]

# Map island name → its towns list
ISLAND_TOWN_LISTS = {
    "oahu": OAHU_TOWNS,
    "maui": MAUI_TOWNS,
    "kauai": KAUAI_TOWNS,
    "molokai": MOLOKAI_TOWNS,
}
