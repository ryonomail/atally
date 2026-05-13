<?php

namespace App\Console\Commands;

use App\Services\HelloWorkService;
use Illuminate\Console\Command;
use ReflectionClass;

class PreviewHelloWorkJob extends Command
{
    protected $signature = 'app:preview-hellowork-job';
    protected $description = 'ハローワーク求人を1件取得して整形後の内容を表示する（テスト用）';

    public function handle(HelloWorkService $service): int
    {
        $this->info('APIに接続中...');

        $ref = new ReflectionClass($service);

        $getToken = $ref->getMethod('getToken');
        $getToken->setAccessible(true);
        $token = $getToken->invoke($service);

        if (!$token) {
            $this->error('トークン取得に失敗しました。API認証情報を確認してください。');
            return self::FAILURE;
        }

        $this->info('求人を1件取得中...');

        $fetchPage = $ref->getMethod('fetchJobPage');
        $fetchPage->setAccessible(true);
        $jobs = $fetchPage->invoke($service, $token, 'M100', 1);

        if (empty($jobs)) {
            $this->error('求人データが取得できませんでした。');
            return self::FAILURE;
        }

        $job = $jobs[0];

        $this->newLine();
        $this->line(str_repeat('=', 60));
        $this->line('【タイトル】');
        $this->line($job['title'] ?? '（なし）');

        $this->newLine();
        $this->line('【雇用形態】');
        $this->line($job['employment_type'] ?? '（なし）');

        $this->newLine();
        $this->line('【勤務地】');
        $this->line($job['location'] ?? '（なし）');

        $this->newLine();
        $this->line('【給与】');
        $min = $job['salary_min'] ?? null;
        $max = $job['salary_max'] ?? null;
        $type = $job['salary_type'] ?? '';
        if ($min || $max) {
            $this->line(implode('〜', array_filter([$min, $max])) . '円 / ' . $type);
        } else {
            $this->line('（なし）');
        }

        $this->newLine();
        $this->line('【就業時間】');
        $this->line($job['work_hours'] ?? '（なし）');

        $this->newLine();
        $this->line('【休日】');
        $this->line($job['holidays'] ?? '（なし）');

        $this->newLine();
        $this->line('【募集人数】');
        $this->line(isset($job['positions_available']) ? $job['positions_available'] . '名' : '（なし）');

        $this->newLine();
        $this->line('【年齢条件】');
        $ageMin = $job['age_min'] ?? null;
        $ageMax = $job['age_max'] ?? null;
        if ($ageMin || $ageMax) {
            $this->line(implode('〜', array_filter([$ageMin, $ageMax])) . '歳');
        } else {
            $this->line('（なし）');
        }

        $this->newLine();
        $this->line('【特徴タグ】');
        $tags = $job['feature_tags'] ?? [];
        $this->line($tags ? implode('、', $tags) : '（なし）');

        $this->newLine();
        $this->line('【求人内容（整形後）】');
        $this->line(str_repeat('-', 60));
        $this->line($job['description'] ?? '（なし）');
        $this->line(str_repeat('=', 60));
        $this->newLine();

        return self::SUCCESS;
    }
}
