import re
import hashlib
from urllib.parse import urljoin
from bs4 import BeautifulSoup

def extract_image_candidates(base_url: str, html: str) -> list[str]:
    soup = BeautifulSoup(html, 'html.parser')
    ordered = []   # maintains priority order
    seen = set()   # dedup

    def add(url):
        if url and url not in seen:
            seen.add(url)
            ordered.append(url)

    # 1. og:image is highest priority — add first
    og_image = soup.find('meta', attrs={'property': 'og:image'})
    if og_image and og_image.get('content'):
        src = og_image['content']
        if src and not src.startswith('data:'):
            add(urljoin(base_url, src))

    img_tags = soup.find_all('img')
    person_keywords = ['profile', 'photo', 'headshot', 'practitioner', 'therapist', 'staff', 'team', 'avatar']
    skip_keywords   = ['logo', 'icon', 'banner', 'header', 'footer', 'sprite', 'pixel', 'tracking', 'ad']

    # 2. Person-tagged images (second priority)
    for img in img_tags:
        src = img.get('src', '')
        alt = img.get('alt', '').lower()
        cls = img.get('class', [])
        if not src or src.startswith('data:'):
            continue
        alt_match   = any(kw in alt for kw in person_keywords)
        class_match = any(isinstance(c, str) and any(kw in c.lower() for kw in person_keywords) for c in cls)
        if alt_match or class_match:
            add(urljoin(base_url, src))

    # 3. Any remaining non-logo images
    for img in img_tags:
        src = img.get('src', '')
        alt = img.get('alt', '').lower()
        width  = img.get('width')
        height = img.get('height')
        if not src or src.startswith('data:'):
            continue
        if any(kw in src.lower() for kw in skip_keywords):
            continue
        if any(kw in alt for kw in skip_keywords):
            continue
        if width is not None and height is not None:
            try:
                if int(width) < 60 or int(height) < 60:
                    continue
            except ValueError:
                pass
        add(urljoin(base_url, src))

    return ordered[:3]
