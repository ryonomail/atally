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
use App\Services\GoogleIndexingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Illuminate\Pagination\LengthAwarePaginator;
use Stripe\PaymentMethod;

class JobController extends Controller
{
    // パブリック: 求人検索
    // リスト用に必要な列のみ取得（description等の重いテキスト列は show() で取得）
    private const LIST_COLUMNS = [
        'jobs.id', 'jobs.title', 'jobs.company_id', 'jobs.employment_type',
        'jobs.location', 'jobs.salary_min', 'jobs.salary_max', 'jobs.salary_type',
        'jobs.source', 'jobs.hellowork_id', 'jobs.feature_tags', 'jobs.remote_policy',
        'jobs.published_at', 'jobs.ranking_score', 'jobs.daily_budget',
        'jobs.last_company_action_at', 'jobs.status',
        'jobs.description', 'jobs.requirements', 'jobs.prefecture', 'jobs.city',
        'jobs.work_hours', 'jobs.holidays', 'jobs.benefits', 'jobs.agency_client_id',
        'jobs.scope_of_change', 'jobs.overtime_average',
        'jobs.listing_type', 'jobs.dispatch_client_name', 'jobs.show_dispatch_client',
    ];

    public function index(Request $request)
    {
        // ── キャッシュ最優先チェック ──────────────────────────────────────────────
        // 認証なし・ゲストパラメータなし = 全ユーザー共通レスポンス → 最速で返す
        $hasAuth       = $request->hasHeader('Authorization');
        $hasGuestParam = $request->hasAny(['guest_skills', 'guest_age', 'guest_experience_years']);

        $sortedParams = $request->all();
        ksort($sortedParams);
        $fullCacheKey = 'jobs_list_' . md5(json_encode($sortedParams));

        if (!$hasAuth && !$hasGuestParam) {
            if ($cached = Cache::get($fullCacheKey)) {
                return response()->json($cached)
                    ->header('X-Cache', 'HIT')
                    ->header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
            }
        }

        // ── ペルソナマッチが必要かどうかを判定 ───────────────────────────────────
        $needsPersona = ($hasAuth && Auth::guard('sanctum')->check()) || $hasGuestParam;

        $query = Job::with(array_filter([
                'company:id,company_name,company_type',
                $needsPersona ? 'persona' : null,
            ]))
            // status = 'active' のみ: 部分インデックス(idx_jobs_active_ranking)を確実に利用
            // suspended(支払い停止中)の求人は求職者に表示しない
            ->where('jobs.status', 'active');

        if ($request->filled('keyword')) {
            // ReDoS対策: キーワード長と分割数を制限
            $keyword = mb_substr($request->keyword, 0, 200);
            $terms = preg_split('/[・\/\s　]+/u', $keyword, 51, PREG_SPLIT_NO_EMPTY);
            $terms = array_slice(array_filter($terms, fn($t) => mb_strlen($t) > 0), 0, 50);

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

        // 都道府県フィルタ（SEOの都道府県ランディング /jobs?prefecture=◯◯県 用）
        if ($request->filled('prefecture')) {
            $query->where('jobs.prefecture', $request->prefecture);
        }

        // 市区町村フィルタ（SEOの市区町村ランディング用）
        if ($request->filled('city')) {
            $query->where('jobs.city', $request->city);
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

        // スキルフィルター: バナーで入力したスキルのいずれかにマッチする求人のみ表示
        if ($request->filled('guest_skills')) {
            $skills = is_array($request->guest_skills)
                ? $request->guest_skills
                : explode(',', $request->guest_skills);
            $skills = array_values(array_filter(array_map('trim', $skills), fn($s) => mb_strlen($s) > 0));

            if (count($skills) > 0) {
                $query->where(function ($q) use ($skills) {
                    foreach ($skills as $skill) {
                        $q->orWhere(function ($sub) use ($skill) {
                            $sub->where('jobs.title', 'like', "%{$skill}%")
                                ->orWhere('jobs.description', 'like', "%{$skill}%")
                                ->orWhere('jobs.requirements', 'like', "%{$skill}%");
                        });
                    }
                });
            }
        }

        // リスト用カラムのみ選択
        $query->select(self::LIST_COLUMNS);

        $sort    = $request->input('sort', 'ranking');
        $perPage = min((int) $request->input('per_page', 20), 50);
        $page    = max(1, (int) $request->input('page', 1));

        // 認証ユーザーのキャッシュチェック（上でスキップされていない場合）
        if ($hasAuth || $hasGuestParam) {
            if ($cached = Cache::get($fullCacheKey)) {
                return response()->json($cached);
            }
        }

        // ペルソナマッチ用プロフィール取得（ログインユーザー or ゲスト属性パラメータ）
        $profile = $this->resolveProfileForMatching($request);

        match ($sort) {
            'newest'      => $query->orderBy('jobs.published_at', 'desc'),
            'salary_high' => $query->orderBy('jobs.salary_max', 'desc'),
            // 事前計算済みランキングスコアで高速ソート（Atally: 10000+, HelloWork: ~0.0017）
            default       => $query->orderBy('jobs.ranking_score', 'desc'),
        };

        // COUNT取得: フィルターなし = PostgreSQL統計の近似値（超高速）、フィルターあり = 5分キャッシュ
        $countParams = $request->except(['page', 'per_page', 'sort']);
        ksort($countParams);
        $countCacheKey = 'jobs_count_' . md5(json_encode($countParams));

        $hasFilters = array_filter($countParams, fn($v) => $v !== null && $v !== '');
        if (empty($hasFilters)) {
            // フィルターなし: status='active' の正確な件数（部分インデックス idx_jobs_active_ranking で高速）。
            // 以前は pg_class.reltuples を使っていたが、これはテーブル全行（closed/pending/draft含む）を
            // 数えてしまい、実際に表示される active 件数と大きく食い違っていた（締切求人が行として残るため）。
            $total = Cache::remember('jobs_count_active_exact', 60, fn () => Job::where('status', 'active')->count());
        } else {
            $total = Cache::remember($countCacheKey, 300, fn() => (clone $query)->count());
        }

        $items  = $query->offset(($page - 1) * $perPage)->limit($perPage)->get();
        $result = new LengthAwarePaginator(
            $items, $total, $perPage, $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

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
                return ($job->ranking_score ?? 0) * 10000 + ($job->persona_match ?? 0);
            })->values();

            $result->setCollection($sorted);
        }

        // 人材紹介会社フラグを付与 & エージェント限定フィールドを除外 & 放置ラベル
        $result->getCollection()->transform(function ($job) {
            $job->setAttribute('is_agency_job', $job->company && $job->company->company_type === 'recruitment_agency');

            $lastAction = $job->last_company_action_at;
            $job->setAttribute('slow_response_warning',
                $lastAction && Carbon::parse($lastAction)->lt(Carbon::now()->subDays(60))
            );

            foreach (Job::AGENT_ONLY_FIELDS as $field) {
                unset($job[$field]);
            }
            return $job;
        });

        $responseData = $result->toArray();

        // フルレスポンスを 15分キャッシュ（求人データは頻繁に変わらないため延長）
        Cache::put($fullCacheKey, $responseData, 900);

        $headers = ['X-Cache' => 'MISS'];
        if (!$hasAuth && !$hasGuestParam) {
            $headers['Cache-Control'] = 'public, max-age=60, stale-while-revalidate=300';
        }
        return response()->json($responseData, 200, $headers);
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

    // SEO: 指定都道府県で求人がある市区町村の一覧（内部リンク・ランディング用）
    public function citiesByPrefecture(Request $request)
    {
        $pref = trim((string) $request->query('prefecture', ''));
        if ($pref === '') {
            return response()->json([]);
        }
        $cities = Cache::remember('seo_cities_' . md5($pref), 3600, function () use ($pref) {
            return Job::where('status', 'active')
                ->where('prefecture', $pref)
                ->whereNotNull('city')->where('city', '!=', '')
                ->selectRaw('city, COUNT(*) as total')
                ->groupBy('city')
                ->havingRaw('COUNT(*) >= 3')
                ->orderByDesc('total')
                ->limit(300)
                ->get()
                ->map(fn ($r) => ['city' => $r->city, 'total' => (int) $r->total])
                ->values();
        });
        return response()->json($cities);
    }

    /**
     * 相場診断: 業種×都道府県×賃金形態 の給与相場（分位）と、この求人の位置づけ・改善提案を返す。
     * job_category_major が未整備のため industry を軸に、salary_type を揃えて salary_min を比較する。
     */
    public function marketBenchmark(Request $request)
    {
        $data = $request->validate([
            'industry'    => 'nullable|string|max:100',
            'prefecture'  => 'nullable|string|max:10',
            'salary_type' => 'nullable|string|max:20',
            'salary_min'  => 'nullable|integer|min:0',
        ]);

        return response()->json($this->computeBenchmark(
            trim((string) ($data['industry'] ?? '')),
            trim((string) ($data['prefecture'] ?? '')),
            trim((string) ($data['salary_type'] ?? '')),
            (int) ($data['salary_min'] ?? 0)
        ));
    }

    /**
     * 給与相場の中核計算（会社フォーム／公開ツールで共用）。
     * industry を軸に salary_type を揃えて salary_min の分位を出し、母数が少なければ全国にフォールバック。
     */
    private function computeBenchmark(string $industry, string $prefecture, string $salaryType, int $yourSalary = 0): array
    {
        // 給与種別の表記ゆれを実データ側へ正規化（「年収」→「年俸制」）
        $salaryType = ['年収' => '年俸制'][$salaryType] ?? $salaryType;

        if ($industry === '' || $salaryType === '') {
            return ['available' => false, 'reason' => 'insufficient_input'];
        }

        $build = function ($withPref) use ($industry, $salaryType, $prefecture) {
            $q = Job::where('status', 'active')
                ->where('industry', $industry)
                ->where('salary_type', $salaryType)
                ->where('salary_min', '>', 0);
            if ($withPref && $prefecture !== '') {
                $q->where('prefecture', $prefecture);
            }
            return $q;
        };

        $scope = 'prefecture';
        $count = ($prefecture !== '') ? (clone $build(true))->count() : 0;
        if ($count < 20) { // 母数が少なければ全国にフォールバック
            $scope = 'nationwide';
            $count = (clone $build(false))->count();
        }
        if ($count < 5) {
            return ['available' => false, 'reason' => 'too_few_samples', 'count' => $count];
        }

        $withPref = $scope === 'prefecture';
        $stats = (clone $build($withPref))->selectRaw("
            percentile_cont(0.25) within group (order by salary_min) AS p25,
            percentile_cont(0.50) within group (order by salary_min) AS p50,
            percentile_cont(0.75) within group (order by salary_min) AS p75
        ")->first();

        $p25 = (int) round($stats->p25);
        $p50 = (int) round($stats->p50);
        $p75 = (int) round($stats->p75);

        $percentile = null;
        if ($yourSalary > 0) {
            $below = (clone $build($withPref))->where('salary_min', '<', $yourSalary)->count();
            $percentile = (int) round($below / max($count, 1) * 100);
        }

        return [
            'available'     => true,
            'scope'         => $scope,               // prefecture / nationwide
            'prefecture'    => $prefecture,
            'industry'      => $industry,
            'salary_type'   => $salaryType,
            'count'         => $count,
            'p25'           => $p25,
            'median'        => $p50,
            'p75'           => $p75,
            'your_salary'   => $yourSalary ?: null,
            'percentile'    => $percentile,          // あなたの給与が下位◯%
            'gap_to_median' => ($yourSalary > 0 && $yourSalary < $p50) ? ($p50 - $yourSalary) : 0,
        ];
    }

    /**
     * 公開: 求職者向け給与相場診断（認証不要）。業種×都道府県×給与種別で分位を返す。
     */
    public function publicSalaryBenchmark(Request $request)
    {
        $data = $request->validate([
            'industry'    => 'required|string|max:100',
            'prefecture'  => 'nullable|string|max:10',
            'salary_type' => 'required|string|max:20',
        ]);

        $key = 'pub_benchmark_' . md5(($data['industry']) . '|' . ($data['prefecture'] ?? '') . '|' . $data['salary_type']);
        $result = \Illuminate\Support\Facades\Cache::remember($key, 1800, function () use ($data) {
            return $this->computeBenchmark(
                trim($data['industry']),
                trim((string) ($data['prefecture'] ?? '')),
                trim($data['salary_type'])
            );
        });

        return response()->json($result);
    }

    /**
     * 公開: 相場診断で選べる業種一覧（十分な母数がある業種のみ・多い順）。
     */
    public function salaryIndustries()
    {
        $list = \Illuminate\Support\Facades\Cache::remember('pub_benchmark_industries', 3600, function () {
            return Job::where('status', 'active')
                ->whereNotNull('industry')->where('industry', '!=', '')
                ->where('salary_min', '>', 0)
                ->selectRaw('industry, COUNT(*) as cnt')
                ->groupBy('industry')
                ->havingRaw('COUNT(*) >= 50')
                ->orderByDesc('cnt')
                ->limit(80)
                ->pluck('industry')
                ->values();
        });
        return response()->json($list);
    }

    // パブリック: 求人詳細
    public function show(Request $request, Job $job)
    {
        if (!in_array($job->status->value, ['active', 'suspended'])) {
            return response()->json(['message' => 'Job not found'], 404);
        }

        $user = Auth::guard('sanctum')->user();
        $isOwner = $user && $user->company && $user->company->id === $job->company_id;
        $isAdmin = $user && $user->role === 'admin';

        // オーナー・管理者以外（求職者・非ログイン）は共通キャッシュを使う
        $useCache = !$isOwner && !$isAdmin;
        $detailCacheKey = 'job_detail_' . $job->id;

        if ($useCache && $cached = Cache::get($detailCacheKey)) {
            // 閲覧記録だけ非同期的に記録（レスポンスをブロックしない）
            $this->recordView($job->id, $user?->id, $request->ip());
            return response()->json($cached);
        }

        // 閲覧記録
        $this->recordView($job->id, $user?->id, $request->ip());

        $job->load(['company', 'agencyClient', 'photos']);
        $data = $job->toArray();

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
            $client = $job->agencyClient;
            $data['client_company'] = $client ? [
                'name'        => $client->company_name,
                'address'     => $client->address,
                'industry'    => $job->client_company_industry ?: ($client->industry ?? null),
                'employees'   => $job->client_company_employees ?: ($client->number_of_employees ?? null),
                'description' => $client->description ?? null,
            ] : null;
            $data['agency_company'] = [
                'name'          => $job->company->company_name,
                'permit_number' => $permitNumber,
                'website'       => $job->company->website,
                'phone'         => $job->company->phone,
                'address'       => $job->company->address,
            ];
        }

        // 似ている求人（5分キャッシュ）
        // ハローワーク求人: 地域密着のため都道府県を最優先
        // 一般求人: 職種カテゴリ→タイトル→雇用形態のスコアリング
        $data['similar_jobs'] = Cache::remember('similar_jobs_v5_' . $job->id, 300, function () use ($job) {
            $cleanTitle  = trim(preg_replace('/【[^】]*】/', '', $job->title ?? ''));
            $titleKw     = mb_substr($cleanTitle, 0, 10);
            $prefecture  = $job->prefecture ?? '';
            $isHelloWork = ($job->source === 'hello_work');

            if (!$prefecture && !$titleKw) {
                return [];
            }

            $base = Job::with('company:id,company_name,quality_score')
                ->where('jobs.id', '!=', $job->id)
                ->where('jobs.status', 'active');

            if ($isHelloWork) {
                // ── ハローワーク: 都道府県ファースト ──────────────────────────
                if ($prefecture) {
                    $results = (clone $base)
                        ->where('prefecture', $prefecture)
                        ->selectRaw('jobs.*, (CASE WHEN title ILIKE ? THEN 1 ELSE 0 END) AS title_match',
                            ['%' . $titleKw . '%'])
                        ->orderByRaw('title_match DESC')
                        ->orderByDesc('daily_budget')
                        ->limit(5)
                        ->get();

                    if ($results->count() >= 3) {
                        return $results->toArray();
                    }
                }
                if ($titleKw) {
                    return (clone $base)
                        ->where('title', 'ILIKE', '%' . $titleKw . '%')
                        ->selectRaw('jobs.*, (CASE WHEN prefecture = ? THEN 1 ELSE 0 END) AS pref_match', [$prefecture])
                        ->orderByRaw('pref_match DESC')
                        ->orderByDesc('daily_budget')
                        ->limit(5)
                        ->get()
                        ->toArray();
                }
            } else {
                // ── 一般求人: 職種カテゴリ → タイトル → 雇用形態スコアリング ──
                $catMajor   = $job->job_category_major ?? '';
                $empType    = $job->employment_type ?? '';

                $hasFilter = $catMajor || $titleKw || $empType;
                if (!$hasFilter) return [];

                return (clone $base)
                    ->selectRaw('jobs.*, (
                        CASE WHEN job_category_major = ? AND job_category_major != \'\' THEN 4 ELSE 0 END
                        + CASE WHEN title ILIKE ? THEN 2 ELSE 0 END
                        + CASE WHEN employment_type = ? AND employment_type != \'\' THEN 1 ELSE 0 END
                        + CASE WHEN prefecture = ? AND prefecture != \'\' THEN 1 ELSE 0 END
                    ) AS score', [$catMajor, '%' . $titleKw . '%', $empType, $prefecture])
                    ->where(function ($q) use ($catMajor, $titleKw, $empType) {
                        if ($catMajor) $q->orWhere('job_category_major', $catMajor);
                        if ($titleKw)  $q->orWhere('title', 'ILIKE', '%' . $titleKw . '%');
                        if ($empType)  $q->orWhere('employment_type', $empType);
                    })
                    ->orderByDesc('score')
                    ->orderByDesc('daily_budget')
                    ->limit(5)
                    ->get()
                    ->toArray();
            }

            return [];
        });

        if ($useCache) {
            Cache::put($detailCacheKey, $data, 180);
        }

        return response()->json($data);
    }

    private function recordView(int $jobId, ?int $userId, string $ip): void
    {
        $oneHourAgo = Carbon::now()->subHour();
        $exists = JobView::where('job_id', $jobId)
            ->where('viewed_at', '>=', $oneHourAgo)
            ->where(function ($q) use ($userId, $ip) {
                $userId ? $q->where('user_id', $userId) : $q->where('ip_address', $ip);
            })
            ->exists();

        if (!$exists) {
            JobView::create([
                'job_id'     => $jobId,
                'user_id'    => $userId,
                'ip_address' => $ip,
                'viewed_at'  => Carbon::now(),
            ]);
        }
    }

    // 企業: 自社求人一覧
    public function myJobs(Request $request)
    {
        $company = Auth::user()->company;
        // 会社未紐付けユーザー（company_role未設定など）は空ページを返す（500を防ぐ）
        if (!$company) {
            return response()->json(['data' => [], 'current_page' => 1, 'last_page' => 1, 'total' => 0]);
        }

        // 一覧では重い関連（photos/persona）を読み込まない。サーバー側で絞り込み＋ページングし、
        // 数千件規模でもペイロードが肥大化しないようにする（旧: 全件get で30MB級だった）。
        $query = Job::with('agencyClient:id,client_name')
            ->withCount('applications')
            ->withCount('views')
            ->withCount(['applications as pending_count' => fn ($q) => $q->where('status', 'pending')])
            ->withCount(['applications as reviewing_count' => fn ($q) => $q->where('status', 'under_review')])
            ->withCount(['applications as interviewing_count' => fn ($q) => $q->where('status', 'interviewing')])
            ->withCount(['applications as offered_count' => fn ($q) => $q->where('status', 'offered')])
            ->withCount(['applications as hired_count' => fn ($q) => $q->where('status', 'hired')])
            ->where('company_id', $company->id);

        // ステータス絞り込み（all=全件）
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }
        // 予算（無料=予算なし / paid=ブースト中）
        if ($request->input('budget') === 'free') {
            $query->where(fn ($q) => $q->whereNull('daily_budget')->orWhere('daily_budget', '<=', 0));
        } elseif ($request->input('budget') === 'paid') {
            $query->where('daily_budget', '>', 0);
        }
        // キーワード（タイトル・勤務地・雇用形態）
        if ($request->filled('q')) {
            $kw = mb_substr(trim($request->q), 0, 100);
            $query->where(function ($q) use ($kw) {
                $q->where('title', 'ilike', "%{$kw}%")
                  ->orWhere('location', 'ilike', "%{$kw}%")
                  ->orWhere('employment_type', 'ilike', "%{$kw}%");
            });
        }

        $perPage = min(max((int) $request->input('per_page', 50), 1), 100);
        return response()->json($query->latest()->paginate($perPage));
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
            'employment_type' => 'required|string|in:正社員,契約社員,パート,派遣,紹介予定派遣,業務委託,インターン', // 雇用形態
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
            'listing_type' => 'nullable|string|in:direct,dispatch,referral',
            'dispatch_client_name' => 'nullable|string|max:255',
            'show_dispatch_client' => 'nullable|boolean',
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

        // 法令明示の必須条件チェック（誤解を与えない表記の徹底）
        $listingType = $request->input('listing_type', 'direct');
        if ($listingType === 'dispatch' && empty($company->dispatch_license_number)) {
            return response()->json([
                'message' => '派遣案件を掲載するには、会社設定で「労働者派遣事業 許可番号」の登録が必要です。',
                'compliance_required' => true,
            ], 422);
        }
        if ($listingType === 'referral' && empty($company->permit_number)) {
            return response()->json([
                'message' => '紹介案件を掲載するには、会社設定で「職業紹介事業 許可番号」の登録が必要です。',
                'compliance_required' => true,
            ], 422);
        }

        $data = $request->only([
            'agency_client_id', 'title', 'description', 'requirements',
            'listing_type', 'dispatch_client_name', 'show_dispatch_client',
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
        // ランキングスコアを事前計算（Atally求人: 10000 + 予算 × 品質スコア × 採用実績係数）
        $data['ranking_score'] = $this->computeRankingScore((float) $data['daily_budget'], $company);

        // ステータス決定（無料掲載モデル）:
        //  - 公開予約あり → scheduled
        //  - NGワード検出 → pending_review（手動レビュー行き）
        //  - それ以外 → 自動承認で即公開（必須項目はvalidate済み・NGワード無し）
        //    無料掲載は published_at から30日で自動終了（expires_at）。ハローワーク求人は別ルール。
        if ($request->filled('scheduled_publish_at')) {
            $data['scheduled_publish_at'] = $request->input('scheduled_publish_at');
            $data['status'] = 'scheduled';
        } elseif ($hasNgWord) {
            $data['status'] = 'pending_review';
        } else {
            $data['status'] = 'active';
            $data['published_at'] = now();
            // 無料掲載の自動終了日（明示指定が無ければ30日後）
            if (empty($data['expires_at'])) {
                $data['expires_at'] = now()->addDays(30);
            }
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
        $this->authorize('manage', $job);
        $company = Auth::user()->company;

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
        $this->authorize('manage', $job);
        $company = Auth::user()->company;

        $request->validate([
            // 職業安定法 必須項目
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'prefecture' => 'required|string|max:10',
            'city' => 'required|string|max:100',
            'office_address' => 'required|string|max:255',
            'location' => 'nullable|string|max:255',
            'employment_type' => 'required|string|in:正社員,契約社員,パート,派遣,紹介予定派遣,業務委託,インターン',
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

        // 法令明示の必須条件チェック（更新で種別を変える場合も含む）
        $listingType = $request->input('listing_type', $job->listing_type ?? 'direct');
        if ($listingType === 'dispatch' && empty($company->dispatch_license_number)) {
            return response()->json([
                'message' => '派遣案件を掲載するには、会社設定で「労働者派遣事業 許可番号」の登録が必要です。',
                'compliance_required' => true,
            ], 422);
        }
        if ($listingType === 'referral' && empty($company->permit_number)) {
            return response()->json([
                'message' => '紹介案件を掲載するには、会社設定で「職業紹介事業 許可番号」の登録が必要です。',
                'compliance_required' => true,
            ], 422);
        }

        $data = $request->only([
            'title', 'description', 'requirements',
            'listing_type', 'dispatch_client_name', 'show_dispatch_client',
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
                    $customer = \Stripe\Customer::retrieve([
                        'id' => $company->stripe_customer_id,
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
                    \App\Models\PaymentTransaction::record([
                        'company_id' => $company->id,
                        'job_id' => $job->id,
                        'amount' => $dailyBudget,
                        'type' => 'job_activation',
                        'stripe_payment_intent_id' => $intent->id,
                    ]);
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
        // ランキングスコアを再計算（予算または公開状態が変わった場合に反映）
        $newBudget = (float) ($data['daily_budget'] ?? $oldBudget);
        $data['ranking_score'] = $this->computeRankingScore((float) $newBudget, $company);
        $job->update($data);

        // 課金保護: 予算変更ログ
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
        $this->authorize('manage', $job);
        $company = Auth::user()->company;

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
        $this->authorize('manage', $job);
        $company = Auth::user()->company;

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
        $this->authorize('manage', $job);
        $company = Auth::user()->company;

        JobPersona::where('job_id', $job->id)->delete();

        return response()->json(['message' => 'ペルソナ設定を削除しました']);
    }

    // 企業: 一括予算設定
    /**
     * ティア方式のランキングスコアを算出。
     *  - 予算>0（ブースト中）→ BOOST_BASE + 日額 × 品質 × 採用実績（無料より必ず上）
     *  - 予算0（無料掲載）   → FREE_BASE
     */
    private function computeRankingScore(float $budget, $company): float
    {
        $mult = ($company->quality_score ?? 1.0) * ($company->hiring_reputation ?? 1.0);
        return $budget > 0
            ? \App\Models\Campaign::BOOST_BASE + $budget * $mult
            : \App\Models\Campaign::FREE_BASE;
    }

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

            $job->update([
                'daily_budget'  => $newBudget,
                'ranking_score' => $this->computeRankingScore($newBudget, $company),
            ]);

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

    /**
     * 企業: 無料掲載→有料化の納得ナッジ。
     * 無料枠(daily_budget=0)のアクティブ求人ごとに、同エリアの競合数・有料掲載数・推奨開始予算を返す。
     * 検索順位は ranking_score（=予算由来）で決まるため、有料化＝上位表示という事実に基づく。
     */
    public function boostInsights(Request $request)
    {
        $company = Auth::user()->company;
        if (!$company) {
            return response()->json(['free_jobs' => 0, 'items' => []]);
        }

        $freeTotal = $company->jobs()->where('status', 'active')->where('daily_budget', 0)->count();

        $freeJobs = $company->jobs()->where('status', 'active')->where('daily_budget', 0)
            ->orderByDesc('created_at')->limit(20)
            ->get(['id', 'title', 'prefecture', 'location']);

        $items = $freeJobs->map(function ($j) {
            $area = function () use ($j) {
                $q = Job::where('status', 'active');
                if (!empty($j->prefecture)) $q->where('prefecture', $j->prefecture);
                elseif (!empty($j->location)) $q->where('location', $j->location);
                return $q;
            };
            $areaActive = (clone $area())->count();
            $areaPaid   = (clone $area())->where('daily_budget', '>', 0)->count();
            $maxPaid    = (float) (clone $area())->where('daily_budget', '>', 0)->max('daily_budget');
            // 有料勢を上回る推奨予算（¥100単位・切り上げ）。有料勢がいなければ最低ライン。
            $suggested  = $maxPaid > 0 ? (int) (ceil(($maxPaid + 100) / 100) * 100) : 300;

            return [
                'id'               => $j->id,
                'title'            => $j->title,
                'area'             => $j->prefecture ?: ($j->location ?: '全国'),
                'area_active'      => $areaActive,
                'area_paid'        => $areaPaid,
                'suggested_budget' => $suggested,
            ];
        });

        return response()->json([
            'free_jobs' => $freeTotal,
            'items'     => $items->values(),
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
            $wasActive = $job->status->value === 'active';
            $job->update(['status' => $request->status]);
            if ($request->status === 'active' && !$wasActive) {
                GoogleIndexingService::notifyJobPublished($job->id);
            }
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
        $this->authorize('manage', $job);
        $company = Auth::user()->company;

        // 公開中の求人は削除不可（課金逃れ防止）
        if ($job->status->value === 'active') {
            return response()->json([
                'message' => '公開中の求人は削除できません。先に「停止」または「終了」にしてから削除してください。',
            ], 422);
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
        $this->authorize('manage', $job);
        $company = Auth::user()->company;

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
        $this->authorize('manage', $job);
        $company = Auth::user()->company;

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
        $this->authorize('manage', $job);
        $company = Auth::user()->company;

        return response()->json($job->photos);
    }
}
