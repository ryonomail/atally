#!/bin/bash
set -e

cd /var/www/html

# Install dependencies if needed
if [ ! -d "vendor" ]; then
    composer install --no-interaction --optimize-autoloader
fi

if [ ! -d "node_modules" ]; then
    npm install
fi

# Generate app key if not set
php artisan key:generate --force 2>/dev/null || true

# Run migrations
php artisan migrate --force 2>/dev/null || true

# Build frontend assets (macOS DockerではHMRのファイル変更検知が不安定なためビルドモードを使用)
npm run build 2>/dev/null || true
# hotファイルが残っていれば削除（ビルドモード使用のため）
rm -f public/hot

# Start Laravel dev server
php artisan serve --host=0.0.0.0 --port=8000
