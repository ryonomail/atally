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
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_CALLBACK_URL', '/auth/google/callback'),
    ],

    'hellowork' => [
        'base_url' => env('HELLOWORK_BASE_URL', ''),
        'id'       => env('HELLOWORK_ID', ''),
        'pass'     => env('HELLOWORK_PASS', ''),
    ],
];
