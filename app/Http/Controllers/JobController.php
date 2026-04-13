<?php

namespace App\Http\Controllers;

use App\Models\Job;
use App\Models\JobPersona;
use App\Models\JobPhoto;
use App\Models\JobView;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\Company;
use App\Services\NgWordService;
use App\Services\BillingProtectionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Carbon;
use Stripe\PaymentMethod;

class JobController extends Controller
{
    // パブリック: 求人検索
    public function index(Request $request)
    {
        // 求職者向け公開検索: 直接採用企業の求人のみ表示
        // 人材紹介会社の求人は /api/agency-jobs (AgencyJobDBPage) で管理
        $query = Job::with(['company', 'persona'])
            ->whereIn('jobs.status', ['active', 'suspended'])
            ->whereHas('company', fn($q) => $q->where('company_type', 'direct_employer'));

        if ($request->filled('keyword')) {
            $terms = preg_split('/[・\/\s　]+/u', $request->keyword);
            $terms = array_filter($terms, fn($t) => mb_strlen($t) > 0);

            if (count($terms) > 0) {
                $query->where(function ($q) use ($terms) {
                    foreach ($terms as $term) {
                        $q->orWhere(function ($sub) use ($term) {
                            $sub->where('jobs.title', 'like', "%{$term}%")
                                ->orWhere('jobs.description', 'like', "%{$term}%")
                                ->orWhere('jobs.requirements', 'like', "%{$term}%");
                        });
                    }
                });
            }
        }

        if ($request->filled('location')) {
            $query->where('jobs.location', 'like', "%{$request->location}%");
        }

        if ($request->filled('employment_type')) {
            $query->where('jobs.employment_type', $request->employment_type);
        }

        if ($request->filled('salary_min')) {
            $query->where('jobs.salary_max', '>=', (int) $request->salary_min);
        }

        if ($request->filled('job_category_major')) {
            $query->where('jobs.job_category_major', $request->job_category_major);
        }

        if ($request->filled('application_type')) {
            $query->where('jobs.application_type', $request->application_type);
        }

        if ($request->filled('feature_tags')) {
            $tags = is_array($request->feature_tags) ? $request->feature_tags : explode(',', $request->feature_tags);
            foreach ($tags as $tag) {
                $query->whereJsonContains('jobs.feature_tags', trim($tag));
            }
        }

        if ($request->filled('remote_policy')) {
            $query->where('jobs.remote_policy', $request->remote_policy);
        }

        $query->join('companies', 'jobs.company_id', '=', 'companies.id')
            ->leftJoin('job_personas', 'jobs.id', '=', 'job_personas.job_id')
            ->select('jobs.*');

        $sort = $request->input('sort', 'ranking');

        // ペルソナマッチ用プロフィール取得（ログインユーザー or ゲスト属性パラメータ）
        $profile = $this->resolveProfileForMatching($request);

        match ($sort) {
            'newest'      => $query->orderBy('jobs.published_at', 'desc'),
            'salary_high' => $query->orderBy('jobs.salary_max', 'desc'),
            default       => $query->orderByRaw(
                // メインスコア: 予算 × 品質スコア × ブースト係数 × 採用実績係数
                '(jobs.daily_budget * companies.quality_score * COALESCE(job_personas.boost_factor, 1.0) * companies.hiring_reputation) DESC'
            )
            // タイブレーク1: 品質スコア単体
            ->orderBy('companies.quality_score', 'desc'),
        };

        $perPage = min((int) $request->input('per_page', 20), 50);
        $result = $query->paginate($perPage);

        // タイブレーク2: ペルソナマッチ度（ログインユーザー/ゲスト共通）
        // DB側でのソート後、同スコア帯内でペルソナマッチ度を加味して再ソート
        if ($sort === 'ranking') {
            $items = collect($result->items())->map(function ($job) use ($profile) {
                $matchScore = 0;
                if ($job->persona && $profile) {
                    $matchScore = $job->persona->calculateMatchScore($profile);
                }
                $job->setAttribute('persona_match', round($matchScore * 100));
                return $job;
            });

            $sorted = $items->sortByDesc(function ($job) {
                // メインスコアでグループ化し、同スコア内でペルソナマッチ度でソート
                $mainScore = ($job->daily_budget ?? 0)
                    * ($job->company->quality_score ?? 1)
                    * ($job->persona?->boost_factor ?? 1.0)
                    * ($job->company->hiring_reputation ?? 1.0);
                // メインスコアを大きな桁に、ペルソナマッチを小さな桁に配置
                // → メインスコアが同じ場合のみペルソナマッチが順位に影響
                return $mainScore * 10000 + ($job->persona_match ?? 0);
            })->values();

            $result->setCollection($sorted);
        }

        // 人材紹介会社フラグを付与 & エージェント限定フィールドを除外 & 放置ラベル
        $result->getCollection()->transform(function ($job) {
            $job->setAttribute('is_agency_job', $job->company && $job->company->company_type === 'recruitment_agency');

            // 放置ラベル: 60日以上アクションなしの求人に警告表示
            $lastAction = $job->last_company_action_at;
            $job->setAttribute('slow_response_warning',
                $lastAction && Carbon::parse($lastAction)->lt(Carbon::now()->subDays(60))
            );

            // パブリックAPIではエージェント限定フィールドを非公開
            foreach (Job::AGENT_ONLY_FIELDS as $field) {
                unset($job[$field]);
            }
            return $job;
        });

        return response()->json($result);
    }

