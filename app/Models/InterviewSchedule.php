<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InterviewSchedule extends Model
{
    use HasFactory;

    protected $fillable = [
        'application_id',
        'scheduled_at',
        'location',
        'meeting_url',
        'notes',
        'status',
        'confirmed',
        'reminder_day_before_sent',
        'reminder_day_of_sent',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'confirmed' => 'boolean',
            'reminder_day_before_sent' => 'boolean',
            'reminder_day_of_sent' => 'boolean',
        ];
    }

    /**
     * ステータスラベル
     */
    public function getStatusLabelAttribute(): string
    {
        return match ($this->status) {
            'pending' => '未確認',
            'confirmed' => '確認済み',
            'cancelled' => 'キャンセル',
            'completed' => '完了',
            default => $this->status,
        };
    }

    public function application()
    {
        return $this->belongsTo(Application::class);
    }
}
