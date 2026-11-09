"""
営業リスト（見込み企業）の自動収集エンジン。

収集元:
  - CSV 取り込み    … ハローワーク等で集めた企業一覧（会社名・住所・HP・業種・求人数）
  - Googleマップ   … Google Places API (Text Search)。ホームページを持たない企業も取得できる
  - OpenStreetMap  … Nominatim + Overpass（APIキー不要）
補完（1社ずつ）:
  - HPが無い企業 → Brave Search API で公式サイト・SNSを検索（社名一致・ポータル除外）
  - HPがある企業 → トップ＋お問い合わせ/会社概要ページから メールアドレス・SNS を抽出
  - 住所 → 緯度経度（国土地理院 住所検索API）

PythonAnywhere ではリクエスト時間やバックグラウンドスレッドに制限があるため、
処理は step() 単位（数秒〜数十秒）に分割し、ブラウザ or 常駐ワーカーから繰り返し呼ぶ。
Googleマップ・Indeed 等の画面スクレイピングは利用規約違反のため行わない。
"""
from __future__ import annotations

import html as htmllib
import ipaddress
import json
import os
import re
import socket
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from urllib.parse import parse_qs, quote, urljoin, urlparse

import requests

import techdetect
from db import SNS_FIELDS, get_db, now, row_to_dict, update_lead, update_run

USER_AGENT = "Mozilla/5.0 (compatible; LeadCollector/1.0)"
ENRICH_BATCH = 150   # 1回の収集/調査で HP・メールを調べる最大件数
ENRICH_STEP = 6      # 1ステップで調べる件数（PythonAnywhere のリクエスト時間内に収める）
LOCK_SECONDS = 180

OSM_TAG_MAP = {
    "美容室": {"shop": "hairdresser"}, "美容院": {"shop": "hairdresser"}, "ヘアサロン": {"shop": "hairdresser"},
    "理容": {"shop": "hairdresser"}, "ネイル": {"shop": "beauty"}, "エステ": {"shop": "beauty"},
    "カフェ": {"amenity": "cafe"}, "喫茶": {"amenity": "cafe"}, "レストラン": {"amenity": "restaurant"},
    "飲食": {"amenity": "restaurant"}, "居酒屋": {"amenity": "pub"}, "ラーメン": {"cuisine": "ramen"},
    "歯科": {"amenity": "dentist"}, "歯医者": {"amenity": "dentist"}, "クリニック": {"amenity": "clinic"},
    "病院": {"amenity": "hospital"}, "薬局": {"amenity": "pharmacy"}, "保育": {"amenity": "kindergarten"},
    "介護": {"amenity": "social_facility"}, "不動産": {"office": "estate_agent"}, "工務店": {"craft": "builder"},
    "建設": {"office": "construction_company"}, "税理士": {"office": "tax_advisor"}, "弁護士": {"office": "lawyer"},
    "ホテル": {"tourism": "hotel"}, "旅館": {"tourism": "guest_house"}, "パン": {"shop": "bakery"},
    "花屋": {"shop": "florist"}, "自動車": {"shop": "car_repair"}, "整備": {"shop": "car_repair"},
    "ジム": {"leisure": "fitness_centre"}, "塾": {"amenity": "prep_school"},
}

CATEGORY_LABELS = {
    "hairdresser": "美容室・理容室", "beauty": "美容・ネイル・エステ", "cafe": "カフェ", "restaurant": "レストラン",
    "pub": "居酒屋・バー", "bar": "バー", "fast_food": "ファストフード", "dentist": "歯科", "clinic": "クリニック",
    "hospital": "病院", "doctors": "医院", "pharmacy": "薬局", "kindergarten": "保育園・幼稚園",
    "social_facility": "福祉施設", "estate_agent": "不動産", "builder": "工務店", "construction_company": "建設会社",
    "tax_advisor": "税理士", "lawyer": "法律事務所", "hotel": "ホテル", "guest_house": "旅館・民宿",
    "bakery": "パン屋", "florist": "花屋", "car_repair": "自動車整備", "car": "自動車販売",
    "fitness_centre": "フィットネス", "prep_school": "学習塾", "company": "企業", "it": "IT企業",
    "accountant": "会計事務所", "clothes": "アパレル", "supermarket": "スーパー", "convenience": "コンビニ",
}

