import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)


@pytest.fixture(autouse=True)
def tmp_env(tmp_path, monkeypatch):
    import db
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "t.sqlite3"))
    for k in ("GOOGLE_PLACES_API_KEY", "BRAVE_SEARCH_API_KEY", "HELLOWORK_EXPORT_URL", "HELLOWORK_EXPORT_TOKEN"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("DASHBOARD_PASSWORD", "pw")
    monkeypatch.setenv("DEPLOY_SECRET", "s3cret")
    import collector
    monkeypatch.setattr(collector, "is_safe_public_url", lambda u: bool(u) and u.startswith("http"))
    monkeypatch.setattr(collector.time, "sleep", lambda s: None)
    db.init_db()
    yield
