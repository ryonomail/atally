<?php

namespace App\Services;

use App\Models\LeadCollectionRun;
use App\Models\LeadCompany;
use Illuminate\Http\Client\Pool;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * 営業リスト（見込み企業）の自動収集。
 *
 * 収集元:
 *  0. ハローワーク求人（jobs テーブルに取り込み済み）の事業所 … 企業数が最も多い。外部アクセス不要
 *  1. Google Places API (Text Search)  … Googleマップ掲載の店舗・企業。ホームページ未保有の企業も取得できる
 *  2. OpenStreetMap (Nominatim + Overpass) … APIキー不要のフォールバック。SNSタグ(contact:instagram 等)も保有
 * 補完:
 *  3. ホームページが無い企業は Brave Search API（任意）で 公式サイト・SNS を検索
 *  4. 公式サイトのトップ＋お問い合わせ/会社概要ページから メールアドレス・SNSリンクを抽出
 *  5. 住所から緯度経度（国土地理院API）を求めて地図に表示
 *
 * Googleマップ・Indeed 等の画面スクレイピングは利用規約違反のため行わず、公式APIのみを使う。
 */
class LeadCollectorService
{
    private const USER_AGENT = 'Mozilla/5.0 (compatible; AtallyLeadCollector/1.0; +https://atally.io)';

    /** 1回の収集でサイト巡回する最大件数 */
    private const MAX_SITE_FETCH = 120;

    /** 日本語キーワード → OSM タグ（名前に業種名が含まれない店舗も拾うため） */
    private const OSM_TAG_MAP = [
        '美容室'   => ['shop' => 'hairdresser'],
        '美容院'   => ['shop' => 'hairdresser'],
        'ヘアサロン' => ['shop' => 'hairdresser'],
        '理容'     => ['shop' => 'hairdresser'],
        'ネイル'   => ['shop' => 'beauty'],
        'エステ'   => ['shop' => 'beauty'],
        'カフェ'   => ['amenity' => 'cafe'],
        '喫茶'     => ['amenity' => 'cafe'],
        'レストラン' => ['amenity' => 'restaurant'],
        '飲食'     => ['amenity' => 'restaurant'],
        '居酒屋'   => ['amenity' => 'pub'],
        'ラーメン' => ['cuisine' => 'ramen'],
        '歯科'     => ['amenity' => 'dentist'],
        '歯医者'   => ['amenity' => 'dentist'],
        'クリニック' => ['amenity' => 'clinic'],
        '病院'     => ['amenity' => 'hospital'],
        '薬局'     => ['amenity' => 'pharmacy'],
        '保育'     => ['amenity' => 'kindergarten'],
        '介護'     => ['amenity' => 'social_facility'],
        '不動産'   => ['office' => 'estate_agent'],
        '工務店'   => ['craft' => 'builder'],
        '建設'     => ['office' => 'construction_company'],
        '税理士'   => ['office' => 'tax_advisor'],
        '弁護士'   => ['office' => 'lawyer'],
        'ホテル'   => ['tourism' => 'hotel'],
        '旅館'     => ['tourism' => 'guest_house'],
        'パン'     => ['shop' => 'bakery'],
        '花屋'     => ['shop' => 'florist'],
        '自動車'   => ['shop' => 'car_repair'],
        '整備'     => ['shop' => 'car_repair'],
        'ジム'     => ['leisure' => 'fitness_centre'],
        '塾'       => ['amenity' => 'prep_school'],
    ];

    private const CATEGORY_LABELS = [
        'hairdresser' => '美容室・理容室', 'beauty' => '美容・ネイル・エステ', 'cafe' => 'カフェ',
        'restaurant' => 'レストラン', 'pub' => '居酒屋・バー', 'bar' => 'バー', 'fast_food' => 'ファストフード',
        'dentist' => '歯科', 'clinic' => 'クリニック', 'hospital' => '病院', 'doctors' => '医院',
        'pharmacy' => '薬局', 'kindergarten' => '保育園・幼稚園', 'social_facility' => '福祉施設',
        'estate_agent' => '不動産', 'builder' => '工務店', 'construction_company' => '建設会社',
        'tax_advisor' => '税理士', 'lawyer' => '法律事務所', 'hotel' => 'ホテル', 'guest_house' => '旅館・民宿',
        'bakery' => 'パン屋', 'florist' => '花屋', 'car_repair' => '自動車整備', 'car' => '自動車販売',
        'fitness_centre' => 'フィットネス', 'prep_school' => '学習塾', 'company' => '企業', 'convenience' => 'コンビニ',
        'supermarket' => 'スーパー', 'clothes' => 'アパレル', 'it' => 'IT企業', 'accountant' => '会計事務所',
    ];

    private array $log = [];

    /** 1回の調査で処理する最大件数（続きは「HP・メールを探す」ボタンで） */
    public const ENRICH_BATCH = 150;

    public static function availableSources(): array
    {
        return [
            'hellowork'  => true,
            'google'     => (bool) config('services.lead_collector.google_places_key'),
            'osm'        => true,
            'sns_search' => (bool) config('services.lead_collector.brave_search_key'),
        ];
    }

