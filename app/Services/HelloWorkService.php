<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Job;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * ハローワーク求人 API 連携サービス
 *
 * API仕様: XML-based POST, トークンは当日のみ有効
 * メンテナンス: 毎日 0:00-6:00, 月末 21:30-6:00
 */
class HelloWorkService
{
    private string $baseUrl;
    private string $apiId;
    private string $apiPass;

    /** ハローワーク求人を格納する会社のID（専用ダミー企業） */
    private ?int $companyId = null;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.hellowork.base_url', ''), '/');
        $this->apiId   = config('services.hellowork.id', '');
        $this->apiPass = config('services.hellowork.pass', '');
    }

    // ----------------------------------------------------------------
    // Public entry point
    // ----------------------------------------------------------------

    /**
     * 全国一般求人を同期する（メインコマンドから呼ぶ）
     *
     * @return array{inserted:int, updated:int, deleted:int, errors:int}
     */
    public function sync(string $dataId = 'M100'): array
    {
        $token = $this->getToken();
        if (!$token) {
            return ['inserted' => 0, 'updated' => 0, 'deleted' => 0, 'errors' => 1];
        }

        $stats = ['inserted' => 0, 'updated' => 0, 'deleted' => 0, 'errors' => 0];

        try {
            $this->companyId = $this->getOrCreateHelloWorkCompany();

            // ページネーションしながら全件取得
            $page = 1;
            $activeIds = [];

            while (true) {
                $jobs = $this->fetchJobPage($token, $dataId, $page);
                if (empty($jobs)) {
                    break;
                }

                foreach ($jobs as $jobData) {
                    try {
                        $result = $this->upsertJob($jobData);
                        $stats[$result]++;
                        if ($jobData['hellowork_id']) {
                            $activeIds[] = $jobData['hellowork_id'];
                        }
                    } catch (\Throwable $e) {
                        Log::error('HelloWork: upsert failed', [
                            'id'    => $jobData['hellowork_id'] ?? null,
                            'error' => $e->getMessage(),
                        ]);
                        $stats['errors']++;
                    }
                }

                $page++;
            }

            // APIに存在しなくなった求人を非公開に
            if (!empty($activeIds)) {
                $deleted = Job::where('source', 'hellowork')
                    ->whereNotIn('hellowork_id', $activeIds)
                    ->where('status', 'active')
                    ->update(['status' => 'closed']);
                $stats['deleted'] = $deleted;
            }
        } finally {
            $this->deleteToken($token);
        }

        return $stats;
    }

    // ----------------------------------------------------------------
    // Token management
    // ----------------------------------------------------------------

    private function getToken(): ?string
    {
        if (empty($this->baseUrl) || empty($this->apiId) || empty($this->apiPass)) {
            Log::error('HelloWork: API credentials not configured (HELLOWORK_BASE_URL / HELLOWORK_ID / HELLOWORK_PASS)');
            return null;
        }

        try {
            $url = "{$this->baseUrl}/auth/getToken?id={$this->apiId}&pass={$this->apiPass}";
            $response = Http::timeout(30)->post($url);

            if (!$response->successful()) {
                Log::error('HelloWork: getToken failed', ['status' => $response->status()]);
                return null;
            }

            $xml = simplexml_load_string($response->body());
            $token = (string) ($xml->token ?? '');

            if (empty($token)) {
                Log::error('HelloWork: getToken returned empty token');
                return null;
            }

            return $token;
        } catch (\Throwable $e) {
            Log::error('HelloWork: getToken exception', ['error' => $e->getMessage()]);
            return null;
        }
    }

    private function deleteToken(string $token): void
    {
        try {
            Http::timeout(10)->post("{$this->baseUrl}/auth/delToken?token={$token}");
        } catch (\Throwable $e) {
            Log::warning('HelloWork: delToken failed', ['error' => $e->getMessage()]);
        }
    }

    // ----------------------------------------------------------------
    // Data fetching
    // ----------------------------------------------------------------

    /**
     * 1ページ分の求人XMLを取得してパースした配列を返す
     * 0件 or エラーの場合は空配列
     */
    private function fetchJobPage(string $token, string $dataId, int $page): array
    {
        try {
            $url = "{$this->baseUrl}/kyujin/{$dataId}/{$page}?token={$token}";
            $response = Http::timeout(60)->post($url);

            if (!$response->successful()) {
                Log::warning('HelloWork: fetchJobPage failed', [
                    'dataId' => $dataId,
                    'page'   => $page,
                    'status' => $response->status(),
                ]);
                return [];
            }

            return $this->parseJobsXml($response->body());
        } catch (\Throwable $e) {
            Log::error('HelloWork: fetchJobPage exception', [
                'page'  => $page,
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }

    /**
     * ハローワーク求人XMLをパースして配列に変換
     * 仕様: APIインタフェース仕様書(マスキング版) v1.4 2026年3月
     */
    private function parseJobsXml(string $xml): array
    {
        $jobs = [];

        try {
            $root = simplexml_load_string($xml);
            if (!$root) {
                return [];
            }

            // <kyujin> 要素を繰り返す（仕様上の要素名が確定次第修正）
            $items = $root->kyujin ?? $root->item ?? $root->children();

            foreach ($items as $item) {
                $jobs[] = $this->mapXmlToJobData($item);
            }
        } catch (\Throwable $e) {
            Log::error('HelloWork: XML parse error', ['error' => $e->getMessage()]);
        }

        return array_filter($jobs, fn($j) => !empty($j['hellowork_id']));
    }

    /**
     * XML要素を jobs テーブル用の配列に変換
     *
     * フィールド名は仕様書 v1.4 準拠:
     *   kjno        = 求人番号
     *   jgshmei     = 事業所名（会社名）
     *   sksu        = 職種
     *   shigoto_ny  = 仕事内容
     *   koyokeitai_n= 雇用形態
     *   shgbsjusho  = 就業場所
     *   kjyukoymd   = 有効期限 (YYYYMMDD)
     *   uktkymd_seireki = 受付日 (YYYYMMDD)
     *   kihonkyugenga   = 基本給下限
     *   kihonkyujoge    = 基本給上限
     */
    private function mapXmlToJobData(\SimpleXMLElement $item): array
    {
        $get = fn(string $key) => trim((string) ($item->$key ?? ''));

        $salaryMin = $this->parseSalary($get('kihonkyugenga'));
        $salaryMax = $this->parseSalary($get('kihonkyujoge'));

        $expiresAt = null;
        $rawExpiry = $get('kjyukoymd');
        if (preg_match('/^\d{8}$/', $rawExpiry)) {
            $expiresAt = Carbon::createFromFormat('Ymd', $rawExpiry)->endOfDay();
        }

        $publishedAt = null;
        $rawPublished = $get('uktkymd_seireki');
        if (preg_match('/^\d{8}$/', $rawPublished)) {
            $publishedAt = Carbon::createFromFormat('Ymd', $rawPublished)->startOfDay();
        }

        return [
            'hellowork_id'   => $get('kjno') ?: null,
            'title'          => $get('sksu') ?: '職種未記載',
            'description'    => $get('shigoto_ny') ?: '',
            'employment_type'=> $this->normalizeEmploymentType($get('koyokeitai_n')),
            'location'       => $get('shgbsjusho') ?: null,
            'salary_min'     => $salaryMin,
            'salary_max'     => $salaryMax,
            'salary_type'    => ($salaryMin || $salaryMax) ? '月給' : null,
            'expires_at'     => $expiresAt,
            'published_at'   => $publishedAt,
            // 企業名は description に付記（ハローワークは企業IDなし）
            '_company_name'  => $get('jgshmei'),
        ];
    }

    // ----------------------------------------------------------------
    // DB upsert
    // ----------------------------------------------------------------

    /**
     * @return 'inserted'|'updated'
     */
    private function upsertJob(array $data): string
    {
        $helloworkId = $data['hellowork_id'];
        unset($data['_company_name'], $data['hellowork_id']);

        $existing = Job::where('hellowork_id', $helloworkId)->first();

        $attributes = array_merge($data, [
            'source'      => 'hellowork',
            'status'      => 'active',
            'company_id'  => $this->companyId,
        ]);

        if ($existing) {
            $existing->update($attributes);
            return 'updated';
        }

        Job::create(array_merge($attributes, ['hellowork_id' => $helloworkId]));
        return 'inserted';
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    /**
     * ハローワーク求人専用のダミー企業レコードを取得または作成
     */
    private function getOrCreateHelloWorkCompany(): int
    {
        $company = Company::firstOrCreate(
            ['company_name' => 'ハローワーク'],
            [
                'verification_status' => 'approved',
                'website'             => 'https://www.hellowork.mhlw.go.jp/',
                'description'         => '厚生労働省が運営する公共職業安定所（ハローワーク）の求人情報です。',
            ]
        );

        return (int) $company->id;
    }

    private function parseSalary(string $value): ?int
    {
        $num = preg_replace('/[^\d]/', '', $value);
        return $num !== '' ? (int) $num : null;
    }

    private function normalizeEmploymentType(string $raw): ?string
    {
        $map = [
            '正社員'   => '正社員',
            '契約'     => '契約社員',
            'パート'   => 'パート',
            'アルバイト' => 'パート',
            '派遣'     => '派遣',
            '業務委託' => '業務委託',
        ];

        foreach ($map as $keyword => $normalized) {
            if (str_contains($raw, $keyword)) {
                return $normalized;
            }
        }

        return $raw ?: null;
    }
}
