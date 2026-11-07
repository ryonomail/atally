<?php

namespace App\Services\SalesLeads;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * 企業の公式サイト（Google Placesが返す websiteUri）だけを対象に、
 * そこに企業自身が公開しているメールアドレス・SNSリンクを読み取るクローラー。
 *
 * Instagram/Facebook/TikTok 等のSNSプラットフォームへは一切アクセスしない
 * （利用規約上スクレイピングが禁止されているため）。あくまで企業公式サイトに
 * 載っている「自己紹介用のリンク」を転記するだけ。
 */
class WebsiteContactExtractor
{
    private const SNS_HOSTS = [
        'instagram_url' => 'instagram.com',
        'facebook_url' => 'facebook.com',
        'tiktok_url' => 'tiktok.com',
    ];

    // 見慣れたプレースホルダ/サービス用メールは除外（お問い合わせフォームのCDN等が混ざるため）
    private const IGNORED_EMAIL_DOMAINS = [
        'example.com', 'sentry.io', 'wixpress.com', 'godaddy.com',
        'domainsbyproxy.com', 'w3.org', 'schema.org',
    ];

    private int $timeout;
    private string $userAgent;

    public function __construct()
    {
        $this->timeout = (int) config('sales_leads.website_fetch_timeout_sec', 8);
        $this->userAgent = config('sales_leads.crawler_user_agent', 'AtallySalesLeadBot/1.0');
    }

    /**
     * @return array{email: ?string, instagram_url: ?string, facebook_url: ?string, tiktok_url: ?string}
     */
    public function extract(string $websiteUrl): array
    {
        $result = ['email' => null, 'instagram_url' => null, 'facebook_url' => null, 'tiktok_url' => null];

        $websiteUrl = $this->normalizeUrl($websiteUrl);
        if (!$websiteUrl) {
            return $result;
        }

        if (!$this->isAllowedByRobots($websiteUrl)) {
            return $result;
        }

        $homepageHtml = $this->fetch($websiteUrl);
        if ($homepageHtml === null) {
            return $result;
        }

        $this->mergeFindings($result, $homepageHtml, $websiteUrl);

        // ホームページで見つからなかった項目があれば、「お問い合わせ/会社概要」リンクを1つだけ追って再確認
        if (!$result['email'] || !$result['instagram_url'] || !$result['facebook_url'] || !$result['tiktok_url']) {
            $subPageUrl = $this->findContactPageLink($homepageHtml, $websiteUrl);
            if ($subPageUrl) {
                $subHtml = $this->fetch($subPageUrl);
                if ($subHtml !== null) {
                    $this->mergeFindings($result, $subHtml, $subPageUrl);
                }
            }
        }

        return $result;
    }

    private function mergeFindings(array &$result, string $html, string $pageUrl): void
    {
        if (!$result['email']) {
            $result['email'] = $this->extractEmail($html);
        }
        foreach (self::SNS_HOSTS as $field => $host) {
            if (!$result[$field]) {
                $result[$field] = $this->extractSnsLink($html, $host);
            }
        }
    }

    private function normalizeUrl(?string $url): ?string
    {
        if (!$url) {
            return null;
        }
        $url = trim($url);
        if (!preg_match('#^https?://#i', $url)) {
            $url = 'https://' . $url;
        }

        return filter_var($url, FILTER_VALIDATE_URL) ? $url : null;
    }

