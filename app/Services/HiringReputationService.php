<?php

namespace App\Services;

use App\Enums\ApplicationStatus;
use App\Mail\StalledJobWarning;
use App\Models\Application;
use App\Models\Company;
use App\Models\Job;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class HiringReputationService
{
    // 採用実績スコアのレンジ（ランキング係数として使用）
    private const MIN_SCORE = 0.7;
    private const MAX_SCORE = 1.3;
    private const NEUTRAL_SCORE = 1.0;

    // ベイズ平均の仮想応募数（重み）— 新規企業の安定化用
    private const BAYESIAN_CONFIDENCE = 10;

    // 最低応募数: これ未満の求人はスコア計算対象外
    private const MIN_APPLICATIONS_THRESHOLD = 3;

    // 放置判定の日数閾値
    private const STALLED_WARNING_DAYS = 30;
    private const STALLED_LABEL_DAYS = 60;
    private const STALLED_PENALTY_DAYS = 90;

    // 採用報告ボーナス（1件あたり）
    private const REPORT_BONUS = 0.02;
    // 最大ボーナス上限
    private const MAX_REPORT_BONUS = 0.20;

    // 放置ペナルティ（1件あたり、5件以上放置時）
    private const STALLED_PENALTY_PER_JOB = 0.03;
    // 最大ペナルティ上限
    private const MAX_STALLED_PENALTY = 0.15;

    /**
     * 全企業の採用実績スコアを再計算して更新する
     */
    public function updateAll(): int
    {
        $count = 0;

        // プラットフォーム全体の平均採用率を先に算出
        $platformAvgRate = $this->calculatePlatformAverageHiringRate();

        // 職種カテゴリ別の平均採用率を算出
        $categoryAvgRates = $this->calculateCategoryAverageHiringRates();

        Company::where('verification_status', 'approved')
            ->chunk(100, function ($companies) use (&$count, $platformAvgRate, $categoryAvgRates) {
                foreach ($companies as $company) {
                    $score = $this->calculateReputation($company, $platformAvgRate, $categoryAvgRates);
                    $company->update(['hiring_reputation' => $score]);
                    $count++;
                }
            });

        return $count;
    }

    /**
     * 1企業の採用実績スコアを計算する（0.7〜1.3）
     */
    public function calculateReputation(
        Company $company,
        ?float $platformAvgRate = null,
        ?array $categoryAvgRates = null
    ): float {
        $platformAvgRate ??= $this->calculatePlatformAverageHiringRate();
        $categoryAvgRates ??= $this->calculateCategoryAverageHiringRates();

        // 1) 企業の採用率を職種カテゴリ別にベイズ平均で算出
        $relativeScore = $this->calculateRelativeHiringScore($company, $platformAvgRate, $categoryAvgRates);

        // 2) 採用報告ボーナス
        $reportBonus = $this->calculateReportBonus($company);

        // 3) 放置ペナルティ
        $stalledPenalty = $this->calculateStalledPenalty($company);

        // 最終スコア
        $score = self::NEUTRAL_SCORE + $relativeScore + $reportBonus - $stalledPenalty;

        return round(
            min(self::MAX_SCORE, max(self::MIN_SCORE, $score)),
            4
        );
    }

    /**
     * 職種カテゴリ別の相対採用率スコアを算出
     * 同カテゴリ内での位置を -0.15 〜 +0.15 で返す
     */
    private function calculateRelativeHiringScore(
        Company $company,
        float $platformAvgRate,
        array $categoryAvgRates
    ): float {
        $jobs = $company->jobs()
            ->whereIn('status', ['active', 'closed'])
            ->withCount([
                'applications',
                'applications as hired_count' => function ($q) {
                    $q->where('status', ApplicationStatus::Hired->value);
                },
            ])
            ->having('applications_count', '>=', self::MIN_APPLICATIONS_THRESHOLD)
            ->get();

        if ($jobs->isEmpty()) {
            return 0.0; // データ不足 → 中立
        }

        $totalWeightedScore = 0.0;
        $totalWeight = 0.0;

        foreach ($jobs as $job) {
            $category = $job->job_category_major ?? '__default__';
            $categoryAvg = $categoryAvgRates[$category] ?? $platformAvgRate;

            // ベイズ平均: 新規/少量データの安定化
            $adjustedRate = ($platformAvgRate * self::BAYESIAN_CONFIDENCE + $job->hired_count)
                / (self::BAYESIAN_CONFIDENCE + $job->applications_count);

            // カテゴリ平均との相対比較 (0.0〜2.0、1.0が平均)
            $relative = $categoryAvg > 0
                ? $adjustedRate / $categoryAvg
                : 1.0;

            // 応募数で重み付け（応募が多い求人ほど影響大）
            $weight = $job->applications_count;
            $totalWeightedScore += $relative * $weight;
            $totalWeight += $weight;
        }

        if ($totalWeight === 0.0) {
            return 0.0;
        }

        $avgRelative = $totalWeightedScore / $totalWeight;

        // 0.0〜2.0 を -0.15〜+0.15 にマッピング
        return ($avgRelative - 1.0) * 0.15;
    }

    /**
     * 採用報告ボーナス: きちんとHiredステータスに更新した回数に応じて加点
     */
    private function calculateReportBonus(Company $company): float
    {
        $hiredCount = Application::whereIn('job_id', $company->jobs()->pluck('id'))
            ->where('status', ApplicationStatus::Hired->value)
            ->count();

        $bonus = $hiredCount * self::REPORT_BONUS;

        return min($bonus, self::MAX_REPORT_BONUS);
    }

    /**
     * 放置ペナルティ: 応募が来ているのにアクションがない求人の数に応じて減点
     */
    private function calculateStalledPenalty(Company $company): float
    {
        $stalledCount = $company->jobs()
            ->where('status', 'active')
            ->whereHas('applications', function ($q) {
                $q->where('status', ApplicationStatus::Pending->value);
            })
            ->where(function ($q) {
                $q->whereNull('last_company_action_at')
                    ->orWhere('last_company_action_at', '<', Carbon::now()->subDays(self::STALLED_PENALTY_DAYS));
            })
            ->count();

        if ($stalledCount < 5) {
            return 0.0; // 5件未満は猶予
        }

        $penalty = $stalledCount * self::STALLED_PENALTY_PER_JOB;

        return min($penalty, self::MAX_STALLED_PENALTY);
    }

    /**
     * プラットフォーム全体の平均採用率
     */
    private function calculatePlatformAverageHiringRate(): float
    {
        $result = DB::selectOne("
            SELECT
                COALESCE(SUM(hired_sub.cnt), 0) as total_hired,
                COALESCE(SUM(app_sub.cnt), 0) as total_applications
            FROM jobs
            LEFT JOIN (
                SELECT job_id, COUNT(*) as cnt
                FROM applications
                WHERE status = ?
                GROUP BY job_id
            ) hired_sub ON hired_sub.job_id = jobs.id
            LEFT JOIN (
                SELECT job_id, COUNT(*) as cnt
                FROM applications
                GROUP BY job_id
            ) app_sub ON app_sub.job_id = jobs.id
            WHERE jobs.status IN ('active', 'closed')
        ", [ApplicationStatus::Hired->value]);

        if (!$result || $result->total_applications == 0) {
            return 0.10; // フォールバック: 10%
        }

        return $result->total_hired / $result->total_applications;
    }

    /**
     * 職種カテゴリ別の平均採用率
     */
    private function calculateCategoryAverageHiringRates(): array
    {
        $rows = DB::select("
            SELECT
                COALESCE(jobs.job_category_major, '__default__') as category,
                COUNT(CASE WHEN applications.status = ? THEN 1 END) as hired,
                COUNT(applications.id) as total
            FROM jobs
            JOIN applications ON applications.job_id = jobs.id
            WHERE jobs.status IN ('active', 'closed')
            GROUP BY COALESCE(jobs.job_category_major, '__default__')
            HAVING COUNT(applications.id) >= ?
        ", [ApplicationStatus::Hired->value, self::MIN_APPLICATIONS_THRESHOLD]);

        $rates = [];
        foreach ($rows as $row) {
            $rates[$row->category] = $row->total > 0
                ? $row->hired / $row->total
                : 0.10;
        }

        return $rates;
    }

    /**
     * 放置求人を検出して段階的に対応する
     * - 30日: 企業に通知
     * - 60日: 求人にラベル付与
     * - 90日: 自動非アクティブ化
     */
    public function detectAndHandleStalledJobs(): array
    {
        $results = ['notified' => 0, 'labeled' => 0, 'deactivated' => 0];

        // 30日放置: 通知対象
        $warningJobs = Job::where('status', 'active')
            ->whereHas('applications', fn($q) => $q->where('status', ApplicationStatus::Pending->value))
            ->where(function ($q) {
                $q->whereNull('last_company_action_at')
                    ->orWhere('last_company_action_at', '<', Carbon::now()->subDays(self::STALLED_WARNING_DAYS));
            })
            ->where(function ($q) {
                // 60日以上は別カテゴリで処理
                $q->where('last_company_action_at', '>=', Carbon::now()->subDays(self::STALLED_LABEL_DAYS))
                    ->orWhereNull('last_company_action_at');
            })
            ->with('company.user')
            ->get();

        foreach ($warningJobs as $job) {
            if ($job->company?->user?->email) {
                Mail::to($job->company->user->email)
                    ->queue(new StalledJobWarning($job, self::STALLED_WARNING_DAYS));
            }
            Log::info("Stalled job warning: Job #{$job->id} ({$job->title}) - 30日以上放置");
            $results['notified']++;
        }

        // 60日放置: ラベル付与（フロント側で「返信が遅い可能性」表示の判定に使う）
        $labelJobs = Job::where('status', 'active')
            ->whereHas('applications', fn($q) => $q->where('status', ApplicationStatus::Pending->value))
            ->where('last_company_action_at', '<', Carbon::now()->subDays(self::STALLED_LABEL_DAYS))
            ->where('last_company_action_at', '>=', Carbon::now()->subDays(self::STALLED_PENALTY_DAYS))
            ->get();

        foreach ($labelJobs as $job) {
            Log::info("Stalled job label: Job #{$job->id} ({$job->title}) - 60日以上放置");
            $results['labeled']++;
        }

        // 90日放置: 自動非アクティブ化
        $deactivateJobs = Job::where('status', 'active')
            ->whereHas('applications', fn($q) => $q->where('status', ApplicationStatus::Pending->value))
            ->where('last_company_action_at', '<', Carbon::now()->subDays(self::STALLED_PENALTY_DAYS))
            ->get();

        foreach ($deactivateJobs as $job) {
            $job->update(['status' => 'closed']);
            Log::info("Stalled job deactivated: Job #{$job->id} ({$job->title}) - 90日以上放置のため自動クローズ");
            $results['deactivated']++;
        }

        return $results;
    }
}
