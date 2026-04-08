<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\DailyUsage;
use App\Services\QualityScoreService;
use Illuminate\Console\Command;

class RecordDailyUsage extends Command
{
    protected $signature = 'app:record-daily-usage';
    protected $description = '毎日0時に全企業の日額予算と品質メトリクスをDailyUsagesに記録';

    public function handle(QualityScoreService $qualityScoreService): void
    {
        $today = now()->toDateString();
        $count = 0;

        // 承認済み全企業を対象（予算0でも品質メトリクスは記録する）
        Company::where('verification_status', 'approved')
            ->chunk(100, function ($companies) use ($today, &$count, $qualityScoreService) {
                foreach ($companies as $company) {
                    $effectiveBudget = $company->effectiveDailyBudget();

                    // 品質スコア用メトリクスを計算
                    $metrics = $qualityScoreService->recordMetrics($company, $today);

                    $usage = DailyUsage::firstOrCreate(
                        ['company_id' => $company->id, 'date' => $today],
                        ['budget_amount' => 0, 'max_budget_amount' => 0]
                    );

                    // max_budget_amountは日中に記録された最高額を保持（下げない）
                    $maxBudget = max((float) $usage->max_budget_amount, round($effectiveBudget, 2));

                    $usage->update([
                        'budget_amount' => round($effectiveBudget, 2),
                        'max_budget_amount' => $maxBudget,
                        'boost_factor' => round($company->averageBoostFactor(), 1),
                        'base_budget' => $company->totalDailyBudget(),
                        'reply_rate' => $metrics['reply_rate'],
                        'reply_speed_hours' => $metrics['reply_speed_hours'],
                        'interview_setup_rate' => $metrics['interview_setup_rate'],
                        'logged_in' => $metrics['logged_in'],
                    ]);
                    $count++;
                }
            });

        $this->info("Recorded daily usage for {$count} companies.");
    }
}
