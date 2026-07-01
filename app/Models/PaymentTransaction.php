<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

class PaymentTransaction extends Model
{
    protected $fillable = [
        'company_id', 'agency_id', 'campaign_id', 'job_id', 'amount', 'agency_share_amount', 'currency',
        'type', 'stripe_payment_intent_id', 'status', 'charged_at',
    ];

    protected function casts(): array
    {
        return ['charged_at' => 'datetime'];
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function agency()
    {
        return $this->belongsTo(Company::class, 'agency_id');
    }

    /**
     * 課金成功時に台帳へ記録。失敗しても課金フロー自体は止めない（ログのみ）。
     * stripe_payment_intent_id があれば重複登録を防ぐ。
     */
    public static function record(array $attrs): void
    {
        try {
            $attrs['charged_at'] = $attrs['charged_at'] ?? now();
            $attrs['status'] = $attrs['status'] ?? 'succeeded';
            $attrs['currency'] = $attrs['currency'] ?? 'jpy';

            // 求人課金レベニューシェア: この企業を運用中の代理店がいれば、求人課金の一定割合を代理店取り分として計上（モデルA・分離型）。
            // agency自身への課金など、明示済みや成功以外の取引には付けない。
            if (($attrs['status'] === 'succeeded') && !empty($attrs['company_id']) && !array_key_exists('agency_id', $attrs)) {
                $engagement = AgencyEngagement::activeForClient((int) $attrs['company_id']);
                if ($engagement && $engagement->agency_id !== (int) $attrs['company_id']) {
                    $rate = (float) ($engagement->revenue_share_rate ?? 0.25);
                    $attrs['agency_id'] = $engagement->agency_id;
                    $attrs['agency_share_amount'] = (int) floor(((int) ($attrs['amount'] ?? 0)) * $rate);
                }
            }

            if (!empty($attrs['stripe_payment_intent_id'])) {
                static::updateOrCreate(
                    ['stripe_payment_intent_id' => $attrs['stripe_payment_intent_id']],
                    $attrs
                );
            } else {
                static::create($attrs);
            }
        } catch (\Throwable $e) {
            Log::warning('payment_transaction record failed: ' . $e->getMessage());
        }
    }
}
