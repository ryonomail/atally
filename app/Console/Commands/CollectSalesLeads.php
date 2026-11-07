<?php

namespace App\Console\Commands;

use App\Services\SalesLeads\GooglePlacesClient;
use App\Services\SalesLeads\LeadExclusionFilter;
use App\Services\SalesLeads\SalesLeadCollector;
use App\Services\SalesLeads\WebsiteContactExtractor;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * 営業リード（不動産/人材/飲食/観光/中小企業）をGoogle Places APIから収集する。
 *
 * 全国47都道府県 × 対象業種 × キーワードのバリエーションを日ごとに少しずつローテーションし、
 * 1回の実行では --limit 件（デフォルト300件）の新規リードを保存した時点で終了する。
 * どこまで回したかは settings テーブルの 'sales_leads_cursor' に保存し、次回実行時に続きから回す。
 *
 * Web制作/マーケティング会社はキーワードで機械的に除外。SNSの直接スクレイピングは行わず、
 * 企業の公式サイトに掲載されているリンク/メールのみを転記する。
 */
class CollectSalesLeads extends Command
{
    protected $signature = 'app:collect-sales-leads {--limit=}';
    protected $description = '営業リード（不動産/人材/飲食/観光/中小企業）をGoogle Places APIから日次で収集する';

    private const CURSOR_KEY = 'sales_leads_cursor';

    public function handle(SalesLeadCollector $collector): int
    {
        $placesClient = app(GooglePlacesClient::class);
        if (!$placesClient->isConfigured()) {
            $this->warn('GOOGLE_PLACES_API_KEY が未設定のため収集をスキップしました。');
            return self::SUCCESS;
        }

        $limit = (int) ($this->option('limit') ?: config('sales_leads.daily_limit', 300));

        $industries = config('sales_leads.target_industries', []);
        $industryKeys = array_keys($industries);
        $prefectures = config('sales_leads.prefectures', []);

        if (empty($industryKeys) || empty($prefectures)) {
            $this->warn('sales_leads設定（業種/都道府県）が空です。');
            return self::SUCCESS;
        }

        $cursor = $this->loadCursor($industryKeys, $prefectures, $industries);

        $totalSaved = 0;
        $totalFound = 0;
        $totalExcluded = 0;
        $combosTried = 0;
        $maxCombos = $this->estimateMaxCombos($industries, $prefectures);

        while ($totalSaved < $limit && $combosTried < $maxCombos) {
            $industryKey = $industryKeys[$cursor['industry_index']];
            $industry = $industries[$industryKey];
            $queries = $industry['queries'] ?? [];
            if (empty($queries)) {
                $cursor = $this->advanceCursor($cursor, 1, $industryKeys, $prefectures);
                $combosTried++;
                continue;
            }

            $prefecture = $prefectures[$cursor['prefecture_index']];
            $query = $queries[$cursor['query_index'] % count($queries)];

            $remaining = $limit - $totalSaved;

            try {
                $stats = $collector->collectForQuery($industryKey, $query, $prefecture, $remaining);
            } catch (\Throwable $e) {
                Log::warning('[SalesLeads] collectForQuery failed: ' . $e->getMessage(), [
                    'industry' => $industryKey, 'prefecture' => $prefecture, 'query' => $query,
                ]);
                $stats = ['found' => 0, 'saved' => 0, 'excluded' => 0, 'duplicated' => 0];
            }

            $totalSaved += $stats['saved'];
            $totalFound += $stats['found'];
            $totalExcluded += $stats['excluded'];

            $this->line(sprintf(
                '[%s/%s] "%s" → 検出%d件 / 保存%d件 / 除外%d件 / 重複%d件',
                $industry['label'] ?? $industryKey,
                $prefecture,
                $query,
                $stats['found'],
                $stats['saved'],
                $stats['excluded'],
                $stats['duplicated'],
            ));

            $cursor = $this->advanceCursor($cursor, count($queries), $industryKeys, $prefectures);
            $combosTried++;
        }

        $this->saveCursor($cursor);

        $this->info("完了: 新規保存 {$totalSaved}件（検出{$totalFound}件・除外{$totalExcluded}件）");

        return self::SUCCESS;
    }

    private function estimateMaxCombos(array $industries, array $prefectures): int
    {
        $maxQueries = 1;
        foreach ($industries as $industry) {
            $maxQueries = max($maxQueries, count($industry['queries'] ?? []));
        }

        // 全業種×全都道府県×最大クエリ数 を1回フルに回っても止まるように上限を設ける
        return max(1, count($industries) * count($prefectures) * $maxQueries);
    }

    /**
     * @return array{industry_index:int, prefecture_index:int, query_index:int}
     */
    private function loadCursor(array $industryKeys, array $prefectures, array $industries): array
    {
        $raw = DB::table('settings')->where('key', self::CURSOR_KEY)->value('value');
        $cursor = $raw ? json_decode($raw, true) : null;

        if (!is_array($cursor)) {
            $cursor = ['industry_index' => 0, 'prefecture_index' => 0, 'query_index' => 0];
        }

        $cursor['industry_index'] = min(max((int) ($cursor['industry_index'] ?? 0), 0), max(count($industryKeys) - 1, 0));
        $cursor['prefecture_index'] = min(max((int) ($cursor['prefecture_index'] ?? 0), 0), max(count($prefectures) - 1, 0));
        $cursor['query_index'] = max((int) ($cursor['query_index'] ?? 0), 0);

        return $cursor;
    }

    private function advanceCursor(array $cursor, int $queryCountForCurrentIndustry, array $industryKeys, array $prefectures): array
    {
        $cursor['query_index']++;
        if ($cursor['query_index'] >= max($queryCountForCurrentIndustry, 1)) {
            $cursor['query_index'] = 0;
            $cursor['prefecture_index']++;
            if ($cursor['prefecture_index'] >= count($prefectures)) {
                $cursor['prefecture_index'] = 0;
                $cursor['industry_index'] = ($cursor['industry_index'] + 1) % max(count($industryKeys), 1);
            }
        }

        return $cursor;
    }

    private function saveCursor(array $cursor): void
    {
        DB::table('settings')->updateOrInsert(
            ['key' => self::CURSOR_KEY],
            ['value' => json_encode($cursor), 'updated_at' => now()],
        );
    }
}
