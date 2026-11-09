"""
営業メールの自動送信。

特定電子メール法に沿った安全策を組み込んでいる:
  - 送信者名・住所・連絡先・配信停止リンクを全メールのフッターに必ず付ける（テンプレートから消せない）
  - 配信停止したアドレス（suppressions）には二度と送らない。List-Unsubscribe（ワンクリック停止）ヘッダー付き
  - サイトに「営業メールお断り」等の表記がある企業には送らない
  - 同じアドレスへは同じキャンペーンで 1 回だけ、別キャンペーンでも 14 日以内は再送しない
  - 1 日の上限・送信間隔を設けて少しずつ送る（迷惑メール判定・SMTP 制限の回避）
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from urllib.parse import quote

from db import get_db, now, row_to_dict
from techdetect import PHP_EOL

TARGETS = {
    "all": "メールアドレスのある全企業",
    "php": "PHP製サイトの企業",
    "php_old": "PHPがサポート終了・終了間近の企業",
}
SKIP_STATUSES = ("negotiating", "won", "lost", "excluded")
RESEND_GAP_DAYS = 14

DEFAULT_TEMPLATES = {
    "php_old": {
        "subject": "【{会社名} ご担当者様】ホームページのPHPバージョンについてのご案内",
        "body": (
            "{会社名}\nご担当者様\n\n"
            "突然のご連絡失礼いたします。\n\n"
            "貴社ホームページ（{ホームページ}）を拝見したところ、{PHP状況}。\n"
            "サポートが終了したバージョンは、新たな脆弱性が見つかっても修正版が提供されないため、"
            "改ざんや情報漏えいのリスクが高まります。\n\n"
            "弊社では、PHPのバージョンアップやサイトのリニューアル、保守運用をお手伝いしております。\n"
            "現状の簡易診断は無料で承りますので、ご興味がございましたら本メールにご返信ください。\n\n"
            "何卒よろしくお願いいたします。"
        ),
    },
    "php": {
        "subject": "【{会社名} ご担当者様】ホームページの保守・セキュリティ対策のご案内",
        "body": (
            "{会社名}\nご担当者様\n\n"
            "突然のご連絡失礼いたします。\n\n"
            "貴社ホームページ（{ホームページ}）はPHP{CMS補足}で構築されているようです。\n"
            "PHPやCMSは定期的なバージョンアップを行わないと、公開済みの脆弱性を突かれる恐れがあります。\n\n"
            "弊社では、サーバー・PHP・CMSの更新や保守運用をお手伝いしております。\n"
            "現状の簡易診断は無料で承りますので、ご興味がございましたら本メールにご返信ください。\n\n"
            "何卒よろしくお願いいたします。"
        ),
    },
    "all": {
        "subject": "【{会社名} ご担当者様】ご案内",
        "body": "{会社名}\nご担当者様\n\n突然のご連絡失礼いたします。\n\n（ここにご案内内容を書いてください）\n\n何卒よろしくお願いいたします。",
    },
}


def env(k: str, d: str = "") -> str:
    return os.environ.get(k, "") or d


# ---------------------------------------------------------------------
# 設定チェック
# ---------------------------------------------------------------------
def config_status() -> dict:
    required = {
        "SMTP_HOST": "SMTPサーバー", "MAIL_FROM": "送信元アドレス", "SENDER_COMPANY": "送信者名（会社名）",
        "SENDER_ADDRESS": "送信者の住所", "PUBLIC_BASE_URL": "ダッシュボードのURL（配信停止リンク用）",
        "SECRET_KEY": "SECRET_KEY",
    }
    missing = [f"{k}（{label}）" for k, label in required.items() if not env(k)]
    return {
        "ready": not missing, "missing": missing,
        "from": env("MAIL_FROM"), "daily_limit": int(env("SEND_DAILY_LIMIT", "100")),
        "interval": int(env("SEND_INTERVAL_SEC", "20")),
    }


# ---------------------------------------------------------------------
# 配信停止
# ---------------------------------------------------------------------
def unsubscribe_token(email: str) -> str:
    return hmac.new(env("SECRET_KEY").encode(), email.strip().lower().encode(), hashlib.sha256).hexdigest()[:32]


def unsubscribe_url(email: str) -> str:
    base = env("PUBLIC_BASE_URL").rstrip("/")
    return f"{base}/u?e={quote(email)}&t={unsubscribe_token(email)}"


def verify_unsubscribe(email: str, token: str) -> bool:
    return bool(email and token and env("SECRET_KEY")) and hmac.compare_digest(unsubscribe_token(email), token)


def suppress(email: str, reason: str) -> None:
    with get_db() as db:
        db.execute("INSERT OR IGNORE INTO suppressions (email, reason, created_at) VALUES (?, ?, ?)",
                   (email.strip().lower(), reason, now()))


# ---------------------------------------------------------------------
# 本文の組み立て
# ---------------------------------------------------------------------
def php_label(lead: dict) -> str:
    v, st = lead.get("php_version"), lead.get("php_status")
    if not v:
        return "PHPで構築されているようです（バージョンは非公開）"
    m = re.match(r"(\d+)\.(\d+)", v)
    key = m.group(1) if m and m.group(1) == "5" else (f"{m.group(1)}.{m.group(2)}" if m else "")
    eol = PHP_EOL.get(key)
    when = f"{eol.year}年{eol.month}月" if eol else ""
    if st == "eol":
        return f"PHP {v} が使われており、このバージョンは{when}に公式のセキュリティサポートが終了しています"
    if st == "near_eol":
        return f"PHP {v} が使われており、このバージョンは{when}に公式のセキュリティサポートが終了予定です"
    return f"PHP {v} が使われています"


def render(campaign: dict, lead: dict) -> tuple[str, str]:
    cms = lead.get("cms") or ""
    values = {
        "会社名": lead.get("name") or "", "住所": lead.get("address") or "", "業種": lead.get("category") or "",
        "ホームページ": lead.get("website") or "", "PHPバージョン": lead.get("php_version") or "不明",
        "PHP状況": php_label(lead), "CMS": cms, "CMS補足": f"（{cms}）" if cms else "",
    }

    def fill(t: str) -> str:
        return re.sub(r"\{([^{}]+)\}", lambda m: values.get(m.group(1), m.group(0)), t)

    footer = (
        "\n\n――――――――――――――――――――\n"
        f"送信者：{env('SENDER_COMPANY')}\n"
        f"住所：{env('SENDER_ADDRESS')}\n"
        f"連絡先：{env('SENDER_CONTACT') or env('MAIL_FROM')}\n"
        "本メールは貴社ウェブサイトで公開されているメールアドレス宛にお送りしています。\n"
        "今後このようなご案内が不要な場合は、お手数ですが下記より配信停止してください。\n"
        f"{unsubscribe_url(lead.get('email') or '')}\n"
    )
    return fill(campaign["subject"]).replace("\n", " ")[:200], fill(campaign["body"]) + footer


def build_message(campaign: dict, lead: dict, to: str | None = None) -> EmailMessage:
    subject, body = render(campaign, lead)
    to = to or lead["email"]
    msg = EmailMessage()
    msg["From"] = formataddr((env("MAIL_FROM_NAME") or env("SENDER_COMPANY"), env("MAIL_FROM")))
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=env("MAIL_FROM").split("@")[-1] or None)
    if env("MAIL_REPLY_TO"):
        msg["Reply-To"] = env("MAIL_REPLY_TO")
    msg["List-Unsubscribe"] = f"<{unsubscribe_url(lead.get('email') or to)}>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    msg.set_content(body)
    return msg


def smtp_send(msg: EmailMessage) -> None:
    host, port = env("SMTP_HOST"), int(env("SMTP_PORT", "587"))
    security = env("SMTP_SECURITY", "starttls").lower()
    ctx = ssl.create_default_context()
    if security == "ssl":
        server = smtplib.SMTP_SSL(host, port, timeout=30, context=ctx)
    else:
        server = smtplib.SMTP(host, port, timeout=30)
        if security == "starttls":
            server.starttls(context=ctx)
    try:
        if env("SMTP_USER"):
            server.login(env("SMTP_USER"), env("SMTP_PASSWORD"))
        server.send_message(msg)
    finally:
        try:
            server.quit()
        except smtplib.SMTPException:
            pass


# ---------------------------------------------------------------------
# 対象の抽出
# ---------------------------------------------------------------------
def _target_sql(target: str) -> str:
    cond = [
        "l.email IS NOT NULL", "l.no_sales_email = 0",
        f"l.status NOT IN ({','.join(repr(s) for s in SKIP_STATUSES)})",
        "lower(l.email) NOT IN (SELECT email FROM suppressions)",
    ]
    if target == "php":
        cond.append("l.uses_php = 1")
    elif target == "php_old":
        cond.append("l.php_status IN ('eol','near_eol')")
    return " AND ".join(cond)


def pending_query(campaign_id: int, target: str) -> tuple[str, list]:
    gap = (datetime.now(timezone.utc) - timedelta(days=RESEND_GAP_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    sql = f"""FROM leads l WHERE {_target_sql(target)}
        AND NOT EXISTS (SELECT 1 FROM email_log g WHERE g.campaign_id = ? AND (g.lead_id = l.id OR lower(g.email) = lower(l.email)))
        AND NOT EXISTS (SELECT 1 FROM email_log g WHERE lower(g.email) = lower(l.email) AND g.status = 'sent' AND g.sent_at > ?)"""
    return sql, [campaign_id, gap]


def _today_start() -> str:
    # 日本時間の 0 時（UTC で保存しているため換算）
    jst = timezone(timedelta(hours=9))
    t = datetime.now(jst).replace(hour=0, minute=0, second=0, microsecond=0)
    return t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def campaign_stats(db, c: dict) -> dict:
    sql, params = pending_query(c["id"], c["target"])
    one = lambda q, p=(): db.execute(q, p).fetchone()[0]  # noqa: E731
    return {
        "pending": one(f"SELECT COUNT(*) {sql}", params),
        "sent": one("SELECT COUNT(*) FROM email_log WHERE campaign_id = ? AND status = 'sent'", (c["id"],)),
        "failed": one("SELECT COUNT(*) FROM email_log WHERE campaign_id = ? AND status = 'failed'", (c["id"],)),
        "sent_today": one("SELECT COUNT(*) FROM email_log WHERE campaign_id = ? AND status = 'sent' AND sent_at >= ?",
                          (c["id"], _today_start())),
        "blocked_no_sales": one(f"SELECT COUNT(*) FROM leads l WHERE l.email IS NOT NULL AND l.no_sales_email = 1"
                                + (" AND l.uses_php = 1" if c["target"] == "php" else "")
                                + (" AND l.php_status IN ('eol','near_eol')" if c["target"] == "php_old" else "")),
    }


# ---------------------------------------------------------------------
# 送信（ブラウザ or 常駐ワーカーから定期的に呼ばれる）
# ---------------------------------------------------------------------
def send_step() -> dict:
    """有効なキャンペーンから 1 通送る。送信間隔・1日の上限を守る"""
    cfg = config_status()
    if not cfg["ready"]:
        return {"sent": 0, "reason": "not_configured"}
    with get_db() as db:
        last = db.execute("SELECT MAX(sent_at) FROM email_log").fetchone()[0]
        if last and datetime.now(timezone.utc) - datetime.strptime(last, "%Y-%m-%dT%H:%M:%SZ").replace(
                tzinfo=timezone.utc) < timedelta(seconds=cfg["interval"]):
            return {"sent": 0, "reason": "interval"}
        today = db.execute("SELECT COUNT(*) FROM email_log WHERE status = 'sent' AND sent_at >= ?",
                           (_today_start(),)).fetchone()[0]
        if today >= cfg["daily_limit"]:
            return {"sent": 0, "reason": "daily_limit"}

        pick = None
        for c in [row_to_dict(r) for r in db.execute("SELECT * FROM campaigns WHERE active = 1 ORDER BY id")]:
            c_today = db.execute("SELECT COUNT(*) FROM email_log WHERE campaign_id = ? AND status = 'sent' AND sent_at >= ?",
                                 (c["id"], _today_start())).fetchone()[0]
            if c_today >= c["daily_limit"]:
                continue
            sql, params = pending_query(c["id"], c["target"])
            lead = db.execute(f"SELECT l.* {sql} ORDER BY l.php_status = 'eol' DESC, l.job_count DESC, l.id LIMIT 1",
                              params).fetchone()
            if lead:
                pick = (c, row_to_dict(lead))
                break
        if not pick:
            return {"sent": 0, "reason": "nothing"}
        c, lead = pick
        # 先に記録して二重送信を防ぐ（UNIQUE(campaign_id, lead_id)）
        try:
            db.execute("INSERT INTO email_log (campaign_id, lead_id, email, status, sent_at) VALUES (?, ?, ?, 'sending', ?)",
                       (c["id"], lead["id"], lead["email"], now()))
        except Exception:  # noqa: BLE001
            return {"sent": 0, "reason": "race"}

    try:
        smtp_send(build_message(c, lead))
        status, error = "sent", None
    except Exception as e:  # noqa: BLE001
        status, error = "failed", str(e)[:300]
    with get_db() as db:
        db.execute("UPDATE email_log SET status = ?, error = ?, sent_at = ? WHERE campaign_id = ? AND lead_id = ?",
                   (status, error, now(), c["id"], lead["id"]))
        if status == "sent":
            db.execute("UPDATE leads SET status = 'contacted', updated_at = ? WHERE id = ? AND status = 'new'",
                       (now(), lead["id"]))
            # 送信履歴をメモに残す
            db.execute("UPDATE leads SET memo = trim(coalesce(memo, '') || char(10) || ?) WHERE id = ?",
                       (f"[{datetime.now(timezone(timedelta(hours=9))):%Y-%m-%d}] メール送信: {c['name']}", lead["id"]))
    return {"sent": 1 if status == "sent" else 0, "status": status, "to": lead["email"], "campaign": c["name"], "error": error}
