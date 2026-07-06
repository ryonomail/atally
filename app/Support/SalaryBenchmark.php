<?php

namespace App\Support;

use App\Models\Job;
use Illuminate\Support\Facades\Cache;

/**
 * 給与相場の分位統計（業種×都道府県×給与種別）。
 * 求人詳細ページ・企業フォーム・公開ツールで共用する共通レイヤ。
 *
 * ・組み合わせ単位で12時間キャッシュ（Googlebotが大量の求人ページを
 *   クロールしても、percentileの重いクエリは組み合わせ数しか走らない）。
 * ・都道府県の母数<20は全国へフォールバック、<5は available=false。
 */
class SalaryBenchmark
{
    public const MIN_PREF_SAMPLES = 20;
    public const MIN_SAMPLES      = 5;

    /** 表記ゆれの正規化（フォームは「年収」、実データは「年俸制」） */
    public static function normalizeSalaryType(string $salaryType): string
    {
        return ['年収' => '年俸制'][$salaryType] ?? $salaryType;
    }

    /**
     * 分位統計を返す（available, scope, count, p25, median, p75, salary_type）。
     * 12時間キャッシュ。industry / salary_type が空なら available=false。
     */
    public static function stats(?string $industry, ?string $prefecture, ?string $salaryType): array
    {
        $industry   = trim((string) $industry);
        $prefecture = trim((string) $prefecture);
        $salaryType = self::normalizeSalaryType(trim((string) $salaryType));

        if ($industry === '' || $salaryType === '') {
            return ['available' => false, 'reason' => 'insufficient_input'];
        }

        $key = 'sb_stats_' . md5($industry . '|' . $prefecture . '|' . $salaryType);

        return Cache::remember($key, 43200, function () use ($industry, $prefecture, $salaryType) {
            $build = function (bool $withPref) use ($industry, $prefecture, $salaryType) {
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
            $count = ($prefecture !== '') ? $build(true)->count() : 0;
            if ($count < self::MIN_PREF_SAMPLES) {
                $scope = 'nationwide';
                $count = $build(false)->count();
            }
            if ($count < self::MIN_SAMPLES) {
                return ['available' => false, 'reason' => 'too_few_samples', 'count' => $count];
            }

            $stats = $build($scope === 'prefecture')->selectRaw("
                percentile_cont(0.25) within group (order by salary_min) AS p25,
                percentile_cont(0.50) within group (order by salary_min) AS p50,
                percentile_cont(0.75) within group (order by salary_min) AS p75
            ")->first();

            return [
                'available'   => true,
                'scope'       => $scope,               // prefecture / nationwide
                'prefecture'  => $prefecture,
                'industry'    => $industry,
                'salary_type' => $salaryType,
                'count'       => $count,
                'p25'         => (int) round($stats->p25),
                'median'      => (int) round($stats->p50),
                'p75'         => (int) round($stats->p75),
            ];
        });
    }

    /**
     * 求人1件ぶんの「相場コンテキスト」を組み立てる（求人詳細ページ用・独自コンテンツ）。
     * per-jobのDBクエリは走らせない（統計キャッシュ＋算術のみ）。該当なしは null。
     */
    public static function contextForJob(Job $job): ?array
    {
        if (($job->salary_min ?? 0) <= 0) return null;

        $stats = self::stats($job->industry, $job->prefecture, $job->salary_type);
        if (!($stats['available'] ?? false)) return null;

        $salary = (int) $job->salary_min;
        $median = $stats['median'];
        $diffPct = $median > 0 ? (int) round(($salary - $median) / $median * 100) : 0;

        // 四分位で位置ラベルを決定（per-jobクエリなし）
        if ($salary >= $stats['p75'])      $position = 'top25';      // 上位25%
        elseif ($salary >= $median)        $position = 'above_median';
        elseif ($salary >= $stats['p25'])  $position = 'below_median';
        else                               $position = 'bottom25';   // 下位25%

        return [
            'scope'       => $stats['scope'],
            'area_label'  => $stats['scope'] === 'prefecture' ? $stats['prefecture'] : '全国',
            'industry'    => $stats['industry'],
            'salary_type' => $stats['salary_type'],
            'count'       => $stats['count'],
            'p25'         => $stats['p25'],
            'median'      => $median,
            'p75'         => $stats['p75'],
            'salary_min'  => $salary,
            'diff_pct'    => $diffPct,     // 中央値比 +N% / -N%
            'position'    => $position,
        ];
    }
}
