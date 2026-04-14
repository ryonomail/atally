#!/bin/sh
set -e

cd /var/www/html

echo "=== Atally Production Startup ==="

# config:cache は環境変数が全て揃っている前提で実行
php artisan config:cache
php artisan route:cache
php artisan view:cache

# マイグレーション（--force は本番環境での確認プロンプトをスキップ）
php artisan migrate --force

# 初回デプロイ時のみシード実行（SEED_ON_BOOT=true の場合）
if [ "${SEED_ON_BOOT}" = "true" ]; then
    echo "=== Running seeders ==="
    php artisan db:seed --class=DemoSeeder --force 2>/dev/null || true
    php artisan db:seed --class=LargeDataSeeder --force 2>/dev/null || true
fi

# ストレージリンク
php artisan storage:link 2>/dev/null || true

# パーミッション再確認
chown -R www-data:www-data storage bootstrap/cache

echo "=== Starting Supervisor (Nginx + PHP-FPM + Queue + Scheduler) ==="
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
