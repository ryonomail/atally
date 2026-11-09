from datetime import date

import pytest

import mailer
import techdetect
from db import get_db, now


def test_php_detection():
    d = techdetect.detect({"X-Powered-By": "PHP/8.1.2"}, "<html></html>")
    assert d["php"] and d["php_version"] == "8.1.2"
    d = techdetect.detect({"Set-Cookie": "PHPSESSID=abc; path=/"}, "")
    assert d["php"] and d["php_version"] is None
    d = techdetect.detect({}, '<link href="/wp-content/themes/x/style.css">')
    assert d["php"] and d["cms"] == "WordPress"
    d = techdetect.detect({}, '<a href="contact.php">問い合わせ</a>')
    assert d["php"]
    assert not techdetect.detect({"Server": "nginx"}, '<a href="/about.html">x</a>')["php"]


def test_php_status():
    today = date(2026, 11, 9)
    assert techdetect.php_status("7.4.33", today) == "eol"
    assert techdetect.php_status("8.1.0", today) == "eol"
    assert techdetect.php_status("8.2.10", today) == "near_eol"
    assert techdetect.php_status("8.3.1", today) == "supported"
    assert techdetect.php_status("5.6.40", today) == "eol"
    assert techdetect.php_status(None, today) == "unknown"


def test_no_sales_notice():
    assert techdetect.no_sales_notice("<p>営業目的のメールはお断りしております。</p>")
    assert techdetect.no_sales_notice("広告・勧誘メールはご遠慮ください")
    assert not techdetect.no_sales_notice("お問い合わせはメールでお気軽にどうぞ")


@pytest.fixture
def mail_env(monkeypatch):
    for k, v in {"SMTP_HOST": "smtp.example.com", "MAIL_FROM": "sales@me.example", "SENDER_COMPANY": "株式会社テスト",
                 "SENDER_ADDRESS": "東京都千代田区1-1", "PUBLIC_BASE_URL": "https://me.pythonanywhere.com",
                 "SECRET_KEY": "k", "SEND_INTERVAL_SEC": "0"}.items():
        monkeypatch.setenv(k, v)
    sent = []
    monkeypatch.setattr(mailer, "smtp_send", lambda msg: sent.append(msg))
    return sent


def add_lead(db, name, email, **kw):
    cols = {"source": "csv", "external_id": name, "name": name, "email": email, "status": "new",
            "created_at": now(), "updated_at": now(), **kw}
    db.execute(f"INSERT INTO leads ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", list(cols.values()))


def test_render_has_required_footer(mail_env):
    c = {"subject": "{会社名}様", "body": "{PHP状況}。", "target": "php_old"}
    lead = {"name": "A社", "email": "a@a.jp", "php_version": "7.4.33", "php_status": "eol", "website": "https://a.jp"}
    subj, body = mailer.render(c, lead)
    assert subj == "A社様"
    assert "PHP 7.4.33 が使われており、このバージョンは2022年11月に公式のセキュリティサポートが終了しています" in body
    for s in ("株式会社テスト", "東京都千代田区1-1", "sales@me.example", "https://me.pythonanywhere.com/u?e=a%40a.jp&t="):
        assert s in body
    msg = mailer.build_message(c, lead)
    assert msg["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"


def test_send_step_rules(mail_env):
    sent = mail_env
    with get_db() as db:
        add_lead(db, "古いPHP社", "old@a.jp", uses_php=1, php_version="7.4", php_status="eol")
        add_lead(db, "新しいPHP社", "new@b.jp", uses_php=1, php_version="8.4", php_status="supported")
        add_lead(db, "お断り社", "ng@c.jp", uses_php=1, php_status="eol", no_sales_email=1)
        add_lead(db, "停止済み社", "stop@d.jp", uses_php=1, php_status="eol")
        add_lead(db, "商談中社", "deal@e.jp", uses_php=1, php_status="eol", status="negotiating")
        add_lead(db, "同じアドレス社", "OLD@a.jp", uses_php=1, php_status="eol")
        db.execute("INSERT INTO suppressions (email, reason, created_at) VALUES ('stop@d.jp', 'unsubscribe', ?)", (now(),))
        db.execute("INSERT INTO campaigns (name, subject, body, target, active, daily_limit, created_at, updated_at) "
                   "VALUES ('PHP', '{会社名}様', 'x', 'php_old', 1, 50, ?, ?)", (now(), now()))
    results = [mailer.send_step() for _ in range(5)]
    assert [m["To"] for m in sent] == ["old@a.jp"]
    assert results[-1]["reason"] == "nothing"
    with get_db() as db:
        r = db.execute("SELECT status, memo FROM leads WHERE email = 'old@a.jp'").fetchone()
        assert r["status"] == "contacted" and "メール送信: PHP" in r["memo"]


def test_daily_limit_and_inactive(mail_env, monkeypatch):
    sent = mail_env
    monkeypatch.setenv("SEND_DAILY_LIMIT", "2")
    with get_db() as db:
        for i in range(5):
            add_lead(db, f"社{i}", f"x{i}@a{i}.jp")
        db.execute("INSERT INTO campaigns (name, subject, body, target, active, daily_limit, created_at, updated_at) "
                   "VALUES ('off', 's', 'b', 'all', 0, 50, ?, ?)", (now(), now()))
    assert mailer.send_step()["reason"] == "nothing" and not sent
    with get_db() as db:
        db.execute("UPDATE campaigns SET active = 1")
    for _ in range(5):
        mailer.send_step()
    assert len(sent) == 2


def test_unsubscribe_endpoint(mail_env):
    import app as appmod
    appmod.app.config.update(TESTING=True)
    c = appmod.app.test_client()
    with get_db() as db:
        add_lead(db, "A社", "a@a.jp")
    t = mailer.unsubscribe_token("a@a.jp")
    assert c.get("/u?e=a@a.jp&t=bad").status_code == 400
    assert "配信を停止する" in c.get(f"/u?e=a@a.jp&t={t}").get_data(as_text=True)
    # メールソフトのワンクリック停止（RFC 8058）
    r = c.post(f"/u?e=a@a.jp&t={t}", data={"List-Unsubscribe": "One-Click"})
    assert r.status_code == 200
    with get_db() as db:
        assert db.execute("SELECT 1 FROM suppressions WHERE email = 'a@a.jp'").fetchone()
        assert db.execute("SELECT status FROM leads").fetchone()[0] == "excluded"


def test_campaign_api(mail_env):
    import app as appmod
    appmod.app.config.update(TESTING=True, SESSION_COOKIE_SECURE=False)
    c = appmod.app.test_client()
    c.post("/login", data={"password": "pw"})
    H = {"X-Requested-With": "fetch"}
    r = c.post("/api/campaigns", json={"name": "n", "subject": "{会社名}様", "body": "本文", "target": "php_old"}, headers=H)
    assert r.status_code == 201
    cid = r.json["id"]
    d = c.get("/api/campaigns").json
    assert d["config"]["ready"] and d["campaigns"][0]["active"] is False
    assert "サンプル株式会社様" == c.post("/api/campaigns/preview", json={"subject": "{会社名}様", "body": "b"}, headers=H).json["subject"]
    assert c.put(f"/api/campaigns/{cid}", json={"active": True}, headers=H).status_code == 200
    assert c.post("/api/campaigns/test", json={"to": "me@me.jp", "name": "n", "subject": "s", "body": "b"}, headers=H).status_code == 200
    assert mail_env[-1]["To"] == "me@me.jp"
