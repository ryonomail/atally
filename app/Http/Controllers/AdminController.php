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
use App\Services\GoogleIndexingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    private function paramHash(Request $request): string
    {
        $params = $request->all();
        ksort($params);
        return md5(json_encode($params));
    }

    /**
     * 概要タブ用: stats + 売上サマリーを1リクエストで返す
     */
    public function overview()
    {
        $data = Cache::remember('admin_overview', 300, function () {
            $today = now();

            $userCounts = DB::table('users')
                ->selectRaw("COUNT(*) FILTER (WHERE role = 'jobseeker') AS total_jobseekers")
                ->first();

            $companyCounts = DB::table('companies')
                ->selectRaw("
                    COUNT(*) AS total_companies,
                    COUNT(*) FILTER (WHERE verification_status = 'pending') AS pending_verifications,
                    COUNT(*) FILTER (WHERE company_type = 'recruitment_agency' AND license_verified = false AND license_document_path IS NOT NULL) AS pending_licenses
                ")
                ->first();

            $jobCounts = DB::table('jobs')
                ->whereNull('deleted_at')
                ->selectRaw("
                    COUNT(*) FILTER (WHERE status = 'pending_review') AS pending_job_reviews,
                    COUNT(*) FILTER (WHERE status = 'active') AS active_jobs
                ")
                ->first();

            $openReports = DB::table('reports')->where('status', 'open')->count();

            // 今月・先月の売上を1クエリで取得（実際のStripe課金＝決済台帳から集計）
            $revenueSums = DB::table('payment_transactions')
                ->where('status', 'succeeded')
                ->selectRaw("
                    SUM(amount) FILTER (WHERE EXTRACT(YEAR FROM charged_at) = ? AND EXTRACT(MONTH FROM charged_at) = ?) AS this_month,
                    SUM(amount) FILTER (WHERE EXTRACT(YEAR FROM charged_at) = ? AND EXTRACT(MONTH FROM charged_at) = ?) AS last_month
                ", [
                    $today->year, $today->month,
                    $today->copy()->subMonth()->year, $today->copy()->subMonth()->month,
                ])
                ->first();

            return [
                'stats' => [
                    'total_jobseekers'      => (int) $userCounts->total_jobseekers,
                    'total_companies'       => (int) $companyCounts->total_companies,
                    'pending_verifications' => (int) $companyCounts->pending_verifications,
                    'pending_job_reviews'   => (int) $jobCounts->pending_job_reviews,
                    'active_jobs'           => (int) $jobCounts->active_jobs,
                    'open_reports'          => (int) $openReports,
                    'pending_licenses'      => (int) $companyCounts->pending_licenses,
                ],
                'revenue_summary' => [
                    'this_month' => (int) round($revenueSums->this_month ?? 0),
                    'last_month' => (int) round($revenueSums->last_month ?? 0),
                ],
            ];
        });

        return response()->json($data);
    }

    /**
     * ダッシュボード統計
     */
    public function dashboard()
    {
        $stats = Cache::remember('admin_dashboard_stats', 60, function () {
            $userCounts = DB::table('users')
                ->selectRaw("
                    COUNT(*) FILTER (WHERE role = 'jobseeker') AS total_jobseekers
                ")
                ->first();

            $companyCounts = DB::table('companies')
                ->selectRaw("
                    COUNT(*) AS total_companies,
                    COUNT(*) FILTER (WHERE verification_status = 'pending') AS pending_verifications,
                    COUNT(*) FILTER (WHERE company_type = 'recruitment_agency' AND license_verified = false AND license_document_path IS NOT NULL) AS pending_licenses
                ")
                ->first();

            $jobCounts = DB::table('jobs')
                ->whereNull('deleted_at')
                ->selectRaw("
                    COUNT(*) FILTER (WHERE status = 'pending_review') AS pending_job_reviews,
                    COUNT(*) FILTER (WHERE status = 'active') AS active_jobs
                ")
                ->first();

            $openReports = DB::table('reports')
                ->where('status', 'open')
                ->count();

            return [
                'total_jobseekers'      => (int) $userCounts->total_jobseekers,
                'total_companies'       => (int) $companyCounts->total_companies,
                'pending_verifications' => (int) $companyCounts->pending_verifications,
                'pending_job_reviews'   => (int) $jobCounts->pending_job_reviews,
                'active_jobs'           => (int) $jobCounts->active_jobs,
                'open_reports'          => (int) $openReports,
                'pending_licenses'      => (int) $companyCounts->pending_licenses,
            ];
        });

        return response()->json(['stats' => $stats]);
    }

    /**
     * 企業審査一覧
     */
    public function pendingCompanies()
    {
        $data = Cache::remember('admin_pending_companies', 120, function () {
            return Company::where('verification_status', 'pending')
                ->with('user:id,name,email')
                ->orderBy('created_at', 'asc')
                ->paginate(20)
                ->toArray();
        });
        return response()->json($data);
    }

    /**
     * 企業審査: 承認/却下
     */
    public function reviewCompany(Request $request, Company $company)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:verified,rejected'],
            'note' => ['sometimes', 'nullable', 'string', 'max:1000'],
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

        Cache::forget('admin_pending_companies');
        Cache::forget('admin_overview');

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
        $data = Cache::remember('admin_pending_jobs', 120, function () {
            return Job::where('status', 'pending_review')
                ->with(['company:id,company_name', 'agencyClient:id,client_name'])
                ->orderBy('created_at', 'asc')
                ->paginate(20)
                ->toArray();
        });
        return response()->json($data);
    }

    /**
     * ハローワーク同期の状況を返す（最後の同期結果＋現在の有効件数）
     */
    public function helloworkStatus()
    {
        $last = Cache::get('hellowork_last_sync');
        // カードを頻繁にポーリングするため、件数集計は15秒キャッシュして負荷を抑える
        $activeCount = Cache::remember('hellowork_active_count', 15, fn () => Job::where('source', 'hellowork')->where('status', 'active')->count());

        return response()->json([
            'last_sync'    => $last,          // at / inserted / updated / deleted / errors / active_count / note
            'active_count' => $activeCount,   // 現時点の有効なハローワーク求人数
        ]);
    }

    /**
     * ハローワーク同期を今すぐ実行（キューへ投入）。
     * 全国フル同期は時間がかかるため Web リクエストはブロックせずキューに流す。
     */
    public function triggerHelloworkSync(Request $request)
    {
        // キューワーカー（supervisord常駐）が拾って実行する
        Artisan::queue('app:sync-hellowork-jobs');

        AdminAuditLog::log(auth()->id(), 'hellowork.sync_trigger', null, null, '管理画面からハローワーク同期を手動実行');

        return response()->json([
            'message' => '同期をキューに投入しました。完了まで数分かかります。状況は本カードで確認できます。',
        ]);
    }

    /**
     * 求人審査: 一括承認/却下
     */
    public function bulkReviewJobs(Request $request)
    {
        $validated = $request->validate([
            'job_ids'    => ['required', 'array', 'min:1', 'max:200'],
            'job_ids.*'  => ['required', 'integer', 'exists:jobs,id'],
            'status'     => ['required', 'in:active,suspended'],
        ]);

        $jobs = Job::whereIn('id', $validated['job_ids'])
            ->where('status', 'pending_review')
            ->with('company.user')
            ->get();

        DB::transaction(function () use ($jobs, $validated) {
            foreach ($jobs as $job) {
                $job->update([
                    'status'       => $validated['status'],
                    'published_at' => $validated['status'] === 'active' ? now() : null,
                ]);

                if ($validated['status'] === 'active') {
                    GoogleIndexingService::notifyJobPublished($job->id);
                }

                AdminAuditLog::log(auth()->id(), 'job.' . $validated['status'], 'job', $job->id);

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
            }
        });

        Cache::forget('admin_pending_jobs');
        Cache::forget('admin_overview');

        $count = $jobs->count();
        return response()->json([
            'count'   => $count,
            'message' => $validated['status'] === 'active'
                ? "{$count}件の求人を公開しました。"
                : "{$count}件の求人を停止しました。",
        ]);
    }

    /**
     * 求人審査: 承認/却下
     */
    public function reviewJob(Request $request, Job $job)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:active,suspended'],
        ]);

        $wasActive = $job->status->value === 'active';
        $job->update([
            'status' => $validated['status'],
            'published_at' => $validated['status'] === 'active' ? now() : null,
        ]);

        if ($validated['status'] === 'active' && !$wasActive) {
            GoogleIndexingService::notifyJobPublished($job->id);
        }

        Cache::forget('admin_pending_jobs');
        Cache::forget('admin_overview');
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
        $cacheKey = 'admin_reports_' . $this->paramHash($request);
        $data = Cache::remember($cacheKey, 60, function () use ($request) {
            $query = Report::with(['reporter:id,name', 'reportedUser:id,name', 'reportedJob:id,title'])
                ->orderBy('created_at', 'desc');
            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }
            return $query->paginate(20)->toArray();
        });
        return response()->json($data);
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

        // 全ステータスのキャッシュを破棄
        foreach (['open', 'reviewing', 'resolved', ''] as $s) {
            Cache::forget('admin_reports_' . md5(json_encode($s ? ['status' => $s] : [])));
        }

        return response()->json(['report' => $report->fresh()]);
    }

    /**
     * ライセンス審査待ちエージェント一覧
     */
    public function pendingLicenses()
    {
        $data = Cache::remember('admin_pending_licenses', 120, function () {
            return Company::where('company_type', 'recruitment_agency')
                ->where('license_verified', false)
                ->whereNotNull('license_document_path')
                ->with('user:id,name,email')
                ->orderBy('created_at', 'asc')
                ->get()
                ->each->makeVisible('license_document_path')
                ->toArray();
        });
        return response()->json($data);
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

        Cache::forget('admin_pending_licenses');
        Cache::forget('admin_overview');

        return response()->json([
            'company' => $company->fresh(),
            'message' => $validated['approved']
                ? 'ライセンスを承認しました。'
                : 'ライセンスを却下しました。',
        ]);
    }

    /**
     * マーケットプレイス掲載審査待ちの代理店一覧
     */
    public function pendingMarketplace()
    {
        $data = Company::where('company_type', 'recruitment_agency')
            ->where('marketplace_listed', true)
            ->where('marketplace_status', 'pending')
            ->with('user:id,name,email')
            ->orderBy('updated_at', 'asc')
            ->get(['id', 'user_id', 'company_name', 'permit_number', 'service_fee',
                   'service_description', 'service_specialties', 'license_verified', 'updated_at'])
            ->toArray();
        return response()->json($data);
    }

    /**
     * マーケットプレイス掲載の承認/却下（基準は非公開）
     */
    public function reviewMarketplace(Request $request, Company $company)
    {
        $validated = $request->validate([
            'approved' => ['required', 'boolean'],
        ]);

        $company->update([
            'marketplace_status'      => $validated['approved'] ? 'approved' : 'rejected',
            'marketplace_reviewed_at' => now(),
        ]);

        AdminAuditLog::log(auth()->id(), $validated['approved'] ? 'marketplace.approved' : 'marketplace.rejected', 'company', $company->id);

        if ($company->user) {
            $approved = $validated['approved'];
            InAppNotification::notify(
                $company->user->id,
                'system',
                $approved ? 'マーケットプレイス掲載が承認されました' : 'マーケットプレイス掲載が見送りになりました',
                $approved ? '運用代行マーケットプレイスに掲載されました。' : '掲載基準を満たさなかったため、今回は見送りとなりました。',
                '/company/marketplace'
            );
        }

        return response()->json([
            'company' => $company->fresh(),
            'message' => $validated['approved'] ? '掲載を承認しました。' : '掲載を却下しました。',
        ]);
    }

    /**
     * 求職者一覧
     */
    public function jobseekers(Request $request)
    {
        $cacheKey = 'admin_jobseekers_' . $this->paramHash($request);
        $result = Cache::remember($cacheKey, 120, function () use ($request) {
            $query = User::where('role', 'jobseeker')->withCount('applications');
            if ($request->filled('q')) {
                $q = $request->q;
                $query->where(fn($w) => $w->where('name', 'ilike', "%{$q}%")->orWhere('email', 'ilike', "%{$q}%"));
            }
            return $query->orderBy('created_at', 'desc')->paginate(30)->toArray();
        });
        return response()->json($result);
    }

    /**
     * 求職者の履歴書一覧（管理者用）
     */
    public function jobseekerResumes(User $user)
    {
        if ($user->role !== 'jobseeker') {
            return response()->json(['message' => '求職者のみ参照可能です。'], 403);
        }

        $resumes = \App\Models\Resume::where('user_id', $user->id)
            ->with('profile')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn($r) => array_merge($r->toSnapshotData(), [
                'id'         => $r->id,
                'title'      => $r->title,
                'type'       => $r->type,
                'is_default' => $r->is_default,
                'updated_at' => $r->updated_at?->format('Y-m-d H:i'),
            ]));

        return response()->json([
            'user'    => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email],
            'resumes' => $resumes,
        ]);
    }

    /**
     * 全企業一覧
     */
    public function allCompanies(Request $request)
    {
        $cacheKey = 'admin_companies_all_' . $this->paramHash($request);
        $result = Cache::remember($cacheKey, 300, function () use ($request) {
            $query = Company::with('user:id,name,email,suspended_at')
                ->withCount(['jobs' => fn($q) => $q->where('status', 'active')]);
            if ($request->filled('q')) {
                $query->where('company_name', 'ilike', "%{$request->q}%");
            }
            if ($request->filled('status')) {
                $query->where('verification_status', $request->status);
            }
            return $query->orderBy('created_at', 'desc')->paginate(30)->toArray();
        });
        return response()->json($result);
    }

    /**
     * 全求人一覧
     */
    public function allJobs(Request $request)
    {
        $cacheKey = 'admin_jobs_all_' . $this->paramHash($request);
        $result = Cache::remember($cacheKey, 300, function () use ($request) {
            $query = Job::with(['company:id,company_name']);
            if ($request->filled('q')) {
                $query->where('title', 'ilike', "%{$request->q}%");
            }
            if ($request->filled('status')) {
                $query->where('status', $request->status);
            } else {
                $query->where('status', 'active');
            }
            return $query->orderBy('created_at', 'desc')->paginate(30)->toArray();
        });
        return response()->json($result);
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
        $data = Cache::remember('admin_revenue', 300, function () {
            $today = now();

            // 実際のStripe課金（決済台帳）から集計
            $base = fn() => \App\Models\PaymentTransaction::where('status', 'succeeded');

            $thisMonth = $base()->whereYear('charged_at', $today->year)
                ->whereMonth('charged_at', $today->month)
                ->sum('amount');

            $lastMonth = $base()->whereYear('charged_at', $today->copy()->subMonth()->year)
                ->whereMonth('charged_at', $today->copy()->subMonth()->month)
                ->sum('amount');

            $daily = $base()->where('charged_at', '>=', $today->copy()->subDays(30)->startOfDay())
                ->selectRaw("TO_CHAR(charged_at, 'YYYY-MM-DD') as date, SUM(amount) as total")
                ->groupByRaw("TO_CHAR(charged_at, 'YYYY-MM-DD')")
                ->orderBy('date')
                ->get()
                ->map(fn($r) => ['date' => $r->date, 'total' => (int) $r->total])
                ->values()
                ->all();

            $topCompanies = $base()->whereYear('charged_at', $today->year)
                ->whereMonth('charged_at', $today->month)
                ->select('company_id', DB::raw("SUM(amount) as total"))
                ->groupBy('company_id')
                ->orderByDesc('total')
                ->limit(10)
                ->with('company:id,company_name')
                ->get()
                ->map(fn($r) => [
                    'company_id'   => $r->company_id,
                    'total'        => (int) $r->total,
                    'company_name' => $r->company?->company_name,
                ])
                ->values()
                ->all();

            $monthly = $base()->where('charged_at', '>=', $today->copy()->subMonths(6)->startOfMonth())
                ->selectRaw("TO_CHAR(charged_at, 'YYYY-MM') as month, SUM(amount) as total")
                ->groupByRaw("TO_CHAR(charged_at, 'YYYY-MM')")
                ->orderBy('month')
                ->get()
                ->map(fn($r) => ['month' => $r->month, 'total' => (int) $r->total])
                ->values()
                ->all();

            return [
                'this_month'    => round($thisMonth),
                'last_month'    => round($lastMonth),
                'daily'         => $daily,
                'top_companies' => $topCompanies,
                'monthly'       => $monthly,
            ];
        });

        return response()->json($data);
    }

    /**
     * 監査ログ一覧
     */
    public function auditLogs(Request $request)
    {
        $cacheKey = 'admin_audit_' . $this->paramHash($request);
        $data = Cache::remember($cacheKey, 30, function () use ($request) {
            $query = AdminAuditLog::with('admin:id,name')
                ->orderByDesc('created_at');

            if ($request->filled('action')) {
                $allowedCategories = ['user', 'company', 'job', 'report', 'license', 'settings'];
                $action = $request->action;
                if (in_array($action, $allowedCategories, true)) {
                    $query->where('action', 'like', $action . '.%');
                }
            }

            $result = $query->paginate(50);
            $logs = $result->getCollection();

            $companyIds = $logs->where('target_type', 'company')->pluck('target_id')->unique();
            $jobIds     = $logs->where('target_type', 'job')->pluck('target_id')->unique();
            $userIds    = $logs->where('target_type', 'user')->pluck('target_id')->unique();

            $companies = $companyIds->isNotEmpty() ? Company::whereIn('id', $companyIds)->pluck('company_name', 'id') : collect();
            $jobs      = $jobIds->isNotEmpty()     ? Job::whereIn('id', $jobIds)->pluck('title', 'id')               : collect();
            $users     = $userIds->isNotEmpty()    ? User::whereIn('id', $userIds)->pluck('name', 'id')              : collect();

            $logs->transform(function ($log) use ($companies, $jobs, $users) {
                $raw = match ($log->target_type) {
                    'company' => $companies[$log->target_id] ?? null,
                    'job'     => $jobs[$log->target_id] ?? null,
                    'user'    => $users[$log->target_id] ?? null,
                    default   => null,
                };
                $log->target_name = $raw !== null
                    ? htmlspecialchars($raw, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
                    : null;
                return $log;
            });

            return $result->toArray();
        });

        return response()->json($data);
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
        $settings = Cache::remember('admin_settings', 300, function () {
            return DB::table('settings')->pluck('value', 'key');
        });
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
        Cache::forget('admin_settings');

        return response()->json(['message' => '設定を保存しました。']);
    }
}
