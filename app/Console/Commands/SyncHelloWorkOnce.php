<?php

namespace App\Console\Commands;

use App\Services\HelloWorkService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/**
 * デプロイ起動時に一度だけハローワーク求人を同期する。
 * Redis のマーカーで二重実行を防止するため、コンテナが何度再起動しても
 * 実行されるのは「マーカーのバージョンが変わったとき」だけ。
 *
 * 通常の定期同期は app:sync-hellowork-jobs（毎日07:00）が担当。
 * これは新スクレイパー反映のための一回限りの即時同期用。
 */
class SyncHelloWorkOnce extends Command
{
    protected $signature = 'app:sync-hellowork-once {--key=hw_boot_sync_v1}';
    protected $description = '起動時に一度だけハローワーク求人を同期（Redisマーカーで二重実行防止）';

    public function handle(HelloWorkService $service): int
    {
        $key = $this->option('key');

        // Cache::add はアトミック。既にキーがあれば false（＝実行済み）
        if (!Cache::add($key, now()->toDateTimeString(), now()->addDays(30))) {
            $this->info("一度きり同期は実行済み（{$key}）のためスキップします。");
            return self::SUCCESS;
        }

        $this->info('一度きりのハローワーク同期を開始...');

        try {
            $stats = $service->sync('M100', 0);
        } catch (\Throwable $e) {
            // 失敗時はマーカーを消して次回起動で再試行できるようにする
            Cache::forget($key);
            $this->error('同期中に例外: ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->info("完了: 新規{$stats['inserted']} / 更新{$stats['updated']} / 非公開{$stats['deleted']} / エラー{$stats['errors']}");

        if ($stats['errors'] > 0) {
            Cache::forget($key);
            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
