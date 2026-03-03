import re, json
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from src.config import BIG_ISLAND_TOWNS, BIG_ISLAND_ZIPS, ISLAND_TOWN_LISTS

def extract_json_ld(html):
    soup = BeautifulSoup(html, 'html.parser')
    scripts = soup.find_all('script', type='application/ld+json')
    data = []
    for script in scripts:
        try:
            data.append(json.loads(script.string))
        except (json.JSONDecodeError, TypeError):
            continue
    return data

CREDENTIAL_SUFFIXES = re.compile(
    r'\s*[|,]\s*(LMT|CMT|LPC|LCSW|RN|NP|MD|DO|DC|D\.C\.|ND|NMD|LAc|L\.Ac\.?|DiplAc|DAOM|'
    r'PhD|MA|MS|BS|RYT|E-RYT|CYT|CST|CBP|RD|CDN|CPM|LM|RM|CLC|CCH|'
    r'Vinyasa Yoga|Yoga|Rolfing|Craniosacral|Esthetician|Herbalist|'
    r'Naturopath|Midwife|Doula|Bodywork|Therapist|Practitioner|Healer|'
    r'Coach|Counselor|Consultant|Director|Instructor|Teacher|Specialist'
    r').*$',
    re.IGNORECASE
)

TRAILING_CREDS = re.compile(
    r'\s+(LMT|CMT|DC|D\.C\.|ND|NMD|LAc|L\.Ac\.?|DiplAc|DiplArc|DAOM|PhD|RYT|E-RYT|CYT|CST|CPM|LM|'
    r'RN|NP|MD|MSN|PA|PA-C|FNP|CNM|CNC|CMA|RMA|CNHP|LPC|LCSW|MFT)\s*[.]?\s*$',
    re.IGNORECASE
)

def clean_practitioner_name(raw: str) -> str:
    """Strip credential suffixes and whitespace from a practitioner name."""
    # Strip everything after a | or , separator
    name = CREDENTIAL_SUFFIXES.sub('', raw).strip()
    # Strip trailing credential abbreviations one at a time (handles "Lac DiplArc")
    for _ in range(5):
        cleaned = TRAILING_CREDS.sub('', name).strip()
        if cleaned == name:
            break
        name = cleaned
    return name

def extract_name(soup, json_ld_list):
    # 1. Person JSON-LD — highest confidence
    for item in json_ld_list:
        if isinstance(item, dict) and item.get('@type') in ['Person', 'Physician']:
            name = item.get('name')
            if name and 3 <= len(name) <= 100 and not re.search(r'\d{3}', name):
                return clean_practitioner_name(name)

    # 2. H1 tag — usually the practitioner name on profile pages
    h1 = soup.find('h1')
    if h1:
        raw = h1.get_text(strip=True)
        if 3 <= len(raw) <= 100:
            cleaned = clean_practitioner_name(raw)
            if cleaned and 3 <= len(cleaned) <= 80:
                return cleaned

    # 3. Title tag (split on em-dash, pipe, or hyphen)
    title = soup.find('title')
    if title:
        for sep in [' \u2014 ', ' - ', ' | ', '-']:
            parts = title.text.split(sep)
            if len(parts) > 1:
                text = parts[0].strip()
                if 3 <= len(text) <= 80 and not re.search(r'\d{3}', text):
                    return clean_practitioner_name(text)
        text = title.text.strip()
        if 3 <= len(text) <= 80 and not re.search(r'\d{3}', text):
            return clean_practitioner_name(text)

    # 4. Business-type JSON-LD — last resort (sitewide org names land here)
    for item in json_ld_list:
        if isinstance(item, dict) and item.get('@type') in ['MedicalBusiness', 'LocalBusiness', 'HealthAndBeautyBusiness']:
            name = item.get('name')
            if name and 3 <= len(name) <= 100 and not re.search(r'\d{3}', name):
                return name

    return None

