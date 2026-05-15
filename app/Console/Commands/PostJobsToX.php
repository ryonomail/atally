<?php

namespace App\Console\Commands;

use App\Models\Job;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * 新着求人をX（旧Twitter）に自動投稿する
 * 必要な環境変数: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
 */
class PostJobsToX extends Command
{
    protected $signature = 'app:post-jobs-to-x {--limit=5 : 1回の実行で投稿する最大件数}';
    protected $description = '新着求人をX（旧Twitter）に自動投稿する（毎朝10時実行）';

    public function handle(): int
    {
        $apiKey       = config('services.x.api_key');
        $apiSecret    = config('services.x.api_secret');
        $accessToken  = config('services.x.access_token');
        $accessSecret = config('services.x.access_token_secret');

        if (!$apiKey || !$apiSecret || !$accessToken || !$accessSecret) {
            $this->warn('X API 認証情報が未設定です。X_API_KEY 等の環境変数を設定してください。');
            return self::SUCCESS;
        }

        $limit = (int) $this->option('limit');
        $since = now()->subDay();

        // 未投稿の新着求人を取得（x_posted_at が null）
        $jobs = Job::where('status', 'active')
            ->whereNull('x_posted_at')
            ->where('created_at', '>=', $since)
            ->whereNotNull('title')
            ->with('company:id,company_name')
            ->orderByDesc('daily_budget')
            ->limit($limit)
            ->get();

        if ($jobs->isEmpty()) {
            $this->info('投稿する新着求人はありません。');
            return self::SUCCESS;
        }

        $posted = 0;
        foreach ($jobs as $job) {
            $text = $this->buildTweet($job);
            $result = $this->postToX($text, $apiKey, $apiSecret, $accessToken, $accessSecret);

            if ($result) {
                $job->update(['x_posted_at' => now()]);
                $posted++;
                $this->info("投稿: {$job->title}");
                // レート制限対策: 投稿間隔を空ける
                if ($posted < $jobs->count()) sleep(2);
            } else {
                $this->warn("投稿失敗: {$job->title}");
            }
        }

        $this->info("X投稿完了: {$posted}件");
        return self::SUCCESS;
    }

    private function buildTweet(Job $job): string
    {
        $title     = mb_substr($job->title ?? '', 0, 40);
        $pref      = $job->prefecture ?? $job->location ?? '';
        $empType   = $job->employment_type ?? '';
        $url       = config('app.url') . '/jobs/' . $job->id;

        // 給与テキスト
        $salaryText = '';
        if ($job->salary_min || $job->salary_max) {
            $type  = $job->salary_type ?? '';
            $small = in_array($type, ['時給', '日給']);
            $fmt   = fn($v) => $v ? ($small || $v < 100000 ? number_format((int)$v) . '円' : round($v / 10000) . '万円') : null;
            $range = $job->salary_min && $job->salary_max
                ? $fmt($job->salary_min) . '〜' . $fmt($job->salary_max)
                : ($job->salary_min ? $fmt($job->salary_min) . '〜' : '〜' . $fmt($job->salary_max));
            $salaryText = "\n💴 " . ($type ? "{$type} " : '') . $range;
        }

        // ハッシュタグ
        $tags = array_filter(['#求人', '#転職', $pref ? "#{$pref}" : '', $empType ? "#{$empType}" : '']);
        $hashtags = implode(' ', array_slice($tags, 0, 4));

        return "【新着求人】{$title}\n"
            . ($pref ? "📍 {$pref}" : '')
            . ($empType ? " / {$empType}" : '') . "\n"
            . $salaryText . "\n"
            . "🔗 {$url}\n"
            . $hashtags;
    }

    private function postToX(string $text, string $apiKey, string $apiSecret, string $accessToken, string $accessSecret): bool
    {
        $url    = 'https://api.twitter.com/2/tweets';
        $body   = json_encode(['text' => $text]);
        $nonce  = bin2hex(random_bytes(16));
        $ts     = time();

        $oauthParams = [
            'oauth_consumer_key'     => $apiKey,
            'oauth_nonce'            => $nonce,
            'oauth_signature_method' => 'HMAC-SHA1',
            'oauth_timestamp'        => $ts,
            'oauth_token'            => $accessToken,
            'oauth_version'          => '1.0',
        ];

        $baseString = 'POST&' . rawurlencode($url) . '&' . rawurlencode($this->buildParamString($oauthParams));
        $signingKey = rawurlencode($apiSecret) . '&' . rawurlencode($accessSecret);
        $oauthParams['oauth_signature'] = base64_encode(hash_hmac('sha1', $baseString, $signingKey, true));

        $authHeader = 'OAuth ' . implode(', ', array_map(
            fn($k, $v) => rawurlencode($k) . '="' . rawurlencode($v) . '"',
            array_keys($oauthParams), $oauthParams
        ));

        $ctx = stream_context_create([
            'http' => [
                'method'  => 'POST',
                'header'  => "Authorization: {$authHeader}\r\nContent-Type: application/json\r\nContent-Length: " . strlen($body),
                'content' => $body,
                'timeout' => 10,
                'ignore_errors' => true,
            ],
        ]);

        try {
            $response = @file_get_contents($url, false, $ctx);
            $statusLine = $http_response_header[0] ?? '';
            $statusCode = (int) preg_replace('/HTTP\/\S+ (\d+).*/', '$1', $statusLine);

            if ($statusCode === 201) return true;
            Log::warning('X post failed', ['status' => $statusCode, 'response' => $response]);
            return false;
        } catch (\Throwable $e) {
            Log::error('X post exception', ['error' => $e->getMessage()]);
            return false;
        }
    }

    private function buildParamString(array $params): string
    {
        ksort($params);
        return implode('&', array_map(
            fn($k, $v) => rawurlencode($k) . '=' . rawurlencode($v),
            array_keys($params), $params
        ));
    }
}
