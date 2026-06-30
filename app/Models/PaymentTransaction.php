<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

class PaymentTransaction extends Model
{
    protected $fillable = [
        'company_id', 'campaign_id', 'job_id', 'amount', 'currency',
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
