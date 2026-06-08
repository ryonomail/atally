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

        unset($data['hellowork_id']);

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
     * ハローワーク求人情報提供サービス API インタフェース仕様書（v2.0）準拠。
     * フィールド名は公式仕様書のタグ名に厳密に対応させている。
     * 主なタグ対応:
     *   kjno=求人番号 / jgshmei=事業所名 / sksu=職種 / shigoto_ny=仕事内容
     *   sngbrui_n=産業分類 / jigyony=事業内容 / kaishatocho=会社の特長
     *   dhsyamei=代表者名 / jgshhp=企業HP / shihonkin=資本金
     *   jgis_kigyozentai_n=従業員数(企業全体) / sogyostrt_nen_seireki=設立年
     *   chgnkeitai_kagen/jgn=賃金 / khkykagen/jgn=基本給 / ktizangydi=固定残業代
     *   tgktat1〜4=定額手当 / tskntat=通勤手当 / shoyo=賞与 / shkyrt=昇給
     *   shgjn1〜3_open_close=就業時間 / kyukeijn_n=休憩 / jkgi_*=時間外
     *   kyjs=休日 / sk2sei_n=週休二日制 / nenkankjsu_n=年間休日 / sixmonth_yukyukyuka_n=有給
     *   knyhkn_koyo/rosai/kenko/kosei=加入保険 / tiskkin_seido=退職金
     *   sykkn=試用期間 / tnnenrei=定年 / saikoyo=再雇用 / knmencho=勤務延長
     *   nenreisegnari_kagen/jgn=年齢制限 / grki=学歴 / hynakiknt=必要な経験
     *   snkhoho=選考方法 / obshri_*=応募書類 / saiyoninzu_n=採用人数 / boshury_n=募集理由
     *   okni_jdktentisk_n=受動喫煙対策 / mycartsknkahi_n=マイカー通勤 / chushajo_umu_n=駐車場
     *   ztkkimmu_n=在宅勤務 / tenkin_knsi_n=転勤 / kjjknktkjk=求人特記事項
     */
    private function mapXmlToJobData(\SimpleXMLElement $item): array
    {
        $get = fn(string $key) => trim((string) ($item->$key ?? ''));

        // ---- 賃金 ----
        $salaryType = $this->normalizeSalaryType($get('chgnkeitai_n'));
        $salaryMin  = $this->parseSalary($get('chgnkeitai_kagen')) ?: $this->parseSalary($get('khkykagen'));
        $salaryMax  = $this->parseSalary($get('chgnkeitai_jgn'))   ?: $this->parseSalary($get('khkyjgn'));
        $salaryDetails = $this->buildSalaryDetails($get);

        // ---- 日付 ----
        $expiresAt   = $this->parseHwDate($get('kjyukoymd'), true);
        $publishedAt = $this->parseHwDate($get('uktkymd_seireki'), false);

        // ---- 就業場所・住所 ----
        $locationRaw = $get('shgbsjusho1_n') ?: $get('jgshjusho_n') ?: '';
        [$prefecture, $city] = $this->splitLocation($locationRaw);
        $officeAddress = $get('shgbsjusho') ?: $get('jgshszci') ?: ($locationRaw ?: null);
        $postalCode    = $get('shgbsyubinno') ?: $get('jgshyubinno') ?: null;
        $nearestStation = $get('shgbs_myre') ?: $get('shgbs_myremjr') ?: null;
        $accessInfo = $this->joinNonEmpty([
            $get('shgbs_jgshmade_kotsushudan_n'),
            $get('shgbs_jgshmade_shoyojn'),
        ], '　') ?: null;
        $transfer = $this->joinNonEmpty([$get('tenkin_knsi_n'), $get('tenkin_hani')], '：') ?: null;

        // ---- 加入保険・手当・福利厚生 ----
        $insurance  = $this->buildInsuranceList($get);
        $allowances = $this->buildAllowances($get);
        $benefits   = $this->buildBenefits($get);

        // ---- 就業時間・残業・休日 ----
        $workHours = $this->buildWorkHours($get);
        $overtime  = $this->buildOvertime($get);
        $holidays  = $this->buildHolidays($get);
        $holidayDetails = $this->joinNonEmpty([
            $get('kyjstosnta'),
            $get('sixmonth_yukyukyuka_n') !== '' ? "年次有給休暇（6ヶ月経過後）：{$get('sixmonth_yukyukyuka_n')}日" : '',
        ], "\n") ?: null;

        // ---- 試用期間・雇用期間 ----
        $probationPeriod     = $get('sykkn') ?: null;
        $probationConditions = $get('sykknchu_rodojoken') ?: null;
        $contractPeriod      = $get('koyokikan') ?: null;

        // ---- 募集人数・年齢 ----
        $positionsAvailable = $this->parseFirstInt($get('saiyoninzu_n'));
        $ageMin = $this->parseFirstInt($get('nenreisegnari_kagen'));
        $ageMax = $this->parseFirstInt($get('nenreisegnari_jgn'));

        // ---- 応募要件 ----
        $requirements = $get('hynakiknt') ?: null;
        $preferred = $this->joinNonEmpty([
            $get('hynapcskill') !== '' ? "PCスキル：{$get('hynapcskill')}" : '',
            $get('menkyo_skku1_n'), $get('menkyo_skku2_n'), $get('menkyo_skku3_n'),
        ], '／') ?: null;
        $education = $get('grki') ?: null;

        // ---- 選考・募集理由 ----
        $selection    = $this->buildSelection($get);
        $requiredDocs = $this->buildRequiredDocuments($get);
        $recruitmentBackground = $this->joinNonEmpty([$get('boshury_n'), $get('snta_boshury')], '：') ?: null;

        // ---- 会社情報（事業所固有）----
        $employerName    = $get('jgshmei') ?: null;
        $industry        = $get('sngbrui_n') ?: null;
        $employees       = $this->buildEmployees($get);
        $foundedYear     = $this->buildFounded($get);
        $capital         = $get('shihonkin') ?: null;
        $businessContent = $get('jigyony') ?: null;
        $companyFeature  = $get('kaishatocho') ?: null;
        $representative  = $get('dhsyamei') ?: null;
        $homepage        = $get('jgshhp') ?: null;

        // ---- 特徴タグ ----
        $featureTags = $this->buildFeatureTags($get, $insurance);

        return [
            'hellowork_id'             => $get('kjno') ?: null,
            'title'                    => $this->cap($get('sksu') ?: '職種未記載', 255),
            'description'              => $get('shigoto_ny') ?: '職種詳細はお問い合わせください',
            'requirements'             => $requirements,
            'preferred_qualifications' => $preferred,
            'education_requirement'    => $this->cap($education, 50),
            'employment_type'          => $this->cap($this->normalizeEmploymentType($get('koyokeitai_n')), 255),
            'location'                 => $this->cap($locationRaw ?: null, 255),
            'prefecture'               => $this->cap($prefecture, 255),
            'city'                     => $this->cap($city, 255),
            'office_address'           => $this->cap($officeAddress, 255),
            'postal_code'              => $this->cap($postalCode, 20),
            'nearest_station'          => $this->cap($nearestStation, 200),
            'access_info'              => $this->cap($accessInfo, 255),
            'transfer_policy'          => $this->cap($transfer, 255),
            'remote_policy'            => $this->cap($get('ztkkimmu_n') ?: null, 255),
            'salary_min'               => $salaryMin,
            'salary_max'               => $salaryMax,
            'salary_type'              => $this->cap($salaryType, 255),
            'salary_details'           => $salaryDetails,
            'bonus'                    => $this->cap($get('shoyo') ?: null, 255),
            'raise_frequency'          => $this->cap($get('shkyrt') ?: ($get('shkyumu_n') ?: null), 255),
            'allowances'               => $allowances,
            'work_hours'               => $this->cap($workHours, 255),
            'overtime_average'         => $this->cap($overtime, 255),
            'holidays'                 => $this->cap($holidays, 255),
            'holiday_details'          => $holidayDetails,
            'insurance'                => $insurance ?: null,
            'benefits'                 => $benefits ?: null,
            'probation_period'         => $this->cap($probationPeriod, 255),
            'probation_conditions'     => $probationConditions,
            'contract_period'          => $this->cap($contractPeriod, 255),
            'positions_available'      => $positionsAvailable,
            'age_min'                  => $ageMin,
            'age_max'                  => $ageMax,
            'selection_process'        => $selection,
            'required_documents'       => $this->cap($requiredDocs, 255),
            'recruitment_background'   => $recruitmentBackground,
            'smoking_policy'           => $this->cap($get('okni_jdktentisk_n') ?: null, 200),
            'industry'                 => $this->cap($industry, 255),
            'number_of_employees'      => $this->cap($employees, 255),
            'founded_year'             => $this->cap($foundedYear, 255),
            'company_culture'          => $companyFeature,
            'appeal_points'            => $get('kjjknktkjk') ?: null,
            'notes'                    => $this->buildExtraNotes($get),
            'feature_tags'             => $featureTags ?: null,
            // 事業所固有の会社情報（全件ダミー企業に紐づくため求人レコードへ保持）
            'employer_name'            => $this->cap($employerName, 255),
            'representative_name'      => $this->cap($representative, 255),
            'business_content'         => $businessContent,
            'capital'                  => $this->cap($capital, 255),
            'homepage_url'             => $this->cap($homepage, 255),
            'expires_at'               => $expiresAt,
            'published_at'             => $publishedAt,
        ];
    }

    // ----------------------------------------------------------------
    // フィールド組み立てヘルパー（公式v2.0タグ名ベース）
    // ----------------------------------------------------------------

    /** varchar カラム溢れ防止。空文字は null に正規化 */
    private function cap(?string $v, int $len): ?string
    {
        if ($v === null) return null;
        $v = trim($v);
        if ($v === '') return null;
        return mb_strlen($v) > $len ? mb_substr($v, 0, $len) : $v;
    }

    /** 空でない要素だけを区切り文字で連結 */
    private function joinNonEmpty(array $parts, string $sep): string
    {
        $filtered = array_filter(array_map('trim', $parts), fn ($v) => $v !== '');
        return implode($sep, $filtered);
    }

    /** "YYYY/MM/DD" → Carbon（endOfDay: true=終端 / false=始端） */
    private function parseHwDate(string $raw, bool $endOfDay): ?Carbon
    {
        if (!preg_match('#^\d{4}/\d{2}/\d{2}$#', $raw)) return null;
        $d = Carbon::createFromFormat('Y/m/d', $raw);
        return $endOfDay ? $d->endOfDay() : $d->startOfDay();
    }

    /** 文字列中の最初の整数を取り出す（"5人" → 5） */
    private function parseFirstInt(string $raw): ?int
    {
        if ($raw !== '' && preg_match('/(\d+)/', $raw, $m)) {
            return (int) $m[1];
        }
        return null;
    }

    /** 値が「あり」相当か（空・0・なし以外） */
    private function isOn(string $v): bool
    {
        return $v !== '' && $v !== '0' && !str_contains($v, 'なし');
    }

    /** 就業時間（最大3パターン）＋休憩 */
    private function buildWorkHours(callable $get): ?string
    {
        $parts = [];
        foreach (['shgjn1_open_close', 'shgjn2_open_close', 'shgjn3_open_close'] as $k) {
            $v = $get($k);
            if ($v !== '') $parts[] = $v;
        }
        if (!$parts) {
            for ($i = 1; $i <= 3; $i++) {
                $o = $get("shgjn{$i}_open");
                $c = $get("shgjn{$i}_close");
                if ($o !== '' && $c !== '') $parts[] = "{$o}〜{$c}";
            }
        }
        if ($get('shgjn_tkjk') !== '') $parts[] = $get('shgjn_tkjk');
        if ($get('kyukeijn_n') !== '') $parts[] = "休憩{$get('kyukeijn_n')}分";
        return $parts ? implode(' / ', $parts) : null;
    }

    /** 時間外労働 */
    private function buildOvertime(callable $get): ?string
    {
        $umu   = $get('jkgi_umu_n');
        $tsuki = $get('jkgi_thkinjn_ji_n');
        if (str_contains($umu, 'なし')) return 'なし';
        if ($tsuki !== '') return "月平均{$tsuki}時間";
        return $umu ?: null;
    }

    /** 休日（曜日フラグ or テキスト）＋週休二日制＋年間休日 */
    private function buildHolidays(callable $get): ?string
    {
        $text = $get('kyjs');
        if ($text === '') {
            $map = [
                'kyjs_mon' => '月', 'kyjs_tue' => '火', 'kyjs_wed' => '水',
                'kyjs_thu' => '木', 'kyjs_fri' => '金', 'kyjs_sat' => '土',
                'kyjs_sun' => '日', 'kyjs_holiday' => '祝',
            ];
            $days = [];
            foreach ($map as $k => $label) {
                if ($this->isOn($get($k))) $days[] = $label;
            }
            if ($days) $text = implode('・', $days);
        }
        $parts = array_filter([$text, $get('sk2sei_n')], fn ($v) => $v !== '');
        if ($get('nenkankjsu_n') !== '') $parts[] = "年間休日{$get('nenkankjsu_n')}日";
        return $parts ? implode('／', $parts) : null;
    }

    /** 加入保険（knyhkn_*） */
    private function buildInsuranceList(callable $get): array
    {
        $ins = [];
        if ($this->isOn($get('knyhkn_koyo')))  $ins[] = '雇用保険';
        if ($this->isOn($get('knyhkn_rosai'))) $ins[] = '労災保険';
        if ($this->isOn($get('knyhkn_kenko'))) $ins[] = '健康保険';
        if ($this->isOn($get('knyhkn_kosei'))) $ins[] = '厚生年金';
        return array_values(array_unique($ins));
    }

    /** 定額手当（tgktat1〜4）＋通勤手当（tskntat） */
    private function buildAllowances(callable $get): ?string
    {
        $lines = [];
        for ($i = 1; $i <= 4; $i++) {
            $mei   = $get("tgktat{$i}_mei");
            $val   = $get("tgktat{$i}");
            $kagen = $get("tgktat{$i}_kagen");
            $jgn   = $get("tgktat{$i}_jgn");
            if ($mei === '' && $val === '' && $kagen === '' && $jgn === '') continue;
            $amount = $val;
            if ($amount === '' && ($kagen !== '' || $jgn !== '')) {
                $amount = $this->joinNonEmpty([$kagen, $jgn], '〜') . '円';
            }
            $lines[] = $mei !== '' ? trim("{$mei}：{$amount}", '：') : $amount;
        }
        if ($get('tskntat') !== '') {
            $lines[] = "通勤手当：{$get('tskntat')}";
        } elseif ($get('tskntatgaku') !== '') {
            $lines[] = "通勤手当：上限{$get('tskntatgaku')}円";
        }
        return $lines ? implode("\n", array_filter($lines, fn ($v) => trim($v) !== '')) : null;
    }

    /** 福利厚生（退職金・育休・各種制度を配列で） */
    private function buildBenefits(callable $get): array
    {
        $b = [];
        if ($this->isOn($get('tiskkin_seido')) || $this->isOn($get('tiskkin_kysi_n'))) $b[] = '退職金制度';
        if ($this->isOn($get('ikujikyugyostkjissekiumu_n'))) $b[] = '育児休業取得実績あり';
        if ($this->isOn($get('kaigokyugyostkjissekiumu_n'))) $b[] = '介護休業取得実績あり';
        if ($this->isOn($get('fukushokusd_umu_n')))          $b[] = '復職制度あり';
        if (str_contains($get('mycartsknkahi_n'), '可'))      $b[] = 'マイカー通勤可';
        if (str_contains($get('chushajo_umu_n'), '有'))       $b[] = '駐車場あり';
        return array_values(array_unique($b));
    }

    /** 給与補足（支給額a+b・固定残業代） */
    private function buildSalaryDetails(callable $get): ?string
    {
        $lines = [];
        $aMin = $get('sikg_aplusbkagen');
        $aMax = $get('sikg_aplusbjgn');
        if ($aMin !== '' || $aMax !== '') {
            $lines[] = '支給額(a+b)：' . $this->joinNonEmpty([$aMin, $aMax], '〜') . '円';
        }
        $kVal  = $get('ktizangydi');
        $kMin  = $get('ktizangydi_kagen');
        $kMax  = $get('ktizangydi_jgn');
        if ($kVal !== '' || $kMin !== '' || $kMax !== '') {
            $amt  = $kVal !== '' ? $kVal : ($this->joinNonEmpty([$kMin, $kMax], '〜') . '円');
            $tkjk = $get('ktizangydaitkjk');
            $lines[] = "固定残業代：{$amt}" . ($tkjk !== '' ? "（{$tkjk}）" : '');
        }
        return $lines ? implode("\n", $lines) : null;
    }

    /** 選考方法（フラグ＋面接回数＋テキスト） */
    private function buildSelection(callable $get): ?string
    {
        $methods = [];
        if ($this->isOn($get('snkhoho_shrisnko_c'))) $methods[] = '書類選考';
        if ($this->isOn($get('snkhoho_mensetsu_c'))) {
            $kaisu = $get('mensetsuyoteikaisu');
            $methods[] = '面接' . ($kaisu !== '' ? "（{$kaisu}回）" : '');
        }
        if ($this->isOn($get('snkhoho_hkkskn_c'))) $methods[] = '筆記試験';
        $text = $get('snkhoho');
        $methodLine = $methods ? implode('・', $methods) : '';
        return $this->joinNonEmpty([$methodLine, $text], "\n") ?: null;
    }

    /** 応募書類（obshri_*） */
    private function buildRequiredDocuments(callable $get): ?string
    {
        $docs = [];
        if ($this->isOn($get('obshri_hwshkijo')))    $docs[] = 'ハローワーク紹介状';
        if ($this->isOn($get('obshri_rrksh')))       $docs[] = '履歴書';
        if ($this->isOn($get('obshri_shkmkeireki'))) $docs[] = '職務経歴書';
        if ($this->isOn($get('obshri_jobcard')))     $docs[] = 'ジョブ・カード';
        if ($get('oboshri_snta') !== '')             $docs[] = $get('oboshri_snta');
        return $docs ? implode('・', $docs) : null;
    }

    /** 従業員数（企業全体／就業場所） */
    private function buildEmployees(callable $get): ?string
    {
        $parts = [];
        if ($get('jgis_kigyozentai_n') !== '') $parts[] = "企業全体{$get('jgis_kigyozentai_n')}人";
        if ($get('jgis_shgbs_n') !== '')       $parts[] = "就業場所{$get('jgis_shgbs_n')}人";
        return $parts ? implode('／', $parts) : null;
    }

    /** 設立年（西暦・和暦） */
    private function buildFounded(callable $get): ?string
    {
        $sei    = $get('sogyostrt_nen_seireki') ?: $get('sogyostrt_nen');
        $wareki = $get('sogyostrt_nen_wareki');
        if ($sei !== '')    return $wareki !== '' ? "{$sei}年（{$wareki}）" : "{$sei}年";
        return $wareki !== '' ? $wareki : null;
    }

    /** 定年・再雇用・勤務延長・マイカー・駐車場 → 備考 */
    private function buildExtraNotes(callable $get): ?string
    {
        $lines = [];
        $tnnenrei = $get('tnnenrei') ?: $get('tnnenrei_n');
        if ($tnnenrei !== '') {
            $lines[] = "定年：{$tnnenrei}歳";
        } elseif ($get('tnsei') !== '') {
            $lines[] = "定年制：{$get('tnsei')}";
        }
        if ($get('saikoyo') !== '') {
            $lines[] = "再雇用制度：{$get('saikoyo')}";
        } elseif ($get('saikoyo_jgnnenrei') !== '') {
            $lines[] = "再雇用上限年齢：{$get('saikoyo_jgnnenrei')}歳";
        }
        if ($get('knmencho') !== '') {
            $lines[] = "勤務延長：{$get('knmencho')}";
        } elseif ($get('knmencho_jgnnenrei') !== '') {
            $lines[] = "勤務延長上限年齢：{$get('knmencho_jgnnenrei')}歳";
        }
        if ($get('mycartsknkahi_n') !== '') $lines[] = "マイカー通勤：{$get('mycartsknkahi_n')}";
        if ($get('chushajo_umu_n') !== '')  $lines[] = "駐車場：{$get('chushajo_umu_n')}";
        return $lines ? implode("\n", $lines) : null;
    }

    /** 求人データから特徴タグを自動生成（公式タグ名ベース） */
    private function buildFeatureTags(callable $get, array $insurance): array
    {
        $tags = [];

        if (count($insurance) >= 4)      $tags[] = '社保完備';
        elseif (count($insurance) > 0)   $tags[] = '社会保険あり';

        $sk2 = $get('sk2sei_n');
        if (str_contains($sk2, '完全週休二日') || str_contains($sk2, '完全週休2日')) {
            $tags[] = '完全週休2日';
        } elseif (str_contains($sk2, '週休二日') || str_contains($sk2, '週休2日')) {
            $tags[] = '週休2日';
        }

        $nenkan = (int) preg_replace('/[^\d]/', '', $get('nenkankjsu_n'));
        if ($nenkan >= 120)      $tags[] = '年間休日120日以上';
        elseif ($nenkan >= 105)  $tags[] = '年間休日105日以上';

        if (str_contains($get('jkgi_umu_n'), 'なし')) {
            $tags[] = '残業なし';
        } else {
            $m = (int) preg_replace('/[^\d]/', '', $get('jkgi_thkinjn_ji_n'));
            if ($m > 0 && $m <= 20) $tags[] = '残業少なめ';
        }

        if ($this->isOn($get('ikujikyugyostkjissekiumu_n'))) $tags[] = '育休取得実績あり';
        if ($this->isOn($get('tiskkin_seido')) || $this->isOn($get('tiskkin_kysi_n'))) $tags[] = '退職金制度あり';
        if (str_contains($get('mycartsknkahi_n'), '可')) $tags[] = 'マイカー通勤可';
        if (str_contains($get('chushajo_umu_n'), '有'))  $tags[] = '駐車場あり';
        if ($this->isOn($get('ztkkimmu_n')))             $tags[] = '在宅勤務可';
        if (str_contains($get('tenkin_knsi_n'), 'なし')) $tags[] = '転勤なし';
        if (str_contains($get('uijturnkange_n'), '歓迎')) $tags[] = 'UIJターン歓迎';

        return array_values(array_unique($tags));
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
        $int = ($num !== '') ? (int) $num : null;
        return ($int && $int > 0) ? $int : null;
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