    /**
     * 収集のメイン処理（キュージョブから呼ばれる）
     *   sources に 'enrich' のみ → 未調査企業の HP/メール/SNS 調査の続きだけ行う
     */
    public function run(LeadCollectionRun $run): void
    {
        $run->update(['status' => 'running', 'started_at' => now()]);

        $sources = $run->sources ?: ['google', 'osm'];
        $available = self::availableSources();
        $ids = [];
        $new = 0;
        $updated = 0;

        if ($sources === ['enrich']) {
            $targets = LeadCompany::whereNull('enriched_at')
                ->orderByRaw('job_count is null')->orderByDesc('job_count')->orderBy('id')
                ->limit(self::ENRICH_BATCH)->get();
            $this->safely('HP・メール・SNS調査', function () use ($targets) { $this->enrich($targets); return []; });
            $remain = LeadCompany::whereNull('enriched_at')->count();
            $this->log[] = sprintf('調査 %d件 / 残り未調査 %d件', $targets->count(), $remain);
            $run->update(['found_count' => $targets->count(), 'status' => 'done', 'finished_at' => now(), 'message' => implode("\n", $this->log)]);
            return;
        }

        // ハローワーク求人（DB内）から事業所を取り込み
        if (in_array('hellowork', $sources, true)) {
            $r = $this->safely('ハローワーク求人', fn () => [$this->importFromHellowork($run)]);
            if ($r) { $new += $r[0]['new']; $updated += $r[0]['updated']; }
        }

        $places = [];
        if (in_array('google', $sources, true) && $run->keyword !== '') {
            if ($available['google']) {
                $places = array_merge($places, $this->safely('Googleマップ', fn () => $this->fetchGooglePlaces($run->keyword, $run->area)));
            } else {
                $this->log[] = 'Googleマップ: APIキー(GOOGLE_PLACES_API_KEY)未設定のためスキップ';
            }
        }
        if (in_array('osm', $sources, true) && $run->keyword !== '' && $run->area !== '') {
            $places = array_merge($places, $this->safely('OpenStreetMap', fn () => $this->fetchOsm($run->keyword, $run->area)));
        }
        $places = $this->dedupe($places);

        foreach ($places as $p) {
            $lead = LeadCompany::firstOrNew(['source' => $p['source'], 'external_id' => $p['external_id']]);
            $isNew = !$lead->exists;
            foreach ($p as $k => $v) {
                // 既存レコードの手入力・補完済みの値は空値で上書きしない
                if ($v === null || $v === '') continue;
                $lead->{$k} = $v;
            }
            if (!empty($p['website']) && empty($lead->website_found_by)) $lead->website_found_by = $p['source'];
            $lead->has_website = !empty($lead->website);
            $lead->search_keyword = $run->keyword;
            $lead->search_area = $run->area;
            $lead->last_run_id = $run->id;
            $lead->save();
            $ids[] = $lead->id;
            $isNew ? $new++ : $updated++;
        }

        $total = LeadCompany::where('last_run_id', $run->id)->count();
        $run->update(['found_count' => $total, 'new_count' => $new, 'updated_count' => $updated]);

        // 公式サイト・メール・SNS 補完（求人数の多い企業から最大 ENRICH_BATCH 件）
        $targets = LeadCompany::where('last_run_id', $run->id)
            ->where(fn ($q) => $q->whereNull('enriched_at')->orWhereIn('id', $ids))
            ->orderByRaw('job_count is null')->orderByDesc('job_count')->orderBy('id')
            ->limit(self::ENRICH_BATCH)->get();
        $this->safely('HP・メール・SNS調査', function () use ($targets) { $this->enrich($targets); return []; });

        $remain = LeadCompany::where('last_run_id', $run->id)->whereNull('enriched_at')->count();
        $this->log[] = sprintf('対象 %d件（新規 %d / 更新 %d）', $total, $new, $updated);
        if ($remain) $this->log[] = "未調査が {$remain}件 残っています。「HP・メールを探す」で続きを調査できます";
        $run->update([
            'status'      => 'done',
            'finished_at' => now(),
            'message'     => implode("\n", $this->log),
        ]);
    }

    /* =========================================================
       ハローワーク求人（jobs テーブル）から事業所を取り込み
       ========================================================= */
    private function importFromHellowork(LeadCollectionRun $run): array
    {
        $q = DB::table('jobs')
            ->where('source', 'hellowork')
            ->whereNotNull('employer_name')->where('employer_name', '<>', '')
            ->select([
                'employer_name', 'prefecture', 'city',
                DB::raw('max(office_address) as office_address'),
                DB::raw('max(homepage_url) as homepage_url'),
                DB::raw('max(industry) as industry'),
                DB::raw('count(*) as job_count'),
            ])
            ->groupBy('employer_name', 'prefecture', 'city');

        if ($run->keyword !== '') {
            $like = '%' . addcslashes($run->keyword, '%_\\') . '%';
            $q->where(fn ($w) => $w->where('employer_name', 'like', $like)->orWhere('industry', 'like', $like)->orWhere('title', 'like', $like));
        }
        if ($run->area !== '') {
            $like = '%' . addcslashes($run->area, '%_\\') . '%';
            $q->where(fn ($w) => $w->where('prefecture', 'like', $like)->orWhere('city', 'like', $like)->orWhere('office_address', 'like', $like));
        }

        $new = 0;
        $updated = 0;
        $rows = [];
        $flush = function () use (&$rows, &$new, &$updated, $run) {
            if (!$rows) return;
            $existing = LeadCompany::where('source', 'hellowork')
                ->whereIn('external_id', array_column($rows, 'external_id'))
                ->pluck('external_id')->flip();
            $now = now();
            foreach ($rows as &$r) {
                isset($existing[$r['external_id']]) ? $updated++ : $new++;
                $r += ['status' => 'new', 'last_run_id' => $run->id, 'search_keyword' => $run->keyword,
                    'search_area' => $run->area, 'created_at' => $now, 'updated_at' => $now];
            }
            unset($r);
            // 既存企業はステータス・メモ・調査済みのHP等を保持し、求人数と取り込み回のみ更新
            LeadCompany::upsert($rows, ['source', 'external_id'], ['job_count', 'category', 'last_run_id', 'search_keyword', 'search_area', 'updated_at']);
            $rows = [];
        };

        foreach ($q->orderBy('employer_name')->cursor() as $j) {
            $name = trim($j->employer_name);
            $website = $this->normalizeWebsite($j->homepage_url);
            $rows[] = [
                'source'           => 'hellowork',
                'external_id'      => 'hw:' . md5($this->normalizeName($name) . '|' . $j->prefecture . '|' . $j->city),
                'name'             => Str::limit($name, 250, ''),
                'category'         => $j->industry ? Str::limit($j->industry, 95, '') : null,
                'address'          => $j->office_address ?: trim(($j->prefecture ?? '') . ($j->city ?? '')) ?: null,
                'website'          => $website,
                'has_website'      => (bool) $website,
                'website_found_by' => $website ? 'hellowork' : null,
                'job_count'        => (int) $j->job_count,
            ];
            if (count($rows) >= 500) $flush();
        }
        $flush();

        $this->log[] = sprintf('ハローワーク求人: %d社（新規 %d / 更新 %d）', $new + $updated, $new, $updated);
        return ['new' => $new, 'updated' => $updated];
    }

