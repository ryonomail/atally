<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\DailyUsage;
use App\Enums\CompanyType;
use App\Enums\VerificationStatus;
use App\Services\BillingProtectionService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class CompanyController extends Controller
{
    /**
     * 企業登録
     */
    public function store(Request $request)
    {
        if ($request->user()->company) {
            return response()->json(['message' => '企業情報は既に登録されています。'], 422);
        }

        $validated = $request->validate([
            'company_name' => ['required', 'string', 'max:255'],
            'company_type' => ['required', 'in:direct_employer,recruitment_agency'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'website' => ['sometimes', 'nullable', 'url', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'address' => ['sometimes', 'nullable', 'string', 'max:500'],
            'permit_number' => ['required_if:company_type,recruitment_agency', 'nullable', 'string', 'max:50', 'regex:/^[\d]+-[ユ]-[\d]+$/u'],
        ]);

        $company = Company::create(array_merge($validated, [
            'user_id' => $request->user()->id,
            'verification_status' => 'pending',
            'quality_score' => 1.0,
        ]));

        $request->user()->update([
            'company_id' => $company->id,
            'company_role' => 'owner',
        ]);

        return response()->json(['company' => $company], 201);
    }

    /**
     * 企業情報取得
     */
    public function show(Request $request)
    {
        $company = $request->user()->company;

        if (!$company) {
            return response()->json(['message' => '企業情報が見つかりません。'], 404);
        }

        return response()->json([
            'company' => $company->load('agencyClients'),
            'ranking_score' => $company->rankingScore(),
            'effective_daily_budget' => $company->effectiveDailyBudget(),
            'average_boost_factor' => $company->averageBoostFactor(),
            'boost_breakdown' => $company->boostBreakdown(),
        ]);
    }

    /**
     * 企業情報更新
     */
    public function update(Request $request)
    {
        $company = $request->user()->company;

        if (!$company) {
            return response()->json(['message' => '企業情報が見つかりません。'], 404);
        }

        $validated = $request->validate([
            'company_name' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'website' => ['sometimes', 'nullable', 'url', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'address' => ['sometimes', 'nullable', 'string', 'max:500'],
            'permit_number' => ['sometimes', 'nullable', 'string', 'max:50', 'regex:/^[\d]+-[ユ]-[\d]+$/u'],
            'industry' => ['sometimes', 'nullable', 'string', 'max:100'],
            'number_of_employees' => ['sometimes', 'nullable', 'string', 'max:50'],
            'founded_year' => ['sometimes', 'nullable', 'string', 'max:20'],
            'office_address' => ['sometimes', 'nullable', 'string', 'max:500'],
            'nearest_station' => ['sometimes', 'nullable', 'string', 'max:200'],
            'company_culture' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'work_environment' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'benefits_default' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'revenue' => ['sometimes', 'nullable', 'string', 'max:100'],
            'capital' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        $company->update($validated);

        return response()->json(['company' => $company->fresh()]);
    }

    /**
     * 書類アップロード（登記簿謄本/許可証）
     */
    public function uploadDocument(Request $request)
    {
        $company = $request->user()->company;

        $request->validate([
            'document' => ['required', 'file', 'max:10240', 'mimes:pdf,jpg,jpeg,png'], // 10MB, PDF/画像のみ
            'document_type' => ['required', 'in:registration_certificate,permit_license'],
        ]);

        $path = $request->file('document')->store('company-documents', 'private');

        $documents = $company->documents ?? [];
        $documents[] = [
            'type' => $request->document_type,
            'path' => $path,
            'uploaded_at' => now()->toIso8601String(),
        ];

        $company->update(['documents' => $documents]);

        return response()->json([
            'message' => '書類をアップロードしました。審査をお待ちください。',
            'documents' => $documents,
        ]);
    }

    /**
     * 利用履歴（過去30日 + 月別サマリー）
     */
    public function billingHistory(Request $request)
    {
        $company = $request->user()->company;

        if (!$company) {
            return response()->json(['message' => '企業情報が見つかりません。'], 404);
        }

        // 過去30日の利用履歴
        $since = Carbon::today()->subDays(30);
        $dailyUsages = $company->dailyUsages()
            ->where('date', '>=', $since)
            ->orderByDesc('date')
            ->get();

        // 今月・先月のサマリー
        $thisMonthStart = Carbon::today()->startOfMonth();
        $lastMonthStart = Carbon::today()->subMonth()->startOfMonth();
        $lastMonthEnd = Carbon::today()->subMonth()->endOfMonth();

        // 請求額はmax_budget_amount（その日の最高額）を使用
        $thisMonthTotal = $company->dailyUsages()
            ->where('date', '>=', $thisMonthStart)
            ->sum('max_budget_amount');

        $lastMonthTotal = $company->dailyUsages()
            ->whereBetween('date', [$lastMonthStart, $lastMonthEnd])
            ->sum('max_budget_amount');

        // アクティブ求人数（現在）
        $activeJobCount = $company->jobs()->where('status', 'active')->count();

        return response()->json([
            'daily_usages' => $dailyUsages->map(fn ($u) => [
                'date' => $u->date->format('Y-m-d'),
                'budget_amount' => $u->budget_amount,
                'max_budget_amount' => $u->max_budget_amount,
                'billed' => $u->billed,
                'boost_factor' => $u->boost_factor,
                'base_budget' => $u->base_budget,
            ]),
            'summary' => [
                'this_month_total' => round((float) $thisMonthTotal, 2),
                'last_month_total' => round((float) $lastMonthTotal, 2),
                'active_job_count' => $activeJobCount,
            ],
        ]);
    }

    /**
     * 企業プロフィール（パブリック）
     */
    public function publicProfile(Company $company)
    {
        if ($company->verification_status !== 'verified') {
            return response()->json(['message' => '企業が見つかりません。'], 404);
        }

        $jobs = $company->jobs()
            ->where('status', 'active')
            ->select(['id', 'title', 'location', 'employment_type', 'salary_min', 'salary_max', 'remote_policy'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'company' => [
                'id' => $company->id,
                'company_name' => $company->company_name,
                'description' => $company->description,
                'website' => $company->website,
                'address' => $company->address,
                'industry' => $company->industry,
                'number_of_employees' => $company->number_of_employees,
                'founded_year' => $company->founded_year,
                'office_address' => $company->office_address,
                'nearest_station' => $company->nearest_station,
                'company_culture' => $company->company_culture,
                'work_environment' => $company->work_environment,
                'benefits_default' => $company->benefits_default,
                'revenue' => $company->revenue,
                'capital' => $company->capital,
            ],
            'jobs' => $jobs,
        ]);
    }

    /**
     * 日額予算変更
     */
    public function updateBudget(Request $request)
    {
        $company = $request->user()->company;

        if ($company->needsAttention() || $company->isSuspended()) {
            return response()->json([
                'message' => '未払いのため予算変更はロックされています。',
            ], 403);
        }

        $validated = $request->validate([
            'daily_budget' => ['required', 'numeric', 'min:0', 'max:999999'],
        ]);

        $oldBudget = (float) $company->daily_budget;
        $company->update(['daily_budget' => $validated['daily_budget']]);

        // 課金保護: 会社全体予算の変更ログ
        if ($oldBudget !== (float) $validated['daily_budget']) {
            BillingProtectionService::logBudgetChange(
                $company->id, null, 'company_budget_change', $oldBudget, (float) $validated['daily_budget']
            );
        }

        $company = $company->fresh();

        return response()->json([
            'company' => $company,
            'ranking_score' => $company->rankingScore(),
            'effective_daily_budget' => $company->effectiveDailyBudget(),
            'average_boost_factor' => $company->averageBoostFactor(),
        ]);
    }
}
