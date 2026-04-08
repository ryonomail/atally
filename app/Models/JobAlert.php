<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JobAlert extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'keyword',
        'location',
        'employment_type',
        'salary_min',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'salary_min' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
