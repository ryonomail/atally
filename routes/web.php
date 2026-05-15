<?php

use App\Http\Controllers\SocialAuthController;
use Illuminate\Support\Facades\Route;

// Google OAuth
Route::get('/auth/google/redirect', [SocialAuthController::class, 'redirectToGoogle']);
Route::get('/auth/google/callback', [SocialAuthController::class, 'handleGoogleCallback']);

// /agency/* → /company へのサーバーサイド301リダイレクト（SEO: クライアントサイドリダイレクトを置き換え）
Route::redirect('/agency', '/company', 301);
Route::redirect('/agency/job-database', '/company', 301);
Route::redirect('/agency/clients', '/company', 301);
Route::redirect('/agency/bulk-upload', '/company/bulk-upload', 301);
Route::get('/agency/{any}', fn() => redirect('/company', 301))->where('any', '.*');

// 求人一覧ページ: 都道府県・キーワード検索時のサーバーサイドSEO
Route::get('/jobs', function () {
    $prefecture = request()->query('prefecture', '');
    $keyword    = request()->query('keyword', '');
    $baseUrl    = config('app.url');

    $cacheKey = 'seo_jobs_count_' . md5($prefecture . '|' . $keyword);
    $count = \Illuminate\Support\Facades\Cache::remember($cacheKey, 900, function () use ($prefecture, $keyword) {
        return \App\Models\Job::where('status', 'active')
            ->when($prefecture, fn($q) => $q->where('prefecture', $prefecture))
            ->when($keyword, fn($q) => $q->where('title', 'ILIKE', "%{$keyword}%"))
            ->count();
    });

    if ($prefecture || $keyword) {
        $parts     = array_filter([$keyword ?: null, $prefecture ?: null]);
        $titlePart = implode('・', $parts);
        $seo = [
            'title'       => $titlePart . 'の求人・仕事探し ' . number_format($count) . '件 | Atally',
            'description' => ($prefecture ?: '全国') . 'の' . ($keyword ?: '求人') . '情報 ' . number_format($count) . '件以上掲載中。給与・勤務時間・待遇など詳細条件で検索できます。正社員・パート・アルバイト・派遣求人あり。',
            'url'         => $baseUrl . '/jobs?' . http_build_query(array_filter(compact('prefecture', 'keyword'))),
        ];
    } else {
        $seo = [
            'title'       => '求人・仕事探し ' . number_format($count) . '件 | Atally',
            'description' => '全国' . number_format($count) . '件以上の求人掲載中。正社員・パート・アルバイト・派遣など雇用形態や地域・職種で絞り込み検索。ハローワーク求人も掲載。無料で簡単に応募できます。',
            'url'         => $baseUrl . '/jobs',
        ];
    }

    return view('app', compact('seo'));
});

