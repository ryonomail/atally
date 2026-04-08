<?php

namespace App\Services;

use App\Models\BudgetAuditLog;
use App\Models\DailyUsage;
use App\Models\Company;
use Illuminate\Support\Facades\Auth;

class BillingProtectionService
{
    /**
     * 予算変更を監査ログに記録し、daily_usagesのmax_budget_amountを更新
     */
    public static function logBudgetChange(int $companyId, ?int $jobId, string $action, ?float $oldBudget, ?float $newBudget): void
    {
        // 監査ログ記録
        BudgetAuditLog::create([
            'company_id' => $companyId,
            'job_id' => $jobId,
            'user_id' => Auth::id(),
            'action' => $action,
            'old_budget' => $oldBudget,
            'new_budget' => $newBudget,
        ]);

        // その日のmax_budget_amountを更新（高い方を保持）
        static::updateMaxBudget($companyId);
    }

    /**
     * 企業の今日のmax_budget_amountを再計算（全アクティブ求人の合計で最高額を保持）
     */
    public static function updateMaxBudget(int $companyId): void
    {
        $company = Company::find($companyId);
        if (!$company) return;

        $currentTotal = $company->effectiveDailyBudget();
        $today = now()->toDateString();

        $usage = DailyUsage::firstOrCreate(
            ['company_id' => $companyId, 'date' => $today],
            ['budget_amount' => 0, 'max_budget_amount' => 0]
        );

        // 現在の合計が記録済みの最高額より高ければ更新
        if ($currentTotal > (float) $usage->max_budget_amount) {
            $usage->update(['max_budget_amount' => round($currentTotal, 2)]);
        }

        // budget_amountも現時点の値で更新
        $usage->update(['budget_amount' => round($currentTotal, 2)]);
    }
}
