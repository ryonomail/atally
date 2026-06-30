<?php

namespace App\Models;

use App\Enums\JobStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Job extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * エージェント限定フィールド（企業オーナー・管理者以外には非公開）
     */
    public const AGENT_ONLY_FIELDS = [
        'age_min', 'age_max', 'gender_requirement', 'nationality_requirement',
        'education_requirement', 'referral_fee_distribution', 'refund_policy',
        'payment_terms', 'disclosure_scope', 'likely_candidates', 'ng_targets',
        'selection_details_agent',
    ];

    protected $fillable = [
        'company_id',
        'campaign_id',
        'agency_client_id',
        'title',
        'description',
        'requirements',
        'salary_min',
        'salary_max',
        'salary_type',
        'location',
        'prefecture',
        'city',
        'employment_type',
        'listing_type',
        'dispatch_client_name',
        'show_dispatch_client',
        'work_hours',
        'benefits',
        'status',
        'daily_budget',
        'ng_word_flagged',
        'published_at',
        'expires_at',
        'scheduled_publish_at',
        // 待遇・条件
        'holidays',
        'holiday_details',
        'insurance',
        'allowances',
        'probation_period',
        'probation_conditions',
        // 給与詳細
        'salary_details',
        'raise_frequency',
        'bonus',
        // 勤務環境
        'remote_policy',
        'office_address',
        'nearest_station',
        'access_info',
        'transfer_policy',
        'overtime_average',
        'work_environment',
        // 選考情報
        'selection_process',
        'required_documents',
        'estimated_timeline',
        // 会社の魅力
        'company_culture',
        'number_of_employees',
        'founded_year',
        'industry',
        // その他
        'appeal_points',
        'contract_period',
        'notes',
        // 人材紹介
        'allow_referral',
        'referral_fee_type',
        'referral_fee',
        'referral_conditions',
        'client_company_industry',
        'client_company_employees',
        // 職種カテゴリ
        'job_category_major',
        'job_category_minor',
        // 採用情報
        'application_type',
        'positions_available',
        'feature_tags',
        // 仕事内容補足
        'preferred_qualifications',
        'recruitment_background',
        'scope_of_change',
        'location_scope_of_change',
        // 勤務条件補足
        'dormitory',
        'smoking_policy',
        // エージェント限定情報
        'age_min',
        'age_max',
        'gender_requirement',
        'nationality_requirement',
        'education_requirement',
        'referral_fee_distribution',
        'refund_policy',
        'payment_terms',
        'disclosure_scope',
        'likely_candidates',
        'ng_targets',
        'selection_details_agent',
        'last_company_action_at',
        'source',
        'hellowork_id',
        'ranking_score',
    ];

    protected function casts(): array
    {
        return [
            'status' => JobStatus::class ,
            'last_company_action_at' => 'datetime',
            'salary_min' => 'integer',
            'salary_max' => 'integer',
            'daily_budget' => 'decimal:2',
            'ng_word_flagged' => 'boolean',
            'allow_referral' => 'boolean',
            'show_dispatch_client' => 'boolean',
            'referral_fee' => 'decimal:2',
            'benefits' => 'array',
            'insurance' => 'array',
            'feature_tags' => 'array',
            'positions_available' => 'integer',
            'age_min' => 'integer',
            'age_max' => 'integer',
            'published_at' => 'datetime',
            'expires_at' => 'datetime',
            'scheduled_publish_at' => 'datetime',
        ];
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function agencyClient()
    {
        return $this->belongsTo(AgencyClient::class);
    }

    public function applications()
    {
        return $this->hasMany(Application::class);
    }

    public function persona()
    {
        return $this->hasOne(JobPersona::class);
    }

    public function photos()
    {
        return $this->hasMany(JobPhoto::class)->orderBy('sort_order');
    }

    public function views()
    {
        return $this->hasMany(JobView::class);
    }

    /**
     * 人材会社の法的表示テキスト
     */
    public function agencyDisplayText(): ?string
    {
        if (!$this->agencyClient) {
            return null;
        }

        $company = $this->company;
        $permitNumber = $company->permit_number ?? '未登録';

        return "{$company->company_name}（許可番号: {$permitNumber}）が代理掲載しています";
    }

    public function isActive(): bool
    {
        return $this->status === JobStatus::Active;
    }
}
