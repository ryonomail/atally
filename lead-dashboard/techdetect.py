"""
公式サイトの技術判定（PHP / CMS / PHP のサポート状況）と「営業メールお断り」表記の検出。

公開ページを 1 回取得したときのレスポンスヘッダーと HTML だけを見る受動的な判定で、
脆弱性スキャン等の能動的な調査は行わない。
"""
from __future__ import annotations

import re
from datetime import date

# PHP 各バージョンのセキュリティサポート終了日（php.net/supported-versions）
PHP_EOL = {
    "5": date(2018, 12, 31), "7.0": date(2019, 1, 10), "7.1": date(2019, 12, 1), "7.2": date(2020, 11, 30),
    "7.3": date(2021, 12, 6), "7.4": date(2022, 11, 28), "8.0": date(2023, 11, 26), "8.1": date(2025, 12, 31),
    "8.2": date(2026, 12, 31), "8.3": date(2027, 12, 31), "8.4": date(2028, 12, 31), "8.5": date(2029, 12, 31),
}
NEAR_EOL_DAYS = 183

# PHP で動く主な CMS / EC
PHP_CMS = [
    (re.compile(r"<meta[^>]+name=[\"']generator[\"'][^>]+content=[\"']WordPress\s*([\d.]*)", re.I), "WordPress"),
    (re.compile(r"/wp-(?:content|includes)/", re.I), "WordPress"),
    (re.compile(r"<meta[^>]+name=[\"']generator[\"'][^>]+content=[\"']EC-CUBE\s*([\d.]*)", re.I), "EC-CUBE"),
    (re.compile(r"eccube|/html/template/", re.I), "EC-CUBE"),
    (re.compile(r"<meta[^>]+name=[\"']generator[\"'][^>]+content=[\"']concrete5?\s*-?\s*([\d.]*)", re.I), "concrete CMS"),
    (re.compile(r"<meta[^>]+name=[\"']generator[\"'][^>]+content=[\"']Joomla!?\s*([\d.]*)", re.I), "Joomla"),
    (re.compile(r"<meta[^>]+name=[\"']generator[\"'][^>]+content=[\"']Drupal\s*([\d.]*)", re.I), "Drupal"),
    (re.compile(r"<meta[^>]+name=[\"']generator[\"'][^>]+content=[\"']a-blog cms\s*([\d.]*)", re.I), "a-blog cms"),
    (re.compile(r"<meta[^>]+name=[\"']generator[\"'][^>]+content=[\"']baserCMS\s*([\d.]*)", re.I), "baserCMS"),
    (re.compile(r"<meta[^>]+name=[\"']generator[\"'][^>]+content=[\"']MODX", re.I), "MODX"),
]

PHP_LINK = re.compile(r"(?:href|src|action)=[\"'][^\"'#?]*\.php(?:[?#\"'])", re.I)

NO_SALES = re.compile(
    r"(営業|広告|勧誘|宣伝|セールス|売り込み)[^。\n<]{0,15}(メール|ﾒｰﾙ|電子メール|e-?mail|ご連絡|連絡|お問い?合わせ|DM)"
    r"[^。\n<]{0,15}(お断り|ご遠慮|禁止|固くお断|受け付けて(?:おりません|いません)|返信(?:いたし|し)(?:かね|ません))",
    re.I,
)


def php_status(version: str | None, today: date | None = None) -> str:
    """eol=サポート終了 / near_eol=半年以内に終了 / supported / unknown"""
    if not version:
        return "unknown"
    today = today or date.today()
    m = re.match(r"(\d+)\.(\d+)", version)
    if not m:
        return "unknown"
    key = m.group(1) if m.group(1) == "5" else f"{m.group(1)}.{m.group(2)}"
    eol = PHP_EOL.get(key)
    if eol is None:
        return "eol" if int(m.group(1)) < 7 else "unknown"
    if eol < today:
        return "eol"
    if (eol - today).days <= NEAR_EOL_DAYS:
        return "near_eol"
    return "supported"


def detect(headers: dict, html: str, url: str = "") -> dict:
    """{'php': bool, 'php_version': str|None, 'cms': str|None, 'evidence': str}"""
    h = {k.lower(): v for k, v in (headers or {}).items()}
    ev: list[str] = []
    version = None

    powered = h.get("x-powered-by", "")
    m = re.search(r"PHP/?\s*([\d.]+)?", powered, re.I)
    if m:
        ev.append(f"X-Powered-By: {powered[:40]}")
        version = m.group(1) or None
    m = re.search(r"PHP/([\d.]+)", h.get("server", ""), re.I)
    if m:
        ev.append(f"Server: {h['server'][:60]}")
        version = version or m.group(1)
    if re.search(r"PHPSESSID", h.get("set-cookie", ""), re.I):
        ev.append("Cookie: PHPSESSID")

    cms = None
    for rx, name in PHP_CMS:
        mm = rx.search(html or "")
        if mm:
            ver = (mm.group(1) if mm.groups() else "") or ""
            cms = f"{name} {ver}".strip()
            ev.append(f"CMS: {cms}")
            break

    if re.search(r"\.php(?:$|\?)", url or "", re.I):
        ev.append("URL: .php")
    elif PHP_LINK.search(html or ""):
        ev.append("リンク: .php")

    return {"php": bool(ev), "php_version": version, "cms": cms, "evidence": " / ".join(ev)[:300]}


def no_sales_notice(html: str) -> bool:
    """「営業メールお断り」等の表記があるか（特定電子メール法上、送信してはいけない）"""
    text = re.sub(r"<[^>]+>", "", html or "")
    return bool(NO_SALES.search(text))