    public function enrich(iterable $leads): void
    {
        $leads = collect($leads);
        $toSearch = [];
        foreach ($leads as $lead) {
            // Google が「ウェブサイト」として Instagram 等を登録しているケースを SNS に振り分け
            if ($lead->website && ($sns = $this->classifySnsUrl($lead->website))) {
                [$field, $url] = $sns;
                if (empty($lead->{$field})) $lead->{$field} = $url;
                $lead->website = null;
                $lead->has_website = false;
                $lead->website_found_by = null;
            } elseif ($lead->website) {
                $lead->website = $this->normalizeWebsite($lead->website);
                $lead->has_website = (bool) $lead->website;
            }
            if ($lead->isDirty()) $lead->save();

            if (!$lead->website) $toSearch[] = $lead;
        }

        // 1) HPが無い企業 → Web検索で公式サイト・SNSを探す
        if (config('services.lead_collector.brave_search_key')) {
            $this->enrichFromSearch(array_slice($toSearch, 0, (int) config('services.lead_collector.search_limit', 50)));
        } elseif ($toSearch) {
            $this->log[] = sprintf('ホームページ無し %d件: 検索APIキー(BRAVE_SEARCH_API_KEY)未設定のため HP・SNS 検索をスキップ', count($toSearch));
        }

        // 2) HPがある企業（検索で見つかった分も含む）→ サイトからメール・SNS を抽出
        $this->enrichFromWebsites($leads->filter(fn ($l) => $l->website)->take(self::MAX_SITE_FETCH)->values()->all());

        // 3) 位置情報が無い企業 → 住所から緯度経度（地図表示用）
        $this->geocode($leads->filter(fn ($l) => $l->lat === null && $l->address)->take(self::ENRICH_BATCH)->values()->all());

        // 調査済みにする（見つからなかった企業も再調査の対象から外す）
        LeadCompany::whereIn('id', $leads->pluck('id'))->whereNull('enriched_at')->update(['enriched_at' => now()]);
    }

    /* =========================================================
       Google Places API (New) - Text Search
       ========================================================= */
    private function fetchGooglePlaces(string $keyword, string $area): array
    {
        $key = config('services.lead_collector.google_places_key');
        $results = [];
        $pageToken = null;

        for ($page = 0; $page < 3; $page++) { // 最大 60 件（APIの上限）
            $body = [
                'textQuery'    => trim("{$keyword} {$area}"),
                'languageCode' => 'ja',
                'regionCode'   => 'JP',
                'pageSize'     => 20,
            ];
            if ($pageToken) $body['pageToken'] = $pageToken;

            $res = Http::withHeaders([
                'X-Goog-Api-Key'   => $key,
                'X-Goog-FieldMask' => implode(',', [
                    'places.id', 'places.displayName', 'places.formattedAddress', 'places.location',
                    'places.nationalPhoneNumber', 'places.websiteUri', 'places.primaryTypeDisplayName',
                    'places.rating', 'places.userRatingCount', 'places.googleMapsUri', 'places.businessStatus',
                    'nextPageToken',
                ]),
            ])->timeout(20)->post('https://places.googleapis.com/v1/places:searchText', $body);

            if (!$res->successful()) {
                throw new \RuntimeException('Places API エラー: ' . ($res->json('error.message') ?? $res->status()));
            }

            foreach ($res->json('places', []) as $pl) {
                if (($pl['businessStatus'] ?? null) === 'CLOSED_PERMANENTLY') continue;
                $results[] = [
                    'source'          => 'google',
                    'external_id'     => $pl['id'],
                    'name'            => $pl['displayName']['text'] ?? '(名称不明)',
                    'category'        => $pl['primaryTypeDisplayName']['text'] ?? null,
                    'address'         => $this->cleanAddress($pl['formattedAddress'] ?? null),
                    'phone'           => $pl['nationalPhoneNumber'] ?? null,
                    'website'         => $pl['websiteUri'] ?? null,
                    'lat'             => $pl['location']['latitude'] ?? null,
                    'lng'             => $pl['location']['longitude'] ?? null,
                    'google_maps_url' => $pl['googleMapsUri'] ?? null,
                    'rating'          => $pl['rating'] ?? null,
                    'review_count'    => $pl['userRatingCount'] ?? null,
                ];
            }

            $pageToken = $res->json('nextPageToken');
            if (!$pageToken) break;
            usleep(500_000);
        }

        $this->log[] = 'Googleマップ: ' . count($results) . '件';
        return $results;
    }

