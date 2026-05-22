<?php

namespace App\Http\Controllers;

use App\Models\Job;
use App\Models\JobPersona;
use App\Models\JobReferral;
use App\Models\Company;
use App\Services\NgWordService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Stripe\Stripe;
use Stripe\PaymentIntent;

class AgencyController extends Controller
{
    /**
     * エージェント専用: 求人データベース（他エージェントの公開求人一覧）
     */
    public function jobDatabase(Request $request)
    {
        $company = Auth::user()->company;
        if (!$company->isAgency()) {
            return response()->json(['message' => '人材紹介会社のみ利用可能です'], 403);
        }

        $query = Job::with(['company', 'persona'])
            ->whereIn('jobs.status', ['active'])
            ->where('jobs.allow_referral', true)
            ->join('companies', 'jobs.company_id', '=', 'companies.id')
            ->where('jobs.company_id', '!=', $company->id)
            ->select('jobs.*');

        if ($request->filled('keyword')) {
            $keyword = $request->keyword;
            $query->where(function ($q) use ($keyword) {
                $q->where('jobs.title', 'like', "%{$keyword}%")
                    ->orWhere('jobs.description', 'like', "%{$keyword}%");
            });
        }

        if ($request->filled('location')) {
            $query->where('jobs.location', 'like', "%{$request->location}%");
        }

        $query->orderBy('jobs.created_at', 'desc');
        $perPage = min((int) $request->input('per_page', 20), 50);

        $result = $query->paginate($perPage);

        // 各求人に手数料情報を付与 + 企業連絡先をマスク（紹介承認前は非公開）
        $result->getCollection()->transform(function ($job) {
            $job->setAttribute('fee_display', $job->referral_fee_type === 'percentage'
                ? $job->referral_fee . '%'
                : ($job->referral_fee ? '¥' . number_format($job->referral_fee) : null));
            // 連絡先情報をマスク
            if ($job->company) {
                $job->company->makeHidden(['phone', 'website', 'address', 'office_address']);
            }
            return $job;
        });

        return response()->json($result);
    }

    /**
     * エージェント用: 候補者検索（scout_enabled な求職者）
     */
    public function searchCandidates(Request $request)
    {
        $company = Auth::user()->company;
        if (!$company->isAgency()) {
            return response()->json(['message' => '人材紹介会社のみ利用可能です'], 403);
        }

        $query = \App\Models\UserProfile::query()
            ->whereHas('user', fn($q) => $q->where('role', 'jobseeker'))
            ->whereHas('user.resumes', fn($q) => $q->where('scout_enabled', true));

        if ($request->filled('keyword')) {
            $keyword = $request->keyword;
            $query->where(function ($q) use ($keyword) {
                $q->where('full_name', 'ilike', "%{$keyword}%")
                  ->orWhere('self_pr', 'ilike', "%{$keyword}%")
                  ->orWhereJsonContains('skills', $keyword);
            });
        }

        if ($request->filled('location')) {
            $query->where('address', 'ilike', "%{$request->location}%");
        }

        $profiles = $query->with('user:id,email')->orderBy('updated_at', 'desc')->paginate(20);

        // 匿名化して返す
        $profiles->getCollection()->transform(function ($p) {
            $name = $p->full_name ?? '';
            return [
                'user_id' => $p->user_id,
                'display_name' => mb_substr($name, 0, 1) . str_repeat('●', max(0, mb_strlen($name) - 1)),
                'age' => $p->birth_date ? now()->diffInYears($p->birth_date) : null,
                'gender' => $p->gender,
                'area' => $p->address ? mb_substr($p->address, 0, 3) : null,
                'skills' => $p->skills ?? [],
                'work_history_count' => is_array($p->work_history) ? count($p->work_history) : 0,
                'education_summary' => is_array($p->education) && count($p->education) > 0
                    ? ($p->education[count($p->education) - 1]['school'] ?? '')
                    : '',
                'self_pr_excerpt' => $p->self_pr ? mb_substr($p->self_pr, 0, 100) . '...' : '',
            ];
        });

        return response()->json($profiles);
    }

