<?php

namespace App\Models;

use App\Enums\CompanyStatus;
use App\Enums\VerificationStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Company extends Model
{
    use HasFactory;

    protected $hidden = [
        'stripe_customer_id',
        'stripe_subscription_id',
        'license_document_path',
    ];

    protected $fillable = [
        'user_id',
        'company_name',
        'company_type',
        'description',
        'website',
        'phone',
        'address',
        'industry',
        'number_of_employees',
        'founded_year',
        'office_address',
        'nearest_station',
        'company_culture',
        'work_environment',
        'benefits_default',
        'revenue',
        'capital',
        'daily_budget',
        'quality_score',
        'hiring_reputation',
        'status',
        'verification_status',
        'payment_failed_at',
        'stripe_customer_id',
        'stripe_subscription_id',
        'documents',
        'permit_number',
        'license_document_path',
        'license_verified',
    ];

    protected function casts(): array
    {
        return [
            'status' => CompanyStatus::class,
            'daily_budget' => 'decimal:2',
            'quality_score' => 'decimal:4',
            'hiring_reputation' => 'decimal:4',
            'documents' => 'array',
            'payment_failed_at' => 'datetime',
            'license_verified' => 'boolean',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * チームメンバー（company_id で紐づくユーザー）
     */
    public function teamMembers()
    {
        return $this->hasMany(User::class, 'company_id');
    }

    /**
     * 招待一覧
     */
    public function invitations()
    {
        return $this->hasMany(CompanyInvitation::class);
    }

    public function jobs()
    {
        return $this->hasMany(Job::class);
    }

    public function dailyUsages()
    {
        return $this->hasMany(DailyUsage::class);
    }

    public function agencyClients()
    {
        return $this->hasMany(AgencyClient::class);
    }

    public function referralsAsSource()
    {
        return $this->hasMany(JobReferral::class, 'source_company_id');
    }

    public function referralsAsReferrer()
    {
        return $this->hasMany(JobReferral::class, 'referrer_company_id');
    }

    public function isAgency(): bool
    {
        return $this->company_type === 'recruitment_agency';
    }

    public function isLicenseVerified(): bool
    {
        return $this->isAgency() && $this->license_verified;
    }

    /**
     * 全アクティブ求人の合計日額予算
     */
    public function totalDailyBudget(): float
    {
        return (float) $this->jobs()->where('status', 'active')->sum('daily_budget');
    }

    /**
     * ランキングスコア（参考値: 合計日額予算 × 品質係数）
     */
    public function rankingScore(): float
    {
        return $this->totalDailyBudget() * (float) $this->quality_score * (float) ($this->hiring_reputation ?? 1.0);
    }

    /**
     * ブースト込みの実効日額（全アクティブ求人の合計課金額）
     */
    public function effectiveDailyBudget(): float
    {
        $activeJobs = $this->jobs()
            ->where('status', 'active')
            ->with('persona')
            ->get();

        return $activeJobs->sum(function ($job) {
            $boost = (float) ($job->persona?->boost_factor ?? 1.0);
            return (float) $job->daily_budget * $boost;
        });
    }

    /**
     * アクティブ求人の平均ブースト倍率
     */
    public function averageBoostFactor(): float
    {
        $activeJobs = $this->jobs()->where('status', 'active')->with('persona')->get();

        if ($activeJobs->isEmpty()) {
            return 1.0;
        }

        $totalBoost = 0.0;
        foreach ($activeJobs as $job) {
            $totalBoost += (float) ($job->persona?->boost_factor ?? 1.0);
        }

        return $totalBoost / $activeJobs->count();
    }

    /**
     * 求人ごとの課金内訳
     */
    public function boostBreakdown(): array
    {
        $activeJobs = $this->jobs()
            ->where('status', 'active')
            ->with('persona')
            ->get();

        if ($activeJobs->isEmpty()) {
            return [];
        }

        return $activeJobs->map(function ($job) {
            $boost = (float) ($job->persona?->boost_factor ?? 1.0);
            return [
                'job_id' => $job->id,
                'title' => $job->title,
                'daily_budget' => (float) $job->daily_budget,
                'boost_factor' => $boost,
                'daily_cost' => round((float) $job->daily_budget * $boost, 2),
            ];
        })->values()->toArray();
    }

    /**
     * 要注意状態（未払い発生から7日以内）
     */
    public function needsAttention(): bool
    {
        return $this->payment_failed_at !== null
            && $this->status->value !== 'suspended';
    }

    /**
     * 利用停止中
     */
    public function isSuspended(): bool
    {
        return $this->status->value === 'suspended';
    }

    /**
     * Phase2停止対象か（決済失敗から7日以上経過）
     */
    public function shouldBeSuspended(): bool
    {
        return $this->payment_failed_at !== null
            && $this->payment_failed_at->diffInDays(now()) >= 7;
    }
}