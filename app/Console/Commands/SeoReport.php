<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Google Search Console から検索パフォーマンスを取得し、SEOの「狙い目」を抽出してレポート化する。
 * サービスアカウントのJSONキーで認証（依存パッケージ不要・純PHPでJWTをRS256署名）。
 *
 * 出力:
 *   storage/app/seo/latest.json … 機械可読（朝の記事ルーチンが読む）
 *   storage/app/seo/seo-YYYY-MM-DD.md … 人間可読の要約
 *
 * 事前準備（オーナー）:
 *   1) Google Cloud で Search Console API を有効化 → サービスアカウント作成 → JSONキー発行
 *   2) Search Console → 設定 → ユーザーと権限 → サービスアカウントのメールを「制限付き」で追加
 *   3) JSONキーを GSC_KEY_PATH（既定 storage/app/gsc-service-account.json）に配置
 *   4) 必要なら .env に GSC_SITE_URL（既定 sc-domain:atally.io）
 */
class SeoReport extends Command
{
    protected $signature = 'app:seo-report {--days=28 : 集計期間（日）}';
    protected $description = 'Google Search Console の検索パフォーマンスを取得し、SEOの狙い目を抽出してレポート化';

    public function handle(): int
    {
        $keyPath = config('services.gsc.key_path');
        $siteUrl = config('services.gsc.site_url');

        if (!$keyPath || !is_file($keyPath)) {
            $this->warn("GSCサービスアカウントキーが見つかりません: {$keyPath}");
            $this->line('セットアップ後に再実行してください（このコマンドはスキップされました）。');
            return self::SUCCESS; // スケジューラを落とさない
        }

        $sa = json_decode((string) file_get_contents($keyPath), true);
        if (empty($sa['client_email']) || empty($sa['private_key'])) {
            $this->error('サービスアカウントJSONの形式が不正です（client_email / private_key が必要）。');
            return self::FAILURE;
        }

        $token = $this->fetchAccessToken($sa);
        if (!$token) {
            $this->error('アクセストークンの取得に失敗しました。');
            return self::FAILURE;
        }

        $days   = max(7, (int) $this->option('days'));
        // GSCのデータは2〜3日遅延するため、終端を3日前に置く
        $end    = Carbon::today()->subDays(3);
        $start  = $end->copy()->subDays($days - 1);
        $pvEnd  = $start->copy()->subDay();
        $pvStart = $pvEnd->copy()->subDays($days - 1);
        $fmt = fn(Carbon $d) => $d->format('Y-m-d');

        $enc = rawurlencode($siteUrl);
        $base = "https://searchconsole.googleapis.com/webmasters/v3/sites/{$enc}";

        $query = fn(array $body) => Http::withToken($token)
            ->post("{$base}/searchAnalytics/query", $body)->json() ?? [];

        // 期間合計（今期・前期）
        $curTotals = $query(['startDate' => $fmt($start), 'endDate' => $fmt($end)]);
        $prevTotals = $query(['startDate' => $fmt($pvStart), 'endDate' => $fmt($pvEnd)]);
        $sumRow = fn($r) => (($r['rows'][0] ?? null) ?: ['clicks' => 0, 'impressions' => 0, 'ctr' => 0, 'position' => 0]);
        $cur = $sumRow($curTotals);
        $prev = $sumRow($prevTotals);

        // クエリ別・ページ別
        $byQuery = $query(['startDate' => $fmt($start), 'endDate' => $fmt($end), 'dimensions' => ['query'], 'rowLimit' => 1000])['rows'] ?? [];
        $byPage  = $query(['startDate' => $fmt($start), 'endDate' => $fmt($end), 'dimensions' => ['page'], 'rowLimit' => 1000])['rows'] ?? [];

        // 狙い目①: あと一歩で1ページ目（順位5〜20・表示20以上）
        $strike = collect($byQuery)
            ->filter(fn($r) => ($r['position'] ?? 99) >= 5 && ($r['position'] ?? 99) <= 20 && ($r['impressions'] ?? 0) >= 20)
            ->sortByDesc('impressions')->take(30)->values();

        // 狙い目②: 上位なのにクリックされない（順位10以内・CTR<3%・表示50以上）＝タイトル/説明改善
        $lowCtr = collect($byQuery)
            ->filter(fn($r) => ($r['position'] ?? 99) <= 10 && ($r['ctr'] ?? 1) < 0.03 && ($r['impressions'] ?? 0) >= 50)
            ->sortByDesc('impressions')->take(20)->values();

        // 表示の多いページ（改善優先度の参考）
        $topPages = collect($byPage)->sortByDesc('impressions')->take(20)->values();

        // サイトマップ状況（インデックスの進み具合）
        $sitemaps = Http::withToken($token)->get("{$base}/sitemaps")->json()['sitemap'] ?? [];

        $report = [
            'generated_at' => now()->toDateTimeString(),
            'site'         => $siteUrl,
            'period'       => ['start' => $fmt($start), 'end' => $fmt($end), 'days' => $days],
            'totals'       => [
                'clicks'       => round($cur['clicks'] ?? 0),
                'impressions'  => round($cur['impressions'] ?? 0),
                'ctr'          => round(($cur['ctr'] ?? 0) * 100, 2),
                'position'     => round($cur['position'] ?? 0, 1),
                'prev_clicks'      => round($prev['clicks'] ?? 0),
                'prev_impressions' => round($prev['impressions'] ?? 0),
                'clicks_delta'     => round(($cur['clicks'] ?? 0) - ($prev['clicks'] ?? 0)),
                'impr_delta'       => round(($cur['impressions'] ?? 0) - ($prev['impressions'] ?? 0)),
            ],
            'strike_zone'  => $strike->map(fn($r) => $this->row($r))->all(),
            'low_ctr'      => $lowCtr->map(fn($r) => $this->row($r))->all(),
            'top_pages'    => $topPages->map(fn($r) => $this->row($r, 'page'))->all(),
            'sitemaps'     => collect($sitemaps)->map(fn($s) => [
                'path'      => $s['path'] ?? '',
                'submitted' => $s['contents'][0]['submitted'] ?? null,
                'indexed'   => $s['contents'][0]['indexed'] ?? null,
                'errors'    => $s['errors'] ?? 0,
                'warnings'  => $s['warnings'] ?? 0,
            ])->all(),
        ];

        Storage::put('seo/latest.json', json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        Storage::put('seo/seo-' . now()->format('Y-m-d') . '.md', $this->toMarkdown($report));

        $t = $report['totals'];
        $this->info("SEOレポート生成: 期間 {$report['period']['start']}〜{$report['period']['end']}");
        $this->line(sprintf(
            'クリック %d（前期比 %+d） / 表示 %d（%+d） / 平均CTR %s%% / 平均順位 %s',
            $t['clicks'], $t['clicks_delta'], $t['impressions'], $t['impr_delta'], $t['ctr'], $t['position']
        ));
        $this->line('狙い目クエリ（あと一歩）: ' . $strike->count() . '件 / CTR改善: ' . $lowCtr->count() . '件');
        Log::info('seo-report generated', ['totals' => $t, 'strike' => $strike->count(), 'low_ctr' => $lowCtr->count()]);

        return self::SUCCESS;
    }

    private function row(array $r, string $keyLabel = 'query'): array
    {
        return [
            $keyLabel     => $r['keys'][0] ?? '',
            'clicks'      => (int) round($r['clicks'] ?? 0),
            'impressions' => (int) round($r['impressions'] ?? 0),
            'ctr'         => round(($r['ctr'] ?? 0) * 100, 2),
            'position'    => round($r['position'] ?? 0, 1),
        ];
    }

    /** サービスアカウントのJWTでアクセストークンを取得（RS256・依存なし） */
    private function fetchAccessToken(array $sa): ?string
    {
        $now = time();
        $b64 = fn($d) => rtrim(strtr(base64_encode($d), '+/', '-_'), '=');
        $header = $b64(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $claim  = $b64(json_encode([
            'iss'   => $sa['client_email'],
            'scope' => 'https://www.googleapis.com/auth/webmasters.readonly',
            'aud'   => 'https://oauth2.googleapis.com/token',
            'iat'   => $now,
            'exp'   => $now + 3600,
        ]));
        $signingInput = "{$header}.{$claim}";
        $signature = '';
        if (!openssl_sign($signingInput, $signature, $sa['private_key'], OPENSSL_ALGO_SHA256)) {
            return null;
        }
        $jwt = "{$signingInput}." . $b64($signature);

        $res = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]);

        return $res->successful() ? ($res->json()['access_token'] ?? null) : null;
    }