    /* =========================================================
       OpenStreetMap (Nominatim でエリア → Overpass で施設検索)
       ========================================================= */
    private function fetchOsm(string $keyword, string $area): array
    {
        $geo = Http::withHeaders(['User-Agent' => self::USER_AGENT, 'Accept-Language' => 'ja'])
            ->timeout(20)
            ->get('https://nominatim.openstreetmap.org/search', [
                'q' => $area, 'format' => 'json', 'limit' => 1, 'countrycodes' => 'jp',
            ]);
        $hit = $geo->json(0);
        if (!$hit || empty($hit['boundingbox'])) {
            $this->log[] = "OpenStreetMap: エリア「{$area}」が見つかりませんでした";
            return [];
        }

        [$s, $n, $w, $e] = array_map('floatval', $hit['boundingbox']);
        // 都道府県単位など広すぎるエリアは Overpass がタイムアウトするので中心から約15km四方に制限
        if (($n - $s) > 0.3 || ($e - $w) > 0.3) {
            $lat = (float) $hit['lat'];
            $lon = (float) $hit['lon'];
            [$s, $n, $w, $e] = [$lat - 0.15, $lat + 0.15, $lon - 0.18, $lon + 0.18];
            $this->log[] = 'OpenStreetMap: エリアが広いため中心部（約30km四方）に絞って検索';
        }
        $bbox = sprintf('%.5f,%.5f,%.5f,%.5f', $s, $w, $n, $e);

        $kw = $this->overpassRegex($keyword);
        $filters = ["nwr[\"name\"~\"{$kw}\",i][~\"^(shop|office|amenity|craft|healthcare|tourism|leisure|company)$\"~\".\"]({$bbox});"];
        foreach (self::OSM_TAG_MAP as $jp => $tags) {
            if (mb_strpos($keyword, $jp) !== false) {
                foreach ($tags as $k => $v) {
                    $filters[] = "nwr[\"{$k}\"=\"{$v}\"][\"name\"]({$bbox});";
                }
            }
        }
        $query = '[out:json][timeout:60];(' . implode('', array_unique($filters)) . ');out center tags 300;';

        $res = Http::withHeaders(['User-Agent' => self::USER_AGENT])
            ->asForm()->timeout(90)
            ->post('https://overpass-api.de/api/interpreter', ['data' => $query]);
        if (!$res->successful()) {
            throw new \RuntimeException('Overpass API エラー: HTTP ' . $res->status());
        }

        $results = [];
        foreach ($res->json('elements', []) as $el) {
            $t = $el['tags'] ?? [];
            if (empty($t['name'])) continue;
            $lat = $el['lat'] ?? $el['center']['lat'] ?? null;
            $lng = $el['lon'] ?? $el['center']['lon'] ?? null;

            $row = [
                'source'      => 'osm',
                'external_id' => $el['type'] . '/' . $el['id'],
                'name'        => $t['name'],
                'category'    => $this->osmCategory($t),
                'address'     => $this->osmAddress($t),
                'phone'       => $t['phone'] ?? $t['contact:phone'] ?? null,
                'email'       => $t['email'] ?? $t['contact:email'] ?? null,
                'website'     => $t['website'] ?? $t['contact:website'] ?? $t['url'] ?? null,
                'lat'         => $lat,
                'lng'         => $lng,
                'google_maps_url' => $lat && $lng
                    ? 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode($t['name']) . '%20' . $lat . ',' . $lng
                    : null,
            ];
            foreach ([
                'instagram' => 'contact:instagram', 'twitter' => 'contact:twitter', 'facebook' => 'contact:facebook',
                'tiktok' => 'contact:tiktok', 'youtube' => 'contact:youtube', 'line' => 'contact:line',
            ] as $field => $tag) {
                if (!empty($t[$tag])) $row[$field] = $this->osmSnsValue($field, $t[$tag]);
            }
            if (!empty($t['contact:x']) && empty($row['twitter'])) $row['twitter'] = $this->osmSnsValue('twitter', $t['contact:x']);
            $results[] = $row;
        }

        $this->log[] = 'OpenStreetMap: ' . count($results) . '件';
        return $results;
    }

    /**
     * 同名・近接（約200m以内）の重複を統合。Google の情報を優先し、OSM の SNS 等で穴埋めする。
     */
    private function dedupe(array $places): array
    {
        usort($places, fn ($a, $b) => ($a['source'] === 'google' ? 0 : 1) <=> ($b['source'] === 'google' ? 0 : 1));
        $out = [];
        foreach ($places as $p) {
            $merged = false;
            foreach ($out as &$o) {
                if ($this->normalizeName($o['name']) !== $this->normalizeName($p['name'])) continue;
                if ($o['lat'] && $p['lat'] && $this->distanceM($o['lat'], $o['lng'], $p['lat'], $p['lng']) > 200) continue;
                foreach ($p as $k => $v) {
                    if (in_array($k, ['source', 'external_id'], true)) continue;
                    if (empty($o[$k]) && !empty($v)) $o[$k] = $v;
                }
                $merged = true;
                break;
            }
            unset($o);
            if (!$merged) $out[] = $p;
        }
        return $out;
    }

