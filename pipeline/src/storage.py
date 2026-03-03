import sqlite3
from pathlib import Path
from src.config import DB_PATH

def init_db(db_path=DB_PATH):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS url_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT UNIQUE NOT NULL,
            domain TEXT,
            status TEXT DEFAULT "pending",
            depth INTEGER DEFAULT 0,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT UNIQUE NOT NULL,
            html_path TEXT,
            fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status_code INTEGER
        )
    """)
    conn.commit()
    conn.close()

def enqueue_url(url, domain, depth=0, db_path=DB_PATH):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR IGNORE INTO url_queue (url, domain, depth) VALUES (?, ?, ?)",
        (url, domain, depth)
    )
    conn.commit()
    conn.close()

def fetch_batch(batch_size=20, db_path=DB_PATH):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM url_queue WHERE status='pending' LIMIT ?",
        (batch_size,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def mark_done(url, db_path=DB_PATH):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE url_queue SET status='done' WHERE url=?",
        (url,)
    )
    conn.commit()
    conn.close()

def save_page(url, html_path, status_code, db_path=DB_PATH):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO pages (url, html_path, status_code)
        VALUES (?, ?, ?)
    """, (url, html_path, status_code))
    conn.commit()
    conn.close()
