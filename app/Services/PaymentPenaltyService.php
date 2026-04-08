<?php

namespace App\Services;

use App\Models\BudgetAuditLog;
use App\Models\Company;
use App\Enums\CompanyStatus;
use Illuminate\Support\Facades\Log;

class PaymentPenaltyService
{
    /**
     * Phase 1: 即時一部制限（決済失敗検知時）
     */
    public function applyPhase1(Company $company): void
    {
        Log::warning("Payment penalty Phase 1 applied to company #{$company->id}");

        $company->update([
            'status' => CompanyStatus::NeedsAttention->value,
            'payment_failed_at' => now(),
        ]);

        // 全アクティブ求人の予算を0にしてオークション停止 + 監査ログ
        $activeJobs = $company->jobs()->where('status', 'active')->get();
        foreach ($activeJobs as $job) {
            $oldBudget = (float) $job->daily_budget;
            if ($oldBudget > 0) {
                BudgetAuditLog::create([
                    'company_id' => $company->id,
                    'job_id' => $job->id,
                    'user_id' => $company->user_id,
                    'action' => 'penalty_freeze',
                    'old_budget' => $oldBudget,
                    'new_budget' => 0,
                ]);
            }
        }
        $company->jobs()->where('status', 'active')->update(['daily_budget' => 0]);
    }

    /**
     * Phase 2: 完全停止（7日経過後バッチで実行）
     */
    public function applyPhase2(Company $company): void
    {
        Log::warning("Payment penalty Phase 2 applied to company #{$company->id}");

        $company->update([
            'status' => CompanyStatus::Suspended->value,
        ]);
    }

    /**
     * 復旧: 決済完了時に全制限解除
     */
    public function restore(Company $company): void
    {
        Log::info("Payment penalty restored for company #{$company->id}");

        $company->update([
            'status' => CompanyStatus::Active->value,
            'payment_failed_at' => null,
        ]);
    }

    /**
     * バッチ: Phase2該当企業を停止処理
     */
    public function processPhase2Batch(): int
    {
        $count = 0;

        Company::where('status', CompanyStatus::NeedsAttention->value)
            ->whereNotNull('payment_failed_at')
            ->get()
            ->each(function ($company) use (&$count) {
            if ($company->shouldBeSuspended()) {
                $this->applyPhase2($company);
                $count++;
            }
        });

        return $count;
    }
}