    /* =========================================================
       公式サイトから メール / SNS 抽出
       トップページで見つからなければ「お問い合わせ」「会社概要」ページも見る
       ========================================================= */
    private function enrichFromWebsites(array $leads): void
    {
        $ok = 0;
        $mail = 0;
        foreach (array_chunk($leads, 8) as $chunk) {
            $chunk = array_values(array_filter($chunk, fn ($l) => $this->isSafePublicUrl($l->website)));
            if (!$chunk) continue;

            $pages = $this->fetchPages(array_map(fn ($l) => $l->website, $chunk));
            $second = [];
            foreach ($chunk as $i => $lead) {
                $html = $pages[$i] ?? null;
                if ($html === null) continue;
                $ok++;
                $this->applyPage($lead, $html);
                if (empty($lead->email)) {
                    foreach ($this->contactLinks($html, $lead->website) as $u) $second[] = [$lead, $u];
                }
            }

            // 2段目: お問い合わせ・会社概要ページ
            if ($second) {
                $second = array_values(array_filter($second, fn ($x) => $this->isSafePublicUrl($x[1])));
                $pages2 = $this->fetchPages(array_column($second, 1));
                foreach ($second as $i => [$lead, $u]) {
                    if (!empty($lead->email) || ($pages2[$i] ?? null) === null) continue;
                    $this->applyPage($lead, $pages2[$i]);
                }
            }

            foreach ($chunk as $lead) {
                if (!empty($lead->email)) $mail++;
                $lead->enriched_at = now();
                $lead->save();
            }
        }
        if ($leads) $this->log[] = "公式サイト巡回: {$ok}/" . count($leads) . "件を取得（メール判明 {$mail}件）";
    }

    /** 複数URLを並列取得し、成功したものだけ HTML を返す（インデックス維持） */
    private function fetchPages(array $urls): array
    {
        if (!$urls) return [];
        $responses = Http::pool(fn (Pool $pool) => array_map(
            fn ($u) => $pool->withHeaders(['User-Agent' => self::USER_AGENT, 'Accept-Language' => 'ja'])
                ->withOptions(['allow_redirects' => ['max' => 3]])
                ->timeout(10)->get($u),
            $urls
        ));
        $out = [];
        foreach ($urls as $i => $u) {
            $res = $responses[$i] ?? null;
            if ($res instanceof \Illuminate\Http\Client\Response && $res->successful()) {
                $out[$i] = $this->toUtf8(substr($res->body(), 0, 2_000_000), $res->header('Content-Type'));
            }
        }
        return $out;
    }

    private function applyPage(LeadCompany $lead, string $html): void
    {
        foreach ($this->extractSnsLinks($html) as $field => $url) {
            if (empty($lead->{$field})) $lead->{$field} = $url;
        }
        if (empty($lead->email) && ($email = $this->extractEmail($html, parse_url($lead->website, PHP_URL_HOST)))) {
            $lead->email = $email;
        }
    }

    /** 同一ドメイン内の「お問い合わせ」「会社概要」系リンクを最大2件 */
    private function contactLinks(string $html, string $base): array
    {
        $baseHost = preg_replace('/^www\./', '', strtolower((string) parse_url($base, PHP_URL_HOST)));
        if (!preg_match_all('#<a\s[^>]*href=["\']([^"\'\#]+)["\'][^>]*>(.*?)</a>#is', $html, $m, PREG_SET_ORDER)) return [];
        $hits = [];
        foreach ($m as [, $href, $text]) {
            $text = strip_tags($text);
            if (!preg_match('/(contact|inquiry|toiawase|otoiawase|company|about|gaiyo|outline|profile|access|お問い?合わせ|会社概要|会社案内|企業情報|事業所概要|アクセス)/iu', $href . ' ' . $text)) continue;
            $abs = $this->absUrl($href, $base);
            if (!$abs) continue;
            $host = preg_replace('/^www\./', '', strtolower((string) parse_url($abs, PHP_URL_HOST)));
            if ($host !== $baseHost) continue;
            $hits[$abs] = true;
            if (count($hits) >= 2) break;
        }
        return array_keys($hits);
    }

    private function absUrl(string $href, string $base): ?string
    {
        $href = html_entity_decode(trim($href), ENT_QUOTES | ENT_HTML5);
        if (preg_match('#^(mailto|tel|javascript):#i', $href)) return null;
        if (preg_match('#^https?://#i', $href)) return $href;
        $b = parse_url($base);
        if (empty($b['host'])) return null;
        $root = ($b['scheme'] ?? 'https') . '://' . $b['host'] . (isset($b['port']) ? ':' . $b['port'] : '');
        if (str_starts_with($href, '//')) return ($b['scheme'] ?? 'https') . ':' . $href;
        if (str_starts_with($href, '/')) return $root . $href;
        $dir = preg_replace('#/[^/]*$#', '/', $b['path'] ?? '/');
        return $root . ($dir ?: '/') . $href;
    }

