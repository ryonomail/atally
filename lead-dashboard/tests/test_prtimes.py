import json
import re

import responses

import collector
import prtimes
from db import get_db

RDF = """<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns="http://purl.org/rss/1.0/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://prtimes.jp/"><title>PR TIMES</title></channel>
  <item rdf:about="https://prtimes.jp/main/html/rd/p/000000012.000045678.html">
    <title>介護施設を世田谷区に新規オープン</title>
    <link>https://prtimes.jp/main/html/rd/p/000000012.000045678.html</link>
    <description>&lt;p&gt;株式会社ケアテックは新施設を開設&lt;/p&gt;</description>
    <dc:corp>株式会社ケアテック</dc:corp>
    <dc:date>2026-11-12T10:00:00+09:00</dc:date>
  </item>
  <item rdf:about="https://prtimes.jp/main/html/rd/p/000000011.000045678.html">
    <title>古いリリース</title>
    <link>https://prtimes.jp/main/html/rd/p/000000011.000045678.html</link>
    <dc:corp>株式会社ケアテック</dc:corp>
    <dc:date>2026-11-01T10:00:00+09:00</dc:date>
  </item>
  <item rdf:about="https://prtimes.jp/main/html/rd/p/000000003.000099999.html">
    <title>新作ゲームを発売</title>
    <link>https://prtimes.jp/main/html/rd/p/000000003.000099999.html</link>
    <dc:corp>ゲーム株式会社</dc:corp>
  </item>
  <item rdf:about="https://prtimes.jp/x"><title>企業名なし</title><link>https://prtimes.jp/x</link></item>
</rdf:RDF>""".encode()

RSS2 = b"""<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
<item><title>Release A</title><link>https://prtimes.jp/main/html/rd/p/000000001.000000777.html</link>
<pubDate>Thu, 12 Nov 2026 01:00:00 GMT</pubDate><author>Alpha Inc.</author></item></channel></rss>"""


def test_parse_rdf_and_rss2():
    items = prtimes.parse_feed(RDF)
    assert len(items) == 4 and items[0]["corp"] == "株式会社ケアテック"
    assert "株式会社ケアテックは新施設" in items[0]["description"]
    row = prtimes.item_to_row(items[0])
    assert row["external_id"] == "pt:45678" and row["release_title"] == "介護施設を世田谷区に新規オープン"
    assert row["prtimes_url"] == "https://prtimes.jp/main/html/searchrlp/company_id/45678"
    assert prtimes.item_to_row(items[3]) is None
    r2 = prtimes.parse_feed(RSS2)
    assert r2[0]["corp"] == "Alpha Inc." and prtimes.company_id(r2[0]["link"]) == "777"


def test_extract_address():
    assert collector.extract_address("<p>〒150-0002 東京都渋谷区渋谷2-21-1 ヒカリエ</p>") == "東京都渋谷区渋谷2-21-1"
    assert collector.extract_address("<p>北海道札幌市中央区北1条西2-1</p>") == "北海道札幌市中央区北1条西2-1"
    assert collector.extract_address("東京都内で営業中") is None


@responses.activate
def test_prtimes_flow(monkeypatch):
    monkeypatch.setenv("BRAVE_SEARCH_API_KEY", "b")
    monkeypatch.setenv("PRTIMES_FEEDS", "https://prtimes.jp/companyrdf.php?company_id=45678")
    responses.get("https://prtimes.jp/index.rdf", body=RDF, content_type="application/rdf+xml")
    responses.get("https://prtimes.jp/companyrdf.php", body=RDF, content_type="application/rdf+xml")

    def brave(req):
        if "%E3%82%B1%E3%82%A2%E3%83%86%E3%83%83%E3%82%AF" in req.url:  # ケアテック
            return 200, {}, json.dumps({"web": {"results": [
                {"url": "https://prtimes.jp/main/html/searchrlp/company_id/45678", "title": "株式会社ケアテックのプレスリリース｜PR TIMES"},
                {"url": "https://www.caretech.co.jp/", "title": "株式会社ケアテック | 介護"},
            ]}})
        return 200, {}, json.dumps({"web": {"results": []}})
    responses.add_callback(responses.GET, re.compile(r"https://api\.search\.brave\.com/.*"), callback=brave)
    responses.get("https://www.caretech.co.jp/", body='<a href="/company/">会社概要</a>', content_type="text/html",
                  headers={"X-Powered-By": "PHP/8.0.30"})
    responses.get("https://www.caretech.co.jp/company/", content_type="text/html",
                  body="<dl><dt>所在地</dt><dd>〒154-0001 東京都世田谷区池尻1-2-3</dd><dt>Mail</dt><dd>info@caretech.co.jp</dd></dl>")
    responses.get(re.compile(r"https://msearch\.gsi\.go\.jp/.*"), json=[{"geometry": {"coordinates": [139.68, 35.65]}}])

    run = collector.run_to_completion(collector.create_run("介護", "", ["prtimes"]), 60)
    assert run["status"] == "done", run["message"]
    assert "リリース 8件から 1社" in run["message"]
    with get_db() as d:
        rows = [dict(r) for r in d.execute("SELECT * FROM leads")]
    assert len(rows) == 1
    l = rows[0]
    assert l["name"] == "株式会社ケアテック" and l["source"] == "prtimes"
    assert l["release_title"] == "介護施設を世田谷区に新規オープン"   # 最新リリース
    assert l["website"] == "https://www.caretech.co.jp/"            # PR TIMES 自体は公式サイト扱いしない
    assert l["email"] == "info@caretech.co.jp" and l["address"] == "東京都世田谷区池尻1-2-3"
    assert l["lat"] == 35.65 and l["uses_php"] == 1 and l["php_status"] == "eol"


def test_collect_api_prtimes_without_keyword():
    import app as appmod
    appmod.app.config.update(TESTING=True, SESSION_COOKIE_SECURE=False)
    c = appmod.app.test_client()
    c.post("/login", data={"password": "pw"})
    H = {"X-Requested-With": "fetch"}
    assert c.post("/api/collect", json={"sources": ["prtimes"]}, headers=H).status_code == 202
    c.post("/api/runs/1/cancel", headers=H)
    assert c.post("/api/collect", json={"sources": ["osm"], "keyword": "x"}, headers=H).status_code == 422
