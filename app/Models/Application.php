<?php

namespace App\Models;

use App\Enums\ApplicationStatus;
use App\Enums\ApplicationType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Application extends Model
{
    use HasFactory;

    protected $fillable = [
        'job_id',
        'user_id',
        'type',
        'status',
        'resume_snapshot',
        'cover_letter',
        'company_note',
        'rejection_reason',
        'rejection_feedback',
    ];

    protected function casts(): array
    {
        return [
            'type' => ApplicationType::class ,
            'status' => ApplicationStatus::class ,
            'resume_snapshot' => 'array',
        ];
    }

    public function job()
    {
        return $this->belongsTo(Job::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function messages()
    {
        return $this->hasMany(Message::class);
    }

    public function interviewSchedules()
    {
        return $this->hasMany(InterviewSchedule::class);
    }

    public function statusHistories()
    {
        return $this->hasMany(ApplicationStatusHistory::class);
    }

    public function isAccepted(): bool
    {
        return $this->status === ApplicationStatus::Accepted;
    }

    public function isScout(): bool
    {
        return $this->type === ApplicationType::Scout;
    }

    /**
     * チャット可能かどうか（スカウトの場合は承認後のみ）
     */
    public function canChat(): bool
    {
        if ($this->isScout()) {
            return $this->isAccepted();
        }
        return true; // 通常応募はいつでもチャット可
    }
}