    private function toUtf8(string $html, ?string $contentType): string
    {
        $charset = null;
        if ($contentType && preg_match('/charset=([\w\-]+)/i', $contentType, $m)) $charset = $m[1];
        elseif (preg_match('/<meta[^>]+charset=["\']?([\w\-]+)/i', $html, $m)) $charset = $m[1];
        $charset = strtoupper((string) $charset);
        if (in_array($charset, ['SHIFT_JIS', 'SHIFT-JIS', 'SJIS', 'X-SJIS', 'WINDOWS-31J', 'CP932'], true)) return mb_convert_encoding($html, 'UTF-8', 'SJIS-win');
        if ($charset === 'EUC-JP') return mb_convert_encoding($html, 'UTF-8', 'eucJP-win');
        return $html;
    }

    /* =========================================================
       ホームページ無し企業の 公式サイト / SNS を検索（Brave Search API）
       ========================================================= */
    private function enrichFromSearch(array $leads): void
    {
        $key = config('services.lead_collector.brave_search_key');
        $web = 0;
        $sns = 0;
        foreach ($leads as $lead) {
            $city = $this->cityFromAddress($lead->address);
            try {
                $res = Http::withHeaders(['X-Subscription-Token' => $key, 'Accept' => 'application/json'])
                    ->timeout(15)
                    ->get('https://api.search.brave.com/res/v1/web/search', [
                        'q' => trim("\"{$lead->name}\" {$city}"), 'count' => 10, 'country' => 'JP', 'search_lang' => 'jp',
                    ]);
                if ($res->status() === 429) { sleep(2); continue; }
                if (!$res->successful()) continue;

                [$foundWeb, $foundSns] = $this->pickFromSearchResults($lead, $res->json('web.results', []));
                if ($foundWeb) $web++;
                if ($foundSns) $sns++;
                $lead->save();
            } catch (\Throwable $e) {
                Log::info('lead search failed', ['lead' => $lead->id, 'error' => $e->getMessage()]);
            }
            usleep(1_100_000); // 無料プランは 1 req/sec
        }
        if ($leads) $this->log[] = "Web検索（HP無し " . count($leads) . "件）: 公式サイト発見 {$web}件 / SNS発見 {$sns}件";
    }

    /**
     * 検索結果から 公式サイト と SNS を選ぶ。誤マッチ防止のためタイトル/説明に社名を含むものだけ採用し、
     * 求人サイト・口コミサイト・企業DB などのポータルは公式サイトとみなさない。
     */
    public function pickFromSearchResults(LeadCompany $lead, array $results): array
    {
        $nameKey = $this->normalizeName($lead->name);
        if ($nameKey === '') return [false, false];
        $foundWeb = false;
        $foundSns = false;
        foreach ($results as $r) {
            $url = $r['url'] ?? '';
            $text = $this->normalizeName(strip_tags(($r['title'] ?? '') . ($r['description'] ?? '')));
            if (mb_strpos($text, $nameKey) === false) continue;

            if ($s = $this->classifySnsUrl($url)) {
                [$field, $u] = $s;
                if (empty($lead->{$field})) { $lead->{$field} = $u; $foundSns = true; }
                continue;
            }
            if (!$lead->website && !$this->isPortal($url)) {
                $p = parse_url($url);
                $lead->website = ($p['scheme'] ?? 'https') . '://' . $p['host'] . '/';
                $lead->has_website = true;
                $lead->website_found_by = 'search';
                $foundWeb = true;
            }
        }
        return [$foundWeb, $foundSns];
    }

