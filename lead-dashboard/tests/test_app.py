import hashlib
import hmac
import json

import pytest


@pytest.fixture
def client():
    import app as appmod
    appmod.app.config.update(TESTING=True, SESSION_COOKIE_SECURE=False)
    return appmod.app.test_client()


H = {"X-Requested-With": "fetch"}


def login(c):
    assert c.post("/login", data={"password": "pw"}).status_code == 302


def test_requires_login(client):
    assert client.get("/").status_code == 302
    assert client.get("/api/leads").status_code == 401
    assert client.post("/login", data={"password": "ng"}).status_code == 200


def test_crud_and_csv(client):
    login(client)
    assert client.post("/api/collect", json={"sources": ["hellowork"]}).status_code == 403  # CSRF ヘッダー無し
    csv_body = "会社名,住所,ホームページ,業種,求人数\n株式会社テスト,東京都港区1-1,www.test.co.jp,IT,3\n".encode("cp932")
    from io import BytesIO
    r = client.post("/api/import-csv", data={"file": (BytesIO(csv_body), "a.csv")}, headers=H, content_type="multipart/form-data")
    assert r.status_code == 202, r.json
    d = client.get("/api/leads").json
    assert d["total"] == 1 and d["data"][0]["website"] == "http://www.test.co.jp" and d["data"][0]["job_count"] == 3
    lid = d["data"][0]["id"]
    assert client.put(f"/api/leads/{lid}", json={"status": "won", "memo": "OK"}, headers=H).json["status"] == "won"
    assert client.get("/api/stats").json["by_status"] == {"won": 1}
    out = client.get("/api/export.csv").data.decode("utf-8-sig")
    assert "株式会社テスト" in out and "ハローワーク求人数" in out
    assert client.post("/api/collect", json={"sources": ["google"]}, headers=H).status_code == 422


def test_deploy_signature(client, monkeypatch):
    import deploy
    called = {}
    monkeypatch.setattr(deploy, "run_deploy", lambda b: called.setdefault("b", b) and {"ok": True, "log": []})
    body = json.dumps({"ref": "refs/heads/main"}).encode()
    assert client.post("/deploy", data=body, headers={"X-Hub-Signature-256": "sha256=bad"}).status_code == 403
    sig = "sha256=" + hmac.new(b"s3cret", body, hashlib.sha256).hexdigest()
    r = client.post("/deploy", data=body, headers={"X-Hub-Signature-256": sig, "Content-Type": "application/json"})
    assert r.status_code == 200 and called["b"] == "main"
    other = json.dumps({"ref": "refs/heads/dev"}).encode()
    sig2 = "sha256=" + hmac.new(b"s3cret", other, hashlib.sha256).hexdigest()
    assert "skipped" in client.post("/deploy", data=other, headers={"X-Hub-Signature-256": sig2, "Content-Type": "application/json"}).json