    /**
     * エージェント: 紹介申請（他エージェントの求人に候補者を紹介）
     * システム利用料: 1件あたり500円（税込）
     */
    public function createReferral(Request $request, Job $job)
    {
        $company = Auth::user()->company;
        if (!$company->isAgency()) {
            return response()->json(['message' => '人材紹介会社のみ利用可能です'], 403);
        }

        if ($job->company_id === $company->id) {
            return response()->json(['message' => '自社の求人には紹介できません'], 422);
        }

        // 既に紹介済みかチェック
        $existing = JobReferral::where('job_id', $job->id)
            ->where('referrer_company_id', $company->id)
            ->whereIn('status', ['pending', 'approved'])
            ->first();

        if ($existing) {
            return response()->json(['message' => 'この求人には既に紹介申請済みです'], 422);
        }

        // 求人の掲載者タイプでパターンを判定
        $job->loadMissing('company');
        $isDirect = $job->company && $job->company->company_type === 'direct_employer';
        $referralPattern = $isDirect ? 'direct' : 'revenue_share';

        if ($isDirect) {
            // パターン1: 企業求人への直接紹介（手数料シェア不要）
            $request->validate([
                'message' => 'nullable|string|max:2000',
                'candidate_summary' => 'required|string|max:5000',
                'candidate_user_id' => 'nullable|integer|exists:users,id',
                'resume_file' => 'nullable|file|mimes:pdf|max:10240',
                'referral_fee_type' => 'nullable|in:percentage,fixed',
                'fee_percentage' => 'nullable|numeric|min:1|max:100',
                'referral_fee' => 'nullable|numeric|min:1',
                'terms_accepted' => 'required|accepted',
            ]);

            // 求人に設定された手数料をデフォルトとして使用
            $feeType = $request->input('referral_fee_type', $job->referral_fee_type ?? 'percentage');
            $feePercentage = $feeType === 'percentage'
                ? $request->input('fee_percentage', $job->referral_fee ?? 20)
                : null;
            $feeAmount = $feeType === 'fixed'
                ? $request->input('referral_fee', $job->referral_fee)
                : null;
            $sourceShare = 0;
            $referrerShare = 100;
        } else {
            // パターン2: エージェント間レベニューシェア
            $request->validate([
                'message' => 'nullable|string|max:2000',
                'candidate_summary' => 'required|string|max:5000',
                'candidate_user_id' => 'nullable|integer|exists:users,id',
                'resume_file' => 'nullable|file|mimes:pdf|max:10240',
                'referral_fee_type' => 'nullable|in:percentage,fixed',
                'fee_percentage' => 'nullable|numeric|min:10|max:50',
                'referral_fee' => 'nullable|numeric|min:1',
                'source_share' => 'nullable|numeric|min:20|max:80',
                'referrer_share' => 'nullable|numeric|min:20|max:80',
                'terms_accepted' => 'required|accepted',
            ]);

            $feeType = $request->input('referral_fee_type', 'percentage');
            $feePercentage = $feeType === 'percentage'
                ? $request->input('fee_percentage', 20)
                : null;
            $feeAmount = $feeType === 'fixed'
                ? $request->input('referral_fee')
                : null;
            $sourceShare = $request->input('source_share', 50);
            $referrerShare = $request->input('referrer_share', 50);

            // シェア合計が100%になるよう確認
            if (abs($sourceShare + $referrerShare - 100) > 0.01) {
                return response()->json(['message' => '手数料シェアの合計は100%にしてください'], 422);
            }
        }

        // システム利用料 500円（税込）
        $proposalFee = 500;

        // 本番環境: Stripe決済
        if (app()->environment('production')) {
            // Stripeカード登録チェック
            if (!$company->stripe_customer_id) {
                return response()->json(['message' => '紹介申請にはカード登録が必要です。設定画面からカードを登録してください。'], 422);
            }

            try {
                Stripe::setApiKey(config('services.stripe.secret'));

                $paymentIntent = PaymentIntent::create([
                    'amount' => $proposalFee,
                    'currency' => 'jpy',
                    'customer' => $company->stripe_customer_id,
                    'payment_method_types' => ['card'],
                    'confirm' => true,
                    'off_session' => true,
                    'description' => "システム利用料（紹介提案） - 求人ID:{$job->id} {$job->title}",
                    'metadata' => [
                        'type' => 'referral_proposal_fee',
                        'company_id' => $company->id,
                        'job_id' => $job->id,
                    ],
                ]);

                if ($paymentIntent->status !== 'succeeded') {
                    return response()->json(['message' => '決済に失敗しました。カード情報を確認してください。'], 422);
                }
            } catch (\Stripe\Exception\CardException $e) {
                Log::warning('Referral proposal fee charge failed', [
                    'company_id' => $company->id,
                    'job_id' => $job->id,
                    'error' => $e->getMessage(),
                ]);
                return response()->json(['message' => '決済に失敗しました: ' . $e->getError()->message], 422);
            } catch (\Exception $e) {
                Log::error('Referral proposal fee charge error', [
                    'company_id' => $company->id,
                    'job_id' => $job->id,
                    'error' => $e->getMessage(),
                ]);
                return response()->json(['message' => '決済処理中にエラーが発生しました。しばらく経ってからお試しください。'], 500);
            }
        } else {
            // 開発環境: 決済スキップ（ログのみ）
            Log::info('DEV: システム利用料スキップ', [
                'company_id' => $company->id,
                'job_id' => $job->id,
                'amount' => $proposalFee,
            ]);
        }

        // 履歴書PDFアップロード
        $resumePath = null;
        if ($request->hasFile('resume_file')) {
            $resumePath = $request->file('resume_file')->store('referral-resumes', 'public');
        }

        $referral = JobReferral::create([
            'job_id' => $job->id,
            'source_company_id' => $job->company_id,
            'referrer_company_id' => $company->id,
            'candidate_user_id' => $request->candidate_user_id,
            'referral_pattern' => $referralPattern,
            'referral_fee_type' => $feeType,
            'fee_percentage' => $feePercentage,
            'referral_fee_amount' => $feeAmount,
            'source_share' => $sourceShare,
            'referrer_share' => $referrerShare,
            'status' => 'pending',
            'message' => $request->message,
            'candidate_summary' => $request->candidate_summary,
            'resume_file_path' => $resumePath,
            'proposal_fee' => $proposalFee,
            'terms_accepted' => true,
        ]);

        return response()->json($referral->load(['job', 'sourceCompany', 'referrerCompany', 'candidateUser']), 201);
    }

