<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Campaign extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'name',
        'daily_budget',
        'budget_allocation',
        'billing_period',
        'status',
        'start_date',
        'end_date',
        'next_billing_date',
    ];

    protected function casts(): array
    {
        return [
            'daily_budget' => 'decimal:2',
            'start_date' => 'date',
            'end_date' => 'date',
            'next_billing_date' => 'date',
        ];
    }

    /**
     * 即時課金額（有効化時に請求する金額）
     * daily: 日額予算そのまま
     * monthly: 月額予算そのまま（月額を前払い）
     */
    public function chargeAmount(): int
    {
        return (int) $this->daily_budget;
    }

    /**
     * 各求人に配分する日額（ランキング計算用）
     * daily: total / job_count
     * monthly: total / 30 / job_count
     */
    public function perJobDailyBudget(int $jobCount): float
    {
        if ($jobCount === 0) return 0;
        $base = (float) $this->daily_budget / $jobCount;
        return $this->billing_period === 'monthly' ? round($base / 30, 2) : round($base, 2);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function jobs()
    {
        return $this->hasMany(Job::class);
    }

    public function activeJobs()
    {
        return $this->jobs()->where('status', 'active');
    }

    /**
     * キャンペーン予算を所属求人に配分する
     */
    public function distributeBudget(): void
    {
        $jobs = $this->activeJobs()->get();
        if ($jobs->isEmpty()) {
            return;
        }

        $jobCount = $jobs->count();

        if ($this->budget_allocation === 'weighted') {
            // パフォーマンス比配分（閲覧数ベース）
            $totalViews = $jobs->sum(fn ($job) => $job->views()->where('viewed_at', '>=', now()->subDays(7))->count());
            if ($totalViews === 0) {
                // 閲覧データなしの場合は均等配分にフォールバック
                $perJob = $this->perJobDailyBudget($jobCount);
                foreach ($jobs as $job) {
                    $job->update(['daily_budget' => $perJob]);
                }
            } else {
                $baseDailyTotal = $this->billing_period === 'monthly'
                    ? (float) $this->daily_budget / 30
                    : (float) $this->daily_budget;
                foreach ($jobs as $job) {
                    $views = $job->views()->where('viewed_at', '>=', now()->subDays(7))->count();
                    $ratio = $views / $totalViews;
                    $job->update(['daily_budget' => round($baseDailyTotal * $ratio, 2)]);
                }
            }
        } else {
            // 均等配分
            $perJob = $this->perJobDailyBudget($jobCount);
            foreach ($jobs as $job) {
                $job->update(['daily_budget' => $perJob]);
            }
        }
    }

    /**
     * キャンペーンの合計消費予算（所属求人の日額合計）
     */
    public function actualDailySpend(): float
    {
        return (float) $this->activeJobs()->sum('daily_budget');
    }

    /**
     * キャンペーンの月額見積もり
     */
    public function monthlyEstimate(): float
    {
        return (float) $this->daily_budget * 30;
    }
}
