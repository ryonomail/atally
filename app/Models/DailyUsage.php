<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DailyUsage extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'date',
        'budget_amount',
        'max_budget_amount',
        'billed',
        'boost_factor',
        'base_budget',
        'reply_rate',
        'reply_speed_hours',
        'interview_setup_rate',
        'logged_in',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'budget_amount' => 'decimal:2',
            'max_budget_amount' => 'decimal:2',
            'billed' => 'boolean',
            'boost_factor' => 'decimal:1',
            'base_budget' => 'decimal:2',
            'reply_rate' => 'decimal:4',
            'reply_speed_hours' => 'decimal:2',
            'interview_setup_rate' => 'decimal:4',
            'logged_in' => 'boolean',
        ];
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }
}
