"""SQLite データベース（PythonAnywhere のファイルシステムにそのまま置ける）"""
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("LEADS_DB_PATH") or os.path.join(BASE_DIR, "data", "leads.sqlite3")

SNS_FIELDS = ["instagram", "twitter", "facebook", "tiktok", "youtube", "line"]
STATUSES = ["new", "contacted", "negotiating", "won", "lost", "excluded"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL DEFAULT '',
    area TEXT NOT NULL DEFAULT '',
    sources TEXT NOT NULL DEFAULT '',          -- カンマ区切り: hellowork,google,osm / enrich
    status TEXT NOT NULL DEFAULT 'queued',     -- queued / fetching / enriching / done / failed
    found_count INTEGER NOT NULL DEFAULT 0,
    new_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    enrich_total INTEGER NOT NULL DEFAULT 0,
    enrich_done INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL DEFAULT '',
    stats TEXT NOT NULL DEFAULT '{}',        -- 調査の集計（JSON）
    locked_until TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT
);
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    external_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    has_website INTEGER NOT NULL DEFAULT 0,
    website_found_by TEXT,
    lat REAL,
    lng REAL,
    google_maps_url TEXT,
    rating REAL,
    review_count INTEGER,
    job_count INTEGER,
    instagram TEXT, twitter TEXT, facebook TEXT, tiktok TEXT, youtube TEXT, line TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    memo TEXT,
    search_keyword TEXT,
    search_area TEXT,
    last_run_id INTEGER,
    enrich_run_id INTEGER,
    enriched_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_run ON leads(last_run_id);
CREATE INDEX IF NOT EXISTS idx_leads_enrich_run ON leads(enrich_run_id, enriched_at);
CREATE INDEX IF NOT EXISTS idx_leads_enriched ON leads(enriched_at);
CREATE INDEX IF NOT EXISTS idx_leads_name ON leads(name);
"""


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
    return conn


@contextmanager
def get_db():
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as db:
        db.executescript(SCHEMA)


def row_to_dict(row) -> dict:
    if row is None:
        return None
    d = dict(row)
    if "has_website" in d:
        d["has_website"] = bool(d["has_website"])
    return d


def update_lead(db, lead_id: int, fields: dict) -> None:
    if not fields:
        return
    fields = dict(fields)
    fields["updated_at"] = now()
    cols = ", ".join(f"{k} = ?" for k in fields)
    db.execute(f"UPDATE leads SET {cols} WHERE id = ?", [*fields.values(), lead_id])


def update_run(db, run_id: int, **fields) -> None:
    if not fields:
        return
    cols = ", ".join(f"{k} = ?" for k in fields)
    db.execute(f"UPDATE runs SET {cols} WHERE id = ?", [*fields.values(), run_id])
