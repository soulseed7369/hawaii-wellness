import requests
import hashlib
import time
from pathlib import Path
from urllib.parse import urlparse
from src.config import CACHE_DIR, CrawlPolicy
from src.robots import RobotsChecker
from src.throttler import Throttler
from src.storage import save_page, mark_done

CACHE_DIR.mkdir(parents=True, exist_ok=True)

def fetch_page(url, robots_checker, throttler, policy=CrawlPolicy()):
    max_retries = getattr(policy, 'max_retries', 3)
    
    for attempt in range(max_retries + 1):
        try:
            domain = urlparse(url).netloc
            if not robots_checker.can_fetch(url):
                print(f"Skipping {url}: blocked by robots.txt")
                mark_done(url)
                return None
            
            throttler.wait(domain)
            response = requests.get(url, headers={'User-Agent': policy.user_agent}, timeout=15)
            
            # Handle successful response
            if response.status_code == 200:
                content_type = response.headers.get('Content-Type', '')
                if 'text/html' not in content_type:
                    print(f"Skipping {url}: non-HTML content ({content_type.split(';')[0].strip()})")
                    mark_done(url)
                    return None

                filename = hashlib.md5(url.encode()).hexdigest() + '.html'
                html_path = CACHE_DIR / filename
                html_path.write_text(response.text, errors='replace')

                save_page(url, str(html_path), response.status_code)
                mark_done(url)
                print(f"Fetched {url} with status {response.status_code}")
                return html_path
            
            # 404: permanent, no retry
            if response.status_code == 404:
                print(f"Skipping {url}: 404 Not Found")
                mark_done(url)
                return None

            # 429/503: transient, retry with backoff
            if response.status_code in (429, 503):
                if attempt < max_retries:
                    wait_time = 2 ** attempt
                    print(f"Rate-limited ({response.status_code}) on {url}. Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                print(f"Giving up on {url} after {max_retries} retries (status {response.status_code})")
                mark_done(url)
                return None

            # Other non-200: no retry
            mark_done(url)
            return None
            
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            if attempt < max_retries:
                wait_time = 2 ** attempt
                print(f"Transient error fetching {url}: {e}. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                print(f"Failed to fetch {url} after {max_retries} retries: {e}")
                mark_done(url)
                return None
                
        except Exception as e:
            # Handle other exceptions (non-transient errors)
            if attempt < max_retries:
                wait_time = 2 ** attempt
                print(f"Transient error fetching {url}: {e}. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                print(f"Failed to fetch {url} after {max_retries} retries: {e}")
                mark_done(url)
                return None
    
    # This should not be reached due to the loop logic, but just in case
    return None