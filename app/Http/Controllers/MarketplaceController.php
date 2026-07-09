<?php

namespace App\Http\Controllers;

use App\Models\AgencyEngagement;
use App\Models\Company;
use App\Models\PaymentTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class MarketplaceController extends Controller
{
    /** 管理料の上限（法外な金額を防ぐ・月額円） */
    const FEE_CAP = 100000;

    // ========== 企業（求人主）向け ==========

    /** 掲載中のパートナー（代理店）一覧。会社タイプは問わない（営業代行・コンサル等も可）＝運営審査のみで公開 */
    public function agencies(Request $request)
    {
        $agencies = Company::where('marketplace_listed', true)
            ->where('marketplace_status', 'approved')
            ->orderByRaw('COALESCE(service_fee, 999999) asc')
            ->get(['id', 'company_name', 'industry', 'permit_number', 'service_fee',
                   'service_description', 'service_specialties', 'license_verified']);

        return response()->json($agencies);
    }

    /** パートナー用: 自社の紹介コード/URLと状態。コードは初回アクセス時に発行 */
    public function partnerStatus(Request $request)
    {
        $company = Auth::user()->company;
        if (!$company) return response()->json(['message' => '企業アカウントが必要です'], 403);

        if (empty($company->referral_code)) {
            // 一意な短コードを発行（衝突時はリトライ）
            do {
                $code = strtoupper(\Illuminate\Support\Str::random(8));
            } while (Company::where('referral_code', $code)->exists());
            $company->update(['referral_code' => $code]);
        }

        return response()->json([
            'referral_code' => $company->referral_code,
            'referral_url'  => config('app.url') . '/register?role=company&ref=' . $company->referral_code,
            'marketplace_listed' => (bool) $company->marketplace_listed,
            'marketplace_status' => $company->marketplace_status,
        ]);
    }

    /** 自社（求人主）の現在の運用エンゲージメント（依頼中/稼働中） */
    public function myEngagement(Request $request)
    {
        $company = Auth::user()->company;
        if (!$company) return response()->json(['engagement' => null]);

        $engagement = AgencyEngagement::with('agency:id,company_name,service_fee,permit_number')
            ->where('client_company_id', $company->id)
            ->whereIn('status', ['requested', 'active'])
            ->latest()
            ->first();

        return response()->json(['engagement' => $engagement]);
    }

    /** 代理店に運用を依頼する */
    public function requestEngagement(Request $request)
    {
        $data = $request->validate([
            'agency_id' => 'required|integer|exists:companies,id',
            'note'      => 'nullable|string|max:1000',
        ]);

        $company = Auth::user()->company;
        if (!$company) return response()->json(['message' => '企業アカウントが必要です'], 403);
        if ((int) $data['agency_id'] === (int) $company->id) {
            return response()->json(['message' => '自社を担当代理店にはできません'], 422);
        }

        $agency = Company::where('id', $data['agency_id'])
            ->where('marketplace_listed', true)
            ->first();
        if (!$agency) return response()->json(['message' => '対象のパートナーが見つかりません'], 404);

        // 既に依頼中/稼働中があれば重複させない
        $existing = AgencyEngagement::where('client_company_id', $company->id)
            ->whereIn('status', ['requested', 'active'])->first();
        if ($existing) {
            return response()->json(['message' => '既に依頼中または稼働中の代理店があります。先に解除してください。'], 422);
        }

        $engagement = AgencyEngagement::create([
            'agency_id'          => $agency->id,
            'client_company_id'  => $company->id,
            'status'             => 'requested',
            'revenue_share_rate' => 0.25,
            'note'               => $data['note'] ?? null,
            'requested_at'       => now(),
        ]);

        return response()->json(['engagement' => $engagement->load('agency:id,company_name')], 201);
    }

    /** 求人主が運用契約を解除する */
    public function endEngagement(Request $request, AgencyEngagement $engagement)
    {
        $company = Auth::user()->company;
        if (!$company || $engagement->client_company_id !== $company->id) {
            return response()->json(['message' => '権限がありません'], 403);
        }
        $engagement->update(['status' => 'ended', 'ended_at' => now()]);
        return response()->json(['engagement' => $engagement]);
    }

    // ========== 代理店向け ==========

    /** 自社（パートナー）の掲載プロフィールを更新。会社タイプは問わない（審査で判断） */
    public function updateProfile(Request $request)
    {
        $company = Auth::user()->company;
        if (!$company) {
            return response()->json(['message' => '企業アカウントが必要です'], 403);
        }

        $data = $request->validate([
            'marketplace_listed'  => 'required|boolean',
            'service_fee'         => 'nullable|integer|min:0|max:' . self::FEE_CAP,
            'service_description' => 'nullable|string|max:2000',
            'service_specialties' => 'nullable|string|max:255',
        ]);

        // 許可番号は必須にしない（営業代行等も想定）。掲載可否は運営の非公開基準による審査で判断する。
        $update = [
            'marketplace_listed'  => $data['marketplace_listed'],
            'service_fee'         => $data['service_fee'] ?? null,
            'service_description' => $data['service_description'] ?? null,
            'service_specialties' => $data['service_specialties'] ?? null,
        ];

        // 掲載を希望し、まだ承認されていなければ審査待ちにする（却下後の再申請も審査待ちへ戻す）
        if ($data['marketplace_listed'] && $company->marketplace_status !== 'approved') {
            $update['marketplace_status'] = 'pending';
            $update['marketplace_reviewed_at'] = null;
        }

        $company->update($update);

        return response()->json([
            'company' => $company->only(['id', 'marketplace_listed', 'marketplace_status', 'service_fee', 'service_description', 'service_specialties']),
            'fee_cap' => self::FEE_CAP,
        ]);
    }

    /** パートナーの担当企業（エンゲージメント）一覧。各企業の掲載数・今月の還元額つき */
    public function engagements(Request $request)
    {
        $company = Auth::user()->company;
        if (!$company) {
            return response()->json(['message' => '企業アカウントが必要です'], 403);
        }

        $engagements = AgencyEngagement::with('clientCompany:id,company_name,industry,office_address')
            ->where('agency_id', $company->id)
            ->orderByRaw("CASE status WHEN 'requested' THEN 0 WHEN 'active' THEN 1 ELSE 2 END")
            ->latest()
            ->get();

        // 担当企業ごとの実績（掲載中求人数・今月の課金・今月のあなたの還元額）
        $clientIds = $engagements->pluck('client_company_id')->unique()->values();
        $jobCounts = $clientIds->isEmpty() ? collect() : DB::table('jobs')
            ->whereIn('company_id', $clientIds)->where('status', 'active')
            ->selectRaw('company_id, COUNT(*) AS c')->groupBy('company_id')->get()->keyBy('company_id');
        $shareThisMonth = $clientIds->isEmpty() ? collect() : DB::table('payment_transactions')
            ->where('agency_id', $company->id)->where('status', 'succeeded')
            ->whereIn('company_id', $clientIds)
            ->whereRaw("date_trunc('month', charged_at) = date_trunc('month', now())")
            ->selectRaw('company_id, SUM(agency_share_amount) AS share, SUM(amount) AS billed')
            ->groupBy('company_id')->get()->keyBy('company_id');

        $engagements->each(function ($e) use ($jobCounts, $shareThisMonth) {
            $e->setAttribute('client_active_jobs', (int) ($jobCounts[$e->client_company_id]->c ?? 0));
            $e->setAttribute('client_billed_this_month', (int) ($shareThisMonth[$e->client_company_id]->billed ?? 0));
            $e->setAttribute('share_this_month', (int) ($shareThisMonth[$e->client_company_id]->share ?? 0));
        });

        return response()->json(['engagements' => $engagements, 'fee_cap' => self::FEE_CAP]);
    }

    /** 依頼への応答（承認して稼働＝管理料確定 / 辞退） */
    public function respondEngagement(Request $request, AgencyEngagement $engagement)
    {
        $company = Auth::user()->company;
        if (!$company || $engagement->agency_id !== $company->id) {
            return response()->json(['message' => '権限がありません'], 403);
        }

        $data = $request->validate([
            'action'      => 'required|in:accept,decline',
            'monthly_fee' => 'nullable|integer|min:0|max:' . self::FEE_CAP,
        ]);

        if ($data['action'] === 'decline') {
            $engagement->update(['status' => 'declined', 'ended_at' => now()]);
        } else {
            $engagement->update([
                'status'       => 'active',
                'monthly_fee'  => $data['monthly_fee'] ?? $company->service_fee,
                'activated_at' => now(),
            ]);
        }

        return response()->json(['engagement' => $engagement]);
    }

    /** パートナーの求人課金レベニューシェア（25%）実績 */
    public function payouts(Request $request)
    {
        $company = Auth::user()->company;
        if (!$company) {
            return response()->json(['message' => '企業アカウントが必要です'], 403);
        }

        $base = PaymentTransaction::where('agency_id', $company->id)
            ->where('status', 'succeeded')
            ->where('agency_share_amount', '>', 0);

        $total = (clone $base)->sum('agency_share_amount');
        $thisMonth = (clone $base)
            ->whereRaw("date_trunc('month', charged_at) = date_trunc('month', now())")
            ->sum('agency_share_amount');

        $byMonth = (clone $base)
            ->selectRaw("to_char(date_trunc('month', charged_at), 'YYYY-MM') as month, sum(agency_share_amount) as amount, count(*) as cnt")
            ->groupByRaw("date_trunc('month', charged_at)")
            ->orderByRaw("date_trunc('month', charged_at) desc")
            ->limit(12)
            ->get();

        return response()->json([
            'total'      => (int) $total,
            'this_month' => (int) $thisMonth,
            'by_month'   => $byMonth,
            'share_rate' => 0.25,
        ]);
    }
}