PORTALS = [
    "indeed.com", "hellowork.mhlw.go.jp", "mhlw.go.jp", "townwork.net", "baitoru.com", "mynavi.jp", "rikunabi.com",
    "en-japan.com", "doda.jp", "kyujinbox.com", "stanby.com", "careerjet.jp", "jobtalk.jp", "jobmedley.com",
    "job-medley.com", "airwork.net", "en-gage.net", "wantedly.com", "green-japan.com", "openwork.jp", "vorkers.com",
    "jobhouse.jp", "hatarako.net", "e-aidem.com", "an-career", "jobcatalog", "shigoto-in", "ekiten.jp",
    "hotpepper.jp", "tabelog.com", "gnavi.co.jp", "retty.me", "mapion.co.jp", "navitime.co.jp", "itp.ne.jp",
    "goo.ne.jp", "yahoo.co.jp", "google.com", "google.co.jp", "houjin.info", "houjin-bangou.nta.go.jp",
    "info.gbiz.go.jp", "catr.jp", "baseconnect.in", "salesnow.jp", "musubu.in", "wikipedia.org", "nikkei.com",
    "prtimes.jp", "amazon.co.jp", "rakuten.co.jp", "jalan.net", "minkou.jp", "caloo.jp", "byoinnavi.jp",
    "homes.co.jp", "suumo.jp", "minnanokaigo.com", "youtube.com", "note.com", "ameblo.jp", "linkedin.com",
    "tiktok.com", "line.me", "lin.ee", "instagram.com", "facebook.com", "twitter.com", "x.com",
]

CONTACT_RE = re.compile(
    r"(contact|inquiry|toiawase|otoiawase|company|about|gaiyo|outline|profile|access|お問い?合わせ|会社概要|会社案内|企業情報|事業所概要|アクセス)",
    re.I,
)


def env(key: str, default: str = "") -> str:
    return os.environ.get(key, default) or default


def available_sources() -> dict:
    return {
        "google": bool(env("GOOGLE_PLACES_API_KEY")),
        "osm": True,
        "web_search": bool(env("BRAVE_SEARCH_API_KEY")),
    }


def http() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "ja"})
    return s


# =====================================================================
# 実行（run）の作成と 1 ステップ処理
# =====================================================================
def create_run(keyword: str, area: str, sources: list[str]) -> int:
    with get_db() as db:
        cur = db.execute(
            "INSERT INTO runs (keyword, area, sources, status, created_at) VALUES (?, ?, ?, 'queued', ?)",
            (keyword.strip(), area.strip(), ",".join(sources), now()),
        )
        return cur.lastrowid


def create_enrich_run() -> int | None:
    with get_db() as db:
        cur = db.execute(
            "INSERT INTO runs (sources, status, created_at) VALUES ('enrich', 'enriching', ?)", (now(),)
        )
        run_id = cur.lastrowid
        n = _assign_targets(db, run_id, "enriched_at IS NULL AND enrich_run_id IS NULL")
        if n == 0:
            n = _assign_targets(db, run_id, "enriched_at IS NULL")
        if n == 0:
            db.execute("DELETE FROM runs WHERE id = ?", (run_id,))
            return None
        update_run(db, run_id, enrich_total=n, found_count=n)
        return run_id


def _assign_targets(db, run_id: int, where: str) -> int:
    cur = db.execute(
        f"""UPDATE leads SET enrich_run_id = ? WHERE id IN (
              SELECT id FROM leads WHERE {where}
              ORDER BY job_count IS NULL, job_count DESC, id LIMIT ?)""",
        (run_id, ENRICH_BATCH),
    )
    return cur.rowcount


def active_run_id() -> int | None:
    with get_db() as db:
        r = db.execute(
            "SELECT id FROM runs WHERE status IN ('queued','fetching','enriching') ORDER BY id LIMIT 1"
        ).fetchone()
        return r["id"] if r else None