    private function isAllowedByRobots(string $url): bool
    {
        $parts = parse_url($url);
        if (!$parts || empty($parts['host'])) {
            return true;
        }

        $robotsUrl = ($parts['scheme'] ?? 'https') . '://' . $parts['host'] . '/robots.txt';

        try {
            $response = Http::withHeaders(['User-Agent' => $this->userAgent])
                ->timeout($this->timeout)
                ->get($robotsUrl);

            if (!$response->successful()) {
                return true; // robots.txtが無い/取得できない場合はトップページ取得のみ許可
            }

            $disallowedAll = false;
            foreach (preg_split('/\r\n|\r|\n/', $response->body()) as $line) {
                $line = trim($line);
                if (stripos($line, 'User-agent:') === 0) {
                    $agent = trim(substr($line, strlen('User-agent:')));
                    $disallowedAll = ($agent === '*');
                } elseif ($disallowedAll && stripos($line, 'Disallow:') === 0) {
                    $path = trim(substr($line, strlen('Disallow:')));
                    if ($path === '/') {
                        return false;
                    }
                }
            }

            return true;
        } catch (\Throwable $e) {
            return true;
        }
    }

    private function fetch(string $url): ?string
    {
        try {
            $response = Http::withHeaders(['User-Agent' => $this->userAgent])
                ->timeout($this->timeout)
                ->get($url);

            return $response->successful() ? $response->body() : null;
        } catch (\Throwable $e) {
            Log::debug('[SalesLeads] website fetch failed: ' . $e->getMessage());
            return null;
        }
    }

    private function extractEmail(string $html): ?string
    {
        // 1) mailto: リンクを優先
        if (preg_match('/mailto:([^"\'\s?>]+)/i', $html, $m)) {
            $email = $m[1];
            if ($this->isUsableEmail($email)) {
                return $email;
            }
        }

        // 2) 本文中のメールらしき文字列
        if (preg_match_all('/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/', $html, $matches)) {
            foreach ($matches[0] as $candidate) {
                if ($this->isUsableEmail($candidate)) {
                    return $candidate;
                }
            }
        }

        return null;
    }

    private function isUsableEmail(string $email): bool
    {
        $domain = strtolower(substr($email, strpos($email, '@') + 1));
        foreach (self::IGNORED_EMAIL_DOMAINS as $ignored) {
            if ($domain === $ignored || str_ends_with($domain, '.' . $ignored)) {
                return false;
            }
        }

        return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
    }

    private function extractSnsLink(string $html, string $host): ?string
    {
        $pattern = '#href=["\']((?:https?:)?//(?:www\.)?' . preg_quote($host, '#') . '/[^"\'\s]+)["\']#i';
        if (!preg_match_all($pattern, $html, $matches)) {
            return null;
        }

        foreach ($matches[1] as $url) {
            // 「シェアボタン」や汎用トップページへのリンクはノイズなので除外
            if (preg_match('#/(sharer|share|intent|plugins)/#i', $url)) {
                continue;
            }
            if (!str_starts_with($url, 'http')) {
                $url = 'https:' . $url;
            }
            // クエリパラメータ（トラッキング等）は落として正規化
            return strtok($url, '?');
        }

        return null;
    }

    private function findContactPageLink(string $html, string $baseUrl): ?string
    {
        $keywords = ['お問い合わせ', 'contact', '会社概要', 'about', 'company'];

        if (!preg_match_all('#<a\s[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>#is', $html, $matches, PREG_SET_ORDER)) {
            return null;
        }

        foreach ($matches as $match) {
            $href = $match[1];
            $text = strip_tags($match[2]);
            foreach ($keywords as $keyword) {
                if (mb_stripos($text, $keyword) !== false || mb_stripos($href, $keyword) !== false) {
                    return $this->resolveUrl($href, $baseUrl);
                }
            }
        }

        return null;
    }

    private function resolveUrl(string $href, string $baseUrl): ?string
    {
        if (preg_match('#^https?://#i', $href)) {
            return $href;
        }
        $base = parse_url($baseUrl);
        if (!$base) {
            return null;
        }
        $scheme = $base['scheme'] ?? 'https';
        $host = $base['host'] ?? null;
        if (!$host) {
            return null;
        }
        if (str_starts_with($href, '/')) {
            return "{$scheme}://{$host}{$href}";
        }

        return rtrim($baseUrl, '/') . '/' . $href;
    }
}