def extract_phone(html_text):
    phones = re.findall(r"(\(?)(\d{3})(\)?[\s.\-]?)(\d{3})([\s.\-]?)(\d{4})", html_text)
    valid = []
    for p in phones:
        digits = ''.join(p)
        digits_only = re.sub(r'\D', '', digits)
        if digits_only.startswith('808') or len(digits_only) == 10:
            valid.append(digits)
    return valid[0] if valid else None

def extract_address(soup, json_ld_list):
    for item in json_ld_list:
        if isinstance(item, dict) and 'address' in item:
            addr = item['address']
            if isinstance(addr, dict) and addr.get('@type') == 'PostalAddress':
                parts = [addr.get('streetAddress'), addr.get('addressLocality'), f"{addr.get('addressRegion')} {addr.get('postalCode')}"]
                return ', '.join(p for p in parts if p).strip(', ')
            elif isinstance(addr, str):
                return addr
    addr_elem = soup.find(attrs={'itemprop': 'streetAddress'}) or soup.find(attrs={'itemprop': 'address'})
    return addr_elem.text if addr_elem else None

def _format_town(town):
    if '-' in town:
        return '-'.join(p.capitalize() for p in town.split('-'))
    elif ' ' in town:
        return ' '.join(p.capitalize() for p in town.split(' '))
    return town.capitalize()

# ZIP → canonical town name
ZIP_TO_TOWN = {
    '96740': 'Kailua-Kona', '96745': 'Kailua-Kona',
    '96720': 'Hilo',
    '96743': 'Waimea',
    '96778': 'Pahoa',
    '96749': 'Keaau', '96760': 'Keaau',
    '96725': 'Holualoa',
    '96704': 'Captain Cook',
    '96726': 'Kealakekua',
    '96737': 'Ocean View',
    '96738': 'Waikoloa',
    '96750': 'Kailua-Kona',
    '96755': 'Hawi',
    '96759': 'Mililani',
    '96764': 'Laupahoehoe',
    '96771': 'Mountain View',
    '96772': 'Naalehu',
    '96773': 'Papaikou',
    '96774': 'Honokaa',
    '96776': 'Paauilo',
    '96777': 'Pahala',
    '96780': 'Pepeekeo',
    '96783': 'Papaikou',
}

def extract_town(address, name, html_text):
    # Build search text: address+name first (most reliable), then full page
    priority = (address or '').lower() + ' ' + (name or '').lower()
    full = priority + ' ' + html_text.lower()

    # 1. Town name match — check priority text first, then full page
    for source in (priority, full):
        for town in BIG_ISLAND_TOWNS:
            if town.lower() in source:
                return _format_town(town)

    # 2. ZIP code fallback — anywhere on the page
    for zip_code, town_name in ZIP_TO_TOWN.items():
        if zip_code in full:
            return town_name

    return None

def detect_island(city, address):
    """Detect which Hawaiian island based on city name and address text."""
    city_lower = (city or '').lower().strip()
    address_lower = (address or '').lower()

    # Big Island check first (crawl was seeded from Big Island)
    if city_lower in BIG_ISLAND_TOWNS:
        return 'big_island'

    # Check Big Island ZIPs in address
    for zip_code in BIG_ISLAND_ZIPS:
        if zip_code in address_lower:
            return 'big_island'

    # Check other islands
    for island, towns in ISLAND_TOWN_LISTS.items():
        if city_lower in towns:
            return island

    # Address text fallback
    if any(t in address_lower for t in ['honolulu', 'oahu']):
        return 'oahu'
    if any(t in address_lower for t in ['maui', 'lahaina', 'kihei']):
        return 'maui'
    if any(t in address_lower for t in ['kauai', 'lihue']):
        return 'kauai'

    # Default: assume big island (primary crawl target)
    return 'big_island'

