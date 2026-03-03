import sys
import os
from urllib.parse import urlparse

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.storage import init_db, enqueue_url

def main():
    init_db()
    count = 0
    
    with open('data/seeds_big_island.txt', 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parsed = urlparse(line)
            domain = f"{parsed.scheme}://{parsed.netloc}"
            enqueue_url(line, domain, depth=0)
            count += 1
    
    print(f"Seeded {count} URLs into queue")

if __name__ == "__main__":
    main()