    private function toMarkdown(array $r): string
    {
        $t = $r['totals'];
        $md  = "# SEOレポート {$r['period']['start']}〜{$r['period']['end']}（{$r['site']}）\n\n";
        $md .= "## サマリー\n";
        $md .= "- クリック: {$t['clicks']}（前期比 " . sprintf('%+d', $t['clicks_delta']) . "）\n";
        $md .= "- 表示回数: {$t['impressions']}（前期比 " . sprintf('%+d', $t['impr_delta']) . "）\n";
        $md .= "- 平均CTR: {$t['ctr']}% / 平均順位: {$t['position']}\n\n";

        $md .= "## 狙い目クエリ（順位5〜20＝あと一歩で1ページ目）\n";
        $md .= "| クエリ | 表示 | クリック | CTR% | 順位 |\n|---|---|---|---|---|\n";
        foreach ($r['strike_zone'] as $x) {
            $md .= "| {$x['query']} | {$x['impressions']} | {$x['clicks']} | {$x['ctr']} | {$x['position']} |\n";
        }
        $md .= "\n## CTR改善（上位なのにクリックされない＝タイトル/説明を改善）\n";
        $md .= "| クエリ | 表示 | CTR% | 順位 |\n|---|---|---|---|\n";
        foreach ($r['low_ctr'] as $x) {
            $md .= "| {$x['query']} | {$x['impressions']} | {$x['ctr']} | {$x['position']} |\n";
        }
        $md .= "\n## サイトマップ（インデックス進捗）\n";
        foreach ($r['sitemaps'] as $s) {
            $md .= "- {$s['path']}: 送信 {$s['submitted']} / インデックス {$s['indexed']} / エラー {$s['errors']}\n";
        }
        return $md;
    }
}
