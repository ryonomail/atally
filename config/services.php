<?php

return [
    'x' => [
        'api_key'              => env('X_API_KEY'),
        'api_secret'           => env('X_API_SECRET'),
        'access_token'        => env('X_ACCESS_TOKEN'),
        'access_token_secret' => env('X_ACCESS_TOKEN_SECRET'),
    ],

    'stripe' => [
        'key' => env('STRIPE_KEY'),
        'secret' => env('STRIPE_SECRET'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
    ],

    'crisp' => [
        'website_id' => env('CRISP_WEBSITE_ID'),
    ],

    'google' => [
        'client_id'           => env('GOOGLE_CLIENT_ID'),
        'client_secret'       => env('GOOGLE_CLIENT_SECRET'),
        'redirect'            => env('GOOGLE_CALLBACK_URL', '/auth/google/callback'),
        'ga4_id'              => env('GOOGLE_GA4_ID'),
        'site_verification'   => env('GOOGLE_SITE_VERIFICATION'),
    ],

    'hellowork' => [
        'base_url' => env('HELLOWORK_BASE_URL', ''),
        'id'       => env('HELLOWORK_ID', ''),
        'pass'     => env('HELLOWORK_PASS', ''),
    ],

    // Google Search Console API（SEO分析ループ用・サービスアカウント）
    'gsc' => [
        // URLプレフィックスなら 'https://atally.io/'、ドメインプロパティなら 'sc-domain:atally.io'
        'site_url' => env('GSC_SITE_URL', 'sc-domain:atally.io'),
        // サービスアカウントJSONキーの絶対パス（VPSに配置）
        'key_path' => env('GSC_KEY_PATH', storage_path('app/gsc-service-account.json')),
    ],
];
