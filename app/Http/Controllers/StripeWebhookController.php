<?php

namespace App\Http\Controllers;

use App\Mail\PaymentFailedMail;
use App\Models\AdminAuditLog;
use App\Models\Campaign;
use App\Models\Job;
use App\Services\PaymentPenaltyService;
use App\Models\Company;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class StripeWebhookController extends Controller
{
    public function __construct(private
        PaymentPenaltyService $penaltyService
        )
    {
    }

    /**
     * Stripe Webhook ハンドラー
     */
    public function handle(Request $request)
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');

        // Webhook署名検証
        $webhookSecret = config('services.stripe.webhook_secret');

        if (!$webhookSecret) {
            Log::error('Stripe webhook secret is not configured.');
            return response()->json(['error' => 'Webhook secret not configured'], 500);
        }

        try {
            $event = \Stripe\Webhook::constructEvent($payload, $sigHeader, $webhookSecret);
        } catch (\Stripe\Exception\SignatureVerificationException $e) {
            Log::warning('Stripe webhook signature verification failed.', [
                'error' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Invalid signature'], 400);
        } catch (\Exception $e) {
            Log::error('Stripe webhook parsing failed.', [
                'error' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Invalid payload'], 400);
        }

        $type = $event->type;

        Log::info("Stripe webhook received: {$type}", [
            'event_id' => $event->id,
        ]);

        switch ($type) {
            case 'invoice.payment_failed':
                $this->handlePaymentFailed($event->toArray());
                break;

            case 'invoice.paid':
                $this->handlePaymentSucceeded($event->toArray());
                break;

            case 'invoice.payment_action_required':
                $this->handlePaymentActionRequired($event->toArray());
                break;

            case 'payment_intent.payment_failed':
                $this->handlePaymentIntentFailed($event->toArray());
                break;

            case 'charge.refunded':
                Log::info('Stripe charge refunded.', [
                    'event_id' => $event->id,
                    'charge_id' => $event->data->object->id ?? null,
                ]);
                break;
        }

        return response()->json(['status' => 'ok']);
    }

    /**
     * 決済失敗 → Phase 1 ペナルティ発動
     */
    private function handlePaymentFailed(array $event): void
    {
        $stripeCustomerId = $event['data']['object']['customer'] ?? null;

        if (!$stripeCustomerId)
            return;

        $company = Company::where('stripe_customer_id', $stripeCustomerId)->first();

        if ($company) {
            Log::warning('Payment failed for company.', [
                'company_id' => $company->id,
                'company_name' => $company->company_name,
                'stripe_customer_id' => $stripeCustomerId,
            ]);
            AdminAuditLog::logSystem(
                'payment_failed',
                'Company',
                $company->id,
                "Invoice payment failed. Stripe customer: {$stripeCustomerId}"
            );
            $this->penaltyService->applyPhase1($company);
        }
    }

    /**
     * 決済成功 → 全制限解除
     */
    private function handlePaymentSucceeded(array $event): void
    {
        $stripeCustomerId = $event['data']['object']['customer'] ?? null;

        if (!$stripeCustomerId)
            return;

        $company = Company::where('stripe_customer_id', $stripeCustomerId)->first();

        if ($company && ($company->needsAttention() || $company->isSuspended())) {
            Log::info('Payment succeeded, restoring company.', [
                'company_id' => $company->id,
                'company_name' => $company->company_name,
            ]);
            AdminAuditLog::logSystem(
                'payment_succeeded',
                'Company',
                $company->id,
                "Invoice paid. Restrictions restored. Stripe customer: {$stripeCustomerId}"
            );
            $this->penaltyService->restore($company);
        }
    }

    /**
     * PaymentIntent 失敗（継続課金 off_session）→ 対象を自動一時停止
     */
    private function handlePaymentIntentFailed(array $event): void
    {
        $pi = $event['data']['object'];
        $metadata = $pi['metadata'] ?? [];
        $stripeCustomerId = $pi['customer'] ?? null;
        $amount = $pi['amount'] ?? 0;

        $company = $stripeCustomerId
            ? Company::where('stripe_customer_id', $stripeCustomerId)->first()
            : null;

        // キャンペーン課金失敗
        if (!empty($metadata['campaign_id'])) {
            $campaign = Campaign::find($metadata['campaign_id']);
            if ($campaign) {
                $campaign->update(['status' => 'paused']);
                $campaign->activeJobs()->update(['daily_budget' => 0]);

                AdminAuditLog::logSystem(
                    'campaign_billing_failed_webhook',
                    'Campaign',
                    $campaign->id,
                    "PaymentIntent failed ¥{$amount} (pi: {$pi['id']}). Campaign auto-paused."
                );

                if ($company) {
                    $user = $company->user;
                    if ($user && $user->email) {
                        try {
                            Mail::to($user->email)->send(new PaymentFailedMail($company, $amount, $campaign->name, 'campaign'));
                        } catch (\Exception $e) {
                            Log::error('PaymentFailedMail send error', ['error' => $e->getMessage()]);
                        }
                    }
                }
            }
            return;
        }

        // 求人課金失敗
        if (!empty($metadata['job_id'])) {
            $job = Job::find($metadata['job_id']);
            if ($job) {
                $job->update(['status' => 'paused']);

                AdminAuditLog::logSystem(
                    'job_billing_failed_webhook',
                    'Job',
                    $job->id,
                    "PaymentIntent failed ¥{$amount} (pi: {$pi['id']}). Job auto-paused."
                );

                if ($company) {
                    $user = $company->user;
                    if ($user && $user->email) {
                        try {
                            Mail::to($user->email)->send(new PaymentFailedMail($company, $amount, $job->title, 'job'));
                        } catch (\Exception $e) {
                            Log::error('PaymentFailedMail send error', ['error' => $e->getMessage()]);
                        }
                    }
                }
            }
            return;
        }

        // メタデータなし（有効化時の単発決済失敗など）
        if ($company) {
            Log::warning('PaymentIntent failed (no job/campaign metadata)', [
                'company_id' => $company->id,
                'pi_id'      => $pi['id'],
                'amount'     => $amount,
            ]);
        }
    }

    /**
     * 決済アクション要求（3Dセキュア等）
     */
    private function handlePaymentActionRequired(array $event): void
    {
        $stripeCustomerId = $event['data']['object']['customer'] ?? null;

        if (!$stripeCustomerId)
            return;

        $company = Company::where('stripe_customer_id', $stripeCustomerId)->first();

        if ($company) {
            Log::info('Payment action required for company.', [
                'company_id' => $company->id,
                'company_name' => $company->company_name,
            ]);
        }
    }
}
