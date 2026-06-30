<?php

namespace App\Console\Commands;

use App\Mail\PaymentFailedMail;
use App\Models\AdminAuditLog;
use App\Models\Campaign;
use App\Models\Job;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Stripe\Customer;
use Stripe\Exception\CardException;
use Stripe\PaymentIntent;
use Stripe\PaymentMethod;
use Stripe\Stripe;

class ChargeDailyBilling extends Command
{
    protected $signature = 'app:charge-daily-billing';
    protected $description = '毎日0:05 — アクティブ求人・キャンペーンに日額/月額の継続課金を実行';

    public function handle(): void
    {
        Stripe::setApiKey(config('services.stripe.secret'));

        $today = now()->toDateString();

        $charged = 0;
        $failed = 0;
        $skipped = 0;

        // ── 1. スタンドアロン求人（キャンペーン未所属）── 毎日課金 ──────────
        Job::where('status', 'active')
            ->whereNull('campaign_id')
            ->where('daily_budget', '>=', 500)
            ->with('company')
            ->chunk(50, function ($jobs) use (&$charged, &$failed, &$skipped) {
                foreach ($jobs as $job) {
                    if (!$job->company || !$job->company->stripe_customer_id) {
                        $skipped++;
                        continue;
                    }

                    $amount = (int) $job->daily_budget;
                    $result = $this->chargeCustomer(
                        $job->company,
                        $amount,
                        "日額課金: {$job->title} [job#{$job->id}]",
                        ['type' => 'daily_billing', 'job_id' => $job->id, 'company_id' => $job->company->id]
                    );

                    if ($result['success']) {
                        $charged++;
                        AdminAuditLog::logSystem(
                            'daily_billing_charged',
                            'Job',
                            $job->id,
                            "Daily ¥{$amount} charged (pi: {$result['payment_intent_id']}) company#{$job->company->id}"
                        );
                    } else {
                        $failed++;
                        $this->handleJobFailure($job, $amount, $result['message']);
                    }
                }
            });

        // ── 2. キャンペーン単位の課金 ─────────────────────────────────────
        Campaign::where('status', 'active')
            ->where('daily_budget', '>=', 500)
            ->with('company')
            ->chunk(50, function ($campaigns) use ($today, &$charged, &$failed, &$skipped) {
                foreach ($campaigns as $campaign) {
                    if ($campaign->billing_period === 'monthly') {
                        // 月額: next_billing_date が今日以前になったら課金
                        if (!$campaign->next_billing_date || $campaign->next_billing_date->toDateString() > $today) {
                            $skipped++;
                            continue;
                        }
                    }

                    if (!$campaign->company || !$campaign->company->stripe_customer_id) {
                        $skipped++;
                        continue;
                    }

                    $amount = (int) $campaign->daily_budget;
                    $periodLabel = $campaign->billing_period === 'monthly' ? '月額' : '日額';
                    $result = $this->chargeCustomer(
                        $campaign->company,
                        $amount,
                        "{$periodLabel}課金: {$campaign->name} [campaign#{$campaign->id}]",
                        ['type' => 'campaign_billing', 'campaign_id' => $campaign->id, 'company_id' => $campaign->company->id, 'billing_period' => $campaign->billing_period]
                    );

                    if ($result['success']) {
                        $charged++;
                        // 月額の場合: 課金成功後に次回請求日を +1ヶ月更新
                        if ($campaign->billing_period === 'monthly') {
                            $campaign->update([
                                'next_billing_date' => $campaign->next_billing_date->addMonth()->toDateString(),
                            ]);
                        }
                        AdminAuditLog::logSystem(
                            'campaign_billing_charged',
                            'Campaign',
                            $campaign->id,
                            "{$periodLabel} ¥{$amount} charged (pi: {$result['payment_intent_id']}) company#{$campaign->company->id}"
                        );
                    } else {
                        $failed++;
                        $this->handleCampaignFailure($campaign, $amount, $result['message']);
                    }
                }
            });

        $this->info("Daily billing complete — charged: {$charged}, failed: {$failed}, skipped: {$skipped}");
        Log::info('app:charge-daily-billing', compact('charged', 'failed', 'skipped'));
    }

