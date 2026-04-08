<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminAuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'admin_id',
        'action',
        'target_type',
        'target_id',
        'details',
        'ip_address',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    public static function log(int $adminId, string $action, ?string $targetType = null, ?int $targetId = null, ?string $details = null): self
    {
        return self::create([
            'admin_id' => $adminId,
            'action' => $action,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'details' => $details,
            'ip_address' => request()?->ip(),
            'created_at' => now(),
        ]);
    }

    /**
     * システムイベント用ログ（admin_id = 0 はシステム操作を示す）
     */
    public static function logSystem(string $action, ?string $targetType = null, ?int $targetId = null, ?string $details = null): self
    {
        return self::create([
            'admin_id' => 0,
            'action' => $action,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'details' => $details,
            'ip_address' => request()?->ip(),
            'created_at' => now(),
        ]);
    }
}