// 求人詳細ページ: サーバーサイドでメタ情報を埋め込み（Google しごと検索 + SNSシェア対応）
Route::get('/jobs/{id}', function ($id) {
    try {
        $job = \App\Models\Job::with('company:id,company_name,website')->find($id);
    } catch (\Throwable $e) {
        return response(view('app'), 500);
    }

    if (!$job || ($job->status?->value ?? '') !== 'active') {
        return response(view('app'), 404);
    }

    $employmentTypeMap = [
        '正社員' => 'FULL_TIME', '契約社員' => 'CONTRACTOR', 'パート' => 'PART_TIME',
        '派遣' => 'TEMPORARY', '業務委託' => 'OTHER', 'インターン' => 'INTERN',
    ];

    $salaryUnitMap = ['時給' => 'HOUR', '日給' => 'DAY', '月給' => 'MONTH', '年収' => 'YEAR'];
    $salaryUnit = $salaryUnitMap[$job->salary_type ?? ''] ?? 'YEAR';

    $validThrough = $job->expires_at
        ?? ($job->published_at ?? $job->created_at)?->copy()->addDays(90);

    $defaultOgImage = config('app.og_image');
    $baseUrl        = config('app.url');

    // meta description: 給与を正しくフォーマット（JS の formatSalary と同一ロジック）
    $salaryMin  = $job->salary_min;
    $salaryMax  = $job->salary_max;
    $salaryType = $job->salary_type ?? '';
    $salaryText = '';
    if ($salaryMin || $salaryMax) {
        $isSmall  = in_array($salaryType, ['時給', '日給']);
        $fmtVal   = fn($v) => ($v ? ($isSmall || $v < 100000 ? number_format((int)$v) . '円' : round($v / 10000) . '万円') : null);
        if ($salaryMin && $salaryMax) $salaryRange = $fmtVal($salaryMin) . '〜' . $fmtVal($salaryMax);
        elseif ($salaryMin)           $salaryRange = $fmtVal($salaryMin) . '〜';
        else                          $salaryRange = '〜' . $fmtVal($salaryMax);
        $salaryLabel = $salaryType ?: (($salaryMin >= 1000000 || $salaryMax >= 1000000) ? '年収' : '');
        $salaryText  = $salaryLabel ? "{$salaryLabel} {$salaryRange}" : $salaryRange;
    }
    $descSnippet = '';
    if ($job->description) {
        $clean       = trim(preg_replace('/【[^】]*】\n?/', '', $job->description));
        $descSnippet = ' ' . mb_substr($clean, 0, 50);
    }
    $metaDesc = mb_substr(
        ($job->company->company_name ?? '') . 'の' . $job->title . '。'
        . ($job->prefecture ? $job->prefecture . ' ' : '')
        . ($job->location ? $job->location . ' / ' : '')
        . ($job->employment_type ?? '')
        . ($salaryText ? ' / ' . $salaryText : '')
        . $descSnippet,
        0, 160
    );

    $seo = [
        'title'       => $job->title . '【' . ($job->prefecture ?? $job->location ?? '') . '】 - ' . ($job->company->company_name ?? '') . ' | Atally',
        'description' => $metaDesc,
        'url'         => $baseUrl . '/jobs/' . $job->id,
        'type'        => 'website',
        'image'       => $defaultOgImage,
        'jsonLd'      => [
            '@context' => 'https://schema.org',
            '@graph'   => [
                [
                    '@type'          => 'JobPosting',
                    'title'          => $job->title,
                    'description'    => mb_substr($job->description ?? '', 0, 5000),
                    'datePosted'     => ($job->published_at ?? $job->created_at)?->toIso8601String(),
                    'validThrough'   => $validThrough?->toIso8601String(),
                    'directApply'    => true,
                    'employmentType' => $employmentTypeMap[$job->employment_type] ?? 'OTHER',
                    'hiringOrganization' => [
                        '@type' => 'Organization',
                        'name'  => $job->company->company_name ?? '',
                        ...($job->company->website ? ['sameAs' => $job->company->website] : []),
                    ],
                    'jobLocation' => [
                        '@type'   => 'Place',
                        'address' => array_filter([
                            '@type'           => 'PostalAddress',
                            'addressRegion'   => $job->prefecture ?? '',
                            'addressLocality' => $job->location ?? '',
                            'addressCountry'  => 'JP',
                        ]),
                    ],
                    ...($job->salary_min || $job->salary_max ? [
                        'baseSalary' => [
                            '@type'    => 'MonetaryAmount',
                            'currency' => 'JPY',
                            'value'    => array_filter([
                                '@type'    => 'QuantitativeValue',
                                'minValue' => $job->salary_min ?: null,
                                'maxValue' => $job->salary_max ?: null,
                                'unitText' => $salaryUnit,
                            ]),
                        ],
                    ] : []),
                ],
                [
                    '@type'           => 'BreadcrumbList',
                    'itemListElement' => array_values(array_filter([
                        ['@type' => 'ListItem', 'position' => 1, 'name' => 'ホーム',   'item' => $baseUrl . '/'],
                        ['@type' => 'ListItem', 'position' => 2, 'name' => '求人一覧', 'item' => $baseUrl . '/jobs'],
                        $job->prefecture ? ['@type' => 'ListItem', 'position' => 3, 'name' => $job->prefecture . 'の求人', 'item' => $baseUrl . '/jobs?prefecture=' . urlencode($job->prefecture)] : null,
                        ['@type' => 'ListItem', 'position' => $job->prefecture ? 4 : 3, 'name' => $job->title],
                    ])),
                ],
            ],
        ],
    ];

    return view('app', compact('seo'));
})->where('id', '[0-9]+');

