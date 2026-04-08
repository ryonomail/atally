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
        return view('app');
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
        return view('app');
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

// SPA catch-all (must be last)
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '.*');
