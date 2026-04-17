#!/bin/sh
set -e

cd /var/www/html

echo "=== Atally Production Startup ==="

# ログディレクトリ作成
mkdir -p /var/log/supervisor /var/log/nginx

# config:cache
echo "--- config:cache ---"
php artisan config:cache
echo "--- route:cache ---"
php artisan route:cache
echo "--- view:cache ---"
php artisan view:cache

# マイグレーション
echo "--- migrate ---"
php artisan migrate --force

# 初回デプロイ時のみシード実行（SEED_ON_BOOT=true の場合）
if [ "${SEED_ON_BOOT}" = "true" ]; then
    echo "=== Running DemoSeeder ==="
    php artisan db:seed --class=DemoSeeder --force || echo "DemoSeeder failed (skipped)"
    echo "=== Running LargeDataSeeder ==="
    php artisan db:seed --class=LargeDataSeeder --force || echo "LargeDataSeeder failed (skipped)"
fi

# ストレージリンク
php artisan storage:link 2>/dev/null || true

# パーミッション
chown -R www-data:www-data storage bootstrap/cache || true

echo "=== Starting Supervisor ==="
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
