from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup

DIRECTORY_SIGNALS = ['search', 'find', 'directory', 'results', 'listing', 'browse', '/state/', '/location/', 'therapists/hi', 'find-a-doctor']

BLOCKED_PATH_FRAGMENTS = [
    '/wp-content/', '/wp-admin/', '/wp-json/', '/cdn-cgi/',
    '/cart', '/checkout', '/shop/', '/product/', '/category/',
    '/tag/', '/tags/', '/author/', '/feed/', '/login', '/signup',
    '/register', '/sitemap', '/search', '/page/', '/blog/',
    '/events/', '/news/',
    '.jpg', '.jpeg', '.png', '.gif', '.pdf', '.mp4', '.zip', '.css', '.js',
    '?s=', '?page=', '?replytocom=',
]

BLOCKED_LINK_DOMAINS = {
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'tiktok.com', 'youtube.com', 'linkedin.com', 'pinterest.com',
    'google.com', 'maps.google.com', 'maps.googleapis.com',
    'amazon.com', 'etsy.com', 'ebay.com', 'wikipedia.org',
    'eventbrite.com', 'meetup.com', 'reddit.com',
    'apple.com', 'play.google.com', 'gofundme.com',
    'glassdoor.com', 'indeed.com', 'craigslist.org',
    'nextdoor.com',
}

WELLNESS_DOMAIN_KEYWORDS = [
    'health', 'heal', 'wellness', 'therapy', 'therapist',
    'massage', 'yoga', 'holistic', 'acupuncture', 'naturo',
    'chiro', 'reiki', 'meditation', 'ayur', 'nutrition',
    'counseling', 'somatic', 'bodywork', 'spa', 'retreat',
    'hawaii', 'aloha', 'kona', 'hilo', 'maui', 'oahu',
]


def is_directory_page(url, html):
    url_path = urlparse(url).path.lower()
    if any(signal in url_path for signal in DIRECTORY_SIGNALS):
        return True
    soup = BeautifulSoup(html, 'html.parser')
    return len(soup.find_all('a')) > 30


def is_big_island_link(url, link_text=''):
    big_island_keywords = ['big island', 'hawaii', 'hilo', 'kona', 'kohala', 'kailua-kona', 'waikoloa']
    url_lower = url.lower()
    text_lower = link_text.lower()
    return any(kw in url_lower or kw in text_lower for kw in big_island_keywords)


def extract_profile_links(base_url, html):
    soup = BeautifulSoup(html, 'html.parser')
    base_domain = urlparse(base_url).netloc
    base_path = urlparse(base_url).path
    links = []

    for tag in soup.find_all('a', href=True):
        href = tag['href']
        if href.startswith(('#', 'mailto:', 'tel:')):
            continue

        abs_url = urljoin(base_url, href)
        parsed = urlparse(abs_url)
        link_domain = parsed.netloc
        link_path = parsed.path

        # Skip blocked domains
        bare_domain = link_domain.replace('www.', '')
        if bare_domain in BLOCKED_LINK_DOMAINS or link_domain in BLOCKED_LINK_DOMAINS:
            continue

        # Skip gov/edu
        if link_domain.endswith('.gov') or link_domain.endswith('.edu'):
            continue

        # Skip blocked path fragments
        full_url_lower = abs_url.lower()
        if any(frag in full_url_lower for frag in BLOCKED_PATH_FRAGMENTS):
            continue

        # Skip same page
        if link_domain == base_domain and link_path == base_path:
            continue

        link_text = tag.get_text(strip=True)

        if link_domain == base_domain:
            # Same-domain: always include
            links.append(abs_url)
        else:
            # External: must be Big Island AND wellness domain
            domain_is_wellness = any(kw in link_domain.lower() for kw in WELLNESS_DOMAIN_KEYWORDS)
            if is_big_island_link(abs_url, link_text) and domain_is_wellness:
                links.append(abs_url)

    return list(dict.fromkeys(links))[:50]
