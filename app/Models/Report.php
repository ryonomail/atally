<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Report extends Model
{
    use HasFactory;

    protected $fillable = [
        'reporter_id',
        'reported_user_id',
        'reported_job_id',
        'reason',
        'description',
        'status',
        'admin_note',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
        ];
    }

    public function reporter()
    {
        return $this->belongsTo(User::class , 'reporter_id');
    }

    public function reportedUser()
    {
        return $this->belongsTo(User::class , 'reported_user_id');
    }

    public function reportedJob()
    {
        return $this->belongsTo(Job::class , 'reported_job_id');
    }
}
