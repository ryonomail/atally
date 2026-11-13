#!/usr/bin/env bash
# =====================================================================
# PythonAnywhere 初回セットアップ（PythonAnywhere の Bash コンソールで実行）
#
#   GITHUB_TOKEN=github_pat_xxx PA_API_TOKEN=xxxx bash setup_pythonanywhere.sh
#
#   GITHUB_TOKEN : GitHub の Fine-grained token（ryonomail/atally の Contents: Read-only）
#   PA_API_TOKEN : PythonAnywhere の Account → API token（Webアプリの作成・設定を自動化。無ければ手順を表示）
#   PA_HOST      : 省略時 www.pythonanywhere.com（EU アカウントは eu.pythonanywhere.com）
#   BRANCH       : 省略時 main
# 何度実行しても安全（既存の .env・DB は残る）
# =====================================================================
set -euo pipefail

REPO="ryonomail/atally"
BRANCH="${BRANCH:-main}"
PA_HOST="${PA_HOST:-www.pythonanywhere.com}"
USER_NAME="$(whoami)"
DOMAIN="${PA_DOMAIN:-${USER_NAME}.pythonanywhere.com}"
CLONE_DIR="$HOME/atally"
APP_DIR="$CLONE_DIR/lead-dashboard"
WSGI_FILE="/var/www/$(echo "$DOMAIN" | tr '.' '_' | tr 'A-Z' 'a-z')_wsgi.py"

: "${GITHUB_TOKEN:?GITHUB_TOKEN を指定してください（private リポジトリの取得に使用）}"

# 利用可能な一番新しい Python を選ぶ
PY=""
for v in 3.13 3.12 3.11 3.10; do
  if command -v "python$v" >/dev/null 2>&1; then PY="$v"; break; fi
done
[ -n "$PY" ] || { echo "python3.10 以上が見つかりません"; exit 1; }
echo "==> Python $PY を使用"

# 1) リポジトリ取得（lead-dashboard フォルダだけを sparse checkout）
if [ ! -d "$CLONE_DIR/.git" ]; then
  echo "==> clone $REPO ($BRANCH)"
  git clone --filter=blob:none --no-checkout --depth 50 --branch "$BRANCH" \
    "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "$CLONE_DIR"
  git -C "$CLONE_DIR" sparse-checkout set lead-dashboard
  git -C "$CLONE_DIR" checkout "$BRANCH"
else
  echo "==> 既存のクローンを更新"
  git -C "$CLONE_DIR" remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git"
  git -C "$CLONE_DIR" fetch --depth 50 origin "$BRANCH"
  git -C "$CLONE_DIR" reset --hard "origin/$BRANCH"
fi
chmod 600 "$CLONE_DIR/.git/config"

# 2) virtualenv + 依存パッケージ
VENV="$HOME/.virtualenvs/leads"
if [ ! -x "$VENV/bin/python" ]; then
  echo "==> virtualenv 作成: $VENV"
  "python$PY" -m venv "$VENV"
fi
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q -r "$APP_DIR/requirements.txt"

# 3) .env（無ければ生成。秘密値はランダム生成）
if [ ! -f "$APP_DIR/.env" ]; then
  DASH_PW="$(python$PY -c 'import secrets;print(secrets.token_urlsafe(12))')"
  DEPLOY_SECRET="$(python$PY -c 'import secrets;print(secrets.token_hex(32))')"
  cat > "$APP_DIR/.env" <<ENV
# ===== 営業リスト ダッシュボード設定（git 管理外） =====
DASHBOARD_PASSWORD=${DASH_PW}
SECRET_KEY=$(python$PY -c 'import secrets;print(secrets.token_hex(32))')
# GitHub Actions の Secret「PA_DEPLOY_SECRET」に同じ値を登録する
DEPLOY_SECRET=${DEPLOY_SECRET}
DEPLOY_BRANCH=${BRANCH}
WSGI_FILE=${WSGI_FILE}

# --- 収集元（任意） ---
# PR TIMES: 新着フィード以外に読むRSS（カンマ区切り）と、常駐ワーカーでの自動取得間隔（分、0で無効）
PRTIMES_FEEDS=
PRTIMES_AUTO_MINUTES=0
PRTIMES_AUTO_KEYWORD=
GOOGLE_PLACES_API_KEY=
BRAVE_SEARCH_API_KEY=
LEAD_SEARCH_LIMIT=50

