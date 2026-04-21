<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Job;
use Carbon\Carbon;
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
        $this->baseUrl = rtrim(trim(config('services.hellowork.base_url', '')), '/');
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
    public function sync(string $dataId = 'M100', int $maxPages = 0): array
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
                if ($maxPages > 0 && $page > $maxPages) {
                    break;
                }

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

            // APIに存在しなくなった求人を非公開に（全件取得時のみ実行）
            if ($maxPages === 0 && !empty($activeIds)) {
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
            $url = "{$this->baseUrl}/auth/getToken?" . http_build_query([
                'id'   => $this->apiId,
                'pass' => $this->apiPass,
            ]);
            [$code, $body] = $this->curlPost($url, 30);

            if ($code !== 200) {
                Log::error('HelloWork: getToken failed', ['status' => $code]);
                return null;
            }

            $xml = simplexml_load_string($body);
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
            $this->curlPost("{$this->baseUrl}/auth/delToken?token={$token}", 10);
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
            [$code, $body] = $this->curlPost($url, 60);

            if ($code !== 200) {
                Log::warning('HelloWork: fetchJobPage failed', [
                    'dataId' => $dataId,
                    'page'   => $page,
                    'status' => $code,
                ]);
                return [];
            }

            return $this->parseJobsXml($body);
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
     * 実際のXML構造: <root><kyujin><data>...</data><data>...</data></kyujin></root>
     */
    private function parseJobsXml(string $xml): array
    {
        $jobs = [];

        try {
            $root = simplexml_load_string($xml);
            if (!$root || !isset($root->kyujin)) {
                return [];
            }

            foreach ($root->kyujin->data as $item) {
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
     * 実測フィールド名（APIレスポンスより確認済み）:
     *   kjno             = 求人番号
     *   jgshmei          = 事業所名
     *   sksu             = 職種
     *   shigoto_ny       = 仕事内容
     *   koyokeitai_n     = 雇用形態名
     *   shgbsjusho1_n    = 就業場所（都道府県市区町村）
     *   kjyukoymd        = 有効期限 (YYYY/MM/DD)
     *   uktkymd_seireki  = 受付日 (YYYY/MM/DD)
     *   khkykagen        = 基本給下限（月額）
     *   khkyjgn          = 基本給上限（月額）
     *   chgnkeitai_n     = 賃金形態名（時給・月給等）
     *   chgnkeitai_kagen = 賃金形態別下限
     *   chgnkeitai_jgn   = 賃金形態別上限
     */
    private function mapXmlToJobData(\SimpleXMLElement $item): array
    {
        $get = fn(string $key) => trim((string) ($item->$key ?? ''));

        // 賃金形態に応じて適切なフィールドを使用
        $salaryTypeRaw = $get('chgnkeitai_n'); // 時給・月給・日給等
        $salaryMin = $this->parseSalary($get('chgnkeitai_kagen')) ?: $this->parseSalary($get('khkykagen'));
        $salaryMax = $this->parseSalary($get('chgnkeitai_jgn')) ?: $this->parseSalary($get('khkyjgn'));
        $salaryType = $this->normalizeSalaryType($salaryTypeRaw);

        $expiresAt = null;
        $rawExpiry = $get('kjyukoymd');
        if (preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $rawExpiry)) {
            $expiresAt = Carbon::createFromFormat('Y/m/d', $rawExpiry)->endOfDay();
        }

        $publishedAt = null;
        $rawPublished = $get('uktkymd_seireki');
        if (preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $rawPublished)) {
            $publishedAt = Carbon::createFromFormat('Y/m/d', $rawPublished)->startOfDay();
        }

        return [
            'hellowork_id'   => $get('kjno') ?: null,
            'title'          => $get('sksu') ?: '職種未記載',
            'description'    => $get('shigoto_ny') ?: '',
            'employment_type'=> $this->normalizeEmploymentType($get('koyokeitai_n')),
            'location'       => $get('shgbsjusho1_n') ?: $get('jgshjusho_n') ?: null,
            'salary_min'     => $salaryMin,
            'salary_max'     => $salaryMax,
            'salary_type'    => $salaryType,
            'expires_at'     => $expiresAt,
            'published_at'   => $publishedAt,
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

    /**
     * シンプルなPHP curlでPOSTリクエスト（Guzzleの余分なヘッダーを回避）
     * @return array{int, string} [HTTPステータスコード, レスポンスボディ]
     */
    private function curlPost(string $url, int $timeout = 30): array
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);

        // PHP の curl は CA bundle を自動検出できないことがある
        // システムの証明書バンドルを明示的に指定
        $caBundle = '/etc/ssl/certs/ca-certificates.crt';
        if (file_exists($caBundle)) {
            curl_setopt($ch, CURLOPT_CAINFO, $caBundle);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        } else {
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        }

        $body = curl_exec($ch);
        $errno = curl_errno($ch);
        $error = curl_error($ch);
        $code  = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($errno) {
            Log::error('HelloWork: curl error', ['errno' => $errno, 'error' => $error, 'url' => $url]);
        }

        return [$code, (string) $body];
    }

    private function normalizeSalaryType(string $raw): ?string
    {
        if (str_contains($raw, '時給')) return '時給';
        if (str_contains($raw, '日給')) return '日給';
        if (str_contains($raw, '月額') || str_contains($raw, '月給')) return '月給';
        if (str_contains($raw, '年収') || str_contains($raw, '年額')) return '年収';
        return $raw ?: null;
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
