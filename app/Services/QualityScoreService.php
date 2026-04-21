<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Company;
use App\Models\DailyUsage;
use App\Models\InterviewSchedule;
use App\Models\Message;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class QualityScoreService
{
    // 品質スコアのレンジ
    private const MIN_SCORE = 1.0;
    private const MAX_SCORE = 4.0;

    // 各指標の重み（案B: 返信重視）
    private const WEIGHT_REPLY_RATE = 0.35;
    private const WEIGHT_REPLY_SPEED = 0.30;
    private const WEIGHT_INTERVIEW_SETUP_RATE = 0.25;
    private const WEIGHT_LOGIN_FREQUENCY = 0.10;

    // 移動平均の日数
    private const WINDOW_DAYS = 7;

    // 返信速度の基準（時間）: これ以下なら満点
    private const REPLY_SPEED_EXCELLENT_HOURS = 2;
    // 返信速度の最低ライン: これ以上は0点
    private const REPLY_SPEED_WORST_HOURS = 72;

    /**
     * 全企業の品質スコアを再計算して更新する
     */
    public function updateAll(): int
    {
        $count = 0;

        Company::where('verification_status', 'approved')
            ->chunk(100, function ($companies) use (&$count) {
                foreach ($companies as $company) {
                    $score = $this->calculateScore($company);
                    $company->update(['quality_score' => $score]);
                    $count++;
                }
            });

        // Atally求人のranking_scoreを品質スコア更新後に一括再計算
        DB::statement("
            UPDATE jobs
            SET ranking_score = 10000 + COALESCE(jobs.daily_budget, 0) * c.quality_score * c.hiring_reputation
            FROM companies c
            WHERE jobs.company_id = c.id
              AND jobs.source = 'atally'
        ");

        return $count;
    }

    /**
     * 1企業の品質スコアを計算する（1.0〜4.0）
     */
    public function calculateScore(Company $company): float
    {
        $usages = DailyUsage::where('company_id', $company->id)
            ->where('date', '>=', Carbon::today()->subDays(self::WINDOW_DAYS))
            ->orderBy('date')
            ->get();

        // データが十分にない新規企業はデフォルト 2.0（中間値）
        if ($usages->isEmpty()) {
            return 2.0;
        }

        // 各指標の7日間平均を取得
        $replyRate = $this->averageMetric($usages, 'reply_rate');
        $replySpeed = $this->averageMetric($usages, 'reply_speed_hours');
        $interviewRate = $this->averageMetric($usages, 'interview_setup_rate');
        $loginFrequency = $this->calculateLoginFrequency($usages);

        // 各指標を0.0〜1.0に正規化
        $normalizedReplyRate = $replyRate ?? 0.5;
        $normalizedReplySpeed = $this->normalizeReplySpeed($replySpeed);
        $normalizedInterviewRate = $interviewRate ?? 0.5;
        // ログイン頻度: 7日中何日ログインしたか
        $normalizedLoginFrequency = $loginFrequency;

        // 加重平均
        $weightedScore = ($normalizedReplyRate * self::WEIGHT_REPLY_RATE)
            + ($normalizedReplySpeed * self::WEIGHT_REPLY_SPEED)
            + ($normalizedInterviewRate * self::WEIGHT_INTERVIEW_SETUP_RATE)
            + ($normalizedLoginFrequency * self::WEIGHT_LOGIN_FREQUENCY);

        // 0.0〜1.0 を 1.0〜4.0 にスケーリング
        $score = self::MIN_SCORE + ($weightedScore * (self::MAX_SCORE - self::MIN_SCORE));

        return round(min(self::MAX_SCORE, max(self::MIN_SCORE, $score)), 4);
    }

    /**
     * 企業の日次メトリクスを記録する（RecordDailyUsageから呼ばれる）
     */
    public function recordMetrics(Company $company, string $date): array
    {
        $dateCarbon = Carbon::parse($date);
        $dayStart = $dateCarbon->copy()->startOfDay();
        $dayEnd = $dateCarbon->copy()->endOfDay();

        // この企業の全求人IDを取得
        $jobIds = $company->jobs()->pluck('id');

        if ($jobIds->isEmpty()) {
            return [
                'reply_rate' => null,
                'reply_speed_hours' => null,
                'interview_setup_rate' => null,
                'logged_in' => $this->hasLoggedIn($company, $dayStart, $dayEnd),
            ];
        }

        // その日までに受け取った応募（スカウト除く、直近30日以内の応募が対象）
        $recentApplications = Application::whereIn('job_id', $jobIds)
            ->where('type', 'application')
            ->where('created_at', '>=', $dayStart->copy()->subDays(30))
            ->where('created_at', '<=', $dayEnd)
            ->get();

        $replyRate = $this->calculateReplyRate($recentApplications, $company);
        $replySpeedHours = $this->calculateReplySpeed($recentApplications, $company);
        $interviewSetupRate = $this->calculateInterviewSetupRate($recentApplications);

        $loggedIn = $this->hasLoggedIn($company, $dayStart, $dayEnd);

        return [
            'reply_rate' => $replyRate,
            'reply_speed_hours' => $replySpeedHours,
            'interview_setup_rate' => $interviewSetupRate,
            'logged_in' => $loggedIn,
        ];
    }

    /**
     * 返信率: 応募に対して企業側からメッセージを送った割合
     */
    private function calculateReplyRate($applications, Company $company): ?float
    {
        if ($applications->isEmpty()) {
            return null;
        }

        $applicationIds = $applications->pluck('id');
        $companyUserIds = $company->teamMembers()->pluck('id')
            ->merge([$company->user_id]);

        // 企業側からの返信がある応募の数
        $repliedCount = Message::whereIn('application_id', $applicationIds)
            ->whereIn('sender_id', $companyUserIds)
            ->distinct('application_id')
            ->count('application_id');

        return $applications->count() > 0
            ? round($repliedCount / $applications->count(), 4)
            : null;
    }

    /**
     * 平均返信速度: 応募作成から企業側の最初のメッセージまでの時間（時間単位）
     */
    private function calculateReplySpeed($applications, Company $company): ?float
    {
        if ($applications->isEmpty()) {
            return null;
        }

        $companyUserIds = $company->teamMembers()->pluck('id')
            ->merge([$company->user_id]);

        $totalHours = 0;
        $count = 0;

        foreach ($applications as $application) {
            $firstReply = Message::where('application_id', $application->id)
                ->whereIn('sender_id', $companyUserIds)
                ->orderBy('created_at')
                ->first();

            if ($firstReply) {
                $hours = $application->created_at->diffInMinutes($firstReply->created_at) / 60;
                $totalHours += $hours;
                $count++;
            }
        }

        return $count > 0 ? round($totalHours / $count, 2) : null;
    }

    /**
     * 面接設定率: 応募に対して面接スケジュールが作成された割合
     */
    private function calculateInterviewSetupRate($applications): ?float
    {
        if ($applications->isEmpty()) {
            return null;
        }

        $applicationIds = $applications->pluck('id');

        $withInterview = InterviewSchedule::whereIn('application_id', $applicationIds)
            ->distinct('application_id')
            ->count('application_id');

        return round($withInterview / $applications->count(), 4);
    }

    /**
     * 指定期間に企業のメンバーがログインしたか
     */
    private function hasLoggedIn(Company $company, Carbon $start, Carbon $end): bool
    {
        return $company->teamMembers()
            ->whereBetween('last_login_at', [$start, $end])
            ->exists()
            || ($company->user && $company->user->last_login_at
                && $company->user->last_login_at->between($start, $end));
    }

    /**
     * DailyUsageコレクションから特定メトリクスの平均を計算
     */
    private function averageMetric($usages, string $column): ?float
    {
        $values = $usages->pluck($column)->filter(fn($v) => $v !== null);

        if ($values->isEmpty()) {
            return null;
        }

        return $values->avg();
    }

    /**
     * ログイン頻度を0.0〜1.0で返す（7日中何日ログインしたか）
     */
    private function calculateLoginFrequency($usages): float
    {
        $loggedInDays = $usages->where('logged_in', true)->count();
        return $loggedInDays / self::WINDOW_DAYS;
    }

    /**
     * 返信速度を0.0〜1.0に正規化
     * 2時間以内 = 1.0、72時間以上 = 0.0、間は線形補間
     */
    private function normalizeReplySpeed(?float $hours): float
    {
        if ($hours === null) {
            return 0.5; // データなしは中立
        }

        if ($hours <= self::REPLY_SPEED_EXCELLENT_HOURS) {
            return 1.0;
        }

        if ($hours >= self::REPLY_SPEED_WORST_HOURS) {
            return 0.0;
        }

        // 線形補間: 2h→1.0, 72h→0.0
        return 1.0 - (($hours - self::REPLY_SPEED_EXCELLENT_HOURS)
            / (self::REPLY_SPEED_WORST_HOURS - self::REPLY_SPEED_EXCELLENT_HOURS));
    }
}
