import json
import re

import responses

import collector
from db import get_db


def leads():
    with get_db() as d:
        return {r["name"]: dict(r) for r in d.execute("SELECT * FROM leads")}


def test_classify_sns_url():
    c = collector.classify_sns_url
    assert c("https://www.instagram.com/abc_ig/?igsh=1") == ("instagram", "https://www.instagram.com/abc_ig/")
    assert c("https://www.instagram.com/p/XYZ/") is None
    assert c("https://twitter.com/intent/tweet?text=x") is None
    assert c("https://twitter.com/abc_x") == ("twitter", "https://x.com/abc_x")
    assert c("https://www.facebook.com/sharer/sharer.php?u=x") is None
    assert c("https://www.facebook.com/profile.php?id=123") == ("facebook", "https://www.facebook.com/profile.php?id=123")
    assert c("https://www.tiktok.com/@abc?lang=ja") == ("tiktok", "https://www.tiktok.com/@abc")
    assert c("https://www.youtube.com/watch?v=1") is None
    assert c("https://lin.ee/abc123") == ("line", "https://lin.ee/abc123")


def test_extract_email_and_contact_links():
    html = '<p>お問い合わせ：info＠yamada.co.jp</p><a href="mailto:foo@gmail.com">x</a><img src="logo@2x.png">'
    assert collector.extract_email(html, "www.yamada.co.jp") == "info@yamada.co.jp"
    links = collector.contact_links('<a href="/company/">会社概要</a><a href="contact.html">お問い合わせ</a>'
                                    '<a href="https://other.com/contact">x</a>', "https://www.yamada.co.jp/index.html")
    assert links == ["https://www.yamada.co.jp/company/", "https://www.yamada.co.jp/contact.html"]


def test_normalize_website():
    assert collector.normalize_website("ｗｗｗ.abc.co.jp") == "http://www.abc.co.jp"
    assert collector.normalize_website("なし") is None


def test_decode_shift_jis():
    raw = "<meta charset=Shift_JIS>メール info@a.jp".encode("cp932")
    assert "メール" in collector.decode_html(raw, None)


@responses.activate
def test_csv_import_enrich_flow(monkeypatch):
    monkeypatch.setenv("BRAVE_SEARCH_API_KEY", "b")
    rows = [collector.hellowork_row(x) for x in [
        {"会社名": "社会福祉法人 みどり会", "住所": "東京都世田谷区1-1", "業種": "介護", "求人数": "5"},
        {"会社名": "株式会社山田工務店", "住所": "東京都練馬区2-2", "ホームページ": "www.yamada.co.jp", "業種": "建設", "求人数": "2"},
    ]]

    def brave(req):
        if "%E3%81%BF%E3%81%A9%E3%82%8A%E4%BC%9A" in req.url:
            return 200, {}, json.dumps({"web": {"results": [
                {"url": "https://jp.indeed.com/cmp/midori", "title": "社会福祉法人みどり会の求人 | Indeed"},
                {"url": "https://www.midorikai.or.jp/recruit/", "title": "社会福祉法人 みどり会 | 採用情報"},
                {"url": "https://www.facebook.com/midorikai.tokyo", "title": "社会福祉法人みどり会 - Facebook"},
                {"url": "https://www.instagram.com/other/", "title": "別の会社"},
            ]}})
        return 200, {}, json.dumps({"web": {"results": []}})
    responses.add_callback(responses.GET, re.compile(r"https://api\.search\.brave\.com/.*"), callback=brave)
    responses.get("http://www.yamada.co.jp", body='<meta name="generator" content="WordPress 5.8.2"><a href="/company/">会社概要</a>'
                  '<a href="https://www.instagram.com/yamada_k/">ig</a>', content_type="text/html",
                  headers={"X-Powered-By": "PHP/7.4.33"})
    responses.get("http://www.yamada.co.jp/company/", body="<p>E-mail: info@yamada.co.jp</p><p>※営業目的のメールはお断りしております</p>",
                  content_type="text/html")
    responses.get("https://www.midorikai.or.jp/", body='<a href="mailto:contact@midorikai.or.jp">mail</a>', content_type="text/html")
    responses.get(re.compile(r"https://msearch\.gsi\.go\.jp/.*"), json=[{"geometry": {"coordinates": [139.65, 35.64]}}])

    run = collector.run_to_completion(collector.import_csv_rows(rows), 60)
    assert run["status"] == "done", run["message"]
    ls = leads()
    m, y = ls["社会福祉法人 みどり会"], ls["株式会社山田工務店"]
    assert m["website"] == "https://www.midorikai.or.jp/" and m["website_found_by"] == "search"
    assert m["facebook"] == "https://www.facebook.com/midorikai.tokyo" and m["instagram"] is None
    assert m["email"] == "contact@midorikai.or.jp" and m["uses_php"] == 0
    assert y["email"] == "info@yamada.co.jp" and y["instagram"] == "https://www.instagram.com/yamada_k/"
    assert y["uses_php"] == 1 and y["php_version"] == "7.4.33" and y["php_status"] == "eol" and y["cms"] == "WordPress 5.8.2"
    assert y["no_sales_email"] == 1
    assert m["lat"] == 35.64 and m["enriched_at"] and y["job_count"] == 2
    assert "公式サイト発見 1件" in run["message"] and "PHP使用 1件" in run["message"]

    # 再取り込みでもステータスは保持
    with get_db() as d:
        d.execute("UPDATE leads SET status = 'contacted'")
    run2 = collector.run_to_completion(collector.import_csv_rows(rows), 60)
    assert run2["status"] == "done"
    assert {l["status"] for l in leads().values()} == {"contacted"}


@responses.activate
def test_google_and_osm_dedupe(monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "g")
    responses.post("https://places.googleapis.com/v1/places:searchText", json={"places": [
        {"id": "g1", "displayName": {"text": "ヘアサロン ABC"}, "formattedAddress": "日本、〒150-0001 東京都渋谷区神宮前1-2-3",
         "location": {"latitude": 35.67, "longitude": 139.70}, "websiteUri": "https://www.instagram.com/abc_salon/"},
    ]})
    responses.get(re.compile(r"https://nominatim\.openstreetmap\.org/.*"),
                  json=[{"lat": "35.66", "lon": "139.70", "boundingbox": ["35.64", "35.69", "139.66", "139.72"]}])
    responses.post("https://overpass-api.de/api/interpreter", json={"elements": [
        {"type": "node", "id": 5, "lat": 35.6701, "lon": 139.7001, "tags": {"name": "ヘアサロンABC", "shop": "hairdresser", "contact:twitter": "@abc_hair"}},
        {"type": "way", "id": 6, "center": {"lat": 35.65, "lon": 139.69}, "tags": {"name": "理容 さくら", "shop": "hairdresser",
                                                                                "addr:province": "東京都", "addr:city": "渋谷区"}},
    ]})
    run = collector.run_to_completion(collector.create_run("美容室", "渋谷区", ["google", "osm"]), 60)
    assert run["status"] == "done", run["message"]
    ls = leads()
    assert len(ls) == 2
    abc = ls["ヘアサロン ABC"]
    assert abc["address"] == "東京都渋谷区神宮前1-2-3"
    assert abc["twitter"] == "https://x.com/abc_hair"            # OSM から統合
    assert abc["instagram"] == "https://www.instagram.com/abc_salon/" and not abc["website"]  # SNS を HP 扱いしない
    assert ls["理容 さくら"]["category"] == "美容室・理容室"
