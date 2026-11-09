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

-- メール配信キャンペーン
CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT 'all',        -- all / php / php_old（サポート終了・終了間近）
    active INTEGER NOT NULL DEFAULT 0,         -- 1 のとき自動送信（新しく条件に合った企業にも送る）
    daily_limit INTEGER NOT NULL DEFAULT 50,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS email_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    lead_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL,                      -- sent / failed
    error TEXT,
    sent_at TEXT NOT NULL,
    UNIQUE (campaign_id, lead_id)
);
CREATE INDEX IF NOT EXISTS idx_email_log_sent ON email_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_log_email ON email_log(email);
-- 配信停止（受信拒否）リスト。ここにあるアドレスには二度と送らない
CREATE TABLE IF NOT EXISTS suppressions (
    email TEXT PRIMARY KEY,
    reason TEXT,
    created_at TEXT NOT NULL
);
"""

# 既存DBに後から追加した列（init_db で自動追加）
LEAD_COLUMNS = {
    "uses_php": "INTEGER",          # 1=PHP製サイト 0=PHP以外/不明
    "php_version": "TEXT",
    "php_status": "TEXT",           # eol / near_eol / supported / unknown
    "cms": "TEXT",                  # WordPress 6.1 など
    "tech_evidence": "TEXT",        # 判定根拠
    "tech_checked_at": "TEXT",
    "no_sales_email": "INTEGER NOT NULL DEFAULT 0",  # サイトに「営業メールお断り」表記あり
}


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
        have = {r["name"] for r in db.execute("PRAGMA table_info(leads)")}
        for col, typ in LEAD_COLUMNS.items():
            if col not in have:
                db.execute(f"ALTER TABLE leads ADD COLUMN {col} {typ}")
        if "tech_checked_at" not in have:
            # 技術判定の導入前に調査済みだった HP あり企業を、再調査の対象に戻す
            db.execute("UPDATE leads SET enriched_at = NULL, enrich_run_id = NULL WHERE website IS NOT NULL")


def row_to_dict(row) -> dict:
    if row is None:
        return None
    d = dict(row)
    for k in ("has_website", "uses_php", "no_sales_email"):
        if k in d and d[k] is not None:
            d[k] = bool(d[k])
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
