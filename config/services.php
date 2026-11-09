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

    // 営業リスト自動収集（管理画面 > 営業リスト）
    'lead_collector' => [
        // Google Places API (New) のAPIキー。Googleマップ掲載企業（HP無し含む）の取得に使用
        'google_places_key' => env('GOOGLE_PLACES_API_KEY'),
        // Brave Search API のキー（任意）。ホームページの無い企業の SNS アカウント検索に使用
        'brave_search_key'  => env('BRAVE_SEARCH_API_KEY'),
        // 1回の調査で Web 検索する最大件数（Brave 無料枠は月2,000クエリ）
        'search_limit'      => (int) env('LEAD_SEARCH_LIMIT', 50),
        // 外部ダッシュボード（PythonAnywhere）がハローワーク事業所を取得するためのトークン
        'export_token'      => env('LEAD_EXPORT_TOKEN', ''),
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
        // サービスアカウントJSONキーの絶対パス（ホスト永続の secrets ボリューム内）
        'key_path' => env('GSC_KEY_PATH', storage_path('app/secrets/gsc-service-account.json')),
    ],
];
