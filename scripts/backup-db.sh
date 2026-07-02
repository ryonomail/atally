#!/usr/bin/env bash
# ============================================================
# 日次DBバックアップ（暗号化）。ホスト上で実行（cron推奨）。
#
# ・pg_dump（custom形式）→ GPG公開鍵で暗号化（*.dump.gpg）。
# ・復号にはMac側の秘密鍵が必要（VPSが乗っ取られても復号不可）。
# ・直近 KEEP 世代を保持。オフサイト（Mac）へは別途 pull する。
#
# cron 例（毎日 03:00 / VPSの crontab -e に追記）:
#   0 3 * * * cd /opt/atally && bash scripts/backup-db.sh >> /var/log/atally-backup.log 2>&1
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f ${APP_DIR}/docker-compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-/opt/atally/backups}"
PUBKEY="${BACKUP_PUBKEY:-/opt/atally/backup-pubkey.asc}"
KEEP="${KEEP:-14}"

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
TMP="${BACKUP_DIR}/atally-${TS}.dump"
OUT="${TMP}.gpg"

if [ ! -f "$PUBKEY" ]; then
  echo "$(date '+%F %T') ERROR: 公開鍵が見つかりません: $PUBKEY（暗号化なしでは実行しない）" >&2
  exit 1
fi

echo "$(date '+%F %T') バックアップ開始 → $OUT"
# 1) ダンプ（一時ファイル）→ 2) 公開鍵で暗号化 → 3) 平文ダンプを削除
$COMPOSE exec -T db pg_dump --no-owner --no-privileges --format=custom -U atally atally > "$TMP"
gpg --batch --yes --trust-model always --recipient-file "$PUBKEY" --output "$OUT" --encrypt "$TMP"
rm -f "$TMP"

# 古い世代を削除（KEEP世代を残す・暗号化済みのみ対象）
ls -1t "${BACKUP_DIR}"/atally-*.dump.gpg 2>/dev/null | tail -n "+$((KEEP + 1))" | xargs -r rm -f
# 平文ダンプが万一残っていたら除去（安全側）
ls -1 "${BACKUP_DIR}"/atally-*.dump 2>/dev/null | xargs -r rm -f

echo "$(date '+%F %T') 完了: $(du -h "$OUT" | cut -f1) / 暗号化世代=$(ls -1 "${BACKUP_DIR}"/atally-*.dump.gpg 2>/dev/null | wc -l | tr -d ' ')"