MODALITY_MAP = [
    (r'\b(lomi\s*lomi|lomilomi)\b', 'Massage'),
    (r'\b(massage therapist|massage therapy|therapeutic massage|sports massage|deep tissue|LMT|CMT)\b', 'Massage'),
    (r'\b(chiropractic|chiropractor)\b|(?<!\w)D\.C\.(?!\w)', 'Chiropractic'),
    (r'\b(acupuncture|acupuncturist|L\.Ac\.?|LAc|DiplAc|DAOM)\b', 'Acupuncture'),
    (r'\b(ayurveda|ayurvedic)\b', 'Ayurveda'),
    (r'\b(breathwork|pranayama)\b', 'Breathwork'),
    (r'\b(yoga instructor|yoga teacher|yoga class|vinyasa yoga|hatha yoga|kundalini yoga|yin yoga|RYT|E-RYT)\b', 'Yoga'),
    (r'\b(reiki)\b', 'Reiki'),
    (r'\b(rolfing|structural integration)\b', 'Somatic Therapy'),
    (r'\b(somatic therapy|somatic practitioner)\b', 'Somatic Therapy'),
    (r'\b(craniosacral|cranial sacral|craniosacral therapy)\b', 'Craniosacral'),
    (r'\b(sound heal|sound bath|tibetan bowl|singing bowl)\b', 'Sound Healing'),
    (r'\b(energy heal|energy work|pranic healing|biofield)\b', 'Energy Healing'),
    (r'\b(herbalism|herbal medicine|herbalist)\b', 'Herbalism'),
    (r'\b(nutritionist|dietitian|nutrition counseling|functional nutrition)\b', 'Nutrition'),
    (r'\b(naturopathic|naturopath|naturopathic doctor|NMD)\b', 'Naturopathic'),
    (r'\b(meditation teacher|meditation practitioner|mindfulness teacher|mindfulness coach)\b', 'Meditation'),
    (r'\b(functional medicine)\b', 'Functional Medicine'),
    (r'\b(counseling|counselor|LPC|LCSW|psychotherapist|psychotherapy)\b', 'Counseling'),
    (r'\b(hypnotherapy|hypnotherapist|hypnosis)\b', 'Hypnotherapy'),
    (r'\b(midwife|midwifery|CPM)\b', 'Midwife'),
    (r'\b(birth doula|postpartum doula|doula)\b', 'Birth Doula'),
    (r'\b(nervous system regulation|nervous system healing|polyvagal)\b', 'Nervous System Regulation'),
    (r'\b(TCM|traditional chinese medicine)\b', 'TCM (Traditional Chinese Medicine)'),
    (r'\b(watsu|water therapy|aquatic bodywork)\b', 'Watsu / Water Therapy'),
    (r'\b(osteopathic medicine|osteopathic physician|osteopath\b)', 'Osteopathic'),
    (r'\b(physical therapist|physical therapy|physiotherapy)\b', 'Physical Therapy'),
    (r'\b(reflexology)\b', 'Massage'),
    (r'\b(esthetician|esthetics|skin care specialist|sauna)\b', 'Alternative Therapy'),
    (r'\b(past.life regression|akashic|tarot|soul guid|inner child|unshaming|energy movement)\b', 'Soul Guidance'),
    (r'\b(infrared sauna|infrared)\b', 'Alternative Therapy'),
    (r'\b(yoga)\b', 'Yoga'),  # broad yoga fallback (after specific patterns)
]

def detect_modalities(html_text: str, bio: str = '') -> list:
    """Detect modalities from page text and bio."""
    combined = (html_text + ' ' + (bio or '')).lower()
    found = []
    for pattern, modality in MODALITY_MAP:
        if re.search(pattern, combined, re.IGNORECASE) and modality not in found:
            found.append(modality)
    return found


