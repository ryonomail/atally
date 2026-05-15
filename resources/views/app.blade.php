<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    {{-- Favicon --}}
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="apple-touch-icon" href="/favicon.svg">

    {{-- 動的メタ情報（SSR: クローラー向け） --}}
    @php
        $title       = $seo['title']       ?? 'Atally - 次世代求人マッチングプラットフォーム';
        $description = $seo['description'] ?? 'Atally（アタリー）は品質重視の求人マッチングプラットフォーム。求職者は無料で高機能な履歴書作成、企業は品質スコアで最適な採用を。';
        $canonical   = $seo['url']         ?? config('app.url') . request()->getPathInfo();
        $ogType      = $seo['type']        ?? 'website';
        $ogImage     = $seo['image']       ?? config('app.og_image');
        $jsonLd      = $seo['jsonLd']      ?? [
            '@context'    => 'https://schema.org',
            '@type'       => 'WebSite',
            'name'        => 'Atally',
            'url'         => config('app.url'),
            'description' => '品質重視の次世代求人マッチングプラットフォーム',
        ];
    @endphp

    <title>{{ $title }}</title>
    <meta name="description" content="{{ $description }}">
    <link rel="canonical" href="{{ $canonical }}">

    <meta property="og:type" content="{{ $ogType }}">
    <meta property="og:title" content="{{ $title }}">
    <meta property="og:description" content="{{ $description }}">
    <meta property="og:url" content="{{ $canonical }}">
    <meta property="og:site_name" content="Atally">
    <meta property="og:locale" content="ja_JP">
    @if($ogImage)
        <meta property="og:image" content="{{ $ogImage }}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
    @endif

    <meta name="twitter:card" content="{{ $ogImage ? 'summary_large_image' : 'summary' }}">
    <meta name="twitter:title" content="{{ $title }}">
    <meta name="twitter:description" content="{{ $description }}">
    @if($ogImage)
        <meta name="twitter:image" content="{{ $ogImage }}">
    @endif

    <script type="application/ld+json" nonce="{{ request()->attributes->get('csp_nonce') }}">{!! json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !!}</script>

    {{-- Google Search Console 所有権確認（GOOGLE_SITE_VERIFICATION が設定されている場合のみ） --}}
    @if(config('services.google.site_verification'))
    <meta name="google-site-verification" content="{{ config('services.google.site_verification') }}">
    @endif

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script nonce="{{ request()->attributes->get('csp_nonce') }}">window.__STRIPE_KEY__ = "{{ config('services.stripe.key') }}";</script>

    {{-- Google Analytics 4（GOOGLE_GA4_ID が設定されている場合のみ。SPAのページ遷移はReact側でトラッキング） --}}
    @if(config('services.google.ga4_id'))
    <script async src="https://www.googletagmanager.com/gtag/js?id={{ config('services.google.ga4_id') }}"></script>
    <script nonce="{{ request()->attributes->get('csp_nonce') }}">
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '{{ config('services.google.ga4_id') }}', { send_page_view: false });
        window.__GA4_ID__ = '{{ config('services.google.ga4_id') }}';
    </script>
    @endif

    {{-- Crisp チャットウィジェット（CRISP_WEBSITE_ID が設定されている場合のみ） --}}
    @if(config('services.crisp.website_id'))
    <script nonce="{{ request()->attributes->get('csp_nonce') }}">
        window.$crisp = [];
        window.CRISP_WEBSITE_ID = "{{ config('services.crisp.website_id') }}";
        (function() {
            var d = document;
            var s = d.createElement('script');
            s.src = 'https://client.crisp.chat/l.js';
            s.async = 1;
            d.getElementsByTagName('head')[0].appendChild(s);
        })();
    </script>
    @endif

    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
</head>
<body>
    <div id="app"></div>
</body>
</html>
