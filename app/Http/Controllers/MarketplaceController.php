<?php

namespace App\Http\Controllers;

use App\Models\AgencyEngagement;
use App\Models\Company;
use App\Models\PaymentTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MarketplaceController extends Controller
{
    /** 管理料の上限（法外な金額を防ぐ・月額円） */
    const FEE_CAP = 100000;

    // ========== 企業（求人主）向け ==========

    /** マーケットプレイス掲載中の代理店一覧 */
    public function agencies(Request $request)
    {
        // 掲載希望(marketplace_listed)かつ運営審査を通過(approved)した代理店のみ公開
        $agencies = Company::where('company_type', 'recruitment_agency')
            ->where('marketplace_listed', true)
            ->where('marketplace_status', 'approved')
            ->orderByRaw('COALESCE(service_fee, 999999) asc')
            ->get(['id', 'company_name', 'industry', 'permit_number', 'service_fee',
                   'service_description', 'service_specialties', 'license_verified']);

        return response()->json($agencies);
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
        if ($company->company_type !== 'direct_employer') {
            return response()->json(['message' => '運用依頼は求人企業アカウントのみ可能です'], 403);
        }

        $agency = Company::where('id', $data['agency_id'])
            ->where('company_type', 'recruitment_agency')
            ->where('marketplace_listed', true)
            ->first();
        if (!$agency) return response()->json(['message' => '対象の代理店が見つかりません'], 404);

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

    /** 自社（代理店）のマーケットプレイス掲載プロフィールを更新 */
    public function updateProfile(Request $request)
    {
        $company = Auth::user()->company;
        if (!$company || $company->company_type !== 'recruitment_agency') {
            return response()->json(['message' => '代理店アカウントが必要です'], 403);
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

    /** 代理店に来ている運用依頼/契約一覧 */
    public function engagements(Request $request)
    {
        $company = Auth::user()->company;
        if (!$company || $company->company_type !== 'recruitment_agency') {
            return response()->json(['message' => '代理店アカウントが必要です'], 403);
        }

        $engagements = AgencyEngagement::with('clientCompany:id,company_name,industry,office_address')
            ->where('agency_id', $company->id)
            ->orderByRaw("CASE status WHEN 'requested' THEN 0 WHEN 'active' THEN 1 ELSE 2 END")
            ->latest()
            ->get();

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

    /** 代理店の求人課金レベニューシェア（25%）実績 */
    public function payouts(Request $request)
    {
        $company = Auth::user()->company;
        if (!$company || $company->company_type !== 'recruitment_agency') {
            return response()->json(['message' => '代理店アカウントが必要です'], 403);
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