    /**
     * ペルソナマッチ用のプロフィールを解決する
     * ログイン求職者 → UserProfile、ゲスト → リクエストパラメータから仮プロフィール生成
     */
    private function resolveProfileForMatching(Request $request): ?UserProfile
    {
        // ログイン済み求職者はDBのプロフィールを使用
        $user = Auth::guard('sanctum')->user();
        if ($user && $user->role === 'jobseeker') {
            $profile = UserProfile::where('user_id', $user->id)->first();
            if ($profile) {
                return $profile;
            }
        }

        // ゲスト属性パラメータから仮プロフィールを生成
        if ($request->filled('guest_age') || $request->filled('guest_experience_years') || $request->filled('guest_skills')) {
            $profile = new UserProfile();

            if ($request->filled('guest_age')) {
                $age = (int) $request->guest_age;
                $profile->birth_date = Carbon::today()->subYears($age);
            }

            if ($request->filled('guest_experience_years')) {
                $years = (int) $request->guest_experience_years;
                $profile->work_history = [[
                    'start' => Carbon::today()->subYears($years)->format('Y-m'),
                    'end' => Carbon::today()->format('Y-m'),
                ]];
            }

            if ($request->filled('guest_skills')) {
                $skills = is_array($request->guest_skills)
                    ? $request->guest_skills
                    : explode(',', $request->guest_skills);
                $profile->skills = array_map('trim', $skills);
            }

            if ($request->filled('location')) {
                $profile->address = $request->location;
            }

            return $profile;
        }

        return null;
    }

    // パブリック: 求人詳細
    public function show(Request $request, Job $job)
    {
        if (!in_array($job->status->value, ['active', 'suspended'])) {
            return response()->json(['message' => 'Job not found'], 404);
        }

        // 閲覧記録（同一ユーザー/IPから1時間以内の重複を除外）
        $user = Auth::guard('sanctum')->user();
        $ip = $request->ip();
        $oneHourAgo = Carbon::now()->subHour();

        $duplicate = JobView::where('job_id', $job->id)
            ->where('viewed_at', '>=', $oneHourAgo)
            ->where(function ($q) use ($user, $ip) {
                if ($user) {
                    $q->where('user_id', $user->id);
                } else {
                    $q->where('ip_address', $ip);
                }
            })
            ->exists();

        if (!$duplicate) {
            JobView::create([
                'job_id' => $job->id,
                'user_id' => $user?->id,
                'ip_address' => $ip,
                'viewed_at' => Carbon::now(),
            ]);
        }

        $job->load(['company', 'agencyClient', 'photos']);

        $data = $job->toArray();

        // エージェント限定フィールドを非公開（企業オーナー・管理者のみ閲覧可）
        $isOwner = $user && $user->company && $user->company->id === $job->company_id;
        $isAdmin = $user && $user->role === 'admin';
        if (!$isOwner && !$isAdmin) {
            foreach (Job::AGENT_ONLY_FIELDS as $field) {
                unset($data[$field]);
            }
        }

        // 人材紹介会社の表示義務（職業安定法）
        $data['is_agency_job'] = $job->agency_client_id !== null;
        $data['agency_display'] = $job->agencyDisplayText();
        if ($data['is_agency_job']) {
            $permitNumber = $job->company->permit_number ?? '未登録';
            $data['agency_display'] = "この求人は {$job->company->company_name}（有料職業紹介事業許可番号: {$permitNumber}）を通じて掲載されています。";
            // 紹介先クライアント企業情報
            $client = $job->agencyClient;
            $data['client_company'] = $client ? [
                'name' => $client->company_name,
                'address' => $client->address,
                'industry' => $job->client_company_industry ?: ($client->industry ?? null),
                'employees' => $job->client_company_employees ?: ($client->number_of_employees ?? null),
                'description' => $client->description ?? null,
            ] : null;
            // 紹介元会社情報
            $data['agency_company'] = [
                'name' => $job->company->company_name,
                'permit_number' => $permitNumber,
                'website' => $job->company->website,
                'phone' => $job->company->phone,
                'address' => $job->company->address,
            ];
        }

        // 似ている求人を取得
        $similarQuery = Job::with(['company'])
            ->join('companies', 'jobs.company_id', '=', 'companies.id')
            ->leftJoin('job_personas', 'jobs.id', '=', 'job_personas.job_id')
            ->select('jobs.*')
            ->where('jobs.id', '!=', $job->id)
            ->where('jobs.status', 'active');

        $hasCondition = false;

        if ($job->prefecture) {
            $similarQuery->where('jobs.prefecture', $job->prefecture);
            $hasCondition = true;
        }

        if ($job->employment_type) {
            $similarQuery->where('jobs.employment_type', $job->employment_type);
            $hasCondition = true;
        }

        if ($job->salary_min && $job->salary_max) {
            $range = ($job->salary_max - $job->salary_min) * 0.3;
            $similarQuery->where('jobs.salary_min', '>=', $job->salary_min - $range)
                         ->where('jobs.salary_max', '<=', $job->salary_max + $range);
            $hasCondition = true;
        }

        if ($hasCondition) {
            $data['similar_jobs'] = $similarQuery
                ->orderByRaw('(jobs.daily_budget * companies.quality_score * COALESCE(job_personas.boost_factor, 1.0)) DESC')
                ->orderBy('companies.quality_score', 'desc')
                ->limit(5)
                ->get();
        } else {
            $data['similar_jobs'] = [];
        }

        return response()->json($data);
    }

    // 企業: 自社求人一覧
    public function myJobs(Request $request)
    {
        $company = Auth::user()->company;
        $jobs = Job::with(['photos', 'persona', 'agencyClient:id,client_name'])
            ->withCount('applications')
            ->withCount('views')
            ->withCount(['applications as pending_count' => fn ($q) => $q->where('status', 'pending')])
            ->withCount(['applications as reviewing_count' => fn ($q) => $q->where('status', 'under_review')])
            ->withCount(['applications as interviewing_count' => fn ($q) => $q->where('status', 'interviewing')])
            ->withCount(['applications as offered_count' => fn ($q) => $q->where('status', 'offered')])
            ->withCount(['applications as hired_count' => fn ($q) => $q->where('status', 'hired')])
            ->where('company_id', $company->id)
            ->latest()
            ->get();
        return response()->json($jobs);
    }

