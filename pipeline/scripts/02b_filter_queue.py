import sys
import sqlite3

sys.path.insert(0, '.')
from src.config import DB_PATH

BLOCKED_DOMAINS = {
    'facebook.com', 'www.facebook.com',
    'instagram.com', 'www.instagram.com',
    'twitter.com', 'www.twitter.com', 'x.com',
    'tiktok.com', 'www.tiktok.com',
    'youtube.com', 'www.youtube.com',
    'linkedin.com', 'www.linkedin.com',
    'pinterest.com', 'www.pinterest.com',
    'google.com', 'www.google.com', 'maps.google.com',
    'maps.googleapis.com',
    'amazon.com', 'www.amazon.com',
    'etsy.com', 'www.etsy.com',
    'ebay.com', 'www.ebay.com',
    'wikipedia.org', 'en.wikipedia.org',
    'eventbrite.com', 'www.eventbrite.com',
    'meetup.com', 'www.meetup.com',
    'glassdoor.com', 'www.glassdoor.com',
    'indeed.com', 'www.indeed.com',
    'craigslist.org',
    'nextdoor.com',
    'reddit.com', 'www.reddit.com',
    'apple.com', 'apps.apple.com',
    'play.google.com',
    'gofundme.com',
}

BLOCKED_URL_PATTERNS = [
    '/wp-content/', '/wp-admin/', '/wp-json/', '/wp-login',
    '/cart', '/checkout', '/shop/', '/product/', '/category/',
    '/tag/', '/tags/', '/author/', '/feed/', '/cdn-cgi/',
    '/login', '/signup', '/register', '?s=', '?page=',
    '?replytocom=', '/page/', '/search/', '/sitemap', '/blog/',
    '/events/', '/news/',
    '.jpg', '.jpeg', '.png', '.gif', '.pdf',
    '.mp4', '.zip', '.css', '.js',
]


def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM url_queue WHERE status='pending'")
    before = cursor.fetchone()[0]
    print(f"Pending before filter: {before}")

    url_conditions = ' OR '.join(["url LIKE ?" for _ in BLOCKED_URL_PATTERNS])
    url_params = [f'%{p}%' for p in BLOCKED_URL_PATTERNS]

    domain_placeholders = ','.join(['?' for _ in BLOCKED_DOMAINS])
    blocked_list = list(BLOCKED_DOMAINS)

    sql = f"""
        DELETE FROM url_queue WHERE status='pending' AND (
            {url_conditions}
            OR domain IN ({domain_placeholders})
            OR domain LIKE '%.gov'
            OR domain LIKE '%.edu'
        )
    """
    cursor.execute(sql, url_params + blocked_list)
    removed = cursor.rowcount
    conn.commit()

    cursor.execute("SELECT COUNT(*) FROM url_queue WHERE status='pending'")
    after = cursor.fetchone()[0]
    print(f"Removed: {removed}")
    print(f"Pending after filter: {after}")
    conn.close()


if __name__ == '__main__':
    main()
