#!/usr/bin/env bash
# Atally 復旧スクリプト（新VPSをゼロから構築し、暗号化バックアップからDBを復元する）
#
#   使い方:  ./scripts/rebuild-vps.sh <新VPSのIP> [バックアップ.dump.gpg]
#   例:      ./scripts/rebuild-vps.sh 160.251.xxx.xxx
#
# 前提: ローカルに ~/.ssh/atally_vps（公開鍵を新VPSに登録済み）、GPG秘密鍵、.env がある。
# 冪等性: 途中で失敗しても再実行できるように書いてある。
set -euo pipefail

IP="${1:?新VPSのIPを指定してください（例: ./scripts/rebuild-vps.sh 160.251.1.2）}"
DUMP_GPG="${2:-$HOME/AtallyBackups/atally-20260903-030001.dump.gpg}"
KEY="$HOME/.ssh/atally_vps"
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 root@${IP}"
REMOTE=/opt/atally

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

say "0) 事前チェック"
[ -f "$KEY" ]      || { echo "SSH鍵がありません: $KEY"; exit 1; }
[ -f "$DUMP_GPG" ] || { echo "バックアップがありません: $DUMP_GPG"; exit 1; }
[ -f .env ]        || { echo "ローカル .env がありません"; exit 1; }
$SSH 'echo OK' >/dev/null || { echo "SSH接続に失敗。IPと鍵登録を確認してください"; exit 1; }
echo "接続OK: $IP"

say "1) サーバー初期構築（Docker・スワップ4GB・ファイアウォール）"
$SSH 'bash -se' <<'REMOTE_SETUP'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get -y -qq upgrade
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
apt-get -y -qq install ufw
ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
mkdir -p /opt/atally /opt/atally/backups
echo "setup done: docker=$(docker --version | cut -d, -f1)"
REMOTE_SETUP

say "2) コード転送（git HEAD をそのまま配置）"
git archive --format=tar HEAD | $SSH "cd $REMOTE && tar -xf -"
echo "転送完了: $(git rev-parse --short HEAD)"

say "3) .env 生成（APP_KEY等はローカルから引き継ぎ、DBパスワードは新規生成）"
DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
get() { grep -E "^$1=" .env | head -1 | cut -d= -f2- || true; }
{
  echo "APP_NAME=Atally"
  echo "APP_ENV=production"
  echo "APP_DEBUG=false"
  echo "APP_KEY=$(get APP_KEY)"
  echo "APP_URL=https://atally.io"
  echo "APP_TIMEZONE=Asia/Tokyo"
  echo "DOMAIN=atally.io"
  echo "PORT=80"
  echo "DB_CONNECTION=pgsql"
  echo "DB_HOST=db"
  echo "DB_PORT=5432"
  echo "DB_DATABASE=atally"
  echo "DB_USERNAME=atally"
  echo "DB_PASSWORD=${DB_PASS}"
  echo "REDIS_HOST=redis"
  echo "REDIS_PORT=6379"
  echo "CACHE_DRIVER=redis"
  echo "QUEUE_CONNECTION=redis"
  echo "SESSION_DRIVER=redis"
  echo "LOG_CHANNEL=stack"
  echo "LOG_LEVEL=warning"
  echo "FILESYSTEM_DISK=local"
  # 以下はローカル .env にあれば引き継ぐ（空なら後から要設定）
  for k in STRIPE_KEY STRIPE_SECRET STRIPE_WEBHOOK_SECRET \
           GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_CALLBACK_URL \
           MAIL_MAILER MAIL_HOST MAIL_PORT MAIL_USERNAME MAIL_PASSWORD \
           MAIL_ENCRYPTION MAIL_FROM_ADDRESS MAIL_FROM_NAME; do
    echo "${k}=$(get "$k")"
  done
} | $SSH "cat > $REMOTE/.env && chmod 600 $REMOTE/.env"
echo ".env 配置完了（DBパスワードは新規生成）"

say "4) DBコンテナ起動"
$SSH "cd $REMOTE && docker compose -f docker-compose.prod.yml up -d db"
$SSH 'for i in $(seq 1 40); do docker exec atally-db pg_isready -U atally >/dev/null 2>&1 && { echo "DB ready"; break; }; sleep 3; done'

say "5) バックアップを復号して転送・復元（数分かかります）"
TMP="$(mktemp -t atally-restore)"
trap 'rm -f "$TMP"' EXIT
gpg --batch --quiet --yes --decrypt "$DUMP_GPG" > "$TMP"
echo "復号完了: $(du -h "$TMP" | cut -f1)"
scp -i "$KEY" -o StrictHostKeyChecking=accept-new "$TMP" "root@${IP}:/tmp/atally.dump"
$SSH 'docker cp /tmp/atally.dump atally-db:/tmp/atally.dump && rm -f /tmp/atally.dump'
$SSH 'docker exec atally-db psql -U atally -d postgres -c "DROP DATABASE IF EXISTS atally;" >/dev/null 2>&1 || true
docker exec atally-db psql -U atally -d postgres -c "CREATE DATABASE atally OWNER atally;" >/dev/null
docker exec atally-db pg_restore --no-owner --no-privileges -U atally -d atally /tmp/atally.dump 2>&1 | tail -5 || true
echo "復元完了"'

say "6) 全コンテナをビルドして起動（初回は10〜20分かかります）"
$SSH "cd $REMOTE && docker compose -f docker-compose.prod.yml up -d --build"
$SSH 'for i in $(seq 1 60); do
  code=$(docker exec atally-app curl -s -o /dev/null -w "%{http_code}" -m 5 http://localhost/ 2>/dev/null)
  [ "$code" = "200" ] && { echo "アプリ応答200 ✅"; break; }; sleep 10
done'

say "7) 検証"
$SSH 'docker exec atally-db psql -U atally -d atally -t -A -F"|" -c "
SELECT (SELECT count(*) FROM jobs) AS jobs,
       (SELECT count(*) FROM jobs WHERE status=''active'') AS active_jobs,
       (SELECT count(*) FROM companies) AS companies,
       (SELECT count(*) FROM users) AS users,
       (SELECT count(*) FROM campaigns) AS campaigns;"'
$SSH 'docker ps --filter name=atally --format "{{.Names}}: {{.Status}}"'

say "完了。次は DNS(Squarespace) の A レコードを ${IP} に向けてください。"
echo "  確認: curl -I https://atally.io/"
