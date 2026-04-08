<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * 不審なリクエスト（ボット・スクレイパー）をブロックするミドルウェア
 */
class BlockSuspiciousRequests
{
    /**
     * robots.txt を無視する悪質クローラーのUser-Agent
     */
    private const BLOCKED_USER_AGENTS = [
        'AhrefsBot',
        'SemrushBot',
        'MJ12bot',
        'DotBot',
        'BLEXBot',
        'DataForSeoBot',
        'GPTBot',
        'CCBot',
        'ClaudeBot',
        'anthropic-ai',
        'bytespider',
        'PetalBot',
        'Sogou',
        'YandexBot',
        'Go-http-client',
        'python-requests',
        'Scrapy',
        'curl/',
        'wget/',
        'HttpClient',
        'Java/',
        'libwww-perl',
        'lwp-trivial',
    ];

    /**
     * 短時間の大量リクエストを検知するための設定
     */
    private const BURST_WINDOW_SECONDS = 60;
    private const BURST_LIMIT = 60; // 1分間に60リクエストまで（公開API）
    private const BAN_DURATION_MINUTES = 15;

    public function handle(Request $request, Closure $next): Response
    {
        $ip = $request->ip();

        // 一時BANチェック
        if (Cache::has("banned_ip:{$ip}")) {
            return response()->json(['message' => 'Too Many Requests'], 429);
        }

        // User-Agentチェック
        $userAgent = $request->userAgent() ?? '';
        if ($this->isBlockedUserAgent($userAgent)) {
            Log::warning('Blocked bot access', [
                'ip' => $ip,
                'user_agent' => $userAgent,
                'url' => $request->fullUrl(),
            ]);
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // User-Agentが空のリクエストをブロック（正規ブラウザは必ずUAを送る）
        if (empty($userAgent)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // バースト検知（IP単位の短時間大量リクエスト）
        if ($this->detectBurst($ip)) {
            Cache::put("banned_ip:{$ip}", true, now()->addMinutes(self::BAN_DURATION_MINUTES));
            Log::warning('IP temporarily banned for burst requests', [
                'ip' => $ip,
                'user_agent' => $userAgent,
            ]);
            return response()->json([
                'message' => 'リクエスト数が上限を超えました。しばらくしてから再度お試しください。',
            ], 429);
        }

        $response = $next($request);

        // セキュリティヘッダー追加
        $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        return $response;
    }

    private function isBlockedUserAgent(string $userAgent): bool
    {
        foreach (self::BLOCKED_USER_AGENTS as $blocked) {
            if (stripos($userAgent, $blocked) !== false) {
                return true;
            }
        }
        return false;
    }

    private function detectBurst(string $ip): bool
    {
        $key = "api_burst:{$ip}";
        $hits = Cache::get($key, 0);

        if ($hits >= self::BURST_LIMIT) {
            return true;
        }

        Cache::put($key, $hits + 1, now()->addSeconds(self::BURST_WINDOW_SECONDS));
        return false;
    }
}