def _lock(run_id: int) -> bool:
    t = datetime.now(timezone.utc)
    until = (t + timedelta(seconds=LOCK_SECONDS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with get_db() as db:
        cur = db.execute(
            "UPDATE runs SET locked_until = ? WHERE id = ? AND (locked_until IS NULL OR locked_until < ?)",
            (until, run_id, t.strftime("%Y-%m-%dT%H:%M:%SZ")),
        )
        return cur.rowcount == 1


def _unlock(run_id: int) -> None:
    with get_db() as db:
        update_run(db, run_id, locked_until=None)


def get_run(run_id: int) -> dict | None:
    with get_db() as db:
        return row_to_dict(db.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone())


def step(run_id: int) -> dict:
    """run を 1 ステップ進める。別プロセスが処理中ならそのまま現状を返す"""
    run = get_run(run_id)
    if not run or run["status"] in ("done", "failed"):
        return run or {}
    if not _lock(run_id):
        return run
    try:
        if run["status"] in ("queued", "fetching"):
            _fetch_stage(run)
        else:
            _enrich_stage(run)
    except Exception as e:  # noqa: BLE001
        with get_db() as db:
            update_run(db, run_id, status="failed", finished_at=now(),
                       message=(run.get("message") or "") + f"\n失敗: {str(e)[:300]}")
    finally:
        _unlock(run_id)
    return get_run(run_id)


def run_to_completion(run_id: int, max_seconds: int = 3600) -> dict:
    """テスト・常駐ワーカー用: 完了まで step を回す"""
    deadline = time.time() + max_seconds
    run = get_run(run_id)
    while run and run["status"] not in ("done", "failed") and time.time() < deadline:
        run = step(run_id)
    return run


# ---------------------------------------------------------------------
def _fetch_stage(run: dict) -> None:
    run_id = run["id"]
    sources = [s for s in run["sources"].split(",") if s]
    keyword, area = run["keyword"], run["area"]
    logs: list[str] = []
    with get_db() as db:
        update_run(db, run_id, status="fetching")

    places: list[dict] = []
    hw_rows: list[dict] = []
    if "google" in sources and keyword:
        if available_sources()["google"]:
            places += _safely(logs, "Googleマップ", lambda: fetch_google(keyword, area, logs))
        else:
            logs.append("Googleマップ: APIキー(GOOGLE_PLACES_API_KEY)未設定のためスキップ")
    if "osm" in sources and keyword and area:
        places += _safely(logs, "OpenStreetMap", lambda: fetch_osm(keyword, area, logs))

    places = dedupe(places)
    with get_db() as db:
        new, upd = save_rows(db, run_id, hw_rows + places, keyword, area)
        total = db.execute("SELECT COUNT(*) c FROM leads WHERE last_run_id = ?", (run_id,)).fetchone()["c"]
        n = _assign_targets(db, run_id, f"last_run_id = {int(run_id)} AND enriched_at IS NULL")
        logs.append(f"対象 {total}件（新規 {new} / 更新 {upd}）")
        status = "enriching" if n else "done"
        update_run(db, run_id, status=status, found_count=total, new_count=new, updated_count=upd,
                   enrich_total=n, message="\n".join(logs), finished_at=None if n else now())


def import_csv_rows(rows: list[dict]) -> int:
    """CSV アップロード（ハローワーク事業所など）からの取り込み。run を作り調査待ちにする"""
    with get_db() as db:
        cur = db.execute(
            "INSERT INTO runs (keyword, area, sources, status, created_at) VALUES ('', '', 'csv', 'enriching', ?)",
            (now(),),
        )
        run_id = cur.lastrowid
        new, upd = save_rows(db, run_id, rows, "", "")
        n = _assign_targets(db, run_id, f"last_run_id = {int(run_id)} AND enriched_at IS NULL")
        update_run(db, run_id, found_count=new + upd, new_count=new, updated_count=upd, enrich_total=n,
                   status="enriching" if n else "done", finished_at=None if n else now(),
                   message=f"CSV取り込み: {new + upd}社（新規 {new} / 更新 {upd}）")
        return run_id


def save_rows(db, run_id: int, rows: list[dict], keyword: str, area: str) -> tuple[int, int]:
    """(source, external_id) で upsert。既存企業のステータス・メモ・調査済みの値は保持する"""
    always = {"rating", "review_count", "job_count", "category"}
    new = upd = 0
    ts = now()
    for r in rows:
        r = {k: v for k, v in r.items() if v not in (None, "")}
        ex = db.execute("SELECT * FROM leads WHERE source = ? AND external_id = ?",
                        (r["source"], r["external_id"])).fetchone()
        if ex is None:
            r.setdefault("has_website", 1 if r.get("website") else 0)
            if r.get("website"):
                r.setdefault("website_found_by", r["source"])
            r.update(status="new", last_run_id=run_id, search_keyword=keyword, search_area=area,
                     created_at=ts, updated_at=ts)
            cols = ", ".join(r)
            db.execute(f"INSERT INTO leads ({cols}) VALUES ({', '.join('?' * len(r))})", list(r.values()))
            new += 1
        else:
            fields = {k: v for k, v in r.items()
                      if k not in ("source", "external_id") and (k in always or ex[k] in (None, ""))}
            if fields.get("website"):
                fields["has_website"] = 1
                fields.setdefault("website_found_by", r["source"])
            fields.update(last_run_id=run_id, search_keyword=keyword, search_area=area)
            update_lead(db, ex["id"], fields)
            upd += 1
    return new, upd


def _enrich_stage(run: dict) -> None:
    run_id = run["id"]
    stats = json.loads(run.get("stats") or "{}")
    with get_db() as db:
        leads = [row_to_dict(r) for r in db.execute(
            """SELECT * FROM leads WHERE enrich_run_id = ? AND enriched_at IS NULL
               ORDER BY job_count IS NULL, job_count DESC, id LIMIT ?""", (run_id, ENRICH_STEP))]

    if leads:
        search_budget = int(env("LEAD_SEARCH_LIMIT", "50")) - stats.get("searched", 0)
        changes = enrich_leads(leads, search_budget, stats)
        with get_db() as db:
            for lead_id, fields in changes.items():
                fields["enriched_at"] = now()
                update_lead(db, lead_id, fields)
            update_run(db, run_id, enrich_done=run["enrich_done"] + len(leads), stats=json.dumps(stats))

    with get_db() as db:
        remain = db.execute("SELECT COUNT(*) c FROM leads WHERE enrich_run_id = ? AND enriched_at IS NULL",
                            (run_id,)).fetchone()["c"]
        if remain == 0:
            summary = _stats_summary(stats)
            left = db.execute("SELECT COUNT(*) c FROM leads WHERE enriched_at IS NULL").fetchone()["c"]
            if left:
                summary.append(f"未調査が {left}件 残っています。「HP・メールを探す」で続きを調査できます")
            update_run(db, run_id, status="done", finished_at=now(),
                       message="\n".join(x for x in [run["message"], *summary] if x))


def _stats_summary(s: dict) -> list[str]:
    out = []
    if s.get("searched"):
        out.append(f"Web検索（HP無し {s['searched']}件）: 公式サイト発見 {s.get('web_found', 0)}件 / SNS発見 {s.get('sns_found', 0)}件")
    if s.get("search_skipped"):
        out.append(f"HP無し {s['search_skipped']}件: Web検索APIキー未設定 or 上限のため検索をスキップ")
    if s.get("sites"):
        out.append(f"公式サイト巡回: {s.get('sites_ok', 0)}/{s['sites']}件を取得（メール判明 {s.get('emails', 0)}件 / PHP使用 {s.get('php', 0)}件）")
    if s.get("geo"):
        out.append(f"住所→地図位置: {s.get('geo_ok', 0)}/{s['geo']}件")
    return out


def _safely(logs: list, label: str, fn):
    try:
        return fn()
    except Exception as e:  # noqa: BLE001
        logs.append(f"{label}: 失敗（{str(e)[:200]}）")
        return []


# =====================================================================
# 収集元
# =====================================================================
def hellowork_row(x: dict) -> dict | None:
    """ハローワーク事業所 1 件（API / CSV 共通）→ leads 行"""
    name = (x.get("employer_name") or x.get("name") or x.get("会社名") or x.get("事業所名") or "").strip()
    if not name:
        return None
    pref = (x.get("prefecture") or x.get("都道府県") or "").strip()
    city = (x.get("city") or x.get("市区町村") or "").strip()
    address = (x.get("office_address") or x.get("address") or x.get("住所") or "").strip() or (pref + city) or None
    website = normalize_website(x.get("homepage_url") or x.get("website") or x.get("ホームページ"))
    jc = x.get("job_count") or x.get("求人数")
    return {
        "source": "hellowork",
        "external_id": "hw:" + _md5(f"{normalize_name(name)}|{pref}|{city}"),
        "name": name[:250],
        "category": (x.get("industry") or x.get("category") or x.get("業種") or None),
        "address": address,
        "phone": x.get("phone") or x.get("電話番号") or None,
        "website": website,
        "has_website": 1 if website else 0,
        "website_found_by": "hellowork" if website else None,
        "job_count": int(jc) if str(jc or "").isdigit() else None,
    }


def fetch_google(keyword: str, area: str, logs: list) -> list[dict]:
    key = env("GOOGLE_PLACES_API_KEY")
    mask = ",".join([
        "places.id", "places.displayName", "places.formattedAddress", "places.location",
        "places.nationalPhoneNumber", "places.websiteUri", "places.primaryTypeDisplayName", "places.rating",
        "places.userRatingCount", "places.googleMapsUri", "places.businessStatus", "nextPageToken",
    ])
    results, token = [], None
    for _ in range(3):  # 最大60件（APIの上限）
        body = {"textQuery": f"{keyword} {area}".strip(), "languageCode": "ja", "regionCode": "JP", "pageSize": 20}
        if token:
            body["pageToken"] = token
        res = requests.post("https://places.googleapis.com/v1/places:searchText", json=body, timeout=20,
                            headers={"X-Goog-Api-Key": key, "X-Goog-FieldMask": mask})
        if res.status_code != 200:
            msg = (res.json().get("error", {}) if res.headers.get("content-type", "").startswith("application/json") else {}).get("message")
            raise RuntimeError(f"Places API エラー: {msg or res.status_code}")
        data = res.json()
        for p in data.get("places", []):
            if p.get("businessStatus") == "CLOSED_PERMANENTLY":
                continue
            loc = p.get("location") or {}
            results.append({
                "source": "google", "external_id": p["id"],
                "name": (p.get("displayName") or {}).get("text") or "(名称不明)",
                "category": (p.get("primaryTypeDisplayName") or {}).get("text"),
                "address": clean_address(p.get("formattedAddress")),
                "phone": p.get("nationalPhoneNumber"), "website": p.get("websiteUri"),
                "lat": loc.get("latitude"), "lng": loc.get("longitude"),
                "google_maps_url": p.get("googleMapsUri"),
                "rating": p.get("rating"), "review_count": p.get("userRatingCount"),
            })
        token = data.get("nextPageToken")
        if not token:
            break
        time.sleep(0.5)
    logs.append(f"Googleマップ: {len(results)}件")
    return results


def fetch_osm(keyword: str, area: str, logs: list) -> list[dict]:
    s = http()
    geo = s.get("https://nominatim.openstreetmap.org/search", timeout=20,
                params={"q": area, "format": "json", "limit": 1, "countrycodes": "jp"}).json()
    if not geo or not geo[0].get("boundingbox"):
        logs.append(f"OpenStreetMap: エリア「{area}」が見つかりませんでした")
        return []
    south, north, west, east = map(float, geo[0]["boundingbox"])
    if north - south > 0.3 or east - west > 0.3:
        lat, lon = float(geo[0]["lat"]), float(geo[0]["lon"])
        south, north, west, east = lat - 0.15, lat + 0.15, lon - 0.18, lon + 0.18
        logs.append("OpenStreetMap: エリアが広いため中心部（約30km四方）に絞って検索")
    bbox = f"{south:.5f},{west:.5f},{north:.5f},{east:.5f}"

    kw = overpass_regex(keyword)
    filters = [f'nwr["name"~"{kw}",i][~"^(shop|office|amenity|craft|healthcare|tourism|leisure|company)$"~"."]({bbox});']
    for jp, tags in OSM_TAG_MAP.items():
        if jp in keyword:
            filters += [f'nwr["{k}"="{v}"]["name"]({bbox});' for k, v in tags.items()]
    query = "[out:json][timeout:60];(" + "".join(dict.fromkeys(filters)) + ");out center tags 300;"
    res = s.post("https://overpass-api.de/api/interpreter", data={"data": query}, timeout=90)
    res.raise_for_status()

    results = []
    for el in res.json().get("elements", []):
        t = el.get("tags", {})
        if not t.get("name"):
            continue
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lng = el.get("lon") or (el.get("center") or {}).get("lon")
        row = {
            "source": "osm", "external_id": f"{el['type']}/{el['id']}", "name": t["name"],
            "category": osm_category(t), "address": osm_address(t),
            "phone": t.get("phone") or t.get("contact:phone"), "email": t.get("email") or t.get("contact:email"),
            "website": t.get("website") or t.get("contact:website") or t.get("url"),
            "lat": lat, "lng": lng,
            "google_maps_url": f"https://www.google.com/maps/search/?api=1&query={quote(t['name'])}%20{lat},{lng}" if lat else None,
        }
        for field in SNS_FIELDS:
            v = t.get(f"contact:{field}") or (t.get("contact:x") if field == "twitter" else None)
            if v:
                row[field] = osm_sns_value(field, v)
        results.append(row)
    logs.append(f"OpenStreetMap: {len(results)}件")
    return results


def dedupe(places: list[dict]) -> list[dict]:
    """同名・近接（200m以内）を統合。Google を優先し OSM の SNS 等で穴埋め"""
    places = sorted(places, key=lambda p: 0 if p["source"] == "google" else 1)
    out: list[dict] = []
    for p in places:
        for o in out:
            if normalize_name(o["name"]) != normalize_name(p["name"]):
                continue
            if o.get("lat") and p.get("lat") and distance_m(o["lat"], o["lng"], p["lat"], p["lng"]) > 200:
                continue
            for k, v in p.items():
                if k not in ("source", "external_id") and not o.get(k) and v:
                    o[k] = v
            break
        else:
            out.append(dict(p))
    return out


# =====================================================================
# 補完（HP・メール・SNS・位置）
# =====================================================================
def enrich_leads(leads: list[dict], search_budget: int, stats: dict) -> dict[int, dict]:
    """leads（dict）を調査し、{lead_id: 更新フィールド} を返す。stats は集計用に更新"""
    changes: dict[int, dict] = {l["id"]: {} for l in leads}

    def setf(lead, k, v):
        lead[k] = v
        changes[lead["id"]][k] = v

    # 0) Google の「ウェブサイト」が SNS の場合は振り分け、URL を正規化
    for l in leads:
        if l.get("website"):
            sns = classify_sns_url(l["website"])
            if sns:
                if not l.get(sns[0]):
                    setf(l, sns[0], sns[1])
                setf(l, "website", None); setf(l, "has_website", 0); setf(l, "website_found_by", None)
            else:
                w = normalize_website(l["website"])
                if w != l["website"]:
                    setf(l, "website", w); setf(l, "has_website", 1 if w else 0)

    # 1) HPが無い企業 → Web検索（Brave の無料プランは 1 req/sec）
    key = env("BRAVE_SEARCH_API_KEY")
    for l in [x for x in leads if not x.get("website")]:
        if not key or search_budget <= 0:
            stats["search_skipped"] = stats.get("search_skipped", 0) + 1
            continue
        search_budget -= 1
        stats["searched"] = stats.get("searched", 0) + 1
        try:
            q = f"\"{l['name']}\" {city_from_address(l.get('address'))}".strip()
            res = requests.get("https://api.search.brave.com/res/v1/web/search", timeout=15,
                               headers={"X-Subscription-Token": key, "Accept": "application/json"},
                               params={"q": q, "count": 10, "country": "JP", "search_lang": "jp"})
            if res.status_code == 200:
                upd, web, sns = pick_from_search_results(l, res.json().get("web", {}).get("results", []))
                for k, v in upd.items():
                    setf(l, k, v)
                stats["web_found"] = stats.get("web_found", 0) + int(web)
                stats["sns_found"] = stats.get("sns_found", 0) + int(sns)
            elif res.status_code == 429:
                time.sleep(2)
        except requests.RequestException:
            pass
        time.sleep(1.05)

    # 2) サイト巡回 と 3) 住所→位置 を並列実行
    def work(l):
        out = {}
        if l.get("website"):
            out["site"] = crawl_site(l["website"])
        if l.get("lat") is None and l.get("address"):
            out["geo"] = geocode(l["address"])
        return l, out

    with ThreadPoolExecutor(max_workers=6) as ex:
        for l, out in ex.map(work, leads):
            if "site" in out:
                stats["sites"] = stats.get("sites", 0) + 1
                site = out["site"]
                if site is not None:
                    stats["sites_ok"] = stats.get("sites_ok", 0) + 1
                    for f, u in site["sns"].items():
                        if not l.get(f):
                            setf(l, f, u)
                    if site["email"] and not l.get("email"):
                        setf(l, "email", site["email"])
                        stats["emails"] = stats.get("emails", 0) + 1
                    t = site["tech"]
                    setf(l, "uses_php", 1 if t["php"] else 0)
                    setf(l, "php_version", t["php_version"])
                    setf(l, "php_status", techdetect.php_status(t["php_version"]) if t["php"] else None)
                    setf(l, "cms", t["cms"])
                    setf(l, "tech_evidence", t["evidence"] or None)
                    setf(l, "tech_checked_at", now())
                    if site["no_sales"]:
                        setf(l, "no_sales_email", 1)
                    if t["php"]:
                        stats["php"] = stats.get("php", 0) + 1
            if "geo" in out:
                stats["geo"] = stats.get("geo", 0) + 1
                if out["geo"]:
                    stats["geo_ok"] = stats.get("geo_ok", 0) + 1
                    setf(l, "lat", out["geo"][0]); setf(l, "lng", out["geo"][1])
                    if not l.get("google_maps_url"):
                        setf(l, "google_maps_url", "https://www.google.com/maps/search/?api=1&query="
                             + quote(f"{l['name']} {l['address']}"))
    return changes


def crawl_site(url: str) -> dict | None:
    """トップページ（＋必要ならお問い合わせ/会社概要ページ）から SNS・メール・使用技術を調べる"""
    page = fetch_page_full(url)
    if page is None:
        return None
    html, headers, final_url = page
    host = urlparse(url).hostname
    tech = techdetect.detect(headers, html, final_url)
    no_sales = techdetect.no_sales_notice(html)
    sns = extract_sns_links(html)
    email = extract_email(html, host)
    for u in contact_links(html, final_url):
        if email and no_sales:
            break
        sub = fetch_page_full(u)
        if sub is None:
            continue
        for f, v in extract_sns_links(sub[0]).items():
            sns.setdefault(f, v)
        email = email or extract_email(sub[0], host)
        no_sales = no_sales or techdetect.no_sales_notice(sub[0])
        if not tech["php"]:
            t2 = techdetect.detect(sub[1], sub[0], sub[2])
            if t2["php"]:
                tech = t2
        if email:
            break
    return {"sns": sns, "email": email, "tech": tech, "no_sales": no_sales}


def fetch_page(url: str) -> str | None:
    page = fetch_page_full(url)
    return page[0] if page else None


def fetch_page_full(url: str) -> tuple[str, dict, str] | None:
    """(html, レスポンスヘッダー, 最終URL)"""
    if not is_safe_public_url(url):
        return None
    try:
        res = http().get(url, timeout=10, allow_redirects=True, stream=True)
        if res.status_code != 200 or len(res.history) > 3:
            return None
        buf = bytearray()
        for chunk in res.iter_content(65536):
            buf += chunk
            if len(buf) >= 2_000_000:
                break
        res.close()
        headers = dict(res.headers)
        # 複数の Set-Cookie をまとめて判定できるように
        try:
            headers["Set-Cookie"] = "; ".join(res.raw.headers.getlist("Set-Cookie")) or headers.get("Set-Cookie", "")
        except AttributeError:
            pass
        return decode_html(bytes(buf), res.headers.get("content-type")), headers, res.url
    except (requests.RequestException, OSError, ValueError):
        return None


def decode_html(raw: bytes, content_type: str | None) -> str:
    charset = None
    m = re.search(r"charset=([\w\-]+)", content_type or "", re.I)
    if m:
        charset = m.group(1)
    else:
        m = re.search(rb"<meta[^>]+charset=[\"']?([\w\-]+)", raw[:5000], re.I)
        if m:
            charset = m.group(1).decode("ascii", "ignore")
    cs = (charset or "utf-8").lower()
    if cs in ("shift_jis", "shift-jis", "sjis", "x-sjis", "windows-31j", "cp932"):
        cs = "cp932"
    elif cs in ("euc-jp", "eucjp"):
        cs = "euc_jis_2004"
    try:
        return raw.decode(cs, errors="replace")
    except LookupError:
        return raw.decode("utf-8", errors="replace")


def geocode(address: str) -> tuple[float, float] | None:
    """国土地理院 住所検索API（キー不要）"""
    try:
        res = http().get("https://msearch.gsi.go.jp/address-search/AddressSearch", params={"q": address}, timeout=10)
        data = res.json()
        c = data[0]["geometry"]["coordinates"] if data else None
        if c and len(c) == 2:
            return float(c[1]), float(c[0])
    except (requests.RequestException, ValueError, KeyError, IndexError, TypeError):
        pass
    return None


def pick_from_search_results(lead: dict, results: list[dict]) -> tuple[dict, bool, bool]:
    """検索結果から公式サイトと SNS を選ぶ。タイトル/説明に社名を含むものだけ採用し、ポータルは除外"""
    key = normalize_name(lead["name"])
    upd: dict = {}
    web = sns = False
    if not key:
        return upd, web, sns
    for r in results:
        url = r.get("url") or ""
        text = normalize_name(re.sub(r"<[^>]+>", "", (r.get("title") or "") + (r.get("description") or "")))
        if key not in text:
            continue
        s = classify_sns_url(url)
        if s:
            if not lead.get(s[0]) and s[0] not in upd:
                upd[s[0]] = s[1]
                sns = True
            continue
        if not lead.get("website") and "website" not in upd and not is_portal(url):
            p = urlparse(url)
            upd.update(website=f"{p.scheme or 'https'}://{p.hostname}/", has_website=1, website_found_by="search")
            web = True
    return upd, web, sns


# =====================================================================
# 抽出・判定ユーティリティ
# =====================================================================
URL_RE = re.compile(r"https?://[^\s\"'<>()\\]+", re.I)


def extract_sns_links(html: str) -> dict:
    found: dict = {}
    for url in URL_RE.findall(html):
        s = classify_sns_url(htmllib.unescape(url))
        if s and s[0] not in found:
            found[s[0]] = s[1]
    return found


def classify_sns_url(url: str) -> tuple[str, str] | None:
    """SNS のプロフィール/ページなら (field, 正規化URL)。シェアボタン・投稿URL等は除外"""
    try:
        p = urlparse(url.strip())
    except ValueError:
        return None
    if not p.hostname:
        return None
    host = re.sub(r"^(www\.|m\.|mobile\.|ja-jp\.|ja\.)", "", p.hostname.lower())
    segs = [s for s in p.path.split("/") if s]
    first = segs[0].lower() if segs else ""

    if host == "instagram.com":
        if not first or first in {"p", "reel", "reels", "explore", "accounts", "stories", "share", "tv", "about", "developer", "legal"}:
            return None
        return "instagram", f"https://www.instagram.com/{segs[0]}/"
    if host in ("twitter.com", "x.com"):
        if not first or first in {"share", "intent", "home", "search", "hashtag", "i", "login", "signup", "widgets", "tos", "privacy", "settings", "explore"}:
            return None
        if not re.fullmatch(r"[A-Za-z0-9_]{1,15}", segs[0]):
            return None
        return "twitter", f"https://x.com/{segs[0]}"
    if host in ("facebook.com", "fb.com", "fb.me"):
        if not first or first in {"sharer", "sharer.php", "share", "share.php", "dialog", "plugins", "tr", "login", "login.php",
                                  "policy", "privacy", "help", "watch", "events", "hashtag", "photo.php", "photo", "story.php",
                                  "permalink.php", "groups", "v2.0", "v3.0", "business"}:
            return None
        if first == "profile.php":
            pid = parse_qs(p.query).get("id", [None])[0]
            return ("facebook", f"https://www.facebook.com/profile.php?id={pid}") if pid else None
        if first == "pages" and len(segs) >= 2:
            return "facebook", "https://www.facebook.com/" + "/".join(segs[:3])
        return "facebook", f"https://www.facebook.com/{segs[0]}"
    if host == "tiktok.com":
        return ("tiktok", f"https://www.tiktok.com/{segs[0]}") if first.startswith("@") else None
    if host == "youtube.com":
        if first.startswith("@"):
            return "youtube", f"https://www.youtube.com/{segs[0]}"
        if first in ("channel", "c", "user") and len(segs) > 1:
            return "youtube", f"https://www.youtube.com/{segs[0]}/{segs[1]}"
        return None
    if host == "lin.ee":
        return ("line", f"https://lin.ee/{segs[0]}") if first else None
    if host == "line.me":
        return ("line", f"https://line.me{p.path.rstrip('/')}") if first in ("r", "ti") or "/ti/p/" in p.path else None
    if host == "page.line.me":
        return ("line", f"https://page.line.me/{segs[0]}") if first else None
    return None


EMAIL_RE = re.compile(r"([A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,})")
EMAIL_NG = re.compile(r"(example\.|sentry|wixpress|\.(png|jpe?g|gif|webp|svg|css|js)$|@[0-9]+x\.|domain\.com|yourdomain|xxx)")


def extract_email(html: str, site_host: str | None = None) -> str | None:
    text = htmllib.unescape(html)
    for a, b in (("＠", "@"), ("[at]", "@"), ("(at)", "@"), ("［at］", "@")):
        text = text.replace(a, b)
    cands = []
    for e in EMAIL_RE.findall(text):
        e = e.lower()
        if not EMAIL_NG.search(e) and e not in cands:
            cands.append(e)
    if not cands:
        return None
    site = re.sub(r"^www\.", "", (site_host or "").lower())
    if site:
        for e in cands:
            d = e.split("@", 1)[1]
            if d == site or site.endswith("." + d) or d.endswith("." + site):
                return e
    return cands[0]


def contact_links(html: str, base: str) -> list[str]:
    base_host = re.sub(r"^www\.", "", (urlparse(base).hostname or "").lower())
    hits: list[str] = []
    for href, text in re.findall(r"<a\s[^>]*href=[\"']([^\"'#]+)[\"'][^>]*>(.*?)</a>", html, re.I | re.S):
        if not CONTACT_RE.search(href + " " + re.sub(r"<[^>]+>", "", text)):
            continue
        href = htmllib.unescape(href.strip())
        if re.match(r"^(mailto|tel|javascript):", href, re.I):
            continue
        absu = urljoin(base, href)
        if re.sub(r"^www\.", "", (urlparse(absu).hostname or "").lower()) != base_host:
            continue
        if absu not in hits:
            hits.append(absu)
        if len(hits) >= 2:
            break
    return hits


def is_portal(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return not host or any(p in host for p in PORTALS)


def is_safe_public_url(url: str | None) -> bool:
    """SSRF 対策: http(s) かつ プライベート/予約済み IP に解決されないホストのみ"""
    if not url:
        return False
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        return False
    try:
        infos = socket.getaddrinfo(p.hostname, None)
    except (socket.gaierror, UnicodeError):
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local or ip.is_multicast:
            return False
    return True


def normalize_website(url) -> str | None:
    url = unicodedata.normalize("NFKC", str(url or "")).strip()
    if not url or url in ("なし", "無し", "-", "－"):
        return None
    if not re.match(r"^https?://", url, re.I):
        url = "http://" + url.lstrip("/")
    p = urlparse(url)
    return url if p.hostname and "." in p.hostname and " " not in url else None


def normalize_name(name: str) -> str:
    n = unicodedata.normalize("NFKC", name or "").lower()
    return re.sub(r"(株式会社|有限会社|合同会社|\(株\)|\(有\)|[\s・\-‐－_.,、。()（）「」])", "", n)


def overpass_regex(s: str) -> str:
    words = [w for w in re.split(r"[\s　]+", s.strip()) if w]
    return "|".join(re.escape(w).replace("\\", "\\\\").replace('"', '\\"') for w in words)


def osm_category(t: dict) -> str | None:
    for k in ("shop", "office", "amenity", "craft", "healthcare", "tourism", "leisure", "company"):
        if t.get(k):
            return CATEGORY_LABELS.get(t[k], f"{k}={t[k]}")
    return None


def osm_address(t: dict) -> str | None:
    if t.get("addr:full"):
        return t["addr:full"]
    block = t.get("addr:block_number")
    house = t.get("addr:housenumber")
    num = f"{block}-{house}" if block and house else (block or house)
    parts = [t.get("addr:province") or t.get("addr:state"), t.get("addr:city"), t.get("addr:suburb"),
             t.get("addr:quarter"), t.get("addr:neighbourhood"), num]
    s = "".join(p for p in parts if p)
    return s or None


def osm_sns_value(field: str, v: str) -> str:
    v = v.strip()
    if re.match(r"^https?://", v, re.I):
        c = classify_sns_url(v)
        return c[1] if c else v
    h = v.lstrip("@")
    return {
        "instagram": f"https://www.instagram.com/{h}/", "twitter": f"https://x.com/{h}",
        "facebook": f"https://www.facebook.com/{h}", "tiktok": f"https://www.tiktok.com/@{h}",
        "youtube": f"https://www.youtube.com/@{h}",
    }.get(field, v)


def clean_address(a: str | None) -> str | None:
    if not a:
        return None
    return re.sub(r"^〒\d{3}-\d{4}\s*", "", re.sub(r"^日本、\s*", "", a)).strip()


def city_from_address(a: str | None) -> str:
    m = re.match(r"^(.+?[都道府県])?(.+?[市区町村])", a or "")
    return m.group(0) if m else ""


def distance_m(lat1, lng1, lat2, lng2) -> float:
    d_lat, d_lng = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
    return 2 * 6371000 * asin(min(1, sqrt(a)))


def _md5(s: str) -> str:
    import hashlib
    return hashlib.md5(s.encode()).hexdigest()
