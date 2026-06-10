#!/usr/bin/env bash
# ============================================================
# 日次DBバックアップ（cron 推奨）
#
# cron 例（毎日 03:00 / VPSの crontab -e に追記）:
#   0 3 * * * cd /opt/atally && bash scripts/backup-db.sh >> /var/log/atally-backup.log 2>&1
#
# 直近14世代を保持。BACKUP_DIR は環境変数で上書き可。
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f ${APP_DIR}/docker-compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-/opt/atally/backups}"
KEEP="${KEEP:-14}"

mkdir -p "$BACKUP_DIR"
OUT="${BACKUP_DIR}/atally-$(date +%Y%m%d-%H%M%S).dump"

echo "$(date '+%F %T') バックアップ開始 → $OUT"
$COMPOSE exec -T db pg_dump --no-owner --no-privileges --format=custom -U atally atally > "$OUT"

# 古い世代を削除（KEEP 世代を残す）
ls -1t "${BACKUP_DIR}"/atally-*.dump 2>/dev/null | tail -n "+$((KEEP + 1))" | xargs -r rm -f

echo "$(date '+%F %T') 完了: $(du -h "$OUT" | cut -f1) / 保持世代=$(ls -1 "${BACKUP_DIR}"/atally-*.dump | wc -l | tr -d ' ')"
