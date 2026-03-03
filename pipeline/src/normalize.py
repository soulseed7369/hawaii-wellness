import re
from collections import defaultdict

PHONE_REGEX = re.compile(r'\+?1?\d{10}$')

def normalize_phone(raw):
    if raw is None:
        return None
    if isinstance(raw, tuple):
        digits = ''.join([group for group in raw if isinstance(group, str)])
    else:
        digits = re.sub(r'\D', '', str(raw))
    if len(digits) != 10:
        return None
    return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"


def normalize_city(city):
    if city is None:
        return None
    stripped = city.strip()
    if not stripped:
        return None
    mapped = {
        'kamuela': 'Waimea',
        'ocean view': 'Ocean View',
        'mountain view': 'Mountain View'
    }
    return mapped.get(stripped.lower(), stripped.title())


def extract_modalities(text):
    if text is None:
        return []
    text = text.lower()
    modalities = {
        'acupuncture', 'massage', 'yoga', 'meditation', 'reiki',
        'chiropractic', 'naturopathic', 'ayurveda', 'physical therapy',
        'counseling', 'therapy', 'nutrition', 'herbalism', 'sound healing',
        'breathwork', 'craniosacral', 'osteopathic',
        'somatic', 'energy healing', 'hypnotherapy', 'astrology',
        'functional medicine', 'bioenergetics', 'gestalt',
        'network chiropractic', 'watsu', 'water therapy',
        'soul guide', 'luminous', 'herbalist',
    }
    matches = set()
    for mod in modalities:
        if re.search(re.escape(mod), text):
            matches.add(mod)
    return list(matches)


def score_confidence(entity):
    score = 0.0
    if entity.get('name') and len(entity['name']) >= 5:
        score += 0.3
    if entity.get('phone'):
        score += 0.2
    if entity.get('address'):
        score += 0.2
    if entity.get('city'):
        score += 0.15
    if entity.get('bio'):
        score += 0.1
    if entity.get('modalities') and len(entity['modalities']) > 0:
        score += 0.05
    return round(score, 2)


def normalize_entity(entity, min_confidence=0.3):
    if not entity:
        return None
    normalized = dict(entity)  # preserve all original fields
    normalized['phone'] = normalize_phone(entity.get('phone'))
    normalized['city'] = normalize_city(entity.get('city'))
    # Preserve modalities if already populated by a richer extractor;
    # only fall back to the simple keyword scan if modalities are empty
    if not entity.get('modalities'):
        normalized['modalities'] = extract_modalities(
            (entity.get('name') or '') + ' ' + (entity.get('bio') or '')
        )
    normalized['confidence'] = score_confidence(normalized)
    if normalized['confidence'] < min_confidence:
        return None
    return normalized