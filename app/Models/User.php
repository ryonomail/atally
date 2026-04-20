<?php

namespace App\Models;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'google_id',
        'avatar_url',
        'company_id',
        'company_role',
        'last_login_at',
        'email_on_new_application',
        'email_on_message',
        'email_on_scout',
        'email_on_job_alert',
        'suspended_at',
        'suspension_reason',
        'deactivated_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'google_id',        // OAuth識別子は外部に漏洩させない
        'suspension_reason', // 停止理由は管理者のみ参照（APIレスポンスから除外）
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'suspended_at' => 'datetime',
            'deactivated_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class ,
        ];
    }

    public function profile()
    {
        return $this->hasOne(UserProfile::class);
    }

    public function resumes()
    {
        return $this->hasMany(Resume::class);
    }

    public function company()
    {
        return $this->hasOne(Company::class);
    }

    /**
     * チームメンバーとして所属する企業
     */
    public function teamCompany()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    /**
     * 所属企業を取得（オーナーの場合は hasOne、メンバーの場合は belongsTo）
     */
    public function resolveCompany(): ?Company
    {
        return $this->teamCompany ?? $this->company;
    }

    public function isCompanyOwner(): bool
    {
        return $this->company_role === 'owner';
    }

    public function isCompanyAdmin(): bool
    {
        return in_array($this->company_role, ['owner', 'admin']);
    }

    public function applications()
    {
        return $this->hasMany(Application::class);
    }

    public function savedJobs()
    {
        return $this->belongsToMany(Job::class, 'saved_jobs')->withPivot('created_at');
    }

    public function jobAlerts()
    {
        return $this->hasMany(JobAlert::class);
    }

    public function inAppNotifications()
    {
        return $this->hasMany(InAppNotification::class);
    }

    public function isJobSeeker(): bool
    {
        return $this->role === UserRole::JobSeeker;
    }

    public function isCompany(): bool
    {
        return $this->role === UserRole::Company;
    }

    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }

    public function isSuspended(): bool
    {
        return $this->suspended_at !== null;
    }
}
