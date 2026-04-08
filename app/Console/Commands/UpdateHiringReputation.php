<?php

namespace App\Console\Commands;

use App\Services\HiringReputationService;
use Illuminate\Console\Command;

class UpdateHiringReputation extends Command
{
    protected $signature = 'app:update-hiring-reputation';
    protected $description = '毎日実行: 全企業の採用実績スコアを再計算';

    public function handle(HiringReputationService $service): void
    {
        $count = $service->updateAll();
        $this->info("Updated hiring reputation for {$count} companies.");
    }
}
