<?php

namespace App\Http\Controllers;

use App\Models\AdminAuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\Job;
use Stripe\Stripe;
use Stripe\Customer;
use Stripe\SetupIntent;
use Stripe\PaymentMethod;
use Stripe\PaymentIntent;

class PaymentController extends Controller
{
    public function __construct()
    {
        Stripe::setApiKey(config('services.stripe.secret'));
    }

    /**
     * Stripe顧客を作成し、SetupIntentを返す（カード登録用）
     */
    public function createSetupIntent(Request $request)
    {
        $company = $request->user()->company;

        if (!$company) {
            return response()->json(['message' => '企業情報を先に登録してください。'], 400);
        }

        // Stripe顧客がなければ作成
        if (!$company->stripe_customer_id) {
            $customer = Customer::create([
                'email' => $request->user()->email,
                'name' => $company->company_name,
                'metadata' => [
                    'company_id' => $company->id,
                    'user_id' => $request->user()->id,
                ],
            ]);
            $company->update(['stripe_customer_id' => $customer->id]);

            AdminAuditLog::logSystem(
                'stripe_customer_created',
                'Company',
                $company->id,
                "Stripe customer created: {$customer->id} by user #{$request->user()->id}"
            );
        }

        $setupIntent = SetupIntent::create([
            'customer' => $company->stripe_customer_id,
            'payment_method_types' => ['card'],
        ]);

        return response()->json([
            'client_secret' => $setupIntent->client_secret,
        ]);
    }

    /**
     * カード登録完了（SetupIntent成功後にフロントから呼ばれる）
     */
    public function confirmCard(Request $request)
    {
        $request->validate([
            'payment_method_id' => 'required|string',
        ]);

        $company = $request->user()->company;

        if (!$company || !$company->stripe_customer_id) {
            return response()->json(['message' => '企業情報が見つかりません。'], 400);
        }

        // デフォルトの支払い方法として設定
        Customer::update($company->stripe_customer_id, [
            'invoice_settings' => [
                'default_payment_method' => $request->payment_method_id,
            ],
        ]);

        AdminAuditLog::logSystem(
            'payment_method_registered',
            'Company',
            $company->id,
            "Card registered (pm: {$request->payment_method_id}) by user #{$request->user()->id}"
        );

        return response()->json(['message' => 'カードが登録されました。']);
    }

