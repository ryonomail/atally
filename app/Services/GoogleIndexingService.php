<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GoogleIndexingService
{
    /**
     * 求人ページの URL を Google に通知する
     * 失敗してもサイレントにログだけ残す（求人公開をブロックしない）
     */
    public static function notifyJobPublished(int $jobId): void
    {
        $url = config('app.url') . '/jobs/' . $jobId;

        // サイトマップ Ping（Google・Bing 両方）
        self::pingSitemap($url);
    }

    private static function pingSitemap(string $pageUrl): void
    {
        $sitemapUrl = urlencode(config('app.url') . '/sitemap.xml');

        $targets = [
            'Google' => "https://www.google.com/ping?sitemap={$sitemapUrl}",
            'Bing'   => "https://www.bing.com/ping?sitemap={$sitemapUrl}",
        ];

        foreach ($targets as $name => $pingUrl) {
            try {
                Http::timeout(5)->get($pingUrl);
            } catch (\Throwable $e) {
                Log::info("GoogleIndexingService: {$name} ping failed for {$pageUrl} — {$e->getMessage()}");
            }
        }
    }
}
