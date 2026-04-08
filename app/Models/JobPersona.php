<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobPersona extends Model
{
    protected $fillable = [
        'job_id',
        'age_min',
        'age_max',
        'experience_min',
        'experience_max',
        'target_skills',
        'target_locations',
        'target_job_types',
        'target_employment_status',
        'target_education',
        'boost_factor',
        // 拡張フィールド
        'target_industries',
        'target_salary_min',
        'target_salary_max',
        'target_languages',
        'target_certifications',
        'target_management_experience',
        'target_company_sizes',
        'max_company_changes',
        'personality_traits',
        'priority_conditions',
        'ng_conditions',
        'ideal_candidate_description',
    ];

    protected function casts(): array
    {
        return [
            'age_min' => 'integer',
            'age_max' => 'integer',
            'experience_min' => 'integer',
            'experience_max' => 'integer',
            'target_skills' => 'array',
            'target_locations' => 'array',
            'target_job_types' => 'array',
            'target_industries' => 'array',
            'target_languages' => 'array',
            'target_certifications' => 'array',
            'target_company_sizes' => 'array',
            'personality_traits' => 'array',
            'priority_conditions' => 'array',
            'target_salary_min' => 'integer',
            'target_salary_max' => 'integer',
            'max_company_changes' => 'integer',
            'boost_factor' => 'decimal:1',
        ];
    }

    public function job()
    {
        return $this->belongsTo(Job::class);
    }

    /**
     * 求職者プロフィールとのマッチスコアを計算（0.0〜1.0）
     */
    public function calculateMatchScore(?UserProfile $profile): float
    {
        if (!$profile) return 0.0;

        $scores = [];
        $weights = [];

        // スキルマッチ
        if (!empty($this->target_skills) && !empty($profile->skills)) {
            $profileSkills = array_map('mb_strtolower', $profile->skills);
            $targetSkills = array_map('mb_strtolower', $this->target_skills);
            $matched = count(array_intersect($profileSkills, $targetSkills));
            $total = count($targetSkills);
            $scores[] = $total > 0 ? $matched / $total : 0;
            $weights[] = 3; // スキルは重要度高
        }

        // 年齢マッチ
        if (($this->age_min || $this->age_max) && $profile->birth_date) {
            $age = now()->diffInYears($profile->birth_date);
            $inRange = true;
            if ($this->age_min && $age < $this->age_min) $inRange = false;
            if ($this->age_max && $age > $this->age_max) $inRange = false;
            $scores[] = $inRange ? 1.0 : 0.2;
            $weights[] = 1;
        }

        // 勤務地マッチ
        if (!empty($this->target_locations) && $profile->address) {
            $locationMatch = false;
            foreach ($this->target_locations as $loc) {
                if (str_contains($profile->address, $loc)) {
                    $locationMatch = true;
                    break;
                }
            }
            $scores[] = $locationMatch ? 1.0 : 0.3;
            $weights[] = 1;
        }

        // 経験年数マッチ
        if (($this->experience_min || $this->experience_max) && !empty($profile->work_history)) {
            $totalYears = 0;
            foreach ($profile->work_history as $wh) {
                $start = $wh['start'] ?? null;
                $end = $wh['end'] ?? date('Y-m');
                if ($start) {
                    $totalYears += max(0, (strtotime($end) - strtotime($start)) / (365.25 * 24 * 3600));
                }
            }
            $inRange = true;
            if ($this->experience_min && $totalYears < $this->experience_min) $inRange = false;
            if ($this->experience_max && $totalYears > $this->experience_max) $inRange = false;
            $scores[] = $inRange ? 1.0 : 0.3;
            $weights[] = 2;
        }

        // 業界マッチ
        if (!empty($this->target_industries) && !empty($profile->work_history)) {
            $profileIndustries = array_filter(array_map(fn($wh) => $wh['industry'] ?? null, $profile->work_history));
            if (!empty($profileIndustries)) {
                $matched = count(array_intersect($profileIndustries, $this->target_industries));
                $scores[] = $matched > 0 ? 1.0 : 0.2;
                $weights[] = 2;
            }
        }

        // 語学マッチ
        if (!empty($this->target_languages) && !empty($profile->languages)) {
            $profileLangs = array_map('mb_strtolower', array_column($profile->languages, 'language'));
            $targetLangs = array_map('mb_strtolower', array_column($this->target_languages, 'language'));
            $matched = count(array_intersect($profileLangs, $targetLangs));
            $scores[] = count($targetLangs) > 0 ? min(1.0, $matched / count($targetLangs)) : 0;
            $weights[] = 1;
        }

        if (empty($scores)) return 0.5; // 条件未設定なら中立

        $weightedSum = 0;
        $weightTotal = 0;
        foreach ($scores as $i => $s) {
            $weightedSum += $s * $weights[$i];
            $weightTotal += $weights[$i];
        }

        return $weightTotal > 0 ? $weightedSum / $weightTotal : 0.5;
    }
}