    // 企業: 求人作成（職業安定法2022年改正 必須項目を義務化）
    public function store(Request $request, NgWordService $ngWordService)
    {
        $request->validate([
            // 職業安定法 必須項目
            'title' => 'required|string|max:255',
            'description' => 'required|string',                          // 業務内容
            'prefecture' => 'required|string|max:10',                     // 都道府県
            'city' => 'required|string|max:100',                         // 市区町村
            'office_address' => 'required|string|max:255',               // 詳細住所
            'location' => 'nullable|string|max:255',                     // 就業場所（自動生成も可）
            'employment_type' => 'required|string|in:正社員,契約社員,パート,派遣,業務委託,インターン', // 雇用形態
            'salary_type' => 'required|string|in:年収,月給,日給,時給',     // 賃金形態
            'salary_min' => 'required|integer|min:0',                    // 賃金下限
            'salary_max' => 'nullable|integer|min:0|gte:salary_min',
            'work_hours' => 'required|string|max:500',                   // 勤務時間
            'holidays' => 'required|string|max:255',                     // 休日
            'insurance' => 'required|array|min:1',                       // 社会保険
            'contract_period' => 'required|string|max:255',              // 契約期間（期間の定めなし含む）
            // 任意項目
            'requirements' => 'nullable|string',
            'salary_range' => 'nullable|string',
            'benefits' => 'nullable|array',
            'agency_client_id' => 'nullable|exists:agency_clients,id',
            'holiday_details' => 'nullable|string',
            'allowances' => 'nullable|string',
            'probation_period' => 'nullable|string|max:255',
            'probation_conditions' => 'nullable|string',
            'salary_details' => 'nullable|string',
            'raise_frequency' => 'nullable|string|max:255',
            'bonus' => 'nullable|string|max:255',
            'remote_policy' => 'nullable|string|in:フルリモート,ハイブリッド,出社',
            'nearest_station' => 'nullable|string|max:255',
            'access_info' => 'nullable|string|max:500',
            'transfer_policy' => 'nullable|string|max:255',
            'overtime_average' => 'nullable|string|max:255',
            'work_environment' => 'nullable|string',
            'selection_process' => 'nullable|string',
            'required_documents' => 'nullable|string|max:255',
            'estimated_timeline' => 'nullable|string|max:255',
            'company_culture' => 'nullable|string',
            'number_of_employees' => 'nullable|string|max:255',
            'founded_year' => 'nullable|string|max:255',
            'industry' => 'nullable|string|max:255',
            'appeal_points' => 'nullable|string',
            'notes' => 'nullable|string',
            // 人材紹介
            'allow_referral' => 'nullable|boolean',
            'referral_fee_type' => 'nullable|string|in:percentage,fixed',
            'referral_fee' => 'nullable|numeric|min:0',
            'referral_conditions' => 'nullable|string',
            'client_company_industry' => 'nullable|string|max:100',
            'client_company_employees' => 'nullable|string|max:50',
            // 職種カテゴリ
            'job_category_major' => 'nullable|string|max:100',
            'job_category_minor' => 'nullable|string|max:100',
            // 採用情報
            'application_type' => 'nullable|string|in:中途,新卒,中途・新卒',
            'positions_available' => 'nullable|integer|min:1|max:999',
            'feature_tags' => 'nullable|array',
            'feature_tags.*' => 'string|max:50',
            // 仕事内容補足
            'preferred_qualifications' => 'nullable|string',
            'recruitment_background' => 'nullable|string',
            'scope_of_change' => 'nullable|string',
            'location_scope_of_change' => 'nullable|string',
            // 勤務条件補足
            'dormitory' => 'nullable|string|max:100',
            'smoking_policy' => 'nullable|string|max:200',
            // エージェント限定情報
            'age_min' => 'nullable|integer|min:15|max:70',
            'age_max' => 'nullable|integer|min:15|max:70|gte:age_min',
            'gender_requirement' => 'nullable|string|in:不問,男性,女性',
            'nationality_requirement' => 'nullable|string|max:100',
            'education_requirement' => 'nullable|string|max:50',
            'referral_fee_distribution' => 'nullable|string|max:200',
            'refund_policy' => 'nullable|string',
            'payment_terms' => 'nullable|string|max:200',
            'disclosure_scope' => 'nullable|string|max:200',
            'likely_candidates' => 'nullable|string',
            'ng_targets' => 'nullable|string',
            'selection_details_agent' => 'nullable|string',
            // 課金設定
            'daily_budget' => 'nullable|numeric|min:0|max:999999',
            // スケジュール
            'scheduled_publish_at' => 'nullable|date|after:now',
            'expires_at' => 'nullable|date|after:now',
        ], [
            'description.required' => '業務内容は職業安定法により必須です。',
            'prefecture.required' => '都道府県は職業安定法により必須です。',
            'employment_type.required' => '雇用形態は職業安定法により必須です。',
            'salary_type.required' => '賃金形態は職業安定法により必須です。',
            'salary_min.required' => '賃金（下限）は職業安定法により必須です。',
            'work_hours.required' => '勤務時間は職業安定法により必須です。',
            'holidays.required' => '休日は職業安定法により必須です。',
            'insurance.required' => '社会保険は職業安定法により必須です。',
            'insurance.min' => '社会保険を1つ以上選択してください。',
            'contract_period.required' => '契約期間は職業安定法により必須です。（期間の定めがない場合は「期間の定めなし」と記載してください）',
            'scheduled_publish_at.after' => '公開予約日時は現在以降を指定してください。',
            'expires_at.after' => '掲載期限は現在以降を指定してください。',
        ]);

        $company = Auth::user()->company;

        // agency_client_id の所有権チェック
        if ($request->filled('agency_client_id')) {
            $ownsClient = \App\Models\AgencyClient::where('id', $request->agency_client_id)
                ->where('company_id', $company->id)
                ->exists();
            if (!$ownsClient) {
                return response()->json(['message' => '指定されたクライアントは存在しないか、アクセス権がありません。'], 403);
            }
        }

        // location を自動生成（prefecture + city）
        if (!$request->filled('location')) {
            $request->merge([
                'location' => trim($request->prefecture . $request->city),
            ]);
        }

        // 同一求人の重複チェック（タイトル＋勤務地が一致する未終了求人）
        $duplicate = Job::where('company_id', $company->id)
            ->where('title', $request->title)
            ->where('location', $request->location)
            ->whereNotIn('status', ['closed'])
            ->exists();

        if ($duplicate) {
            return response()->json([
                'message' => '同じタイトル・勤務地の求人が既に掲載されています。既存の求人を編集してください。',
                'errors' => ['title' => ['同じタイトル・勤務地の求人が既に存在します。']],
            ], 422);
        }

        // NGワード判定（全テキストフィールドを検査）
        $textFields = ['title', 'description', 'requirements', 'appeal_points', 'notes'];
        $hasNgWord = false;
        foreach ($textFields as $field) {
            if ($ngWordService->containsNgWord($request->input($field))) {
                $hasNgWord = true;
                break;
            }
        }

        $data = $request->only([
            'agency_client_id', 'title', 'description', 'requirements',
            'salary_min', 'salary_max', 'salary_type', 'salary_range',
            'location', 'prefecture', 'city', 'employment_type', 'work_hours', 'benefits',
            'holidays', 'holiday_details', 'insurance', 'allowances',
            'probation_period', 'probation_conditions',
            'salary_details', 'raise_frequency', 'bonus',
            'remote_policy', 'office_address', 'nearest_station', 'access_info', 'transfer_policy',
            'overtime_average', 'work_environment',
            'selection_process', 'required_documents', 'estimated_timeline',
            'company_culture', 'number_of_employees', 'founded_year', 'industry',
            'appeal_points', 'contract_period', 'notes',
            'allow_referral', 'referral_fee_type', 'referral_fee', 'referral_conditions',
            'client_company_industry', 'client_company_employees',
            'job_category_major', 'job_category_minor',
            'application_type', 'positions_available', 'feature_tags',
            'preferred_qualifications', 'recruitment_background',
            'scope_of_change', 'location_scope_of_change',
            'dormitory', 'smoking_policy',
            'age_min', 'age_max', 'gender_requirement', 'nationality_requirement',
            'education_requirement', 'referral_fee_distribution', 'refund_policy',
            'payment_terms', 'disclosure_scope', 'likely_candidates',
            'ng_targets', 'selection_details_agent',
            'daily_budget',
        ]);
        $data['company_id'] = $company->id;
        $data['ng_word_flagged'] = $hasNgWord;
        $data['daily_budget'] = $data['daily_budget'] ?? 0;
        $data['expires_at'] = $request->input('expires_at');

        // 公開予約の処理
        if ($request->filled('scheduled_publish_at')) {
            $data['scheduled_publish_at'] = $request->input('scheduled_publish_at');
            $data['status'] = 'scheduled';
        } else {
            $data['status'] = 'pending_review';
        }

        $job = Job::create($data);

        // 課金保護: 求人作成ログ
        BillingProtectionService::logBudgetChange(
            $company->id, $job->id, 'job_create', null, (float) ($data['daily_budget'] ?? 0)
        );

        return response()->json($job, 201);
    }

