"""
営業リスト ダッシュボード（PythonAnywhere 用 Flask アプリ）
"""
from __future__ import annotations

import csv
import hmac
import io
import os
import secrets
from datetime import datetime
from functools import wraps

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

from flask import (Flask, Response, abort, jsonify, redirect, render_template, request,  # noqa: E402
                   session, url_for)

import collector  # noqa: E402
import deploy  # noqa: E402
from db import SNS_FIELDS, STATUSES, get_db, init_db, now, row_to_dict, update_lead  # noqa: E402

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get("SECRET_KEY") or secrets.token_hex(32),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("SESSION_COOKIE_SECURE", "1") == "1",
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 14,
    MAX_CONTENT_LENGTH=20 * 1024 * 1024,
    JSON_AS_ASCII=False,
)
app.json.ensure_ascii = False
init_db()


# ---------------------------------------------------------------------
# 認証（環境変数 DASHBOARD_PASSWORD のパスワードでログイン）
# ---------------------------------------------------------------------
def login_required(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        if not session.get("auth"):
            if request.path.startswith("/api/"):
                return jsonify(message="ログインが必要です"), 401
            return redirect(url_for("login", next=request.path))
        # CSRF 対策: 更新系 API は自前ヘッダー必須（他サイトのフォームからは付けられない）
        if request.method not in ("GET", "HEAD") and request.headers.get("X-Requested-With") != "fetch":
            abort(403)
        return fn(*a, **kw)
    return wrapper


@app.route("/login", methods=["GET", "POST"])
def login():
    password = os.environ.get("DASHBOARD_PASSWORD", "")
    error = None
    if not password:
        error = "サーバーに DASHBOARD_PASSWORD が設定されていません（.env を確認してください）"
    elif request.method == "POST":
        if hmac.compare_digest(request.form.get("password", "").encode(), password.encode()):
            session.clear()
            session["auth"] = True
            session.permanent = True
            nxt = request.args.get("next") or "/"
            return redirect(nxt if nxt.startswith("/") and not nxt.startswith("//") else "/")
        error = "パスワードが違います"
    return render_template("login.html", error=error)


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
@login_required
def index():
    return render_template("index.html", sources=collector.available_sources())


@app.route("/healthz")
def healthz():
    return jsonify(ok=True, version=deploy.current_revision())


# ---------------------------------------------------------------------
# 一覧・地図・統計
# ---------------------------------------------------------------------
def _filters(args) -> tuple[str, list]:
    where, params = ["1=1"], []
    q = (args.get("q") or "").strip()
    if q:
        like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        where.append("(name LIKE ? ESCAPE '\\' OR address LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')")
        params += [like] * 5
    if args.get("status") in STATUSES:
        where.append("status = ?"); params.append(args["status"])
    if args.get("website") == "yes":
        where.append("has_website = 1")
    elif args.get("website") == "no":
        where.append("has_website = 0 AND enriched_at IS NOT NULL")
    sns = args.get("sns")
    if sns == "any":
        where.append("(" + " OR ".join(f"{f} IS NOT NULL" for f in SNS_FIELDS) + ")")
    elif sns == "none":
        where.append(" AND ".join(f"{f} IS NULL" for f in SNS_FIELDS))
    elif sns in SNS_FIELDS:
        where.append(f"{sns} IS NOT NULL")
    if args.get("email") == "yes":
        where.append("email IS NOT NULL")
    elif args.get("email") == "no":
        where.append("email IS NULL")
    if args.get("source") in ("hellowork", "google", "osm"):
        where.append("source = ?"); params.append(args["source"])
    if (args.get("run_id") or "").isdigit():
        where.append("last_run_id = ?"); params.append(int(args["run_id"]))
    return " AND ".join(where), params


@app.get("/api/leads")
@login_required
def api_leads():
    where, params = _filters(request.args)
    sort = request.args.get("sort") if request.args.get("sort") in ("name", "job_count", "rating", "created_at", "updated_at") else "id"
    direction = "ASC" if request.args.get("dir") == "asc" else "DESC"
    per = min(200, max(10, int(request.args.get("per_page", 50) or 50)))
    page = max(1, int(request.args.get("page", 1) or 1))
    with get_db() as db:
        total = db.execute(f"SELECT COUNT(*) c FROM leads WHERE {where}", params).fetchone()["c"]
        rows = db.execute(
            f"SELECT * FROM leads WHERE {where} ORDER BY {sort} IS NULL, {sort} {direction}, id DESC LIMIT ? OFFSET ?",
            [*params, per, (page - 1) * per]).fetchall()
    last = max(1, -(-total // per))
    return jsonify({"data": [row_to_dict(r) for r in rows], "total": total, "page": page, "last_page": last,
                    "from": (page - 1) * per + 1 if total else 0, "to": min(total, page * per)})


@app.get("/api/leads/map")
@login_required
def api_map():
    where, params = _filters(request.args)
    cols = "id, name, category, address, lat, lng, status, has_website, email, job_count, " + ", ".join(SNS_FIELDS)
    with get_db() as db:
        rows = db.execute(f"SELECT {cols} FROM leads WHERE {where} AND lat IS NOT NULL AND lng IS NOT NULL "
                          "ORDER BY id DESC LIMIT 3000", params).fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.get("/api/stats")
@login_required
def api_stats():
    sns_any = "(" + " OR ".join(f"{f} IS NOT NULL" for f in SNS_FIELDS) + ")"
    with get_db() as db:
        one = lambda sql: db.execute(sql).fetchone()[0]  # noqa: E731
        return jsonify(
            total=one("SELECT COUNT(*) FROM leads"),
            no_website=one("SELECT COUNT(*) FROM leads WHERE has_website = 0 AND enriched_at IS NOT NULL"),
            with_sns=one(f"SELECT COUNT(*) FROM leads WHERE {sns_any}"),
            no_website_with_sns=one(f"SELECT COUNT(*) FROM leads WHERE has_website = 0 AND enriched_at IS NOT NULL AND {sns_any}"),
            with_email=one("SELECT COUNT(*) FROM leads WHERE email IS NOT NULL"),
            unenriched=one("SELECT COUNT(*) FROM leads WHERE enriched_at IS NULL"),
            by_status={r[0]: r[1] for r in db.execute("SELECT status, COUNT(*) FROM leads GROUP BY status")},
            sources=collector.available_sources(),
        )


# ---------------------------------------------------------------------
# 収集・調査
# ---------------------------------------------------------------------
@app.get("/api/runs")
@login_required
def api_runs():
    with get_db() as db:
        rows = db.execute("SELECT * FROM runs ORDER BY id DESC LIMIT 20").fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.post("/api/collect")
@login_required
def api_collect():
    body = request.get_json(silent=True) or {}
    keyword = str(body.get("keyword") or "").strip()[:100]
    area = str(body.get("area") or "").strip()[:100]
    sources = [s for s in body.get("sources") or [] if s in ("hellowork", "google", "osm")]
    if not sources:
        return jsonify(message="収集元を1つ以上選択してください"), 422
    if {"google", "osm"} & set(sources) and (not keyword or not area):
        return jsonify(message="Googleマップ / OpenStreetMap から収集するには業種とエリアの両方を入力してください"), 422
    if collector.active_run_id():
        return jsonify(message="別の収集が実行中です。完了までお待ちください"), 409
    run_id = collector.create_run(keyword, area, sources)
    return jsonify(message="収集を開始しました", run=collector.get_run(run_id)), 202


@app.post("/api/enrich-batch")
@login_required
def api_enrich_batch():
    if collector.active_run_id():
        return jsonify(message="別の収集が実行中です。完了までお待ちください"), 409
    run_id = collector.create_enrich_run()
    if not run_id:
        return jsonify(message="未調査の企業はありません"), 422
    return jsonify(message=f"未調査の企業を最大{collector.ENRICH_BATCH}件調査します", run=collector.get_run(run_id)), 202


@app.post("/api/runs/<int:run_id>/step")
@login_required
def api_step(run_id):
    """ブラウザから繰り返し呼ばれ、収集・調査を少しずつ進める"""
    return jsonify(collector.step(run_id))


@app.post("/api/runs/<int:run_id>/cancel")
@login_required
def api_cancel(run_id):
    with get_db() as db:
        db.execute("UPDATE runs SET status = 'failed', finished_at = ?, message = message || ? "
                   "WHERE id = ? AND status NOT IN ('done','failed')", (now(), "\n中止しました", run_id))
        db.execute("UPDATE leads SET enrich_run_id = NULL WHERE enrich_run_id = ? AND enriched_at IS NULL", (run_id,))
    return jsonify(message="中止しました")


@app.post("/api/import-csv")
@login_required
def api_import_csv():
    """ハローワーク事業所などの CSV を取り込み（列: 会社名/事業所名/employer_name, 住所, ホームページ, 業種, 求人数 …）"""
    f = request.files.get("file")
    if not f:
        return jsonify(message="CSVファイルを選択してください"), 422
    raw = f.read()
    for enc in ("utf-8-sig", "cp932"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        return jsonify(message="文字コードを判別できませんでした（UTF-8 か Shift_JIS で保存してください）"), 422
    rows = [r for r in (collector.hellowork_row(x) for x in csv.DictReader(io.StringIO(text))) if r]
    if not rows:
        return jsonify(message="会社名（または 事業所名 / employer_name）列が見つかりませんでした"), 422
    if collector.active_run_id():
        return jsonify(message="別の収集が実行中です。完了後に取り込んでください"), 409
    run_id = collector.import_csv_rows(rows)
    return jsonify(message=f"{len(rows)}社を取り込みました。続けてHP・メールを調査します", run=collector.get_run(run_id)), 202


# ---------------------------------------------------------------------
# 個別編集
# ---------------------------------------------------------------------
EDITABLE = {"status", "memo", "name", "phone", "email", "website", *SNS_FIELDS}


@app.put("/api/leads/<int:lead_id>")
@login_required
def api_update(lead_id):
    body = request.get_json(silent=True) or {}
    fields = {k: (str(v).strip()[:5000] if v not in (None, "") else None) for k, v in body.items() if k in EDITABLE}
    if "status" in fields and fields["status"] not in STATUSES:
        return jsonify(message="不正なステータスです"), 422
    for k in ("website", *SNS_FIELDS):
        if fields.get(k) and not fields[k].startswith(("http://", "https://")):
            return jsonify(message=f"{k} は http(s):// から始まるURLを入力してください"), 422
    if "website" in fields:
        fields["has_website"] = 1 if fields["website"] else 0
    with get_db() as db:
        if not db.execute("SELECT 1 FROM leads WHERE id = ?", (lead_id,)).fetchone():
            abort(404)
        update_lead(db, lead_id, fields)
        return jsonify(row_to_dict(db.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()))


@app.post("/api/leads/<int:lead_id>/enrich")
@login_required
def api_enrich_one(lead_id):
    with get_db() as db:
        lead = row_to_dict(db.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone())
    if not lead:
        abort(404)
    changes = collector.enrich_leads([lead], 1, {})
    with get_db() as db:
        fields = changes.get(lead_id, {})
        fields["enriched_at"] = now()
        update_lead(db, lead_id, fields)
        return jsonify(row_to_dict(db.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()))


@app.delete("/api/leads/<int:lead_id>")
@login_required
def api_delete(lead_id):
    with get_db() as db:
        db.execute("DELETE FROM leads WHERE id = ?", (lead_id,))
    return jsonify(message="削除しました")


@app.get("/api/export.csv")
@login_required
def api_export():
    cols = {
        "name": "会社名", "category": "業種", "address": "住所", "phone": "電話番号", "email": "メール",
        "website": "ホームページ", "instagram": "Instagram", "twitter": "X(Twitter)", "facebook": "Facebook",
        "tiktok": "TikTok", "youtube": "YouTube", "line": "LINE", "google_maps_url": "Googleマップ",
        "rating": "評価", "review_count": "口コミ数", "job_count": "ハローワーク求人数", "lat": "緯度", "lng": "経度",
        "status": "ステータス", "memo": "メモ", "source": "取得元", "search_keyword": "検索キーワード",
        "search_area": "検索エリア", "created_at": "登録日時",
    }
    where, params = _filters(request.args)

    def gen():
        buf = io.StringIO()
        w = csv.writer(buf)
        buf.write("﻿")
        w.writerow(cols.values())
        yield buf.getvalue()
        with get_db() as db:
            for r in db.execute(f"SELECT * FROM leads WHERE {where} ORDER BY id DESC", params):
                buf.seek(0); buf.truncate()
                w.writerow(["" if r[c] is None else r[c] for c in cols])
                yield buf.getvalue()

    name = f"leads_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(gen(), mimetype="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f"attachment; filename={name}"})


# ---------------------------------------------------------------------
# 自動デプロイ（GitHub Actions / GitHub Webhook から呼ばれる）
# ---------------------------------------------------------------------
@app.post("/deploy")
def deploy_hook():
    secret = os.environ.get("DEPLOY_SECRET", "")
    if not secret:
        abort(404)
    body = request.get_data()
    sig = request.headers.get("X-Hub-Signature-256", "")
    if not deploy.verify_signature(secret, body, sig):
        abort(403)
    if request.headers.get("X-GitHub-Event") == "ping":
        return jsonify(ok=True, message="pong")
    payload = request.get_json(silent=True) or {}
    branch = os.environ.get("DEPLOY_BRANCH", "main")
    if payload.get("ref") and payload["ref"] != f"refs/heads/{branch}":
        return jsonify(ok=True, skipped=f"{payload['ref']} は対象外（DEPLOY_BRANCH={branch}）")
    result = deploy.run_deploy(branch)
    return jsonify(result), (200 if result["ok"] else 500)


if __name__ == "__main__":
    app.config["SESSION_COOKIE_SECURE"] = False
    app.run(debug=True, port=int(os.environ.get("PORT", 5000)))