    /**
     * Stripe PaymentIntent で即時課金（off_session）
     * @return array{success: bool, payment_intent_id?: string, message?: string}
     */
    private function chargeCustomer($company, int $amount, string $description, array $metadata): array
    {
        try {
            // デフォルト支払い方法を取得
            $customer = Customer::retrieve([
                'id' => $company->stripe_customer_id,
                'expand' => ['invoice_settings.default_payment_method'],
            ]);
            $pm = $customer->invoice_settings->default_payment_method;

            if (!$pm) {
                $methods = PaymentMethod::all([
                    'customer' => $company->stripe_customer_id,
                    'type' => 'card',
                    'limit' => 1,
                ]);
                $pm = count($methods->data) > 0 ? $methods->data[0] : null;
            }

            if (!$pm) {
                return ['success' => false, 'message' => 'カードが未登録'];
            }

            $intent = PaymentIntent::create([
                'amount'         => $amount,
                'currency'       => 'jpy',
                'customer'       => $company->stripe_customer_id,
                'payment_method' => $pm->id,
                'confirm'        => true,
                'off_session'    => true,
                'description'    => $description,
                'metadata'       => $metadata,
            ]);

            if ($intent->status !== 'succeeded') {
                return ['success' => false, 'message' => "決済ステータス: {$intent->status}"];
            }

            return ['success' => true, 'payment_intent_id' => $intent->id];

        } catch (CardException $e) {
            return ['success' => false, 'message' => 'カード拒否: ' . $e->getMessage()];
        } catch (\Exception $e) {
            Log::error('ChargeDailyBilling: Stripe error', [
                'company_id' => $company->id,
                'error' => $e->getMessage(),
            ]);
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * 求人の課金失敗処理 → 一時停止 + メール通知
     */
    private function handleJobFailure(Job $job, int $amount, string $reason): void
    {
        // 求人を一時停止
        $job->update(['status' => 'paused']);

        AdminAuditLog::logSystem(
            'daily_billing_failed',
            'Job',
            $job->id,
            "Daily billing ¥{$amount} failed ({$reason}). Job paused. company#{$job->company->id}"
        );

        Log::warning('Daily billing failed for job', [
            'job_id'     => $job->id,
            'company_id' => $job->company->id,
            'amount'     => $amount,
            'reason'     => $reason,
        ]);

        // 会社の担当者にメール送信
        $user = $job->company->user;
        if ($user && $user->email) {
            try {
                Mail::to($user->email)->send(new PaymentFailedMail(
                    $job->company,
                    $amount,
                    $job->title,
                    'job'
                ));
            } catch (\Exception $e) {
                Log::error('Failed to send PaymentFailedMail', ['error' => $e->getMessage()]);
            }
        }
    }

    /**
     * キャンペーンの課金失敗処理 → 一時停止 + メール通知
     */
    private function handleCampaignFailure(Campaign $campaign, int $amount, string $reason): void
    {
        // キャンペーンを一時停止（所属求人の日額も0に）
        $campaign->update(['status' => 'paused']);
        $campaign->activeJobs()->update(['daily_budget' => 0]);

        AdminAuditLog::logSystem(
            'campaign_billing_failed',
            'Campaign',
            $campaign->id,
            "Campaign billing ¥{$amount} failed ({$reason}). Campaign paused. company#{$campaign->company->id}"
        );

        Log::warning('Daily billing failed for campaign', [
            'campaign_id' => $campaign->id,
            'company_id'  => $campaign->company->id,
            'amount'      => $amount,
            'reason'      => $reason,
        ]);

        $user = $campaign->company->user;
        if ($user && $user->email) {
            try {
                Mail::to($user->email)->send(new PaymentFailedMail(
                    $campaign->company,
                    $amount,
                    $campaign->name,
                    'campaign'
                ));
            } catch (\Exception $e) {
                Log::error('Failed to send PaymentFailedMail', ['error' => $e->getMessage()]);
            }
        }
    }
}
