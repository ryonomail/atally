<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BudgetAuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'company_id',
        'job_id',
        'user_id',
        'action',
        'old_budget',
        'new_budget',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'old_budget' => 'decimal:2',
            'new_budget' => 'decimal:2',
            'created_at' => 'datetime',
        ];
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function job()
    {
        return $this->belongsTo(Job::class)->withTrashed();
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
