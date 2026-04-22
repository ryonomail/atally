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
if [ -n "${REDIS_URL}" ]; then
    echo "--- Parsing REDIS_URL ---"
    _tmpfile=$(mktemp)
    php -r "
        \$url = parse_url(getenv('REDIS_URL'));
        \$host = \$url['host'] ?? '127.0.0.1';
        \$port = \$url['port'] ?? 6379;
        \$pass = \$url['pass'] ?? '';
        file_put_contents(\$argv[1], 'REDIS_HOST=' . \$host . PHP_EOL . 'REDIS_PORT=' . \$port . PHP_EOL . 'REDIS_PASSWORD=' . \$pass . PHP_EOL);
    " "$_tmpfile"
    export REDIS_HOST=$(grep '^REDIS_HOST=' "$_tmpfile" | cut -d= -f2)
    export REDIS_PORT=$(grep '^REDIS_PORT=' "$_tmpfile" | cut -d= -f2)
    _pw=$(grep '^REDIS_PASSWORD=' "$_tmpfile" | cut -d= -f2)
    [ -n "$_pw" ] && export REDIS_PASSWORD="$_pw"
    rm -f "$_tmpfile"
    echo "--- REDIS_HOST=$REDIS_HOST REDIS_PORT=$REDIS_PORT ---"
fi

# Laravelキャッシュ生成（OPcacheと組み合わせて起動後の初回リクエストを高速化）
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
