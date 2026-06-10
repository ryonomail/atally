#!/usr/bin/env bash
# ============================================================
# Render PostgreSQL → 東京VPS PostgreSQL へデータ移行
#
# 前提:
#   - VPS上でこのリポジトリを clone 済み
#   - docker compose -f docker-compose.prod.yml up -d db を実行し db が起動済み
#   - Render ダッシュボード > atally-db > "External Database URL" を控える
#
# 使い方:
#   RENDER_DATABASE_URL="postgres://user:pass@xxx.singapore-postgres.render.com/atally" \
#     bash scripts/migrate-db-from-render.sh
# ============================================================
set -euo pipefail

: "${RENDER_DATABASE_URL:?Set RENDER_DATABASE_URL (Render > atally-db > External Database URL)}"

COMPOSE="docker compose -f docker-compose.prod.yml"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP="/tmp/atally-render-${STAMP}.dump"

echo "==> [1/3] Render からダンプ取得中... ($DUMP)"
# pg_dump はバージョン差異を避けるため postgres:16 のクライアントを使用
docker run --rm postgres:16-alpine \
  pg_dump --no-owner --no-privileges --format=custom "$RENDER_DATABASE_URL" > "$DUMP"
echo "    ダンプ完了: $(du -h "$DUMP" | cut -f1)"

echo "==> [2/3] VPSのdbへリストア中..."
# --clean --if-exists で既存オブジェクトを置換。app 未起動の空DBでもOK。
$COMPOSE exec -T db pg_restore \
  --no-owner --no-privileges --clean --if-exists \
  -U atally -d atally < "$DUMP"

echo "==> [3/3] 差分マイグレーション適用（新カラム等）..."
# app が起動済みなら artisan で、未起動なら一時コンテナで migrate
if $COMPOSE ps app | grep -q "Up"; then
  $COMPOSE exec -T app php artisan migrate --force
else
  echo "    app 未起動のためスキップ（次回 up 時にエントリポイントが migrate を実行します）"
fi

echo "✅ 移行完了。ダンプは $DUMP に保管（不要なら削除可）。"
