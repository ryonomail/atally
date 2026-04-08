<?php

namespace App\Console\Commands;

use App\Services\HiringReputationService;
use Illuminate\Console\Command;

class DetectStalledJobs extends Command
{
    protected $signature = 'app:detect-stalled-jobs';
    protected $description = '毎日実行: 放置求人を検出し段階的に対応（通知→ラベル→自動クローズ）';

    public function handle(HiringReputationService $service): void
    {
        $results = $service->detectAndHandleStalledJobs();

        $this->info("Stalled job detection complete:");
        $this->info("  - Notified (30d): {$results['notified']}");
        $this->info("  - Labeled (60d): {$results['labeled']}");
        $this->info("  - Deactivated (90d): {$results['deactivated']}");
    }
}