    // 企業: 求人複製
    public function duplicate(Job $job)
    {
        $company = Auth::user()->company;
        if ($job->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $exclude = ['id', 'created_at', 'updated_at', 'status', 'ng_word_flagged',
                     'scheduled_publish_at', 'expires_at', 'views_count', 'applications_count'];
        $data = collect($job->toArray())->except($exclude)->toArray();
        $data['title'] = $data['title'] . '（コピー）';
        $data['status'] = 'draft';
        $data['daily_budget'] = 0;

        $newJob = Job::create($data);

        return response()->json($newJob, 201);
    }

    // 企業: 求人CSVエクスポート
    public function exportCsv()
    {
        $company = Auth::user()->company;
        $jobs = Job::where('company_id', $company->id)->orderByDesc('created_at')->get();

        $headers = ['ID', 'タイトル', 'ステータス', '雇用形態', '勤務地', '給与下限', '給与上限',
                     '応募数', '掲載日', '更新日'];
        $rows = $jobs->map(fn($j) => [
            $j->id, $j->title, $j->status, $j->employment_type, $j->location,
            $j->salary_min, $j->salary_max, $j->applications_count ?? 0,
            $j->created_at?->format('Y-m-d'), $j->updated_at?->format('Y-m-d'),
        ]);

        $csv = implode(',', $headers) . "\n";
        foreach ($rows as $row) {
            $csv .= implode(',', array_map(fn($v) => '"' . str_replace('"', '""', (string) $v) . '"', $row)) . "\n";
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="jobs_export.csv"',
        ]);
    }

