<?php

namespace App\Services;

use App\Models\LeadCollectionRun;
use App\Models\LeadCompany;
use Illuminate\Http\Client\Pool;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * 営業リスト（見込み企業）の自動収集。
 *
 * 収集元:
 *  1. Google Places API (Text Search)  … Googleマップ掲載の店舗・企業。ホームページ未保有の企業も取得できる
 *  2. OpenStreetMap (Nominatim + Overpass) … APIキー不要のフォールバック。SNSタグ(contact:instagram 等)も保有
 * 補完:
 *  3. 公式サイトのトップページを取得し、SNSリンク・メールアドレスを抽出
 *  4. ホームページが無い企業は Brave Search API（任意）で SNS アカウントを検索
 *
 * Googleマップの画面スクレイピングは利用規約違反のため行わず、公式APIのみを使う。
 */
class LeadCollectorService
{
    private const USER_AGENT = 'Mozilla/5.0 (compatible; AtallyLeadCollector/1.0; +https://atally.io)';

    /** 1回の収集でサイト巡回する最大件数 */
    private const MAX_SITE_FETCH = 120;

    /** 1回の収集で SNS 検索する最大件数（Brave の無料枠は月2,000クエリ） */
    private const MAX_SNS_SEARCH = 40;

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

    public static function availableSources(): array
    {
        return [
            'google' => (bool) config('services.lead_collector.google_places_key'),
            'osm'    => true,
            'sns_search' => (bool) config('services.lead_collector.brave_search_key'),
        ];
    }

    /**
     * 収集のメイン処理（キュージョブから呼ばれる）
     */
    public function run(LeadCollectionRun $run): void
    {
        $run->update(['status' => 'running', 'started_at' => now()]);

        $sources = $run->sources ?: ['google', 'osm'];
        $available = self::availableSources();
        $places = [];

        if (in_array('google', $sources, true)) {
            if ($available['google']) {
                $places = array_merge($places, $this->safely('Googleマップ', fn () => $this->fetchGooglePlaces($run->keyword, $run->area)));
            } else {
                $this->log[] = 'Googleマップ: APIキー(GOOGLE_PLACES_API_KEY)未設定のためスキップ';
            }
        }
        if (in_array('osm', $sources, true)) {
            $places = array_merge($places, $this->safely('OpenStreetMap', fn () => $this->fetchOsm($run->keyword, $run->area)));
        }

        $places = $this->dedupe($places);
        $run->update(['found_count' => count($places)]);

        // 保存
        $new = 0;
        $updated = 0;
        $ids = [];
        foreach ($places as $p) {
            $lead = LeadCompany::firstOrNew(['source' => $p['source'], 'external_id' => $p['external_id']]);
            $isNew = !$lead->exists;
            foreach ($p as $k => $v) {
                // 既存レコードの手入力・補完済みの値は空値で上書きしない
                if ($v === null || $v === '') continue;
                $lead->{$k} = $v;
            }
            $lead->has_website = !empty($lead->website);
            $lead->search_keyword = $run->keyword;
            $lead->search_area = $run->area;
            $lead->last_run_id = $run->id;
            $lead->save();
            $ids[] = $lead->id;
            $isNew ? $new++ : $updated++;
        }
        $run->update(['new_count' => $new, 'updated_count' => $updated]);

        // 公式サイト・SNS 補完
        $this->safely('SNS補完', function () use ($ids) {
            $this->enrich(LeadCompany::whereIn('id', $ids)->get());
            return [];
        });

        $this->log[] = sprintf('取得 %d件（新規 %d / 更新 %d）', count($places), $new, $updated);
        $run->update([
            'status'      => 'done',
            'finished_at' => now(),
            'message'     => implode("\n", $this->log),
        ]);
    }