    /** 求人・口コミ・企業DB・地図などのポータル/まとめサイト */
    private function isPortal(string $url): bool
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        if ($host === '') return true;
        $portals = [
            'indeed.com', 'hellowork.mhlw.go.jp', 'mhlw.go.jp', 'townwork.net', 'baitoru.com', 'mynavi.jp', 'rikunabi.com',
            'en-japan.com', 'doda.jp', 'kyujinbox.com', 'stanby.com', 'careerjet.jp', 'jobtalk.jp', 'jobs.tsunagaru',
            'jobmedley.com', 'jobposting', 'airwork.net', 'engage-job', 'en-gage.net', 'wantedly.com', 'green-japan.com',
            'openwork.jp', 'vorkers.com', 'jobhouse.jp', 'hatarako.net', 'e-aidem.com', 'an-career', 'jobcatalog',
            'shigoto-in', 'ekiten.jp', 'hotpepper.jp', 'tabelog.com', 'gnavi.co.jp', 'retty.me', 'mapion.co.jp',
            'navitime.co.jp', 'itp.ne.jp', 'goo.ne.jp', 'yahoo.co.jp', 'google.com', 'google.co.jp', 'houjin.info',
            'houjin-bangou.nta.go.jp', 'info.gbiz.go.jp', 'catr.jp', 'baseconnect.in', 'salesnow.jp', 'musubu.in',
            'wikipedia.org', 'nikkei.com', 'prtimes.jp', 'amazon.co.jp', 'rakuten.co.jp', 'jalan.net', 'minkou.jp',
            'caloo.jp', 'byoinnavi.jp', 'beauty.hotpepper.jp', 'homes.co.jp', 'suumo.jp', 'kaigo', 'minnanokaigo.com',
            'youtube.com', 'note.com', 'ameblo.jp', 'linkedin.com', 'tiktok.com', 'line.me', 'lin.ee', 'job-medley.com',
        ];
        foreach ($portals as $p) {
            if (str_contains($host, $p)) return true;
        }
        return false;
    }

    /* =========================================================
       住所 → 緯度経度（国土地理院 住所検索API・キー不要）
       ========================================================= */
    private function geocode(array $leads): void
    {
        $ok = 0;
        foreach ($leads as $lead) {
            try {
                $res = Http::withHeaders(['User-Agent' => self::USER_AGENT])->timeout(10)
                    ->get('https://msearch.gsi.go.jp/address-search/AddressSearch', ['q' => $lead->address]);
                $c = $res->json('0.geometry.coordinates');
                if (is_array($c) && count($c) === 2) {
                    $lead->lng = (float) $c[0];
                    $lead->lat = (float) $c[1];
                    if (!$lead->google_maps_url) {
                        $lead->google_maps_url = 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode($lead->name . ' ' . $lead->address);
                    }
                    $lead->save();
                    $ok++;
                }
            } catch (\Throwable $e) {
                Log::info('lead geocode failed', ['lead' => $lead->id, 'error' => $e->getMessage()]);
            }
            usleep(200_000);
        }
        if ($leads) $this->log[] = "住所→地図位置: {$ok}/" . count($leads) . '件';
    }

    /* =========================================================
       SNS URL 判定
       ========================================================= */

    /** HTML から SNS プロフィールリンクを抽出 */
    public function extractSnsLinks(string $html): array
    {
        $found = [];
        if (!preg_match_all('#https?://[^\s"\'<>()\\\\]+#i', $html, $m)) return $found;
        foreach ($m[0] as $url) {
            $url = html_entity_decode($url, ENT_QUOTES | ENT_HTML5);
            $sns = $this->classifySnsUrl($url);
            if ($sns && empty($found[$sns[0]])) $found[$sns[0]] = $sns[1];
        }
        return $found;
    }

    /**
     * URL が SNS のプロフィール/ページなら [field, 正規化URL] を返す。シェアボタン等は除外。
     */
    public function classifySnsUrl(string $url): ?array
    {
        $parts = parse_url(trim($url));
        if (empty($parts['host'])) return null;
        $host = strtolower(preg_replace('/^(www\.|m\.|mobile\.|ja-jp\.|ja\.)/', '', $parts['host']));
        $path = rtrim($parts['path'] ?? '', '/');
        $segs = array_values(array_filter(explode('/', $path), 'strlen'));
        $first = strtolower($segs[0] ?? '');

        switch (true) {
            case $host === 'instagram.com':
                if (!$first || in_array($first, ['p', 'reel', 'reels', 'explore', 'accounts', 'stories', 'share', 'tv', 'about', 'developer', 'legal'], true)) return null;
                return ['instagram', 'https://www.instagram.com/' . $segs[0] . '/'];

            case in_array($host, ['twitter.com', 'x.com'], true):
                if (!$first || in_array($first, ['share', 'intent', 'home', 'search', 'hashtag', 'i', 'login', 'signup', 'widgets', 'tos', 'privacy', 'settings', 'explore'], true)) return null;
                if (!preg_match('/^[A-Za-z0-9_]{1,15}$/', $segs[0])) return null;
                return ['twitter', 'https://x.com/' . $segs[0]];

            case in_array($host, ['facebook.com', 'fb.com', 'fb.me'], true):
                if (!$first || in_array($first, ['sharer', 'sharer.php', 'share', 'share.php', 'dialog', 'plugins', 'tr', 'login', 'login.php', 'policy', 'privacy', 'help', 'watch', 'events', 'hashtag', 'photo.php', 'photo', 'story.php', 'permalink.php', 'groups', 'v2.0', 'v3.0', 'business'], true)) return null;
                if ($first === 'profile.php') {
                    parse_str($parts['query'] ?? '', $q);
                    return !empty($q['id']) ? ['facebook', 'https://www.facebook.com/profile.php?id=' . $q['id']] : null;
                }
                if ($first === 'pages' && count($segs) >= 2) {
                    return ['facebook', 'https://www.facebook.com/' . implode('/', array_slice($segs, 0, 3))];
                }
                return ['facebook', 'https://www.facebook.com/' . $segs[0]];

            case $host === 'tiktok.com':
                if (!str_starts_with($first, '@')) return null;
                return ['tiktok', 'https://www.tiktok.com/' . $segs[0]];

            case $host === 'youtube.com':
                if (str_starts_with($first, '@')) return ['youtube', 'https://www.youtube.com/' . $segs[0]];
                if (in_array($first, ['channel', 'c', 'user'], true) && !empty($segs[1])) {
                    return ['youtube', 'https://www.youtube.com/' . $segs[0] . '/' . $segs[1]];
                }
                return null;

            case $host === 'lin.ee':
                return $first ? ['line', 'https://lin.ee/' . $segs[0]] : null;

            case $host === 'line.me':
                if (in_array($first, ['r', 'ti'], true) || str_contains($path, '/ti/p/')) {
                    return ['line', 'https://line.me' . $path];
                }
                return null;

            case $host === 'page.line.me':
                return $first ? ['line', 'https://page.line.me/' . $segs[0]] : null;
        }
        return null;
    }

    public function extractEmail(string $html, ?string $siteHost = null): ?string
    {
        $text = html_entity_decode($html, ENT_QUOTES | ENT_HTML5);
        $text = str_replace(['＠', '[at]', '(at)', '［at］'], '@', $text);
        preg_match_all('/(?:mailto:)?([A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,})/i', $text, $m);
        $cands = [];
        foreach (array_unique(array_map('strtolower', $m[1] ?? [])) as $email) {
            if (preg_match('/(example\.|sentry|wixpress|\.(png|jpe?g|gif|webp|svg|css|js)$|@[0-9]+x\.|domain\.com|yourdomain|xxx)/', $email)) continue;
            $cands[] = $email;
        }
        if (!$cands) return null;
        // サイトと同じドメインのアドレスを優先
        $site = preg_replace('/^www\./', '', strtolower((string) $siteHost));
        if ($site) {
            foreach ($cands as $e) {
                $d = substr(strrchr($e, '@'), 1);
                if ($d === $site || str_ends_with($site, '.' . $d) || str_ends_with($d, '.' . $site)) return $e;
            }
        }
        return $cands[0];
    }

    /* =========================================================
       ヘルパー
       ========================================================= */
    private function safely(string $label, callable $fn): array
    {
        try {
            return $fn();
        } catch (\Throwable $e) {
            Log::warning("lead collector {$label} failed", ['error' => $e->getMessage()]);
            $this->log[] = "{$label}: 失敗（" . Str::limit($e->getMessage(), 200) . '）';
            return [];
        }
    }

    private function hasAnySns(LeadCompany $lead): bool
    {
        foreach (LeadCompany::SNS_FIELDS as $f) {
            if (!empty($lead->{$f})) return true;
        }
        return false;
    }

    /** SSRF 対策: http(s) かつ プライベート/予約済みIPに解決されないホストのみ許可 */
    private function isSafePublicUrl(?string $url): bool
    {
        if (!$url) return false;
        $p = parse_url($url);
        if (!in_array(strtolower($p['scheme'] ?? ''), ['http', 'https'], true) || empty($p['host'])) return false;
        $ips = @gethostbynamel($p['host']) ?: [];
        if (!$ips) return false;
        foreach ($ips as $ip) {
            if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return false;
        }
        return true;
    }

    /** "www.example.co.jp" 等を https:// 付きに。URLとして不正なら null */
    public function normalizeWebsite(?string $url): ?string
    {
        $url = trim((string) $url);
        $url = preg_replace('/^[\s　]+|[\s　]+$/u', '', $url);
        if ($url === '' || in_array($url, ['なし', '無し', '-', '－'], true)) return null;
        if (!preg_match('#^https?://#i', $url)) $url = 'http://' . ltrim($url, '/');
        $url = mb_convert_kana($url, 'as');
        return filter_var($url, FILTER_VALIDATE_URL) && str_contains((string) parse_url($url, PHP_URL_HOST), '.') ? $url : null;
    }

    private function overpassRegex(string $s): string
    {
        // 正規表現メタ文字と Overpass の文字列区切りをエスケープ。空白区切りは OR 検索に
        $words = preg_split('/[\s　]+/u', trim($s), -1, PREG_SPLIT_NO_EMPTY);
        $escaped = array_map(fn ($w) => addcslashes(preg_quote($w), '"\\'), $words);
        return implode('|', $escaped);
    }

    private function osmCategory(array $t): ?string
    {
        foreach (['shop', 'office', 'amenity', 'craft', 'healthcare', 'tourism', 'leisure', 'company'] as $k) {
            if (!empty($t[$k])) {
                $v = $t[$k];
                return self::CATEGORY_LABELS[$v] ?? "{$k}={$v}";
            }
        }
        return null;
    }

    private function osmAddress(array $t): ?string
    {
        if (!empty($t['addr:full'])) return $t['addr:full'];
        $parts = array_filter([
            $t['addr:province'] ?? $t['addr:state'] ?? null,
            $t['addr:city'] ?? null,
            $t['addr:suburb'] ?? null,
            $t['addr:quarter'] ?? null,
            $t['addr:neighbourhood'] ?? null,
            isset($t['addr:block_number']) ? $t['addr:block_number'] . (isset($t['addr:housenumber']) ? '-' . $t['addr:housenumber'] : '') : ($t['addr:housenumber'] ?? null),
        ]);
        return $parts ? implode('', $parts) : null;
    }

    private function osmSnsValue(string $field, string $v): string
    {
        $v = trim($v);
        if (preg_match('#^https?://#i', $v)) {
            return ($this->classifySnsUrl($v)[1] ?? null) ?: $v;
        }
        $handle = ltrim($v, '@');
        return match ($field) {
            'instagram' => "https://www.instagram.com/{$handle}/",
            'twitter'   => "https://x.com/{$handle}",
            'facebook'  => "https://www.facebook.com/{$handle}",
            'tiktok'    => "https://www.tiktok.com/@{$handle}",
            'youtube'   => "https://www.youtube.com/@{$handle}",
            default     => $v,
        };
    }

    private function cleanAddress(?string $a): ?string
    {
        if (!$a) return null;
        return trim(preg_replace(['/^日本、\s*/u', '/^〒\d{3}-\d{4}\s*/u'], '', $a));
    }

    private function cityFromAddress(?string $a): string
    {
        if ($a && preg_match('/^(.+?[都道府県])?(.+?[市区町村])/u', $a, $m)) return $m[0];
        return '';
    }

    private function normalizeName(string $name): string
    {
        $n = mb_convert_kana($name, 'asKV');
        $n = mb_strtolower($n);
        $n = preg_replace('/(株式会社|有限会社|合同会社|\(株\)|\(有\)|㈱|㈲|[\s　・\-‐－_.,、。()（）「」])/u', '', $n);
        return $n;
    }

    private function distanceM(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $r = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return 2 * $r * asin(min(1, sqrt($a)));
    }
}
