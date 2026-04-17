#!/bin/sh
set -e

cd /var/www/html

echo "=== Atally Production Startup ==="

# ログディレクトリ作成
mkdir -p /var/log/supervisor /var/log/nginx

# Renderの$PORTに合わせてnginxのポートを設定（デフォルト10000）
APP_PORT=${PORT:-10000}
echo "--- Using port: $APP_PORT ---"
sed -i "s/listen 80;/listen ${APP_PORT};/" /etc/nginx/nginx.conf

# REDIS_URLをパースして個別の環境変数に展開（Predis URL解析の問題を回避）
# Render Key Value の URL 形式: redis://:password@host:port または redis://default:password@host:port
if [ -n "${REDIS_URL}" ]; then
    echo "--- Parsing REDIS_URL ---"
    eval $(php -r "
        \$url = parse_url(getenv('REDIS_URL'));
        \$host = \$url['host'] ?? '127.0.0.1';
        \$port = \$url['port'] ?? 6379;
        \$pass = \$url['pass'] ?? '';
        echo 'export REDIS_HOST=' . escapeshellarg(\$host) . PHP_EOL;
        echo 'export REDIS_PORT=' . escapeshellarg((string)\$port) . PHP_EOL;
        if (\$pass !== '') {
            echo 'export REDIS_PASSWORD=' . escapeshellarg(\$pass) . PHP_EOL;
        }
    ")
    echo "--- REDIS_HOST=\$REDIS_HOST REDIS_PORT=\$REDIS_PORT ---"
fi

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