    public function enrich(iterable $leads): void
    {
        $toFetch = [];
        $toSearch = [];
        foreach ($leads as $lead) {
            // Google が「ウェブサイト」として Instagram 等を登録しているケースを SNS に振り分け
            if ($lead->website && ($sns = $this->classifySnsUrl($lead->website))) {
                [$field, $url] = $sns;
                if (empty($lead->{$field})) $lead->{$field} = $url;
                $lead->website = null;
                $lead->has_website = false;
                $lead->save();
            }

            if ($lead->website) {
                $toFetch[] = $lead;
            } elseif (!$this->hasAnySns($lead)) {
                $toSearch[] = $lead;
            }
        }

        $this->enrichFromWebsites(array_slice($toFetch, 0, self::MAX_SITE_FETCH));

        if (config('services.lead_collector.brave_search_key')) {
            $this->enrichFromSearch(array_slice($toSearch, 0, self::MAX_SNS_SEARCH));
        } elseif ($toSearch) {
            $this->log[] = sprintf('ホームページ無し %d件: SNS検索APIキー(BRAVE_SEARCH_API_KEY)未設定のため SNS 検索をスキップ', count($toSearch));
        }
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
       公式サイトから SNS / メール抽出
       ========================================================= */
    private function enrichFromWebsites(array $leads): void
    {
        $count = 0;
        foreach (array_chunk($leads, 8) as $chunk) {
            $chunk = array_values(array_filter($chunk, fn ($l) => $this->isSafePublicUrl($l->website)));
            if (!$chunk) continue;

            $responses = Http::pool(fn (Pool $pool) => array_map(
                fn ($l) => $pool->withHeaders(['User-Agent' => self::USER_AGENT])
                    ->withOptions(['allow_redirects' => ['max' => 3]])
                    ->timeout(10)->get($l->website),
                $chunk
            ));

            foreach ($chunk as $i => $lead) {
                $res = $responses[$i] ?? null;
                if (!$res instanceof \Illuminate\Http\Client\Response || !$res->successful()) continue;
                $html = substr($res->body(), 0, 2_000_000);
                $found = $this->extractSnsLinks($html);
                foreach ($found as $field => $url) {
                    if (empty($lead->{$field})) $lead->{$field} = $url;
                }
                if (empty($lead->email) && ($email = $this->extractEmail($html))) {
                    $lead->email = $email;
                }
                $lead->enriched_at = now();
                $lead->save();
                $count++;
            }
        }
        if ($leads) $this->log[] = "公式サイト巡回: {$count}/" . count($leads) . '件';
    }

    /* =========================================================
       ホームページ無し企業の SNS を検索（Brave Search API）
       ========================================================= */
    private function enrichFromSearch(array $leads): void
    {
        $key = config('services.lead_collector.brave_search_key');
        $hit = 0;
        foreach ($leads as $lead) {
            $city = $this->cityFromAddress($lead->address);
            $q = "\"{$lead->name}\" {$city} (instagram OR facebook OR twitter OR x.com)";
            try {
                $res = Http::withHeaders(['X-Subscription-Token' => $key, 'Accept' => 'application/json'])
                    ->timeout(15)
                    ->get('https://api.search.brave.com/res/v1/web/search', [
                        'q' => $q, 'count' => 10, 'country' => 'JP', 'search_lang' => 'jp',
                    ]);
                if ($res->status() === 429) { sleep(2); continue; }
                if (!$res->successful()) continue;

                $nameKey = $this->normalizeName($lead->name);
                $changed = false;
                foreach ($res->json('web.results', []) as $r) {
                    $sns = $this->classifySnsUrl($r['url'] ?? '');
                    if (!$sns) continue;
                    // 検索結果のタイトル/説明に社名が含まれるものだけ採用（誤マッチ防止）
                    $text = $this->normalizeName(($r['title'] ?? '') . ($r['description'] ?? ''));
                    if ($nameKey === '' || mb_strpos($text, $nameKey) === false) continue;
                    [$field, $url] = $sns;
                    if (empty($lead->{$field})) { $lead->{$field} = $url; $changed = true; }
                }
                $lead->enriched_at = now();
                $lead->save();
                if ($changed) $hit++;
            } catch (\Throwable $e) {
                Log::info('lead sns search failed', ['lead' => $lead->id, 'error' => $e->getMessage()]);
            }
            usleep(1_100_000); // 無料プランは 1 req/sec
        }
        if ($leads) $this->log[] = "SNS検索（HP無し企業）: {$hit}/" . count($leads) . '件で発見';
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

    public function extractEmail(string $html): ?string
    {
        if (preg_match_all('/mailto:([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/i', $html, $m)) {
            foreach ($m[1] as $email) {
                $email = strtolower($email);
                if (!preg_match('/(example\.|sentry|wixpress|\.png|\.jpg)/', $email)) return $email;
            }
        }
        return null;
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
