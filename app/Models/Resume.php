<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Resume extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'profile_id',
        'title',
        'type',
        'motivation',
        'desired_salary',
        'desired_location',
        'available_date',
        'custom_fields',
        'content',
        'is_default',
        'scout_enabled',
    ];

    protected function casts(): array
    {
        return [
            'available_date' => 'date',
            'custom_fields' => 'array',
            'content' => 'array',
            'is_default' => 'boolean',
            'scout_enabled' => 'boolean',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function profile()
    {
        return $this->belongsTo(UserProfile::class, 'profile_id');
    }

    /**
     * JIS規格スナップショットデータ（PDFプレビュー・応募凍結用）
     */
    public function toSnapshotData(): array
    {
        $profile = $this->profile;

        return [
            'snapshot_at' => now()->toDateTimeString(),
            'full_name' => $profile?->full_name ?? '',
            'full_name_kana' => $profile?->full_name_kana ?? '',
            'birth_date' => $profile?->birth_date?->format('Y-m-d') ?? '',
            'gender' => $profile?->gender ?? '',
            'phone' => $profile?->phone ?? '',
            'postal_code' => $profile?->postal_code ?? '',
            'address' => $profile?->address ?? '',
            'photo_path' => $profile?->photo_path,
            'education' => array_merge(
                $profile?->education ?? [],
                is_array($this->content['extra_education'] ?? null) ? $this->content['extra_education'] : []
            ),
            'work_history' => array_merge(
                $profile?->work_history ?? [],
                is_array($this->content['extra_work_history'] ?? null) ? $this->content['extra_work_history'] : []
            ),
            'licenses' => array_merge(
                $profile?->licenses ?? [],
                is_array($this->content['extra_licenses'] ?? null) ? $this->content['extra_licenses'] : []
            ),
            'skills' => $profile?->skills ?? [],
            'self_pr' => $profile?->self_pr ?? '',
            'motivation' => $this->motivation ?? '',
            'desired_salary' => $this->desired_salary ?? '',
            'desired_location' => $this->desired_location ?? '',
            'available_date' => $this->available_date?->format('Y-m-d') ?? '',
            'custom_fields' => $this->custom_fields ?? [],
            'type' => $this->type ?? 'resume',
            'content' => $this->content ?? [],
        ];
    }
}