<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobReferral extends Model
{
    protected $fillable = [
        'job_id',
        'source_company_id',
        'referrer_company_id',
        'candidate_user_id',
        'fee_percentage',
        'referral_fee_type',
        'referral_fee_amount',
        'referral_pattern',
        'source_share',
        'referrer_share',
        'status',
        'message',
        'candidate_summary',
        'resume_file_path',
        'proposal_fee',
        'terms_accepted',
        'placement_salary',
        'total_fee',
        'source_fee',
        'referrer_fee',
        'placed_at',
    ];

    protected function casts(): array
    {
        return [
            'fee_percentage' => 'decimal:2',
            'referral_fee_amount' => 'integer',
            'source_share' => 'decimal:2',
            'referrer_share' => 'decimal:2',
            'proposal_fee' => 'integer',
            'terms_accepted' => 'boolean',
            'placement_salary' => 'integer',
            'total_fee' => 'integer',
            'source_fee' => 'integer',
            'referrer_fee' => 'integer',
            'placed_at' => 'datetime',
        ];
    }

    public function job()
    {
        return $this->belongsTo(Job::class);
    }

    public function sourceCompany()
    {
        return $this->belongsTo(Company::class, 'source_company_id');
    }

    public function referrerCompany()
    {
        return $this->belongsTo(Company::class, 'referrer_company_id');
    }

    public function candidateUser()
    {
        return $this->belongsTo(User::class, 'candidate_user_id');
    }
}