    /**
     * エージェント: 受け取った紹介一覧（自社求人への紹介申請）
     * 承認前の紹介元企業の連絡先はマスク
     */
    public function receivedReferrals(Request $request)
    {
        $company = Auth::user()->company;
        $referrals = JobReferral::with(['job', 'referrerCompany'])
            ->where('source_company_id', $company->id)
            ->orderBy('created_at', 'desc')
            ->get();

        $hiddenFields = ['phone', 'website', 'address', 'office_address'];
        $referrals->each(function ($r) use ($hiddenFields) {
            if (!in_array($r->status, ['approved', 'placed']) && $r->referrerCompany) {
                $r->referrerCompany->makeHidden($hiddenFields);
            }
        });

        return response()->json($referrals);
    }

    /**
     * エージェント: 送った紹介一覧
     * 承認前の紹介先企業の連絡先はマスク
     */
    public function sentReferrals(Request $request)
    {
        $company = Auth::user()->company;
        $referrals = JobReferral::with(['job', 'sourceCompany'])
            ->where('referrer_company_id', $company->id)
            ->orderBy('created_at', 'desc')
            ->get();

        $hiddenFields = ['phone', 'website', 'address', 'office_address'];
        $referrals->each(function ($r) use ($hiddenFields) {
            if (!in_array($r->status, ['approved', 'placed']) && $r->sourceCompany) {
                $r->sourceCompany->makeHidden($hiddenFields);
            }
        });

        return response()->json($referrals);
    }