    // 企業: 求人更新
    public function update(Request $request, Job $job, NgWordService $ngWordService)
    {
        $company = Auth::user()->company;
        if ($job->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            // 職業安定法 必須項目
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'prefecture' => 'required|string|max:10',
            'city' => 'required|string|max:100',
            'office_address' => 'required|string|max:255',
            'location' => 'nullable|string|max:255',
            'employment_type' => 'required|string|in:正社員,契約社員,パート,派遣,業務委託,インターン',
            'salary_type' => 'required|string|in:年収,月給,日給,時給',
            'salary_min' => 'required|integer|min:0',
            'salary_max' => 'nullable|integer|min:0|gte:salary_min',
            'work_hours' => 'required|string|max:500',
            'holidays' => 'required|string|max:255',
            'insurance' => 'required|array|min:1',
            'contract_period' => 'required|string|max:255',
            'status' => 'required|in:draft,pending_review,active,suspended,closed',
            // 任意項目
            'requirements' => 'nullable|string',
            'salary_range' => 'nullable|string',
            'benefits' => 'nullable|array',
            'holiday_details' => 'nullable|string',
            'allowances' => 'nullable|string',
            'probation_period' => 'nullable|string|max:255',
            'probation_conditions' => 'nullable|string',
            'salary_details' => 'nullable|string',
            'raise_frequency' => 'nullable|string|max:255',
            'bonus' => 'nullable|string|max:255',
            'remote_policy' => 'nullable|string|in:フルリモート,ハイブリッド,出社',
            'nearest_station' => 'nullable|string|max:255',
            'access_info' => 'nullable|string|max:500',
            'transfer_policy' => 'nullable|string|max:255',
            'overtime_average' => 'nullable|string|max:255',
            'work_environment' => 'nullable|string',
            'selection_process' => 'nullable|string',
            'required_documents' => 'nullable|string|max:255',
            'estimated_timeline' => 'nullable|string|max:255',
            'company_culture' => 'nullable|string',
            'number_of_employees' => 'nullable|string|max:255',
            'founded_year' => 'nullable|string|max:255',
            'industry' => 'nullable|string|max:255',
            'appeal_points' => 'nullable|string',
            'notes' => 'nullable|string',
            // 人材紹介
            'allow_referral' => 'nullable|boolean',
            'referral_fee_type' => 'nullable|string|in:percentage,fixed',
            'referral_fee' => 'nullable|numeric|min:0',
            'referral_conditions' => 'nullable|string',
            'client_company_industry' => 'nullable|string|max:100',
            'client_company_employees' => 'nullable|string|max:50',
            // 職種カテゴリ
            'job_category_major' => 'nullable|string|max:100',
            'job_category_minor' => 'nullable|string|max:100',
            // 採用情報
            'application_type' => 'nullable|string|in:中途,新卒,中途・新卒',
            'positions_available' => 'nullable|integer|min:1|max:999',
            'feature_tags' => 'nullable|array',
            'feature_tags.*' => 'string|max:50',
            // 仕事内容補足
            'preferred_qualifications' => 'nullable|string',
            'recruitment_background' => 'nullable|string',
            'scope_of_change' => 'nullable|string',
            'location_scope_of_change' => 'nullable|string',
            // 勤務条件補足
            'dormitory' => 'nullable|string|max:100',
            'smoking_policy' => 'nullable|string|max:200',
            // エージェント限定情報
            'age_min' => 'nullable|integer|min:15|max:70',
            'age_max' => 'nullable|integer|min:15|max:70|gte:age_min',
            'gender_requirement' => 'nullable|string|in:不問,男性,女性',
            'nationality_requirement' => 'nullable|string|max:100',
            'education_requirement' => 'nullable|string|max:50',
            'referral_fee_distribution' => 'nullable|string|max:200',
            'refund_policy' => 'nullable|string',
            'payment_terms' => 'nullable|string|max:200',
            'disclosure_scope' => 'nullable|string|max:200',
            'likely_candidates' => 'nullable|string',
            'ng_targets' => 'nullable|string',
            'selection_details_agent' => 'nullable|string',
            // 課金設定
            'daily_budget' => 'nullable|numeric|min:0|max:999999',
        ], [
            'description.required' => '業務内容は職業安定法により必須です。',
            'prefecture.required' => '都道府県は職業安定法により必須です。',
            'employment_type.required' => '雇用形態は職業安定法により必須です。',
            'salary_type.required' => '賃金形態は職業安定法により必須です。',
            'salary_min.required' => '賃金（下限）は職業安定法により必須です。',
            'work_hours.required' => '勤務時間は職業安定法により必須です。',
            'holidays.required' => '休日は職業安定法により必須です。',
            'insurance.required' => '社会保険は職業安定法により必須です。',
            'contract_period.required' => '契約期間は職業安定法により必須です。',
        ]);

        // location を自動生成（prefecture + city）
        if (!$request->filled('location')) {
            $request->merge([
                'location' => trim($request->prefecture . $request->city),
            ]);
        }

        // NGワード判定（全テキストフィールドを検査）
        $textFields = ['title', 'description', 'requirements', 'appeal_points', 'notes'];
        $hasNgWord = false;
        foreach ($textFields as $field) {
            if ($ngWordService->containsNgWord($request->input($field))) {
                $hasNgWord = true;
                break;
            }
        }

        $data = $request->only([
            'title', 'description', 'requirements',
            'salary_min', 'salary_max', 'salary_type', 'salary_range',
            'location', 'prefecture', 'city', 'employment_type', 'work_hours', 'benefits',
            'holidays', 'holiday_details', 'insurance', 'allowances',
            'probation_period', 'probation_conditions',
            'salary_details', 'raise_frequency', 'bonus',
            'remote_policy', 'office_address', 'nearest_station', 'access_info', 'transfer_policy',
            'overtime_average', 'work_environment',
            'selection_process', 'required_documents', 'estimated_timeline',
            'company_culture', 'number_of_employees', 'founded_year', 'industry',
            'appeal_points', 'contract_period', 'notes',
            'allow_referral', 'referral_fee_type', 'referral_fee', 'referral_conditions',
            'client_company_industry', 'client_company_employees',
            'job_category_major', 'job_category_minor',
            'application_type', 'positions_available', 'feature_tags',
            'preferred_qualifications', 'recruitment_background',
            'scope_of_change', 'location_scope_of_change',
            'dormitory', 'smoking_policy',
            'age_min', 'age_max', 'gender_requirement', 'nationality_requirement',
            'education_requirement', 'referral_fee_distribution', 'refund_policy',
            'payment_terms', 'disclosure_scope', 'likely_candidates',
            'ng_targets', 'selection_details_agent',
            'daily_budget',
        ]);
        $data['ng_word_flagged'] = $hasNgWord;