// 企業プロフィール: サーバーサイドメタ
Route::get('/companies/{id}', function ($id) {
    try {
        $company = \App\Models\Company::find($id);
    } catch (\Throwable $e) {
        return response(view('app'), 500);
    }

    if (!$company || ($company->verification_status?->value ?? '') !== 'verified') {
        return response(view('app'), 404);
    }

    $seo = [
        'title' => $company->company_name . ' の企業情報 | Atally',
        'description' => mb_substr(
            $company->company_name . 'の企業情報・求人一覧。' . ($company->description ?? ''),
            0, 160
        ),
        'url' => config('app.url') . '/companies/' . $company->id,
        'type' => 'website',
        'image' => null,
        'jsonLd' => [
            '@context' => 'https://schema.org',
            '@type' => 'Organization',
            'name' => $company->company_name,
            'url' => $company->website ?? '',
            'address' => $company->address ?? '',
        ],
    ];

    return view('app', compact('seo'));
})->where('id', '[0-9]+');

// ── サイトマップ（インデックス形式 → 最大50K件ずつ分割）─────────────────────────
// Googleの上限: 1サイトマップ50,000URL / 50MB。47万件 → 約10ファイルに自動分割。
Route::get('/sitemap.xml', function () {
    $baseUrl   = config('app.url');
    $totalJobs = \App\Models\Job::where('status', 'active')->count();
    $jobPages  = max(1, (int) ceil($totalJobs / 50000));
    $now       = now()->toAtomString();

    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    $xml .= '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    $xml .= "  <sitemap><loc>{$baseUrl}/sitemap-static.xml</loc><lastmod>{$now}</lastmod></sitemap>\n";
    for ($i = 1; $i <= $jobPages; $i++) {
        $xml .= "  <sitemap><loc>{$baseUrl}/sitemap-jobs-{$i}.xml</loc><lastmod>{$now}</lastmod></sitemap>\n";
    }
    $xml .= '</sitemapindex>';

    return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
});

// 静的ページ + 都道府県ランディング + 企業ページ
Route::get('/sitemap-static.xml', function () {
    $baseUrl = config('app.url');
    $prefectures = [
        '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
        '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
        '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
        '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
        '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
        '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
        '熊本県','大分県','宮崎県','鹿児島県','沖縄県',
    ];

    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

    foreach ([
        ['/', 'daily', '1.0'], ['/jobs', 'hourly', '0.9'], ['/register', 'monthly', '0.6'],
        ['/login', 'monthly', '0.5'], ['/resumes/guest', 'monthly', '0.7'],
        ['/terms', 'yearly', '0.3'], ['/privacy', 'yearly', '0.3'],
    ] as [$path, $freq, $pri]) {
        $xml .= "  <url><loc>{$baseUrl}{$path}</loc><changefreq>{$freq}</changefreq><priority>{$pri}</priority></url>\n";
    }

    foreach ($prefectures as $pref) {
        $url = $baseUrl . '/jobs?prefecture=' . urlencode($pref);
        $xml .= "  <url><loc>{$url}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>\n";
    }

    \App\Models\Company::where('verification_status', 'verified')
        ->select('id', 'updated_at')->orderBy('id')
        ->cursor()->each(function ($c) use (&$xml, $baseUrl) {
            $xml .= "  <url><loc>{$baseUrl}/companies/{$c->id}</loc>";
            if ($c->updated_at) $xml .= "<lastmod>{$c->updated_at->toAtomString()}</lastmod>";
            $xml .= "<changefreq>weekly</changefreq><priority>0.6</priority></url>\n";
        });

    $xml .= '</urlset>';

    return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
});

// 求人サイトマップ（1ページ50,000件、ストリーミング出力）
Route::get('/sitemap-jobs-{page}.xml', function ($page) {
    $baseUrl   = config('app.url');
    $page      = max(1, (int) $page);
    $perPage   = 50000;
    $offset    = ($page - 1) * $perPage;
    $totalJobs = \App\Models\Job::where('status', 'active')->count();

    if ($offset >= $totalJobs) abort(404);

    $callback = function () use ($baseUrl, $offset, $perPage) {
        echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

        $fetched = 0;
        \App\Models\Job::where('status', 'active')
            ->select('id', 'updated_at')
            ->orderBy('id')
            ->skip($offset)
            ->take($perPage)
            ->cursor()
            ->each(function ($job) use ($baseUrl, &$fetched) {
                echo "  <url><loc>{$baseUrl}/jobs/{$job->id}</loc>";
                if ($job->updated_at) echo "<lastmod>{$job->updated_at->toAtomString()}</lastmod>";
                echo "<changefreq>weekly</changefreq><priority>0.7</priority></url>\n";
                $fetched++;
                if ($fetched % 2000 === 0) { ob_flush(); flush(); }
            });

        echo '</urlset>';
    };

    return response()->stream($callback, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
})->where('page', '[0-9]+');

// SPA catch-all (must be last)
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '.*');
