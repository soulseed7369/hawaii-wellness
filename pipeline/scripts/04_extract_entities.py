import sys
sys.path.insert(0, ".")
import json, sqlite3, argparse
from pathlib import Path
from src.config import DB_PATH, OUTPUT_DIR
from src.extract import extract_entity

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--output", default="raw_entities.jsonl")
    args = parser.parse_args()
    
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    query = "SELECT p.url, p.html_path FROM pages p WHERE p.html_path IS NOT NULL"
    if args.limit > 0:
        query += f" LIMIT {args.limit}"
    
    extracted, discarded = 0, 0
    with open(OUTPUT_DIR / args.output, "w") as f:
        for url, html_path in cursor.execute(query):
            try:
                html = open(html_path).read()
            except FileNotFoundError:
                discarded += 1
                continue
            
            result = extract_entity(url, html)
            if result is None:
                discarded += 1
                continue
            if not result.get("city"):
                print(f"No BI town (low confidence): {url}")

            f.write(json.dumps(result) + "\n")
            extracted += 1
    
    print(f"Extracted: {extracted}, Discarded: {discarded}, Output: {OUTPUT_DIR / args.output}")

if __name__ == "__main__":
    main()
