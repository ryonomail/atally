<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'full_name',
        'full_name_kana',
        'birth_date',
        'gender',
        'phone',
        'postal_code',
        'address',
        'photo_path',
        'education',
        'work_history',
        'licenses',
        'skills',
        'self_pr',
    ];

    protected function casts(): array
    {
        return [
            'birth_date' => 'date',
            'education' => 'array',
            'work_history' => 'array',
            'licenses' => 'array',
            'skills' => 'array',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function resumes()
    {
        return $this->hasMany(Resume::class , 'profile_id');
    }

    /**
     * プロフィール入力完了率（品質スコア加点用）
     */
    public function completionRate(): float
    {
        $fields = ['full_name', 'birth_date', 'phone', 'address', 'education', 'work_history', 'self_pr', 'photo_path'];
        $filled = 0;
        foreach ($fields as $field) {
            if (!empty($this->$field)) {
                $filled++;
            }
        }
        return $filled / count($fields);
    }
}
