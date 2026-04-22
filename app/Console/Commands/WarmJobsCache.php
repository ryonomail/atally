<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * 求人リストの先頭ページキャッシュを事前生成する
 *
 * スケジューラーで 4分ごとに実行することで、
 * キャッシュ TTL(5分) が切れる前に再生成し、ユーザーが常にキャッシュヒットする状態を維持する。
 */
class WarmJobsCache extends Command
{
    protected $signature = 'app:warm-jobs-cache';
    protected $description = '求人リスト先頭ページのRedisキャッシュを事前生成する';

    public function handle(): void
    {
        $baseUrl = rtrim(config('app.url'), '/');

        // デフォルトページ（ランキング順・1〜3ページ目）をウォームアップ
        $endpoints = [
            "{$baseUrl}/api/jobs?page=1&sort=ranking",
            "{$baseUrl}/api/jobs?page=2&sort=ranking",
            "{$baseUrl}/api/jobs?page=3&sort=ranking",
            "{$baseUrl}/api/jobs?page=1&sort=newest",
        ];

        foreach ($endpoints as $url) {
            try {
                Http::timeout(15)->get($url);
                $this->line("Warmed: {$url}");
            } catch (\Throwable $e) {
                $this->warn("Failed: {$url} — {$e->getMessage()}");
            }
        }

        $this->info('Cache warm-up complete.');
    }
}
