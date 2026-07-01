<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AgencyEngagement extends Model
{
    protected $fillable = [
        'agency_id', 'client_company_id', 'status', 'monthly_fee',
        'revenue_share_rate', 'note', 'requested_at', 'activated_at', 'ended_at',
    ];

    protected function casts(): array
    {
        return [
            'monthly_fee' => 'integer',
            'revenue_share_rate' => 'decimal:3',
            'requested_at' => 'datetime',
            'activated_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    public function agency()
    {
        return $this->belongsTo(Company::class, 'agency_id');
    }

    public function clientCompany()
    {
        return $this->belongsTo(Company::class, 'client_company_id');
    }

    /** 指定の求人企業を現在運用中の代理店エンゲージメント（1件）を返す。 */
    public static function activeForClient(int $clientCompanyId): ?self
    {
        return static::where('client_company_id', $clientCompanyId)
            ->where('status', 'active')
            ->first();
    }
}
