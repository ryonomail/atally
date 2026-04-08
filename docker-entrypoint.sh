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

# Start Vite dev server in background
npm run dev -- --host 0.0.0.0 &

# Start Laravel dev server
php artisan serve --host=0.0.0.0 --port=8000
