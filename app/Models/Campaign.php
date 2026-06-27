<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Campaign extends Model
{
    use HasFactory;

    /**
     * ランキングのティア方式:
     *   無料掲載 = FREE_BASE(10000)前後
     *   ブースト中 = BOOST_BASE(1,000,000)以上 → 無料より必ず上に出る。
     *   ブースト枠の中では「1件あたり日額 × 品質 × 採用実績」で順位が決まる
     *   （件数が多いほど1件あたりが薄まり、枠内では下がる）。
     */
    public const BOOST_BASE = 1000000;
    public const FREE_BASE = 10000;

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
        // キャンペーンは単一企業に属するので、品質・採用実績の係数は共通
        $company = $this->company;
        $mult = ($company->quality_score ?? 1.0) * ($company->hiring_reputation ?? 1.0);
        // ブースト枠のランキング = BOOST_BASE + 1件あたり日額 × 係数（無料より必ず上）
        $boostScore = fn (float $perJob) => self::BOOST_BASE + $perJob * $mult;

        if ($this->budget_allocation === 'weighted') {
            // パフォーマンス比配分（閲覧数ベース）
            $totalViews = $jobs->sum(fn ($job) => $job->views()->where('viewed_at', '>=', now()->subDays(7))->count());
            if ($totalViews === 0) {
                // 閲覧データなしの場合は均等配分にフォールバック（一括更新）
                $perJob = $this->perJobDailyBudget($jobCount);
                $this->activeJobs()->update(['daily_budget' => $perJob, 'ranking_score' => $boostScore($perJob)]);
            } else {
                $baseDailyTotal = $this->billing_period === 'monthly'
                    ? (float) $this->daily_budget / 30
                    : (float) $this->daily_budget;
                foreach ($jobs as $job) {
                    $views = $job->views()->where('viewed_at', '>=', now()->subDays(7))->count();
                    $perJob = round($baseDailyTotal * ($views / $totalViews), 2);
                    $job->update(['daily_budget' => $perJob, 'ranking_score' => $boostScore($perJob)]);
                }
            }
        } else {
            // 均等配分（全件同額なので一括更新で高速に）
            $perJob = $this->perJobDailyBudget($jobCount);
            $this->activeJobs()->update(['daily_budget' => $perJob, 'ranking_score' => $boostScore($perJob)]);
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
