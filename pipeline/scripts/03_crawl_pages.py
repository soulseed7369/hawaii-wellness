import sys
import argparse

sys.path.insert(0, '.')

from src.storage import fetch_batch, enqueue_url
from src.crawl import fetch_page
from src.discover import is_directory_page, extract_profile_links
from src.robots import RobotsChecker
from src.throttler import Throttler
from src.config import CrawlPolicy

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=0,
                        help='Max URLs to crawl (0 = all pending)')
    parser.add_argument('--batch-size', type=int, default=50)
    args = parser.parse_args()

    robots_checker = RobotsChecker()
    throttler = Throttler()
    policy = CrawlPolicy()

    success_count = 0
    skipped_count = 0
    discovered_count = 0
    total_crawled = 0

    from urllib.parse import urlparse

    while True:
        batch = fetch_batch(batch_size=args.batch_size)
        if not batch:
            break

        for row in batch:
            if args.limit > 0 and total_crawled >= args.limit:
                break
            url = row['url']
            result = fetch_page(url, robots_checker, throttler, policy)
            total_crawled += 1
            if result:
                success_count += 1
                html = result.read_text(errors='replace')
                depth = row['depth']
                try:
                    if is_directory_page(url, html) and depth < 2:
                        profile_urls = extract_profile_links(url, html)
                        for profile_url in profile_urls:
                            domain = urlparse(profile_url).netloc
                            enqueue_url(profile_url, domain, depth=depth+1)
                        discovered_count += len(profile_urls)
                        if profile_urls:
                            print(f'Discovered {len(profile_urls)} profile links from {url}')
                except Exception as e:
                    print(f'Parse error on {url}: {e}')
            else:
                skipped_count += 1

        if args.limit > 0 and total_crawled >= args.limit:
            break

    print(f'Crawled: {success_count}, Skipped: {skipped_count}, Discovered: {discovered_count}')

if __name__ == '__main__':
    main()
