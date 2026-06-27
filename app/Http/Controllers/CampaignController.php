<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\Company;
use App\Models\Job;
use App\Models\AdminAuditLog;
use App\Services\BillingProtectionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Stripe\Stripe;
use Stripe\Customer;
use Stripe\PaymentMethod;
use Stripe\PaymentIntent;

class CampaignController extends Controller
{
    // 予算グループ一覧
    public function index()
    {
        $company = Auth::user()->company;
        $campaigns = Campaign::where('company_id', $company->id)
            ->withCount(['jobs', 'jobs as active_jobs_count' => function ($q) {
                $q->where('status', 'active');
            }])
            ->latest()
            ->get()
            ->map(function ($campaign) {
                $campaign->actual_daily_spend = $campaign->activeJobs()->sum('daily_budget');
                $campaign->monthly_estimate = (float) $campaign->daily_budget * 30;
                return $campaign;
            });

        return response()->json($campaigns);
    }

    // 予算グループ詳細（所属求人込み）
    public function show(Campaign $campaign)
    {
        $company = Auth::user()->company;
        if ($campaign->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $campaign->load(['jobs' => function ($q) {
            $q->withCount('views')
              ->withCount(['views as recent_views_count' => function ($q) {
                  $q->where('viewed_at', '>=', now()->subDays(7));
              }])
              ->withCount('applications');
        }]);

        $campaign->actual_daily_spend = $campaign->activeJobs()->sum('daily_budget');
        $campaign->monthly_estimate = (float) $campaign->daily_budget * 30;

        return response()->json($campaign);
    }

    // 即時決済の共通処理
    private function chargeNow(Company $company, Campaign $campaign, int $amount, string $description): array
    {
        Stripe::setApiKey(config('services.stripe.secret'));

        $customer = Customer::retrieve($company->stripe_customer_id, [
            'expand' => ['invoice_settings.default_payment_method'],
        ]);
        $pm = $customer->invoice_settings->default_payment_method;
        if (!$pm) {
            $methods = PaymentMethod::all(['customer' => $company->stripe_customer_id, 'type' => 'card', 'limit' => 1]);
            $pm = count($methods->data) > 0 ? $methods->data[0] : null;
        }
        if (!$pm) {
            return ['success' => false, 'message' => 'クレジットカードを先に登録してください。', 'payment_required' => true];
        }

        $intent = PaymentIntent::create([
            'amount' => $amount,
            'currency' => 'jpy',
            'customer' => $company->stripe_customer_id,
            'payment_method' => $pm->id,
            'confirm' => true,
            'off_session' => true,
            'description' => $description,
            'metadata' => ['campaign_id' => $campaign->id, 'company_id' => $company->id, 'type' => 'campaign_activation'],
        ]);

        if ($intent->status !== 'succeeded') {
            return ['success' => false, 'message' => '決済に失敗しました。カード情報をご確認ください。'];
        }

        AdminAuditLog::logSystem('campaign_charged', 'Campaign', $campaign->id,
            "Charged ¥{$amount} for campaign activation (pi: {$intent->id}) company#{$company->id}");

        return ['success' => true];
    }

    // 予算グループ作成
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'daily_budget' => 'required|numeric|min:500|max:9999999',
            'budget_allocation' => 'nullable|in:even,weighted',
            'billing_period' => 'nullable|in:daily,monthly',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'job_ids' => 'nullable|array',
            'job_ids.*' => 'integer|exists:jobs,id',
        ]);

        $company = Auth::user()->company;

        if (!$company->stripe_customer_id) {
            return response()->json(['message' => 'クレジットカードを先に登録してください。', 'payment_required' => true], 402);
        }

        // 即時決済（キャンペーン作成時に初回分を課金）
        $amount = (int) $request->daily_budget;
        $billingPeriod = $request->billing_period ?? 'daily';
        $periodLabel = $billingPeriod === 'monthly' ? '月額' : '日額';
        $chargeResult = $this->chargeNow($company, new Campaign(['id' => 0, 'company_id' => $company->id]), $amount,
            "キャンペーン開始費（{$periodLabel}初回分）: {$request->name}");
        if (!$chargeResult['success']) {
            return response()->json($chargeResult, 402);
        }

        // 月額の場合：申し込み日から1ヶ月後を次回請求日にセット
        $nextBillingDate = $billingPeriod === 'monthly' ? now()->addMonth()->toDateString() : null;

        $campaign = Campaign::create([
            'company_id' => $company->id,
            'name' => $request->name,
            'daily_budget' => $request->daily_budget,
            'budget_allocation' => $request->budget_allocation ?? 'even',
            'billing_period' => $billingPeriod,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'next_billing_date' => $nextBillingDate,
        ]);

        // 求人を紐付け
        if ($request->filled('job_ids')) {
            Job::where('company_id', $company->id)
                ->whereIn('id', $request->job_ids)
                ->update(['campaign_id' => $campaign->id]);

            // 予算を配分
            $campaign->refresh();
            $campaign->distributeBudget();
        }

        $campaign->loadCount('jobs');

        return response()->json($campaign, 201);
    }

    // 予算グループ更新
    public function update(Request $request, Campaign $campaign)
    {
        $company = Auth::user()->company;
        if ($campaign->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // lockForUpdate はトランザクション内でのみ有効
        return \Illuminate\Support\Facades\DB::transaction(function () use ($request, $campaign, $company) {

        $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'daily_budget' => 'sometimes|required|numeric|min:500|max:9999999',
            'budget_allocation' => 'nullable|in:even,weighted',
            'billing_period' => 'nullable|in:daily,monthly',
            'status' => 'nullable|in:active,paused,ended',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        // 二重課金防止: 悲観ロックで再取得し最新ステータスを確認
        $campaign = \App\Models\Campaign::where('id', $campaign->id)
            ->where('company_id', $company->id)
            ->lockForUpdate()
            ->first();

        if (!$campaign) {
            return response()->json(['message' => 'キャンペーンが見つかりません。'], 404);
        }

        $oldBudget = (float) $campaign->daily_budget;

        // paused→active への再開時も初回分を即時決済
        $reactivating = $request->status === 'active' && $campaign->status !== 'active';
        if ($reactivating) {
            $amount = (int) $campaign->daily_budget;
            if ($amount >= 500) {
                $billingPeriodOnResume = $request->billing_period ?? $campaign->billing_period;
                $periodLabelOnResume = $billingPeriodOnResume === 'monthly' ? '月額' : '日額';
                $chargeResult = $this->chargeNow($company, $campaign, $amount,
                    "キャンペーン再開費（{$periodLabelOnResume}初回分）: {$campaign->name}");
                if (!$chargeResult['success']) {
                    return response()->json($chargeResult, 402);
                }
            }
        }

        $updateData = $request->only([
            'name', 'daily_budget', 'budget_allocation', 'billing_period', 'status', 'start_date', 'end_date',
        ]);

        // 月額で再開・billing_period変更時は next_billing_date を今日から1ヶ月後にリセット
        $newBillingPeriod = $request->billing_period ?? $campaign->billing_period;
        if ($newBillingPeriod === 'monthly' && ($reactivating || $request->has('billing_period'))) {
            $updateData['next_billing_date'] = now()->addMonth()->toDateString();
        }
        // 日額に変更した場合は next_billing_date をクリア
        if ($request->billing_period === 'daily') {
            $updateData['next_billing_date'] = null;
        }

        $campaign->update($updateData);

        // 一時停止の場合、所属求人を無料ティアに戻す（日額0・ランキングを無料基準へ）
        if ($request->status === 'paused') {
            $campaign->activeJobs()->update(['daily_budget' => 0, 'ranking_score' => Campaign::FREE_BASE]);
        }

        // 予算変更時は再配分
        if ($request->has('daily_budget') && (float) $request->daily_budget !== $oldBudget) {
            if ($campaign->status === 'active') {
                $campaign->distributeBudget();
            }
        }

        // 配分方法変更時も再配分
        if ($request->has('budget_allocation') && $campaign->status === 'active') {
            $campaign->distributeBudget();
        }

        $campaign->loadCount('jobs');
        $campaign->actual_daily_spend = $campaign->activeJobs()->sum('daily_budget');

        return response()->json($campaign);

        }); // end DB::transaction
    }

    // 予算グループ削除
    public function destroy(Campaign $campaign)
    {
        $company = Auth::user()->company;
        if ($campaign->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // 所属求人を無料ティアに戻す（予算グループ解除・日額0・ランキングを無料基準へ）
        Job::where('campaign_id', $campaign->id)->update([
            'campaign_id' => null, 'daily_budget' => 0, 'ranking_score' => Campaign::FREE_BASE,
        ]);

        $campaign->delete();

        return response()->json(['message' => '予算グループを削除しました。']);
    }

    // 求人を予算グループに追加
    public function addJobs(Request $request, Campaign $campaign)
    {
        $company = Auth::user()->company;
        if ($campaign->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'job_ids' => 'required|array|min:1',
            'job_ids.*' => 'integer|exists:jobs,id',
        ]);

        $updated = Job::where('company_id', $company->id)
            ->whereIn('id', $request->job_ids)
            ->update(['campaign_id' => $campaign->id]);

        // 予算再配分
        $campaign->refresh();
        if ($campaign->status === 'active') {
            $campaign->distributeBudget();
        }

        return response()->json([
            'message' => "{$updated}件の求人を予算グループに追加しました。",
            'updated_count' => $updated,
        ]);
    }

    // 求人を予算グループから除外
    public function removeJobs(Request $request, Campaign $campaign)
    {
        $company = Auth::user()->company;
        if ($campaign->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'job_ids' => 'required|array|min:1',
            'job_ids.*' => 'integer|exists:jobs,id',
        ]);

        $updated = Job::where('company_id', $company->id)
            ->where('campaign_id', $campaign->id)
            ->whereIn('id', $request->job_ids)
            ->update(['campaign_id' => null, 'daily_budget' => 0, 'ranking_score' => Campaign::FREE_BASE]);

        // 残りの求人で予算再配分
        $campaign->refresh();
        if ($campaign->status === 'active') {
            $campaign->distributeBudget();
        }

        return response()->json([
            'message' => "{$updated}件の求人を予算グループから除外しました。",
            'updated_count' => $updated,
        ]);
    }

    // 手動で予算を再配分
    public function redistribute(Campaign $campaign)
    {
        $company = Auth::user()->company;
        if ($campaign->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($campaign->status !== 'active') {
            return response()->json(['message' => 'アクティブな予算グループのみ再配分できます。'], 422);
        }

        $campaign->distributeBudget();
        $campaign->load('jobs');

        return response()->json($campaign);
    }
}