    /**
     * エージェント: 紹介承認/拒否
     */
    public function updateReferralStatus(Request $request, JobReferral $referral)
    {
        $company = Auth::user()->company;
        if ($referral->source_company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'status' => 'required|in:approved,rejected',
        ]);

        $referral->update(['status' => $request->status]);

        return response()->json($referral->load(['job', 'referrerCompany']));
    }

    /**
     * エージェント: 成約報告（手数料計算）
     */
    public function reportPlacement(Request $request, JobReferral $referral)
    {
        $company = Auth::user()->company;
        if ($referral->source_company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($referral->status !== 'approved') {
            return response()->json(['message' => '承認済みの紹介のみ成約報告できます'], 422);
        }

        $isFixedDirect = $referral->referral_pattern === 'direct'
            && $referral->referral_fee_type === 'fixed'
            && $referral->referral_fee_amount;

        $request->validate([
            'placement_salary' => $isFixedDirect ? 'nullable|integer|min:0' : 'required|integer|min:1000000',
        ]);

        $salary = $request->input('placement_salary', 0);

        // 手数料タイプで総額を計算
        if ($isFixedDirect) {
            $totalFee = $referral->referral_fee_amount;
        } elseif ($referral->referral_fee_type === 'fixed' && $referral->referral_fee_amount) {
            $totalFee = $referral->referral_fee_amount;
        } else {
            $totalFee = (int) round($salary * $referral->fee_percentage / 100);
        }

        // パターン1（直接紹介）: referrer_share=100 なので紹介者が全額受取
        // パターン2（レベニューシェア）: source/referrer_share で按分
        $sourceFee = (int) round($totalFee * ($referral->source_share ?? 0) / 100);
        $referrerFee = (int) round($totalFee * ($referral->referrer_share ?? 100) / 100);

        $referral->update([
            'status' => 'placed',
            'placement_salary' => $salary,
            'total_fee' => $totalFee,
            'source_fee' => $sourceFee,
            'referrer_fee' => $referrerFee,
            'placed_at' => now(),
        ]);

        return response()->json($referral->load(['job', 'referrerCompany']));
    }

    /**
     * エージェント: 求人一括アップロード（CSV）
     */
    public function bulkUpload(Request $request, NgWordService $ngWordService)
    {
        $company = Auth::user()->company;
        if (!$company->isAgency()) {
            return response()->json(['message' => '人材紹介会社のみ利用可能です'], 403);
        }

        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:20480', // 20MB max
        ]);

        // 5000件 × 処理時間を考慮してタイムアウトを延長
        set_time_limit(300);

        $file = $request->file('file');

        $handle = fopen($file->getRealPath(), 'r');
        if ($handle === false) {
            return response()->json(['message' => 'CSVファイルの読み込みに失敗しました。'], 422);
        }

        // ヘッダー行を先読み
        $headerRow = fgetcsv($handle);
        if ($headerRow === false) {
            fclose($handle);
            return response()->json(['message' => 'CSVにデータ行がありません'], 422);
        }
        // 日本語ヘッダー → 英語フィールド名マッピング（後方互換: 英語ヘッダーもそのまま動く）
        $headerMap = [
            '求人タイトル'          => 'title',
            '仕事内容'              => 'description',
            '応募要件'              => 'requirements',
            '職種カテゴリ（大）'    => 'job_category_major',
            '職種カテゴリ（小）'    => 'job_category_minor',
            '採用区分'              => 'application_type',
            '給与下限（円）'        => 'salary_min',
            '給与上限（円）'        => 'salary_max',
            '給与形態'              => 'salary_type',
            '給与補足'              => 'salary_details',
            '昇給'                  => 'raise_frequency',
            '賞与'                  => 'bonus',
            '都道府県'              => 'prefecture',
            '市区町村'              => 'city',
            '勤務地'                => 'location',
            '詳細住所'              => 'office_address',
            '最寄り駅'              => 'nearest_station',
            'アクセス'              => 'access_info',
            '転勤の有無'            => 'transfer_policy',
            '雇用形態'              => 'employment_type',
            '勤務時間'              => 'work_hours',
            'リモート'              => 'remote_policy',
            '残業時間'              => 'overtime_average',
            '契約期間'              => 'contract_period',
            '休日'                  => 'holidays',
            '休日詳細'              => 'holiday_details',
            '手当'                  => 'allowances',
            '試用期間'              => 'probation_period',
            '試用期間条件'          => 'probation_conditions',
            '選考フロー'            => 'selection_process',
            '必要書類'              => 'required_documents',
            '選考期間'              => 'estimated_timeline',
            '社風'                  => 'company_culture',
            '職場環境'              => 'work_environment',
            '従業員数'              => 'number_of_employees',
            '設立年'                => 'founded_year',
            '業種'                  => 'industry',
            'アピールポイント'      => 'appeal_points',
            '備考'                  => 'notes',
            '紹介許可'              => 'allow_referral',
            '手数料タイプ'          => 'referral_fee_type',
            '手数料'                => 'referral_fee',
            '紹介条件'              => 'referral_conditions',
            'ペルソナ_対象年齢下限'       => 'persona_age_min',
            'ペルソナ_対象年齢上限'       => 'persona_age_max',
            'ペルソナ_経験年数下限'       => 'persona_experience_min',
            'ペルソナ_経験年数上限'       => 'persona_experience_max',
            'ペルソナ_求めるスキル'       => 'persona_target_skills',
            'ペルソナ_対象勤務地'         => 'persona_target_locations',
            'ペルソナ_対象職種'           => 'persona_target_job_types',
            'ペルソナ_就業状態'           => 'persona_target_employment_status',
            'ペルソナ_学歴条件'           => 'persona_target_education',
            'ペルソナ_対象業界'           => 'persona_target_industries',
            'ペルソナ_希望年収下限'       => 'persona_target_salary_min',
            'ペルソナ_希望年収上限'       => 'persona_target_salary_max',
            'ペルソナ_求める資格'         => 'persona_target_certifications',
            'ペルソナ_マネジメント経験'   => 'persona_target_management_experience',
            'ペルソナ_最大転職回数'       => 'persona_max_company_changes',
            'ペルソナ_人物像'             => 'persona_personality_traits',
            'ペルソナ_NG条件'             => 'persona_ng_conditions',
            'ペルソナ_理想の候補者'       => 'persona_ideal_candidate_description',
            'ペルソナ_ブースト係数'       => 'persona_boost_factor',
        ];

        // 日本語ヘッダーを英語フィールド名に変換（英語はそのまま通す）
        $headers = array_map(function ($h) use ($headerMap) {
            $h = trim($h);
            return $headerMap[$h] ?? $h;
        }, $headerRow);

        $requiredHeaders = ['title', 'description', 'prefecture', 'employment_type'];
        $missingHeaders = array_diff($requiredHeaders, $headers);
        if (!empty($missingHeaders)) {
            fclose($handle);
            $labelMap = ['title' => '求人タイトル', 'description' => '仕事内容', 'prefecture' => '都道府県', 'employment_type' => '雇用形態'];
            $missing = implode('」「', array_map(fn($h) => $labelMap[$h] ?? $h, $missingHeaders));
            return response()->json(['message' => "必須カラムが見つかりません: 「{$missing}」"], 422);
        }

        $allowedFields = [
            // 基本情報
            'title', 'description', 'requirements',
            'job_category_major', 'job_category_minor', 'application_type',
            // 給与
            'salary_min', 'salary_max', 'salary_type', 'salary_details', 'raise_frequency', 'bonus',
            // 勤務条件
            'prefecture', 'city', 'location', 'office_address',
            'nearest_station', 'access_info', 'transfer_policy',
            'employment_type', 'work_hours',
            'remote_policy', 'overtime_average', 'contract_period',
            // 待遇
            'holidays', 'holiday_details', 'allowances',
            'probation_period', 'probation_conditions',
            // 選考
            'selection_process', 'required_documents', 'estimated_timeline',
            // 会社の魅力
            'company_culture', 'work_environment',
            'number_of_employees', 'founded_year', 'industry',
            // その他
            'appeal_points', 'notes',
            // 人材紹介
            'allow_referral', 'referral_fee_type', 'referral_fee', 'referral_conditions',
            // ペルソナ設定
            'persona_age_min', 'persona_age_max', 'persona_experience_min', 'persona_experience_max',
            'persona_target_skills', 'persona_target_locations', 'persona_target_job_types',
            'persona_target_employment_status', 'persona_target_education',
            'persona_target_industries', 'persona_target_salary_min', 'persona_target_salary_max',
            'persona_target_certifications', 'persona_target_management_experience',
            'persona_max_company_changes', 'persona_personality_traits',
            'persona_ng_conditions', 'persona_ideal_candidate_description', 'persona_boost_factor',
        ];

        $created = [];
        $errors = [];
        $rowIndex = 0;

        // ストリームで1行ずつ処理（全行をメモリに溜めない）
        while (($row = fgetcsv($handle)) !== false) {
            $rowIndex++;
            if ($rowIndex > 5000) {
                fclose($handle);
                return response()->json(['message' => '一括アップロードは5,000件までです'], 422);
            }
            $lineNum = $rowIndex + 1;

            if (count($row) !== count($headers)) {
                $errors[] = "行{$lineNum}: カラム数が一致しません";
                continue;
            }

            $data = array_combine($headers, $row);

            // 許可されたフィールドのみ
            $filtered = array_intersect_key($data, array_flip($allowedFields));

            if (empty($filtered['title']) || empty($filtered['description'])) {
                $errors[] = "行{$lineNum}: 求人タイトルと仕事内容は必須です";
                continue;
            }
            if (empty($filtered['prefecture'])) {
                $errors[] = "行{$lineNum}: 都道府県は必須です";
                continue;
            }
            if (empty($filtered['employment_type'])) {
                $errors[] = "行{$lineNum}: 雇用形態は必須です";
                continue;
            }

            // 数値・型変換（負の給与や非現実的な値を拒否）
            if (isset($filtered['salary_min'])) {
                $val = (int) $filtered['salary_min'];
                if ($filtered['salary_min'] !== '' && ($val < 0 || $val > 999999999)) {
                    $errors[] = "行{$lineNum}: salary_min は 0〜999,999,999 の範囲で入力してください";
                    continue;
                }
                $filtered['salary_min'] = $val ?: null;
            }
            if (isset($filtered['salary_max'])) {
                $val = (int) $filtered['salary_max'];
                if ($filtered['salary_max'] !== '' && ($val < 0 || $val > 999999999)) {
                    $errors[] = "行{$lineNum}: salary_max は 0〜999,999,999 の範囲で入力してください";
                    continue;
                }
                $filtered['salary_max'] = $val ?: null;
            }
            if (isset($filtered['salary_min'], $filtered['salary_max'])
                && $filtered['salary_min'] && $filtered['salary_max']
                && $filtered['salary_min'] > $filtered['salary_max']) {
                $errors[] = "行{$lineNum}: salary_min は salary_max 以下にしてください";
                continue;
            }
            if (isset($filtered['referral_fee'])) $filtered['referral_fee'] = (float) $filtered['referral_fee'] ?: null;
            if (isset($filtered['allow_referral'])) $filtered['allow_referral'] = in_array(strtolower(trim($filtered['allow_referral'])), ['1', 'true', 'yes', 'はい', 'o']);

            // location を自動生成（prefecture + city があれば）
            if (empty($filtered['location']) && !empty($filtered['prefecture'])) {
                $filtered['location'] = trim(($filtered['prefecture'] ?? '') . ($filtered['city'] ?? ''));
            }

            // NGワード判定
            $hasNgWord = $ngWordService->containsNgWord($filtered['title'])
                || $ngWordService->containsNgWord($filtered['description']);

            $filtered['company_id'] = $company->id;
            $filtered['status'] = 'pending_review';
            $filtered['ng_word_flagged'] = $hasNgWord;

            // ペルソナフィールドを分離
            $personaFields = [];
            $personaPrefix = 'persona_';
            foreach (array_keys($filtered) as $key) {
                if (str_starts_with($key, $personaPrefix)) {
                    $personaKey = substr($key, strlen($personaPrefix));
                    $val = $filtered[$key];
                    if ($val !== '' && $val !== null) {
                        $personaFields[$personaKey] = $val;
                    }
                    unset($filtered[$key]);
                }
            }

            try {
                $job = Job::create($filtered);

                // ペルソナデータがあればJobPersonaを作成
                if (!empty($personaFields)) {
                    $personaData = ['job_id' => $job->id];

                    // 整数フィールド
                    foreach (['age_min', 'age_max', 'experience_min', 'experience_max', 'target_salary_min', 'target_salary_max', 'max_company_changes'] as $intField) {
                        if (isset($personaFields[$intField])) {
                            $personaData[$intField] = (int) $personaFields[$intField] ?: null;
                        }
                    }

                    // セミコロン区切り → JSON配列フィールド
                    foreach (['target_skills', 'target_locations', 'target_job_types', 'target_industries', 'target_certifications', 'target_company_sizes', 'personality_traits', 'priority_conditions'] as $arrayField) {
                        if (isset($personaFields[$arrayField])) {
                            $personaData[$arrayField] = array_map('trim', explode(';', $personaFields[$arrayField]));
                        }
                    }

                    // テキストフィールド
                    foreach (['target_employment_status', 'target_education', 'target_management_experience', 'ng_conditions', 'ideal_candidate_description'] as $textField) {
                        if (isset($personaFields[$textField])) {
                            $personaData[$textField] = $personaFields[$textField];
                        }
                    }

                    // ブースト係数
                    if (isset($personaFields['boost_factor'])) {
                        $boost = (float) $personaFields['boost_factor'];
                        $personaData['boost_factor'] = max(0.5, min(3.0, $boost));
                    }

                    JobPersona::create($personaData);
                }

                $created[] = $job;
            } catch (\Exception $e) {
                $errors[] = "行{$lineNum}: " . $e->getMessage();
            }
        }
        fclose($handle);

        return response()->json([
            'created_count' => count($created),
            'error_count' => count($errors),
            'errors' => $errors,
            'jobs' => $created,
        ]);
    }

    /**
     * エージェント: ライセンス証アップロード
     */
    public function uploadLicense(Request $request)
    {
        $company = Auth::user()->company;

        if (!$company) {
            return response()->json(['message' => '企業情報が登録されていません。先に企業情報を登録してください。'], 422);
        }

        $request->validate([
            'license_document' => 'required|file|mimes:pdf,jpg,jpeg,png|max:10240', // 10MB
            'permit_number' => 'required|string|max:50',
        ]);

        try {
            $path = $request->file('license_document')->store('licenses', 'public');
        } catch (\Throwable $e) {
            \Log::error('License upload failed', ['error' => $e->getMessage(), 'user' => Auth::id()]);
            return response()->json(['message' => 'ファイルの保存に失敗しました。しばらくしてから再度お試しください。'], 500);
        }

        if ($path === false) {
            return response()->json(['message' => 'ファイルの保存に失敗しました。しばらくしてから再度お試しください。'], 500);
        }

        $company->update([
            'company_type' => 'recruitment_agency',
            'license_document_path' => $path,
            'permit_number' => $request->permit_number,
            'license_verified' => false,
        ]);

        Cache::forget('admin_pending_licenses');
        Cache::forget('admin_overview');

        return response()->json([
            'message' => 'ライセンス証をアップロードしました。運営の確認後、エージェント機能が利用可能になります。',
            'company' => $company,
        ]);
    }

    /**
     * エージェント: ダッシュボード統計
     */
    public function dashboard(Request $request)
    {
        $company = Auth::user()->company;
        if (!$company || !$company->isAgency()) {
            return response()->json(['message' => '人材紹介会社のみ利用可能です'], 403);
        }

        $stats = [
            'active_jobs' => $company->jobs()->where('status', 'active')->count(),
            'total_jobs' => $company->jobs()->count(),
            'sent_referrals' => JobReferral::where('referrer_company_id', $company->id)->count(),
            'received_referrals' => JobReferral::where('source_company_id', $company->id)->count(),
            'pending_referrals' => JobReferral::where('source_company_id', $company->id)->where('status', 'pending')->count(),
            'placements' => JobReferral::where(function ($q) use ($company) {
                $q->where('source_company_id', $company->id)
                    ->orWhere('referrer_company_id', $company->id);
            })->where('status', 'placed')->count(),
            'total_earnings' => (int) JobReferral::where('referrer_company_id', $company->id)
                ->where('status', 'placed')
                ->sum('referrer_fee'),
            'license_verified' => $company->license_verified,
            'permit_number' => $company->permit_number,
            'license_document_path' => $company->license_document_path,
            'verification_status' => $company->verification_status,
            'company_type' => $company->company_type,
        ];

        return response()->json($stats);
    }

    // 収益分析
    public function revenueAnalytics(Request $request)
    {
        $company = Auth::user()->company;
        if (!$company->isAgency()) {
            return response()->json(['message' => '人材紹介会社のみ利用可能です'], 403);
        }

        // 月別収益（過去12ヶ月）
        $monthly = [];
        for ($i = 11; $i >= 0; $i--) {
            $date = now()->subMonths($i);
            $month = $date->format('Y-m');
            $earnings = (int) JobReferral::where('referrer_company_id', $company->id)
                ->where('status', 'placed')
                ->whereYear('updated_at', $date->year)
                ->whereMonth('updated_at', $date->month)
                ->sum('referrer_fee');
            $placements = JobReferral::where('referrer_company_id', $company->id)
                ->where('status', 'placed')
                ->whereYear('updated_at', $date->year)
                ->whereMonth('updated_at', $date->month)
                ->count();
            $monthly[] = ['month' => $month, 'earnings' => $earnings, 'placements' => $placements];
        }

        // クライアント別収益
        $byClient = JobReferral::where('referrer_company_id', $company->id)
            ->where('status', 'placed')
            ->selectRaw('source_company_id, SUM(referrer_fee) as total_fee, COUNT(*) as count')
            ->groupBy('source_company_id')
            ->with('sourceCompany:id,company_name')
            ->orderByDesc('total_fee')
            ->limit(10)
            ->get()
            ->map(fn($r) => [
                'company_name' => $r->sourceCompany?->company_name ?? '不明',
                'total_fee' => (int) $r->total_fee,
                'count' => $r->count,
            ]);

        // パフォーマンス指標
        $totalSent = JobReferral::where('referrer_company_id', $company->id)->count();
        $totalApproved = JobReferral::where('referrer_company_id', $company->id)->where('status', 'approved')->count();
        $totalPlaced = JobReferral::where('referrer_company_id', $company->id)->where('status', 'placed')->count();
        $avgFee = JobReferral::where('referrer_company_id', $company->id)
            ->where('status', 'placed')
            ->avg('referrer_fee');

        return response()->json([
            'monthly' => $monthly,
            'by_client' => $byClient,
            'performance' => [
                'total_sent' => $totalSent,
                'total_approved' => $totalApproved,
                'total_placed' => $totalPlaced,
                'approval_rate' => $totalSent > 0 ? round(($totalApproved + $totalPlaced) / $totalSent * 100) : 0,
                'placement_rate' => $totalSent > 0 ? round($totalPlaced / $totalSent * 100) : 0,
                'avg_fee' => (int) ($avgFee ?? 0),
            ],
        ]);
    }
}
