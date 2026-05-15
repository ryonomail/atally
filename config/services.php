<?php

return [
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
];
