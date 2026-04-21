<?php

use App\Http\Controllers\SocialAuthController;
use Illuminate\Support\Facades\Route;

// Google OAuth
Route::get('/auth/google/redirect', [SocialAuthController::class, 'redirectToGoogle']);
Route::get('/auth/google/callback', [SocialAuthController::class, 'handleGoogleCallback']);

// 求人詳細ページ: サーバーサイドでメタ情報を埋め込み（Google しごと検索 + SNSシェア対応）
Route::get('/jobs/{id}', function ($id) {
    $job = \App\Models\Job::with('company:id,company_name,website')->find($id);

    if (!$job || $job->status->value !== 'active') {
        return response(view('app'), 404);
    }

    $employmentTypeMap = [
        '正社員' => 'FULL_TIME', '契約社員' => 'CONTRACTOR', 'パート' => 'PART_TIME',
        '派遣' => 'TEMPORARY', '業務委託' => 'OTHER', 'インターン' => 'INTERN',
    ];

    $seo = [
        'title' => $job->title . ' - ' . ($job->company->company_name ?? '') . ' | Atally',
        'description' => mb_substr(
            ($job->company->company_name ?? '') . 'の' . $job->title . '。'
            . ($job->location ? $job->location . ' / ' : '')
            . ($job->employment_type ?? '')
            . ($job->salary_min ? ' / 年収' . round($job->salary_min / 10000) . '万円〜' : ''),
            0, 160
        ),
        'url' => config('app.url') . '/jobs/' . $job->id,
        'type' => 'website',
        'image' => null,
        'jsonLd' => [
            '@context' => 'https://schema.org/',
            '@type' => 'JobPosting',
            'title' => $job->title,
            'description' => mb_substr($job->description ?? '', 0, 5000),
            'datePosted' => ($job->published_at ?? $job->created_at)?->toIso8601String(),
            ...($job->expires_at ? ['validThrough' => $job->expires_at->toIso8601String()] : []),
            'employmentType' => $employmentTypeMap[$job->employment_type] ?? 'OTHER',
            'hiringOrganization' => [
                '@type' => 'Organization',
                'name' => $job->company->company_name ?? '',
                'sameAs' => $job->company->website ?? '',
            ],
            'jobLocation' => [
                '@type' => 'Place',
                'address' => [
                    '@type' => 'PostalAddress',
                    'addressRegion' => $job->location ?? '',
                    'addressCountry' => 'JP',
                ],
            ],
            ...($job->salary_min || $job->salary_max ? [
                'baseSalary' => [
                    '@type' => 'MonetaryAmount',
                    'currency' => 'JPY',
                    'value' => array_filter([
                        '@type' => 'QuantitativeValue',
                        'minValue' => $job->salary_min,
                        'maxValue' => $job->salary_max,
                        'unitText' => 'YEAR',
                    ]),
                ],
            ] : []),
        ],
    ];

    return view('app', compact('seo'));
})->where('id', '[0-9]+');

// 企業プロフィール: サーバーサイドメタ
Route::get('/companies/{id}', function ($id) {
    $company = \App\Models\Company::find($id);

    if (!$company || $company->verification_status !== 'approved') {
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

// 動的サイトマップ（静的ファイルの代わりに常に最新データを返す）
Route::get('/sitemap.xml', function () {
    $baseUrl = config('app.url');

    $staticUrls = [
        ['loc' => $baseUrl . '/',                 'changefreq' => 'daily',   'priority' => '1.0'],
        ['loc' => $baseUrl . '/jobs',             'changefreq' => 'hourly',  'priority' => '0.9'],
        ['loc' => $baseUrl . '/register',         'changefreq' => 'monthly', 'priority' => '0.6'],
        ['loc' => $baseUrl . '/login',            'changefreq' => 'monthly', 'priority' => '0.5'],
        ['loc' => $baseUrl . '/resumes/guest',    'changefreq' => 'monthly', 'priority' => '0.7'],
        ['loc' => $baseUrl . '/terms',            'changefreq' => 'yearly',  'priority' => '0.3'],
        ['loc' => $baseUrl . '/privacy',          'changefreq' => 'yearly',  'priority' => '0.3'],
    ];

    $jobs = \App\Models\Job::where('status', 'active')
        ->select('id', 'updated_at')
        ->orderByDesc('updated_at')
        ->limit(1000)
        ->get();

    $companies = \App\Models\Company::where('verification_status', 'approved')
        ->select('id', 'updated_at')
        ->orderByDesc('updated_at')
        ->limit(200)
        ->get();

    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

    foreach ($staticUrls as $url) {
        $xml .= "  <url>\n";
        $xml .= "    <loc>{$url['loc']}</loc>\n";
        $xml .= "    <changefreq>{$url['changefreq']}</changefreq>\n";
        $xml .= "    <priority>{$url['priority']}</priority>\n";
        $xml .= "  </url>\n";
    }

    foreach ($jobs as $job) {
        $lastmod = $job->updated_at?->toAtomString();
        $xml .= "  <url>\n";
        $xml .= "    <loc>{$baseUrl}/jobs/{$job->id}</loc>\n";
        if ($lastmod) $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
        $xml .= "    <changefreq>daily</changefreq>\n";
        $xml .= "    <priority>0.8</priority>\n";
        $xml .= "  </url>\n";
    }

    foreach ($companies as $company) {
        $lastmod = $company->updated_at?->toAtomString();
        $xml .= "  <url>\n";
        $xml .= "    <loc>{$baseUrl}/companies/{$company->id}</loc>\n";
        if ($lastmod) $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
        $xml .= "    <changefreq>weekly</changefreq>\n";
        $xml .= "    <priority>0.6</priority>\n";
        $xml .= "  </url>\n";
    }

    $xml .= '</urlset>';

    return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
});

// SPA catch-all (must be last)
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '.*');