        // ステータス遷移の検証
        $requestedStatus = $hasNgWord ? 'pending_review' : $request->status;
        $currentStatus = $job->status->value;
        $allowedTransitions = [
            'draft' => ['pending_review', 'closed'],
            'pending_review' => ['active', 'draft', 'closed'],
            'active' => ['suspended', 'closed'],
            'suspended' => ['active', 'closed'],
            'closed' => ['draft'],
        ];
        if ($requestedStatus !== $currentStatus) {
            $allowed = $allowedTransitions[$currentStatus] ?? [];
            if (!in_array($requestedStatus, $allowed)) {
                return response()->json([
                    'message' => "ステータスを「{$currentStatus}」から「{$requestedStatus}」に変更できません",
                ], 422);
            }
        }
        $data['status'] = $requestedStatus;

        // 求人をアクティブにする場合、カード登録必須 + 初日分を即時決済
        if ($data['status'] === 'active' && $job->status->value !== 'active') {
            \Stripe\Stripe::setApiKey(config('services.stripe.secret'));

            // カード登録チェック
            $hasCard = false;
            $paymentMethodId = null;
            if ($company->stripe_customer_id) {
                try {
                    $customer = \Stripe\Customer::retrieve($company->stripe_customer_id, [
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
                    if ($pm) {
                        $hasCard = true;
                        $paymentMethodId = $pm->id;
                    }
                } catch (\Exception $e) {
                    // Stripe error
                }
            }
            if (!$hasCard) {
                return response()->json([
                    'message' => '求人を掲載するには、先にクレジットカードを登録してください。',
                    'payment_required' => true,
                ], 402);
            }

            // 日額予算が設定されている場合、初日分を即時決済
            $dailyBudget = (int) ($data['daily_budget'] ?? $job->daily_budget ?? 0);
            if ($dailyBudget >= 500) {
                try {
                    $intent = \Stripe\PaymentIntent::create([
                        'amount' => $dailyBudget,
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
                        return response()->json([
                            'message' => '決済に失敗しました。カード情報をご確認ください。',
                        ], 402);
                    }
                    \App\Models\AdminAuditLog::logSystem(
                        'job_activation_charged',
                        'Job',
                        $job->id,
                        "Charged ¥{$dailyBudget} for activation (pi: {$intent->id})"
                    );
                } catch (\Stripe\Exception\CardException $e) {
                    return response()->json([
                        'message' => 'カードが拒否されました: ' . $e->getMessage(),
                    ], 402);
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::error('Job activation charge failed', [
                        'job_id' => $job->id,
                        'error' => $e->getMessage(),
                    ]);
                    return response()->json(['message' => '決済処理中にエラーが発生しました。'], 500);
                }
            }
        }

        $oldBudget = (float) $job->daily_budget;
        $job->update($data);

        // 課金保護: 予算変更ログ
        $newBudget = (float) ($data['daily_budget'] ?? $oldBudget);
        if ($oldBudget !== $newBudget) {
            BillingProtectionService::logBudgetChange(
                $company->id, $job->id, 'budget_change', $oldBudget, $newBudget
            );
        }

        return response()->json($job);
    }

    // パブリック: サイト統計
    public function stats()
    {
        $stats = Cache::remember('site_stats', 300, function () {
            return [
                'job_count' => Job::whereIn('status', ['active', 'suspended'])->count(),
                'company_count' => Company::where('verification_status', 'approved')->count(),
                'user_count' => User::where('role', 'jobseeker')->count(),
            ];
        });

        return response()->json($stats);
    }

    // 企業: 求人パフォーマンス分析
    public function analytics()
    {
        $company = Auth::user()->company;
        $jobs = Job::where('company_id', $company->id)->get();
        $sevenDaysAgo = Carbon::now()->subDays(7);

        $result = $jobs->map(function ($job) use ($sevenDaysAgo) {
            $viewCount = JobView::where('job_id', $job->id)->count();
            $viewCount7d = JobView::where('job_id', $job->id)
                ->where('viewed_at', '>=', $sevenDaysAgo)
                ->count();
            $applicationCount = $job->applications()->count();
            $applicationRate = $viewCount > 0
                ? round(($applicationCount / $viewCount) * 100, 1)
                : 0;

            return [
                'job_id' => $job->id,
                'title' => $job->title,
                'status' => $job->status,
                'view_count' => $viewCount,
                'view_count_7d' => $viewCount7d,
                'application_count' => $applicationCount,
                'application_rate' => $applicationRate,
            ];
        });

        // 採用ファネルデータ（全求人合計）
        $jobIds = $jobs->pluck('id');
        $totalViews = $result->sum('view_count');
        $statusCounts = \App\Models\Application::whereIn('job_id', $jobIds)
            ->selectRaw('status, count(*) as cnt')
            ->groupBy('status')
            ->pluck('cnt', 'status')
            ->toArray();

        $totalApps = array_sum($statusCounts);
        $screening = ($statusCounts['under_review'] ?? 0) + ($statusCounts['interviewing'] ?? 0)
            + ($statusCounts['offered'] ?? 0) + ($statusCounts['accepted'] ?? 0) + ($statusCounts['hired'] ?? 0);
        $interviewing = ($statusCounts['interviewing'] ?? 0) + ($statusCounts['offered'] ?? 0)
            + ($statusCounts['accepted'] ?? 0) + ($statusCounts['hired'] ?? 0);
        $offered = ($statusCounts['offered'] ?? 0) + ($statusCounts['accepted'] ?? 0) + ($statusCounts['hired'] ?? 0);
        $hired = ($statusCounts['accepted'] ?? 0) + ($statusCounts['hired'] ?? 0);

        return response()->json([
            'jobs' => $result,
            'funnel' => [
                ['stage' => '閲覧', 'count' => $totalViews, 'color' => '#121c34'],
                ['stage' => '応募', 'count' => $totalApps, 'color' => '#c8952e'],
                ['stage' => '書類選考通過', 'count' => $screening, 'color' => '#8b5cf6'],
                ['stage' => '面接', 'count' => $interviewing, 'color' => '#3b82f6'],
                ['stage' => '内定', 'count' => $offered, 'color' => '#f59e0b'],
                ['stage' => '採用', 'count' => $hired, 'color' => '#10b981'],
            ],
        ]);
    }

    // 企業: 順位シミュレーター（求人単位）
    public function simulateRanking(Request $request)
    {
        $request->validate([
            'budget' => 'required|numeric|min:0',
        ]);

        $company = Auth::user()->company;
        $score = $request->budget * $company->quality_score;

        // 他の求人（アクティブ）と比較してランキングを推定
        $higherJobs = Job::join('companies', 'jobs.company_id', '=', 'companies.id')
            ->leftJoin('job_personas', 'jobs.id', '=', 'job_personas.job_id')
            ->where('jobs.status', 'active')
            ->whereRaw('(jobs.daily_budget * companies.quality_score * COALESCE(job_personas.boost_factor, 1.0)) > ?', [$score])
            ->count();
        $totalJobs = Job::where('status', 'active')->count();
        $estimatedRank = $higherJobs + 1;

        return response()->json([
            'simulated_ranking_score' => $score,
            'estimated_rank' => $estimatedRank,
            'total_jobs' => $totalJobs,
            'quality_score' => $company->quality_score,
        ]);
    }

    // 企業: ペルソナ取得
    public function getPersona(Job $job)
    {
        $company = Auth::user()->company;
        if ($job->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // 課金チェック（求人の日額予算 > 0）
        if (($job->daily_budget ?? 0) <= 0) {
            return response()->json(['message' => 'ペルソナ設定は有料プランの機能です。この求人の日額予算を設定してください。'], 403);
        }

        $persona = $job->persona;
        return response()->json($persona);
    }

    // 企業: ペルソナ保存
    public function savePersona(Request $request, Job $job)
    {
        $company = Auth::user()->company;
        if ($job->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (($job->daily_budget ?? 0) <= 0) {
            return response()->json(['message' => 'ペルソナ設定は有料プランの機能です。この求人の日額予算を設定してください。'], 403);
        }

        $request->validate([
            'age_min' => 'nullable|integer|min:18|max:70',
            'age_max' => 'nullable|integer|min:18|max:70',
            'experience_min' => 'nullable|integer|min:0|max:50',
            'experience_max' => 'nullable|integer|min:0|max:50',
            'target_skills' => 'nullable|array|max:30',
            'target_skills.*' => 'string|max:100',
            'target_locations' => 'nullable|array|max:50',
            'target_locations.*' => 'string|max:100',
            'target_job_types' => 'nullable|array|max:20',
            'target_job_types.*' => 'string|max:100',
            'target_employment_status' => 'nullable|string|in:在職中,離職中,どちらでも',
            'target_education' => 'nullable|string|in:大卒以上,高卒以上,専門卒以上,短大卒以上,大学院卒以上,不問',
            'boost_factor' => 'nullable|numeric|min:1.0|max:3.0',
            // 拡張フィールド
            'target_industries' => 'nullable|array|max:20',
            'target_industries.*' => 'string|max:100',
            'target_salary_min' => 'nullable|integer|min:0',
            'target_salary_max' => 'nullable|integer|min:0',
            'target_languages' => 'nullable|array|max:10',
            'target_languages.*.language' => 'required_with:target_languages|string|max:50',
            'target_languages.*.level' => 'nullable|string|max:50',
            'target_certifications' => 'nullable|array|max:20',
            'target_certifications.*' => 'string|max:100',
            'target_management_experience' => 'nullable|string|in:不要,あれば尚可,必須（規模不問）,必須（5人以上）,必須（10人以上）,必須（50人以上）',
            'target_company_sizes' => 'nullable|array|max:10',
            'target_company_sizes.*' => 'string|max:50',
            'max_company_changes' => 'nullable|integer|min:0|max:20',
            'personality_traits' => 'nullable|array|max:15',
            'personality_traits.*' => 'string|max:50',
            'priority_conditions' => 'nullable|array|max:10',
            'priority_conditions.*' => 'string|max:100',
            'ng_conditions' => 'nullable|string|max:2000',
            'ideal_candidate_description' => 'nullable|string|max:3000',
        ]);

        $persona = JobPersona::updateOrCreate(
            ['job_id' => $job->id],
            $request->only([
                'age_min', 'age_max',
                'experience_min', 'experience_max',
                'target_skills', 'target_locations', 'target_job_types',
                'target_employment_status', 'target_education',
                'boost_factor',
                'target_industries', 'target_salary_min', 'target_salary_max',
                'target_languages', 'target_certifications',
                'target_management_experience', 'target_company_sizes',
                'max_company_changes', 'personality_traits', 'priority_conditions',
                'ng_conditions', 'ideal_candidate_description',
            ])
        );

        return response()->json($persona);
    }

    // 企業: ペルソナ削除
    public function deletePersona(Job $job)
    {
        $company = Auth::user()->company;
        if ($job->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        JobPersona::where('job_id', $job->id)->delete();

        return response()->json(['message' => 'ペルソナ設定を削除しました']);
    }

    // 企業: 一括予算設定
    public function bulkBudget(Request $request)
    {
        $request->validate([
            'job_ids' => 'required|array|min:1',
            'job_ids.*' => 'integer|exists:jobs,id',
            'daily_budget' => 'required|numeric|min:0|max:999999',
        ]);

        $company = Auth::user()->company;
        $jobs = Job::where('company_id', $company->id)
            ->whereIn('id', $request->job_ids)
            ->get();

        if ($jobs->isEmpty()) {
            return response()->json(['message' => '対象の求人が見つかりません'], 404);
        }

        $updated = [];
        foreach ($jobs as $job) {
            $oldBudget = (float) $job->daily_budget;
            $newBudget = (float) $request->daily_budget;

            $job->update(['daily_budget' => $newBudget]);

            if ($oldBudget !== $newBudget) {
                BillingProtectionService::logBudgetChange(
                    $company->id, $job->id, 'budget_change', $oldBudget, $newBudget
                );
            }

            $updated[] = $job->fresh();
        }

        return response()->json([
            'message' => count($updated) . '件の求人の予算を更新しました',
            'updated' => $updated,
        ]);
    }

    // 企業: 一括ステータス変更
    public function bulkStatus(Request $request)
    {
        $request->validate([
            'job_ids' => 'required|array|min:1',
            'job_ids.*' => 'integer|exists:jobs,id',
            'status' => 'required|in:draft,pending_review,active,suspended,closed',
        ]);

        $company = Auth::user()->company;
        $jobs = Job::where('company_id', $company->id)
            ->whereIn('id', $request->job_ids)
            ->get();

        if ($jobs->isEmpty()) {
            return response()->json(['message' => '対象の求人が見つかりません'], 404);
        }

        // activeにする場合、クレジットカード登録チェック
        if ($request->status === 'active') {
            \Stripe\Stripe::setApiKey(config('services.stripe.secret'));
            $hasCard = false;
            if ($company->stripe_customer_id) {
                try {
                    $methods = PaymentMethod::all([
                        'customer' => $company->stripe_customer_id,
                        'type' => 'card',
                        'limit' => 1,
                    ]);
                    $hasCard = count($methods->data) > 0;
                } catch (\Exception $e) {
                    // Stripe error
                }
            }
            if (!$hasCard) {
                return response()->json([
                    'message' => '求人を公開するには、先にクレジットカードを登録してください。',
                    'payment_required' => true,
                ], 402);
            }
        }

        $updated = [];
        foreach ($jobs as $job) {
            $job->update(['status' => $request->status]);
            $updated[] = $job->fresh();
        }

        $statusLabels = [
            'draft' => '下書き', 'pending_review' => '審査中',
            'active' => '公開中', 'suspended' => '停止', 'closed' => '終了',
        ];

        return response()->json([
            'message' => count($updated) . '件の求人を「' . ($statusLabels[$request->status] ?? $request->status) . '」に変更しました',
            'updated' => $updated,
        ]);
    }

    // 企業: 一括削除
    public function bulkDestroy(Request $request)
    {
        $request->validate([
            'job_ids' => 'required|array|min:1',
            'job_ids.*' => 'integer|exists:jobs,id',
        ]);

        $company = Auth::user()->company;
        $jobs = Job::where('company_id', $company->id)
            ->whereIn('id', $request->job_ids)
            ->get();

        if ($jobs->isEmpty()) {
            return response()->json(['message' => '対象の求人が見つかりません'], 404);
        }

        $count = 0;
        foreach ($jobs as $job) {
            BillingProtectionService::logBudgetChange(
                $company->id, $job->id, 'job_delete', (float) $job->daily_budget, 0
            );
            $job->delete();
            $count++;
        }

        return response()->json([
            'message' => $count . '件の求人を削除しました',
            'deleted_ids' => $jobs->pluck('id'),
        ]);
    }

    // 企業: 求人削除（ソフトデリート — 課金記録を保持）
    public function destroy(Job $job)
    {
        $company = Auth::user()->company;
        if ($job->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // 課金保護: 削除前の予算を記録
        BillingProtectionService::logBudgetChange(
            $company->id, $job->id, 'job_delete', (float) $job->daily_budget, 0
        );

        // ソフトデリート（レコードは残る、写真ファイルは保持）
        $job->delete();

        return response()->json(['message' => '求人を削除しました']);
    }

    // 企業: 求人写真アップロード（最大5枚）
    public function uploadPhoto(Request $request, Job $job)
    {
        $company = Auth::user()->company;
        if ($job->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // 有料チェック（求人の日額予算 > 0）
        if (($job->daily_budget ?? 0) <= 0) {
            return response()->json(['message' => '写真アップロードは有料プランの機能です。この求人の日額予算を設定してください。'], 403);
        }

        $request->validate([
            'photo' => 'required|image|mimes:jpg,jpeg,png,webp|max:10240', // 10MB
            'caption' => 'nullable|string|max:100',
        ]);

        // 最大5枚制限
        $currentCount = $job->photos()->count();
        if ($currentCount >= 5) {
            return response()->json(['message' => '写真は最大5枚までアップロードできます。'], 422);
        }

        $path = $request->file('photo')->store('job-photos/' . $job->id, 'public');

        $photo = JobPhoto::create([
            'job_id' => $job->id,
            'path' => $path,
            'caption' => $request->caption,
            'sort_order' => $currentCount,
        ]);

        return response()->json($photo, 201);
    }

    // 企業: 求人写真削除
    public function deletePhoto(Job $job, JobPhoto $photo)
    {
        $company = Auth::user()->company;
        if ($job->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($photo->job_id !== $job->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        Storage::disk('public')->delete($photo->path);
        $photo->delete();

        return response()->json(['message' => '写真を削除しました']);
    }

    // 企業: 求人写真一覧
    public function photos(Job $job)
    {
        $company = Auth::user()->company;
        if ($job->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($job->photos);
    }
}
