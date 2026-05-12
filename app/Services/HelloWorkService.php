<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Job;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
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
        // updated_at でこの同期で触れた求人を判別する
        $syncStartedAt = now();

        try {
            $this->companyId = $this->getOrCreateHelloWorkCompany();

            $page  = 1;
            $batch = [];

            while (true) {
                if ($maxPages > 0 && $page > $maxPages) break;

                $jobs = $this->fetchJobPage($token, $dataId, $page);
                if (empty($jobs)) break;

                foreach ($jobs as $jobData) {
                    try {
                        $row = $this->prepareRow($jobData);
                        if ($row) {
                            $batch[] = $row;
                            if (count($batch) >= 100) {
                                $counts = $this->flushBatch($batch);
                                $stats['inserted'] += $counts['inserted'];
                                $stats['updated']  += $counts['updated'];
                                $batch = [];
                            }
                        }
                    } catch (\Throwable $e) {
                        Log::error('HelloWork: prepare failed', [
                            'id'    => $jobData['hellowork_id'] ?? null,
                            'error' => $e->getMessage(),
                        ]);
                        $stats['errors']++;
                    }
                }

                $page++;
            }

            if (!empty($batch)) {
                $counts = $this->flushBatch($batch);
                $stats['inserted'] += $counts['inserted'];
                $stats['updated']  += $counts['updated'];
            }

            // updated_at < 同期開始時刻 の求人 = 今回APIに無かった → 非公開化
            // whereNotIn(全ID) の代わりに timestamp 比較でメモリ/パラメータ上限を回避
            if ($maxPages === 0) {
                $stats['deleted'] = Job::where('source', 'hellowork')
                    ->where('status', 'active')
                    ->where('updated_at', '<', $syncStartedAt)
                    ->update(['status' => 'closed']);
            }
        } finally {
            $this->deleteToken($token);
        }

        return $stats;
    }

    /**
     * 1件分の DB 行データを作成（配列フィールドを JSON 文字列に変換）
     */
    private function prepareRow(array $data): ?array
    {
        $helloworkId = $data['hellowork_id'] ?? null;
        if (!$helloworkId) return null;

        unset($data['_company_name'], $data['hellowork_id']);

        $publishedAt  = $data['published_at'] ?? null;
        $rankingScore = $publishedAt
            ? ($publishedAt instanceof Carbon ? $publishedAt : Carbon::parse($publishedAt))->timestamp / 1_000_000_000_000.0
            : 0;

        $now = now();

        $row = array_merge($data, [
            'hellowork_id'  => $helloworkId,
            'source'        => 'hellowork',
            'status'        => 'active',
            'company_id'    => $this->companyId,
            'ranking_score' => $rankingScore,
            'created_at'    => $now,
            'updated_at'    => $now,
        ]);

        // JSONB カラムは文字列に変換
        foreach (['benefits', 'insurance', 'feature_tags'] as $field) {
            if (isset($row[$field]) && is_array($row[$field])) {
                $row[$field] = json_encode($row[$field], JSON_UNESCAPED_UNICODE);
            }
        }

        // Carbon オブジェクトを文字列に変換
        foreach (['expires_at', 'published_at', 'created_at', 'updated_at'] as $field) {
            if (isset($row[$field]) && $row[$field] instanceof Carbon) {
                $row[$field] = $row[$field]->toDateTimeString();
            }
        }

        return $row;
    }

    /**
     * 100件バッチを INSERT ON CONFLICT DO UPDATE で一括処理
     * N+1 クエリを排除し、1バッチ = 1SQL に削減
     */
    private function flushBatch(array $batch): array
    {
        $ids      = array_column($batch, 'hellowork_id');
        $existing = Job::whereIn('hellowork_id', $ids)->pluck('hellowork_id')->flip();

        $insertCount = 0;
        $updateCount = 0;
        foreach ($batch as $row) {
            if ($existing->has($row['hellowork_id'])) {
                $updateCount++;
            } else {
                $insertCount++;
            }
        }

        // created_at は新規挿入のみ、更新時は上書きしない
        $updateColumns = array_values(array_diff(
            array_keys($batch[0]),
            ['hellowork_id', 'created_at']
        ));

        DB::table('jobs')->upsert($batch, ['hellowork_id'], $updateColumns);

        return ['inserted' => $insertCount, 'updated' => $updateCount];
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
            $url    = "{$this->baseUrl}/auth/getToken";
            $fields = ['id' => $this->apiId, 'pass' => $this->apiPass];

            [$code, $body] = $this->curlPost($url, 30, $fields);

            if ($code !== 200) {
                Log::error('HelloWork: getToken failed', ['status' => $code, 'body' => substr($body, 0, 500)]);
                return null;
            }

            $xml = simplexml_load_string($body);
            $token = (string) ($xml->token ?? '');

            if (empty($token)) {
                Log::error('HelloWork: getToken returned empty token', ['body' => substr($body, 0, 500)]);
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
            $this->curlPost("{$this->baseUrl}/auth/delToken", 10, ['token' => $token]);
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
            $url = "{$this->baseUrl}/kyujin/{$dataId}/{$page}";
            [$code, $body] = $this->curlPost($url, 60, ['token' => $token]);

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
     * ハローワーク求人情報提供サービス API v2.0 フィールド対応表:
     *   kjno                = 求人番号
     *   jgshmei             = 事業所名
     *   sksu                = 職種
     *   shigoto_ny          = 仕事内容
     *   biko                = 備考・特記事項
     *   koyokeitai_n        = 雇用形態名
     *   shgbsjusho1_n       = 就業場所（都道府県市区町村）
     *   shgbsjusho2_n       = 就業場所（番地以降）
     *   kjyukoymd           = 有効期限 (YYYY/MM/DD)
     *   uktkymd_seireki     = 受付日 (YYYY/MM/DD)
     *   khkykagen           = 基本給下限（月額）
     *   khkyjgn             = 基本給上限（月額）
     *   chgnkeitai_n        = 賃金形態名（時給・月給等）
     *   chgnkeitai_kagen    = 賃金形態別下限
     *   chgnkeitai_jgn      = 賃金形態別上限
     *   kszk_jikan1_f/t     = 就業時間1（始/終）HH:MM
     *   kszk_jikan2_f/t     = 就業時間2（始/終）HH:MM
     *   kszk_jikan3_f/t     = 就業時間3（始/終）HH:MM
     *   kszk_jikan_bko      = 就業時間の備考
     *   jikan_gazan_f       = 時間外労働なし (1=なし)
     *   jikan_gazan_tsuki   = 月平均時間外労働時間数
     *   kyuujitsu_naiy      = 休日等
     *   nenkan_kyujitsu     = 年間休日数
     *   taiguu_naiy         = 待遇・福利厚生
     *   boshuyoken_naiy     = 応募に必要な資格・経験
     *   gakureki_bko        = 学歴
     *   mensetsu_naiy       = 選考方法
     *   kariagekin_kbn_n    = 退職金制度
     *   shanai_kensyu_f     = 社内研修制度あり (1=あり)
     *   kizyu_f             = 育児休業取得実績あり (1=あり)
     *   boshu_ninzu         = 募集人数
     *   age_ue              = 年齢上限
     *   age_shita           = 年齢下限
     *   hoken_f1            = 雇用保険 (1=あり)
     *   hoken_f2            = 労災保険 (1=あり)
     *   hoken_f3            = 健康保険 (1=あり)
     *   hoken_f4            = 厚生年金 (1=あり)
     */
    private function mapXmlToJobData(\SimpleXMLElement $item): array
    {
        $get = fn(string $key) => trim((string) ($item->$key ?? ''));

        // 賃金
        $salaryTypeRaw = $get('chgnkeitai_n');
        $salaryMin  = $this->parseSalary($get('chgnkeitai_kagen')) ?: $this->parseSalary($get('khkykagen'));
        $salaryMax  = $this->parseSalary($get('chgnkeitai_jgn'))   ?: $this->parseSalary($get('khkyjgn'));
        $salaryType = $this->normalizeSalaryType($salaryTypeRaw);

        // 日付
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

        // 就業時間（3パターン対応）
        $workHours = $this->buildWorkHours(
            $get('kszk_jikan1_f'), $get('kszk_jikan1_t'),
            $get('kszk_jikan2_f'), $get('kszk_jikan2_t'),
            $get('kszk_jikan3_f'), $get('kszk_jikan3_t'),
            $get('kszk_jikan_bko')
        );

        // 就業場所 → 都道府県 / 市区町村 に分割
        $locationRaw = $get('shgbsjusho1_n') ?: $get('jgshjusho_n') ?: '';
        [$prefecture, $city] = $this->splitLocation($locationRaw);

        // 詳細住所（番地以降）
        $addressDetail = $get('shgbsjusho2_n') ?: null;
        $officeAddress = $addressDetail
            ? trim($locationRaw . ' ' . $addressDetail)
            : ($locationRaw ?: null);

        // 社会保険（フラグ → 文字列配列）
        $insurance = [];
        if ($get('hoken_f1') === '1') $insurance[] = '雇用保険';
        if ($get('hoken_f2') === '1') $insurance[] = '労災保険';
        if ($get('hoken_f3') === '1') $insurance[] = '健康保険';
        if ($get('hoken_f4') === '1') $insurance[] = '厚生年金';

        // 待遇・福利厚生
        $taiguuNaiy = $get('taiguu_naiy');
        $benefits = $taiguuNaiy ? [$taiguuNaiy] : null;

        // 追加フィールド
        $biko             = $get('biko');
        $gakureki         = $get('gakureki_bko');
        $mensetsuNaiy     = $get('mensetsu_naiy');
        $kariagekinKbn    = $get('kariagekin_kbn_n');
        $jikanGazanNashi  = $get('jikan_gazan_f');
        $jikanGazanTsuki  = $get('jikan_gazan_tsuki');
        $nenkanKyujitsu   = $get('nenkan_kyujitsu');
        $shanaiKensyuF    = $get('shanai_kensyu_f');
        $kizyuF           = $get('kizyu_f');
        $holidays         = $get('kyuujitsu_naiy');

        // 構造化された仕事内容
        $description = $this->buildDescription(
            $get('shigoto_ny'),
            $biko,
            $gakureki,
            $mensetsuNaiy,
            $jikanGazanNashi,
            $jikanGazanTsuki,
            $kariagekinKbn,
            $nenkanKyujitsu
        );

        // 募集人数
        $positionsAvailable = null;
        $boshuNinzu = $get('boshu_ninzu');
        if ($boshuNinzu && preg_match('/(\d+)/', $boshuNinzu, $m)) {
            $positionsAvailable = (int) $m[1];
        }

        // 年齢条件
        $ageUe    = $get('age_ue');
        $ageShita = $get('age_shita');
        $ageMin   = ($ageShita !== '' && ctype_digit($ageShita)) ? (int) $ageShita : null;
        $ageMax   = ($ageUe    !== '' && ctype_digit($ageUe))    ? (int) $ageUe    : null;

        // 特徴タグ自動生成
        $featureTags = $this->buildFeatureTags(
            $insurance, $holidays, $nenkanKyujitsu,
            $jikanGazanNashi, $jikanGazanTsuki,
            $shanaiKensyuF, $kizyuF, $kariagekinKbn, $taiguuNaiy
        );

        return [
            'hellowork_id'        => $get('kjno') ?: null,
            'title'               => $get('sksu') ?: '職種未記載',
            'description'         => $description,
            'requirements'        => $get('boshuyoken_naiy') ?: null,
            'employment_type'     => $this->normalizeEmploymentType($get('koyokeitai_n')),
            'location'            => $locationRaw ?: null,
            'prefecture'          => $prefecture,
            'city'                => $city,
            'office_address'      => $officeAddress,
            'salary_min'          => $salaryMin,
            'salary_max'          => $salaryMax,
            'salary_type'         => $salaryType,
            'work_hours'          => $workHours,
            'holidays'            => $holidays ?: null,
            'benefits'            => $benefits ?: null,
            'insurance'           => $insurance ?: null,
            'expires_at'          => $expiresAt,
            'published_at'        => $publishedAt,
            'positions_available' => $positionsAvailable,
            'age_min'             => $ageMin,
            'age_max'             => $ageMax,
            'feature_tags'        => $featureTags ?: null,
            '_company_name'       => $get('jgshmei'),
        ];
    }

    /**
     * 複数フィールドをまとめて構造化された仕事内容テキストを生成
     */
    private function buildDescription(
        string $shigotoNy,
        string $biko,
        string $gakureki,
        string $mensetsuNaiy,
        string $jikanGazanNashi,
        string $jikanGazanTsuki,
        string $kariagekinKbn,
        string $nenkanKyujitsu
    ): string {
        $parts = [];

        if ($shigotoNy) {
            $parts[] = "【仕事内容】\n{$shigotoNy}";
        }

        if ($biko) {
            $parts[] = "【特記事項・備考】\n{$biko}";
        }

        // 勤務条件の補足情報をまとめる
        $conditions = [];
        if ($nenkanKyujitsu !== '') {
            $conditions[] = "年間休日：{$nenkanKyujitsu}日";
        }
        if ($jikanGazanNashi === '1') {
            $conditions[] = '時間外労働：なし';
        } elseif ($jikanGazanTsuki !== '') {
            $conditions[] = "月平均時間外：{$jikanGazanTsuki}時間程度";
        }
        if ($kariagekinKbn !== '') {
            $conditions[] = "退職金：{$kariagekinKbn}";
        }
        if ($conditions) {
            $parts[] = "【勤務条件】\n" . implode('　／　', $conditions);
        }

        if ($gakureki) {
            $parts[] = "【学歴】\n{$gakureki}";
        }

        if ($mensetsuNaiy) {
            $parts[] = "【選考方法】\n{$mensetsuNaiy}";
        }

        return implode("\n\n", array_filter($parts));
    }

    /**
     * 求人データから特徴タグを自動生成
     */
    private function buildFeatureTags(
        array $insurance,
        string $holidays,
        string $nenkanKyujitsu,
        string $jikanGazanNashi,
        string $jikanGazanTsuki,
        string $shanaiKensyuF,
        string $kizyuF,
        string $kariagekinKbn,
        string $taiguuNaiy
    ): array {
        $tags = [];

        // 社会保険
        if (count($insurance) >= 4) {
            $tags[] = '社保完備';
        } elseif (count($insurance) > 0) {
            $tags[] = '社会保険あり';
        }

        // 週休2日
        if (str_contains($holidays, '完全週休2日') || str_contains($holidays, '完全週休二日')) {
            $tags[] = '完全週休2日';
        } elseif (str_contains($holidays, '週休2日') || str_contains($holidays, '週休二日')) {
            $tags[] = '週休2日';
        }

        // 年間休日
        $kyujitsuNum = (int) preg_replace('/[^\d]/', '', $nenkanKyujitsu);
        if ($kyujitsuNum >= 120) {
            $tags[] = '年間休日120日以上';
        } elseif ($kyujitsuNum >= 105) {
            $tags[] = '年間休日105日以上';
        }

        // 残業
        if ($jikanGazanNashi === '1') {
            $tags[] = '残業なし';
        } elseif ($jikanGazanTsuki !== '') {
            $overtime = (int) preg_replace('/[^\d]/', '', $jikanGazanTsuki);
            if ($overtime > 0 && $overtime <= 20) {
                $tags[] = '残業少なめ';
            }
        }

        // 研修制度
        if ($shanaiKensyuF === '1') {
            $tags[] = '研修制度あり';
        }

        // 育児休業
        if ($kizyuF === '1') {
            $tags[] = '育休取得実績あり';
        }

        // 退職金
        if ($kariagekinKbn !== '' && !str_contains($kariagekinKbn, 'なし')) {
            $tags[] = '退職金制度あり';
        }

        // 福利厚生テキストからキーワード抽出
        if (str_contains($taiguuNaiy, '交通費')) {
            $tags[] = '交通費支給';
        }
        if (str_contains($taiguuNaiy, '住宅手当') || str_contains($taiguuNaiy, '家賃補助')) {
            $tags[] = '住宅手当あり';
        }
        if (str_contains($taiguuNaiy, '食事') || str_contains($taiguuNaiy, '昼食')) {
            $tags[] = '食事補助あり';
        }
        if (str_contains($taiguuNaiy, '制服') || str_contains($taiguuNaiy, '作業服')) {
            $tags[] = '制服貸与';
        }

        return array_values(array_unique($tags));
    }

    private function buildWorkHours(
        string $f1, string $t1,
        string $f2, string $t2,
        string $f3, string $t3,
        string $bko
    ): ?string {
        $parts = [];
        if ($f1 && $t1) $parts[] = "{$f1}〜{$t1}";
        if ($f2 && $t2) $parts[] = "{$f2}〜{$t2}";
        if ($f3 && $t3) $parts[] = "{$f3}〜{$t3}";
        if ($bko)        $parts[] = $bko;
        return $parts ? implode(' / ', $parts) : null;
    }

    /**
     * "群馬県前橋市" → ["群馬県", "前橋市"]
     * 都道府県（都/道/府/県）を分離し残りを市区町村とする
     */
    private function splitLocation(string $location): array
    {
        if (empty($location)) return [null, null];

        if (preg_match('/^(.+?[都道府県])(.*)$/', $location, $m)) {
            return [
                $m[1],
                $m[2] ?: null,
            ];
        }

        return [null, $location];
    }

    // ----------------------------------------------------------------
    // DB upsert
    // ----------------------------------------------------------------

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
                'verification_status' => 'verified',
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
     * @return array{int, string} [HTTPステータスコード, レスポンスボディ]
     */
    private function curlPost(string $url, int $timeout = 30, array $fields = []): array
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        if ($fields) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($fields));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
        }

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
