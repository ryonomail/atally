<?php

namespace App\Console\Commands;

use App\Services\PaymentPenaltyService;
use Illuminate\Console\Command;

class CheckPaymentPenalties extends Command
{
    protected $signature = 'app:check-payment-penalties';
    protected $description = '毎時実行: 決済失敗から7日経過した企業にPhase2ペナルティを適用';

    public function handle(PaymentPenaltyService $service): void
    {
        $count = $service->processPhase2Batch();
        $this->info("Applied Phase 2 penalties to {$count} companies.");
    }
}
