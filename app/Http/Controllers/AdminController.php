<?php

namespace App\Http\Controllers;

use App\Models\AdminAuditLog;
use App\Models\Company;
use App\Models\DailyUsage;
use App\Models\InAppNotification;
use App\Models\Job;
use App\Models\Report;
use App\Models\User;
use App\Enums\VerificationStatus;
use App\Enums\JobStatus;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    /**
     * ダッシュボード統計
     */
    public function dashboard()
    {
        return response()->json([
            'stats' => [
                'total_jobseekers'      => User::where('role', 'jobseeker')->count(),
                'total_companies'       => Company::count(),
                'pending_verifications' => Company::where('verification_status', 'pending')->count(),
                'pending_job_reviews'   => Job::where('status', 'pending_review')->count(),
                'active_jobs'           => Job::where('status', 'active')->count(),
                'open_reports'          => Report::where('status', 'open')->count(),
                'pending_licenses'      => Company::where('company_type', 'recruitment_agency')
                    ->where('license_verified', false)
                    ->whereNotNull('license_document_path')
                    ->count(),
            ],
        ]);
    }

    /**
     * 企業審査一覧
     */
    public function pendingCompanies()
    {
        $companies = Company::where('verification_status', 'pending')
            ->with('user:id,name,email')
            ->orderBy('created_at', 'asc')
            ->paginate(20);

        return response()->json($companies);
    }

    /**
     * 企業審査: 承認/却下
     */
    public function reviewCompany(Request $request, Company $company)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:verified,rejected'],
            'note' => ['sometimes', 'string', 'max:1000'],
        ]);

        $company->update([
            'verification_status' => $validated['status'],
        ]);

        $isApproved = $validated['status'] === 'verified';
        AdminAuditLog::log(auth()->id(), $isApproved ? 'company.approved' : 'company.rejected', 'company', $company->id, $validated['note'] ?? null);

        // 企業オーナーに審査結果を通知
        if ($company->user) {
            InAppNotification::notify(
                $company->user->id,
                'system',
                $isApproved ? '企業審査が承認されました' : '企業審査が却下されました',
                $isApproved ? '求人の掲載が可能になりました。' : '登録内容をご確認の上、再度お申し込みください。',
                '/company'
            );
        }

        return response()->json([
            'company' => $company->fresh(),
            'message' => $isApproved ? '企業を承認しました。' : '企業を却下しました。',
        ]);
    }

    /**
     * 求人審査一覧
     */
    public function pendingJobs()
    {
        $jobs = Job::where('status', 'pending_review')
            ->with(['company:id,company_name', 'agencyClient:id,client_name'])
            ->orderBy('created_at', 'asc')
            ->paginate(20);

        return response()->json($jobs);
    }

    /**
     * 求人審査: 承認/却下
     */
    public function reviewJob(Request $request, Job $job)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:active,suspended'],
        ]);

        $job->update([
            'status' => $validated['status'],
            'published_at' => $validated['status'] === 'active' ? now() : null,
        ]);

        AdminAuditLog::log(auth()->id(), 'job.' . $validated['status'], 'job', $job->id);

        // 企業オーナーに求人審査結果を通知
        $companyUser = $job->company->user ?? null;
        if ($companyUser) {
            $isActive = $validated['status'] === 'active';
            InAppNotification::notify(
                $companyUser->id,
                'system',
                $isActive ? '求人が公開されました' : '求人が停止されました',
                "「{$job->title}」の審査が完了しました。",
                '/company/jobs'
            );
        }

        return response()->json([
            'job' => $job->fresh(),
            'message' => $validated['status'] === 'active'
            ? '求人を公開しました。'
            : '求人を停止しました。',
        ]);
    }

    /**
     * 通報一覧
     */
    public function reports(Request $request)
    {
        $query = Report::with(['reporter:id,name', 'reportedUser:id,name', 'reportedJob:id,title'])
            ->orderBy('created_at', 'desc');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $reports = $query->paginate(20);

        return response()->json($reports);
    }

    /**
     * 通報対応
     */
    public function resolveReport(Request $request, Report $report)
    {
        $validated = $request->validate([
            'admin_note' => ['required', 'string', 'max:2000'],
            'status' => ['required', 'in:reviewing,resolved'],
        ]);

        $report->update(array_merge($validated, [
            'resolved_at' => $validated['status'] === 'resolved' ? now() : null,
        ]));

        AdminAuditLog::log(auth()->id(), 'report.' . $validated['status'], 'report', $report->id, $validated['admin_note']);

        return response()->json(['report' => $report->fresh()]);
    }

    /**
     * ライセンス審査待ちエージェント一覧
     */
    public function pendingLicenses()
    {
        $agencies = Company::where('company_type', 'recruitment_agency')
            ->where('license_verified', false)
            ->whereNotNull('license_document_path')
            ->with('user:id,name,email')
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json($agencies);
    }

    /**
     * ライセンス承認/却下
     */
    public function reviewLicense(Request $request, Company $company)
    {
        $validated = $request->validate([
            'approved' => ['required', 'boolean'],
        ]);

        $company->update([
            'license_verified' => $validated['approved'],
        ]);

        AdminAuditLog::log(auth()->id(), $validated['approved'] ? 'license.approved' : 'license.rejected', 'company', $company->id);

        // エージェントにライセンス審査結果を通知
        if ($company->user) {
            $approved = $validated['approved'];
            InAppNotification::notify(
                $company->user->id,
                'system',
                $approved ? '人材紹介ライセンスが承認されました' : '人材紹介ライセンスが却下されました',
                $approved ? '人材紹介機能が利用可能になりました。' : 'ライセンス書類をご確認の上、再度アップロードしてください。',
                '/agency'
            );
        }

        return response()->json([
            'company' => $company->fresh(),
            'message' => $validated['approved']
                ? 'ライセンスを承認しました。'
                : 'ライセンスを却下しました。',
        ]);
    }

    /**
     * 求職者一覧
     */
    public function jobseekers(Request $request)
    {
        $query = User::where('role', 'jobseeker')
            ->withCount('applications');

        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($w) use ($q) {
                $w->where('name', 'ilike', "%{$q}%")
                  ->orWhere('email', 'ilike', "%{$q}%");
            });
        }

        return response()->json(
            $query->orderBy('created_at', 'desc')->paginate(30)
        );
    }

    /**
     * 全企業一覧
     */
    public function allCompanies(Request $request)
    {
        $query = Company::with('user:id,name,email,suspended_at')
            ->withCount('jobs');

        if ($request->filled('q')) {
            $q = $request->q;
            $query->where('company_name', 'ilike', "%{$q}%");
        }

        if ($request->filled('status')) {
            $query->where('verification_status', $request->status);
        }

        return response()->json(
            $query->orderBy('created_at', 'desc')->paginate(30)
        );
    }

    /**
     * 全求人一覧
     */
    public function allJobs(Request $request)
    {
        $query = Job::with(['company:id,company_name'])
            ->withCount('applications');

        if ($request->filled('q')) {
            $q = $request->q;
            $query->where('title', 'ilike', "%{$q}%");
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        } else {
            $query->where('status', 'active');
        }

        return response()->json(
            $query->orderBy('created_at', 'desc')->paginate(30)
        );
    }

    /**
     * ユーザー停止
     */
    public function suspendUser(Request $request, User $user)
    {
        if ($user->role === 'admin') {
            return response()->json(['message' => '管理者アカウントは停止できません。'], 422);
        }

        $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        // ログインジェクション対策: 改行文字を除去
        $reason = str_replace(["\r\n", "\r", "\n"], ' ', $request->reason);

        $user->update([
            'suspended_at' => now(),
            'suspension_reason' => $reason,
        ]);

        InAppNotification::notify(
            $user->id,
            'system',
            'アカウントが停止されました',
            $reason,
            null
        );

        AdminAuditLog::log(auth()->id(), 'user.suspend', 'user', $user->id, $reason);

        return response()->json(['message' => 'ユーザーを停止しました。', 'user' => $user->fresh()]);
    }

    /**
     * ユーザー停止解除
     */
    public function unsuspendUser(User $user)
    {
        $user->update([
            'suspended_at' => null,
            'suspension_reason' => null,
        ]);

        AdminAuditLog::log(auth()->id(), 'user.unsuspend', 'user', $user->id);

        InAppNotification::notify(
            $user->id,
            'system',
            'アカウント停止が解除されました',
            'ご利用を再開いただけます。',
            null
        );

        return response()->json(['message' => 'ユーザーの停止を解除しました。', 'user' => $user->fresh()]);
    }

    /**
     * ユーザー物理削除（管理者専用）
     */
    public function deleteUser(User $user)
    {
        if ($user->role === 'admin') {
            return response()->json(['message' => '管理者アカウントは削除できません。'], 422);
        }

        $userId = $user->id;
        $userName = $user->name;

        // 関連トークンを削除してからユーザー削除
        $user->tokens()->delete();
        $user->delete();

        AdminAuditLog::log(auth()->id(), 'user.deleted', 'user', $userId, "ユーザー「{$userName}」を物理削除");

        return response()->json(['message' => 'ユーザーを削除しました。']);
    }

    /**
     * 売上データ
     */
    public function revenue()
    {
        $today = now();

        // 今月の売上（その日の最高額で請求）
        $thisMonth = DailyUsage::whereYear('date', $today->year)
            ->whereMonth('date', $today->month)
            ->sum('max_budget_amount');

        // 先月の売上
        $lastMonth = DailyUsage::whereYear('date', $today->copy()->subMonth()->year)
            ->whereMonth('date', $today->copy()->subMonth()->month)
            ->sum('max_budget_amount');

        // 直近30日の日別売上
        $daily = DailyUsage::where('date', '>=', $today->copy()->subDays(30)->toDateString())
            ->select(DB::raw("date, SUM(max_budget_amount) as total"))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // 企業別売上ランキング（今月）
        $topCompanies = DailyUsage::whereYear('date', $today->year)
            ->whereMonth('date', $today->month)
            ->select('company_id', DB::raw("SUM(max_budget_amount) as total"))
            ->groupBy('company_id')
            ->orderByDesc('total')
            ->limit(10)
            ->with('company:id,company_name')
            ->get();

        // 月別推移（過去6ヶ月）
        $monthly = DailyUsage::where('date', '>=', $today->copy()->subMonths(6)->startOfMonth()->toDateString())
            ->select(DB::raw("TO_CHAR(date, 'YYYY-MM') as month"), DB::raw("SUM(max_budget_amount) as total"))
            ->groupBy(DB::raw("TO_CHAR(date, 'YYYY-MM')"))
            ->orderBy('month')
            ->get();

        return response()->json([
            'this_month' => round($thisMonth),
            'last_month' => round($lastMonth),
            'daily' => $daily,
            'top_companies' => $topCompanies,
            'monthly' => $monthly,
        ]);
    }

    /**
     * 監査ログ一覧
     */
    public function auditLogs(Request $request)
    {
        $query = AdminAuditLog::with('admin:id,name')
            ->orderByDesc('created_at');

        if ($request->filled('action')) {
            // ホワイトリストによるフィルター（SQLインジェクション・情報漏洩対策）
            $allowedPrefixes = ['user.', 'company.', 'job.', 'report.', 'license.', 'settings.', 'stripe_', 'payment_'];
            $action = $request->action;
            $isAllowed = collect($allowedPrefixes)->contains(fn($p) => str_starts_with($action, $p));
            if ($isAllowed) {
                $query->where('action', 'like', $action . '%');
            }
        }

        $result = $query->paginate(50);

        // Resolve target names for display
        $result->getCollection()->transform(function ($log) {
            $raw = match ($log->target_type) {
                'company' => \App\Models\Company::find($log->target_id)?->company_name,
                'job' => \App\Models\Job::find($log->target_id)?->title,
                'user' => User::find($log->target_id)?->name,
                default => null,
            };
            // XSS対策: HTMLエスケープしてからセット
            $log->target_name = $raw !== null
                ? htmlspecialchars($raw, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
                : null;
            return $log;
        });

        return response()->json($result);
    }

    /**
     * ユーザー詳細
     */
    public function userDetail(User $user)
    {
        $data = $user->load(['profile', 'company']);

        $extra = [
            'applications_count' => $user->applications()->count(),
            'recent_applications' => $user->applications()
                ->with('job:id,title')
                ->latest()
                ->limit(5)
                ->get(),
            'audit_logs' => AdminAuditLog::where('target_type', 'user')
                ->where('target_id', $user->id)
                ->with('admin:id,name')
                ->orderByDesc('created_at')
                ->limit(20)
                ->get(),
        ];

        return response()->json(array_merge($data->toArray(), $extra));
    }

    /**
     * システム設定取得
     */
    public function getSettings()
    {
        $settings = DB::table('settings')->pluck('value', 'key');
        return response()->json($settings);
    }

    /**
     * システム設定更新
     */
    public function updateSettings(Request $request)
    {
        // 更新可能なキーのホワイトリスト（任意キーの書き込みを防止）
        $allowedKeys = [
            'site_name',
            'maintenance_mode',
            'max_jobs_per_company',
            'auto_approve_companies',
            'default_job_expiry_days',
            'support_email',
        ];

        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*' => 'string|max:1000',
        ]);

        $updated = [];
        foreach ($validated['settings'] as $key => $value) {
            if (!in_array($key, $allowedKeys, true)) {
                return response()->json(['message' => "設定キー '{$key}' は変更できません。"], 422);
            }
            DB::table('settings')->updateOrInsert(
                ['key' => $key],
                ['value' => $value, 'updated_at' => now()]
            );
            $updated[] = $key;
        }

        AdminAuditLog::log(auth()->id(), 'settings.update', null, null, json_encode($updated));

        return response()->json(['message' => '設定を保存しました。']);
    }
}