    /**
     * 登録済みカード情報を取得
     */
    public function getPaymentMethod(Request $request)
    {
        $company = $request->user()->company;

        if (!$company || !$company->stripe_customer_id) {
            return response()->json(['card' => null]);
        }

        try {
            $customer = Customer::retrieve($company->stripe_customer_id, [
                'expand' => ['invoice_settings.default_payment_method'],
            ]);

            $pm = $customer->invoice_settings->default_payment_method;

            if (!$pm) {
                // デフォルトがなくても紐づいているカードを探す
                $methods = PaymentMethod::all([
                    'customer' => $company->stripe_customer_id,
                    'type' => 'card',
                    'limit' => 1,
                ]);

                if (count($methods->data) > 0) {
                    $pm = $methods->data[0];
                }
            }

            if ($pm) {
                return response()->json([
                    'card' => [
                        'brand' => $pm->card->brand,
                        'last4' => $pm->card->last4,
                        'exp_month' => $pm->card->exp_month,
                        'exp_year' => $pm->card->exp_year,
                    ],
                ]);
            }
        } catch (\Exception $e) {
            Log::warning('Stripe getPaymentMethod error', [
                'company_id' => $company->id,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json(['card' => null]);
    }

    /**
     * カードを削除（変更する場合は削除→再登録）
     */
    public function deletePaymentMethod(Request $request)
    {
        $company = $request->user()->company;

        if (!$company || !$company->stripe_customer_id) {
            return response()->json(['message' => '企業情報が見つかりません。'], 400);
        }

        $methods = PaymentMethod::all([
            'customer' => $company->stripe_customer_id,
            'type' => 'card',
        ]);

        $deletedCount = 0;
        foreach ($methods->data as $method) {
            $method->detach();
            $deletedCount++;
        }

        AdminAuditLog::logSystem(
            'payment_method_deleted',
            'Company',
            $company->id,
            "Deleted {$deletedCount} card(s) by user #{$request->user()->id}"
        );

        return response()->json(['message' => 'カードを削除しました。']);
    }

    /**
     * 求人アクティブ化時の即時決済（初日分の日額予算を即時請求）
     */
    public function chargeJobActivation(Request $request)
    {
        $request->validate([
            'job_id' => 'required|integer|exists:jobs,id',
        ]);

        $company = $request->user()->company;

        if (!$company || !$company->stripe_customer_id) {
            return response()->json(['message' => 'クレジットカードを先に登録してください。', 'payment_required' => true], 402);
        }

        $job = Job::where('id', $request->job_id)
            ->where('company_id', $company->id)
            ->firstOrFail();

        $dailyBudget = (float) ($job->daily_budget ?? 0);

        // 日額予算が0円の場合は課金不要（無料掲載）
        if ($dailyBudget <= 0) {
            return response()->json(['message' => '課金不要です。', 'charged' => false, 'amount' => 0]);
        }

        // 最低課金額チェック
        $amount = (int) $dailyBudget;
        if ($amount < 500) {
            return response()->json(['message' => '日額予算は最低¥500以上に設定してください。'], 422);
        }

        try {
            // デフォルト支払い方法を取得
            $customer = Customer::retrieve($company->stripe_customer_id, [
                'expand' => ['invoice_settings.default_payment_method'],
            ]);
            $paymentMethodId = $customer->invoice_settings->default_payment_method?->id;

            if (!$paymentMethodId) {
                // フォールバック: 紐づいているカードを探す
                $methods = PaymentMethod::all([
                    'customer' => $company->stripe_customer_id,
                    'type' => 'card',
                    'limit' => 1,
                ]);
                if (count($methods->data) === 0) {
                    return response()->json(['message' => 'クレジットカードを先に登録してください。', 'payment_required' => true], 402);
                }
                $paymentMethodId = $methods->data[0]->id;
            }

            // 即時決済（初日分の日額予算）
            $intent = PaymentIntent::create([
                'amount' => $amount,
                'currency' => 'jpy',
                'customer' => $company->stripe_customer_id,
                'payment_method' => $paymentMethodId,
                'confirm' => true,
                'off_session' => true,
                'description' => "求人掲載費（初日分）: {$job->title} [job#{$job->id}]",
                'metadata' => [
                    'job_id' => $job->id,
                    'company_id' => $company->id,
                    'type' => 'job_activation',
                ],
            ]);

            if ($intent->status !== 'succeeded') {
                return response()->json(['message' => '決済に失敗しました。カード情報をご確認ください。'], 402);
            }

            AdminAuditLog::logSystem(
                'job_activation_charged',
                'Job',
                $job->id,
                "Charged ¥{$amount} for job activation (pi: {$intent->id}) by company #{$company->id}"
            );

            return response()->json([
                'message' => "¥" . number_format($amount) . "の決済が完了しました。",
                'charged' => true,
                'amount' => $amount,
                'payment_intent_id' => $intent->id,
            ]);

        } catch (\Stripe\Exception\CardException $e) {
            return response()->json(['message' => 'カードが拒否されました: ' . $e->getMessage()], 402);
        } catch (\Exception $e) {
            Log::error('Job activation charge failed', [
                'job_id' => $job->id,
                'company_id' => $company->id,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => '決済処理中にエラーが発生しました。'], 500);
        }
    }

    /**
     * カード登録状態チェック（求人アクティブ化の前提条件）
     */
    public function checkPaymentReady(Request $request)
    {
        $company = $request->user()->company;

        if (!$company) {
            return response()->json(['ready' => false, 'reason' => 'no_company']);
        }

        if (!$company->stripe_customer_id) {
            return response()->json(['ready' => false, 'reason' => 'no_card']);
        }

        try {
            $methods = PaymentMethod::all([
                'customer' => $company->stripe_customer_id,
                'type' => 'card',
                'limit' => 1,
            ]);

            if (count($methods->data) === 0) {
                return response()->json(['ready' => false, 'reason' => 'no_card']);
            }
        } catch (\Exception $e) {
            return response()->json(['ready' => false, 'reason' => 'stripe_error']);
        }

        return response()->json(['ready' => true]);
    }
}
