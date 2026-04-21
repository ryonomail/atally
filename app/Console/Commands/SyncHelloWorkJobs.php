<?php

namespace App\Console\Commands;

use App\Services\HelloWorkService;
use Illuminate\Console\Command;

class SyncHelloWorkJobs extends Command
{
    protected $signature = 'app:sync-hellowork-jobs
                            {--data-id=M100 : データID (M100=全国一般, M101-M147=都道府県別)}
                            {--max-pages=0 : 最大ページ数 (0=全件, 1=1000件のみ等テスト用)}';

    protected $description = '毎朝実行: ハローワーク求人APIから求人を同期する（メンテナンス時間帯 0:00-6:00 を避けること）';

    public function handle(HelloWorkService $service): int
    {
        $dataId   = $this->option('data-id');
        $maxPages = (int) $this->option('max-pages');
        $this->info("ハローワーク求人同期開始 (dataId: {$dataId}" . ($maxPages ? ", 最大{$maxPages}ページ" : ', 全件') . ')');

        $stats = $service->sync($dataId, $maxPages);

        $this->info("同期完了:");
        $this->info("  新規追加: {$stats['inserted']}");
        $this->info("  更新:     {$stats['updated']}");
        $this->info("  非公開化: {$stats['deleted']}");
        $this->info("  エラー:   {$stats['errors']}");

        return $stats['errors'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}
