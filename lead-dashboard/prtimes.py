"""
PR TIMES の公開 RSS フィードから、プレスリリースを出した企業を取り込む。

- 既定は新着フィード https://prtimes.jp/index.rdf。環境変数 PRTIMES_FEEDS（カンマ/改行区切り）で
  企業別・カテゴリ別など別のフィードURLを追加できる
- 取得するのは RSS に含まれる「企業名・リリースのタイトル/URL/日時」だけで、リリース本文ページは巡回しない
- RSS 1.0(RDF) / RSS 2.0 / Atom のどれでも読めるよう、要素名は名前空間を無視して判定する
- 新着フィードは最新分しか載らないため、常駐ワーカーで定期取得（PRTIMES_AUTO_MINUTES）すると企業が貯まっていく
"""
from __future__ import annotations

import hashlib
import os
import re
import unicodedata
import xml.etree.ElementTree as ET

import requests

DEFAULT_FEED = "https://prtimes.jp/index.rdf"
MAX_FEED_BYTES = 5_000_000
USER_AGENT = "Mozilla/5.0 (compatible; LeadCollector/1.0; RSS reader)"

# PR TIMES のリリースURL: https://prtimes.jp/main/html/rd/p/000000123.000045678.html → 企業ID 45678
RELEASE_URL_RE = re.compile(r"/rd/p/\d+\.(\d+)\.html")
COMPANY_ID_RE = re.compile(r"company_id[=/](\d+)")


def feed_urls() -> list[str]:
    extra = [u.strip() for u in re.split(r"[,\s]+", os.environ.get("PRTIMES_FEEDS", "")) if u.strip()]
    urls = [DEFAULT_FEED, *extra]
    return list(dict.fromkeys(u for u in urls if u.startswith(("http://", "https://"))))


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower() if isinstance(tag, str) else ""


def _text(el) -> str:
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip() if el is not None else ""


def parse_feed(xml: bytes) -> list[dict]:
    """RSS1.0/2.0/Atom を [{title, link, description, date, corp}] に"""
    root = ET.fromstring(xml)
    items = []
    for el in root.iter():
        if _local(el.tag) not in ("item", "entry"):
            continue
        d = {"title": "", "link": "", "description": "", "date": "", "corp": ""}
        for ch in el:
            name = _local(ch.tag)
            if name == "title":
                d["title"] = _text(ch)
            elif name == "link":
                d["link"] = d["link"] or (ch.get("href") or _text(ch))
            elif name in ("description", "summary", "content", "encoded") and not d["description"]:
                d["description"] = re.sub(r"<[^>]+>", " ", _text(ch))[:500].strip()
            elif name in ("date", "pubdate", "published", "updated") and not d["date"]:
                d["date"] = _text(ch)
            elif name in ("corp", "company", "publisher"):
                d["corp"] = _text(ch)
            elif name == "author" and not d["corp"]:
                d["corp"] = _text(ch.find("{*}name") if ch.find("{*}name") is not None else ch)
        if not d["link"]:
            d["link"] = el.get("{http://www.w3.org/1999/02/22-rdf-syntax-ns#}about", "")
        items.append(d)
    return items


def company_id(link: str) -> str | None:
    m = RELEASE_URL_RE.search(link or "") or COMPANY_ID_RE.search(link or "")
    return str(int(m.group(1))) if m else None


def company_page(cid: str) -> str:
    return f"https://prtimes.jp/main/html/searchrlp/company_id/{cid}"


def item_to_row(item: dict) -> dict | None:
    name = unicodedata.normalize("NFKC", item.get("corp") or "").strip()
    if not name:
        return None
    cid = company_id(item.get("link", ""))
    ext = f"pt:{cid}" if cid else "pt:" + hashlib.md5(name.encode()).hexdigest()
    return {
        "source": "prtimes",
        "external_id": ext,
        "name": name[:250],
        "release_title": (item.get("title") or "")[:300] or None,
        "release_url": item.get("link") or None,
        "release_date": (item.get("date") or "")[:40] or None,
        "prtimes_url": company_page(cid) if cid else None,
    }


def matches(item: dict, keyword: str) -> bool:
    if not keyword:
        return True
    hay = unicodedata.normalize("NFKC", f"{item.get('title')} {item.get('description')} {item.get('corp')}").lower()
    words = [w for w in re.split(r"[\s　]+", unicodedata.normalize("NFKC", keyword).lower()) if w]
    return any(w in hay for w in words)


def fetch(keyword: str, logs: list) -> list[dict]:
    """全フィードを読み、キーワードに合うリリースの企業を 1 社 1 行（最新リリース）で返す"""
    rows: dict[str, dict] = {}
    total = 0
    for url in feed_urls():
        try:
            res = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20, stream=True)
            res.raise_for_status()
            buf = bytearray()
            for chunk in res.iter_content(65536):
                buf += chunk
                if len(buf) > MAX_FEED_BYTES:
                    raise OSError("フィードが大きすぎます")
            items = parse_feed(bytes(buf))
        except (requests.RequestException, ET.ParseError, OSError) as e:
            logs.append(f"PR TIMES: フィード取得に失敗（{url}）: {str(e)[:150]}")
            continue
        total += len(items)
        for it in items:
            if not matches(it, keyword):
                continue
            row = item_to_row(it)
            if row and row["external_id"] not in rows:  # フィードは新しい順なので最初が最新
                rows[row["external_id"]] = row
    logs.append(f"PR TIMES: リリース {total}件から {len(rows)}社" + (f"（キーワード「{keyword}」で絞り込み）" if keyword else ""))
    return list(rows.values())