# --- メール自動送信（特定電子メール法により送信者名・住所・連絡先の表示が必須） ---
PUBLIC_BASE_URL=https://${DOMAIN}
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURITY=starttls
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM=
MAIL_FROM_NAME=
MAIL_REPLY_TO=
SENDER_COMPANY=
SENDER_ADDRESS=
SENDER_CONTACT=
SEND_DAILY_LIMIT=100
SEND_INTERVAL_SEC=20
ENV
  chmod 600 "$APP_DIR/.env"
  echo "==> .env を作成しました"
  echo "    ログインパスワード : ${DASH_PW}"
  echo "    PA_DEPLOY_SECRET   : ${DEPLOY_SECRET}"
else
  echo "==> .env は既に存在するため変更しません"
fi
"$VENV/bin/python" -c "import sys; sys.path.insert(0, '$APP_DIR'); import db; db.init_db()"

# 4) Web アプリ（PA_API_TOKEN があれば API で自動設定）
WSGI_CONTENT="$(sed "s#~/atally/lead-dashboard#$APP_DIR#" "$APP_DIR/deploy/wsgi_pythonanywhere.py")"
if [ -n "${PA_API_TOKEN:-}" ]; then
  API="https://${PA_HOST}/api/v0/user/${USER_NAME}"
  AUTH="Authorization: Token ${PA_API_TOKEN}"
  PYTAG="python$(echo "$PY" | tr -d '.')"
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "$AUTH" "$API/webapps/${DOMAIN}/")
  if [ "$code" = "404" ]; then
    echo "==> Web アプリを作成: $DOMAIN ($PYTAG)"
    curl -sf -X POST -H "$AUTH" "$API/webapps/" -d "domain_name=${DOMAIN}" -d "python_version=${PYTAG}" >/dev/null
  fi
  curl -sf -X PATCH -H "$AUTH" "$API/webapps/${DOMAIN}/" \
    -d "virtualenv_path=${VENV}" -d "source_directory=${APP_DIR}" -d "force_https=true" >/dev/null
  if ! curl -sf -H "$AUTH" "$API/webapps/${DOMAIN}/static_files/" | grep -q '"/static/"'; then
    curl -sf -X POST -H "$AUTH" "$API/webapps/${DOMAIN}/static_files/" -d "url=/static/" -d "path=${APP_DIR}/static" >/dev/null
  fi
  printf '%s\n' "$WSGI_CONTENT" > "$WSGI_FILE"
  curl -sf -X POST -H "$AUTH" "$API/webapps/${DOMAIN}/reload/" >/dev/null
  echo "==> Web アプリを設定・リロードしました: https://${DOMAIN}/"
else
  cat <<MSG

==> Web タブで手動設定してください（PA_API_TOKEN を付けて再実行すれば自動化できます）
   1. Add a new web app → Manual configuration → Python ${PY}
   2. Virtualenv           : ${VENV}
   3. Source code          : ${APP_DIR}
   4. Static files         : URL /static/  →  ${APP_DIR}/static
   5. Security             : Force HTTPS を ON
   6. WSGI configuration file (${WSGI_FILE}) を次の内容に置き換え:
------------------------------------------------------------
${WSGI_CONTENT}
------------------------------------------------------------
   7. Reload ボタンを押す
MSG
  if [ -f "$WSGI_FILE" ]; then printf '%s\n' "$WSGI_CONTENT" > "$WSGI_FILE"; echo "   ※ WSGI ファイルは既に存在したため自動で書き換えました"; fi
fi

cat <<MSG

==> 自動デプロイ（GitHub → PythonAnywhere）
   GitHub の ${REPO} → Settings → Secrets and variables → Actions に登録:
     PA_DEPLOY_URL    = https://${DOMAIN}/deploy
     PA_DEPLOY_SECRET = （.env の DEPLOY_SECRET の値）
   以後、${BRANCH} ブランチに lead-dashboard/ の変更を push すると
   テスト → PythonAnywhere へ反映 → 自動リロード まで行われます。
MSG
