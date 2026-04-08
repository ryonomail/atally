<?php

namespace App\Console\Commands;

use App\Services\QualityScoreService;
use Illuminate\Console\Command;

class UpdateQualityScores extends Command
{
    protected $signature = 'app:update-quality-scores';
    protected $description = '毎時実行: 全企業の品質スコアを再計算しRedisキャッシュを更新';

    public function handle(QualityScoreService $service): void
    {
        $count = $service->updateAll();
        $this->info("Updated quality scores for {$count} companies.");
    }
}