def extract_bio_from_page(soup) -> str:
    """Extract practitioner bio from About section or meta description."""
    # Try About section heading → following paragraphs
    for heading in soup.find_all(['h2', 'h3']):
        if re.search(r'\babout\b', heading.get_text(strip=True), re.IGNORECASE):
            paras = []
            for sib in heading.next_siblings:
                if not hasattr(sib, 'name'):
                    continue
                if sib.name in ['h1', 'h2', 'h3']:
                    break
                if sib.name == 'p':
                    t = sib.get_text(strip=True)
                    if t and len(t) > 30:
                        paras.append(t)
                if len(paras) >= 2:
                    break
            if paras:
                return ' '.join(paras)[:500]

    # Fallback: meta description
    meta = soup.find('meta', attrs={'name': 'description'})
    if meta:
        content = (meta.get('content') or '').strip()
        if content and len(content) > 20:
            return content[:300]

    return None


def is_person_name(text: str) -> bool:
    """Heuristic: is this text likely a practitioner's name?"""
    text = text.strip()
    if not text or len(text) < 2 or len(text) > 60:
        return False
    # Skip obvious non-names
    skip = ['meet', 'our', 'team', 'staff', 'about', 'contact', 'services', 'book',
            'ready', 'licensed', 'certified', 'welcome', 'located', 'follow', 'join',
            'gallery', 'news', 'events', 'massage therapists', 'call', 'email']
    low = text.lower()
    if any(s in low for s in skip):
        return False
    # Must start with a capital letter
    if not text[0].isupper():
        return False
    # Allow first-name-only (single word >= 3 chars) or full name
    words = text.split()
    if len(words) == 1 and len(words[0]) >= 3:
        return True
    if len(words) >= 2 and words[0][0].isupper():
        return True
    return False


def extract_team_practitioners(url, html, shared_phone=None, shared_address=None,
                                shared_city=None, shared_island='big_island') -> list:
    """
    Extract multiple practitioners from a team/staff listing page.
    Returns a list of entity dicts.
    """
    soup = BeautifulSoup(html, 'html.parser')
    practitioners = []

    for heading in soup.find_all(['h3', 'h4']):
        raw_name = heading.get_text(strip=True)
        if not is_person_name(raw_name):
            continue
        name = clean_practitioner_name(raw_name)
        if not name or len(name) < 3:
            continue

        # Get bio from following siblings
        bio_parts = []
        for sib in heading.next_siblings:
            if not hasattr(sib, 'name'):
                continue
            if sib.name in ['h2', 'h3', 'h4']:
                break
            if sib.name == 'p':
                t = sib.get_text(strip=True)
                if t and len(t) > 20:
                    bio_parts.append(t)
            if len(bio_parts) >= 2:
                break
        bio = ' '.join(bio_parts)[:400] or None

        # Detect modalities from name credentials + bio
        modalities = detect_modalities(raw_name + ' ' + (bio or ''))

        phone = shared_phone or extract_phone(html)
        city = shared_city or extract_town(shared_address, name, html)
        island = shared_island

        practitioners.append({
            'name': name,
            'phone': phone,
            'email': None,
            'address': shared_address,
            'city': city,
            'website_url': url,
            'bio': bio,
            'modalities': modalities,
            'island': island,
            'status': 'draft',
            'tier': 'free',
            'owner_id': None,
            'external_booking_url': None,
            'accepts_new_clients': True,
            'lat': None,
            'lng': None,
        })

    return practitioners


def extract_entity(url, html):
    try:
        soup = BeautifulSoup(html, 'html.parser')
        json_ld_list = extract_json_ld(html)
        name = extract_name(soup, json_ld_list)
        if not name:
            return None
        phone = extract_phone(html)
        email = re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", html)
        address = extract_address(soup, json_ld_list)
        city = extract_town(address, name, html)
        bio = extract_bio_from_page(soup)
        modalities = detect_modalities(html, bio or '')
        return {
            'name': name,
            'phone': phone,
            'email': email.group(0) if email else None,
            'address': address,
            'city': city,
            'website_url': url,
            'bio': bio,
            'modalities': modalities,
            'island': detect_island(city, address),
            'status': 'draft',
            'tier': 'free',
            'owner_id': None,
            'external_booking_url': None,
            'accepts_new_clients': True,
            'lat': None,
            'lng': None
        }
    except Exception as e:
        print(f'Skipping {url}: parse error ({e})')
        return None
