<?php

namespace App\Http\Controllers;

use App\Models\AdminAuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
        // カード情報はオーナーのみ参照可能
        if ($request->user()->company_role !== 'owner') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

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
        // カード削除はオーナーのみ可能
        if ($request->user()->company_role !== 'owner') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

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
