<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    
    <?php if(isset($seo)): ?>
        <title><?php echo e($seo['title']); ?></title>
        <meta name="description" content="<?php echo e($seo['description']); ?>">
        <link rel="canonical" href="<?php echo e($seo['url']); ?>">
        <meta property="og:type" content="<?php echo e($seo['type'] ?? 'website'); ?>">
        <meta property="og:title" content="<?php echo e($seo['title']); ?>">
        <meta property="og:description" content="<?php echo e($seo['description']); ?>">
        <meta property="og:url" content="<?php echo e($seo['url']); ?>">
        <meta property="og:site_name" content="Atally">
        <meta property="og:locale" content="ja_JP">
        <?php if(!empty($seo['image'])): ?>
            <meta property="og:image" content="<?php echo e($seo['image']); ?>">
        <?php endif; ?>
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="<?php echo e($seo['title']); ?>">
        <meta name="twitter:description" content="<?php echo e($seo['description']); ?>">
        <?php if(!empty($seo['jsonLd'])): ?>
            <script type="application/ld+json"><?php echo json_encode($seo['jsonLd'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?></script>
        <?php endif; ?>
    <?php else: ?>
        <title>Atally - 次世代求人マッチングプラットフォーム</title>
        <meta name="description" content="Atally（アタリー）は品質重視の求人マッチングプラットフォーム。求職者は無料で高機能な履歴書作成、企業は品質スコアで最適な採用を。">
        <meta property="og:type" content="website">
        <meta property="og:title" content="Atally - 次世代求人マッチングプラットフォーム">
        <meta property="og:description" content="品質重視の次世代求人マッチングプラットフォーム。求職者は無料、企業は品質スコアで最適な採用。">
        <meta property="og:site_name" content="Atally">
        <meta property="og:locale" content="ja_JP">
        <meta name="twitter:card" content="summary_large_image">
        <script type="application/ld+json"><?php echo json_encode([
            '@context' => 'https://schema.org',
            '@type' => 'WebSite',
            'name' => 'Atally',
            'url' => config('app.url'),
            'description' => '品質重視の次世代求人マッチングプラットフォーム',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?></script>
    <?php endif; ?>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script>window.__STRIPE_KEY__ = "<?php echo e(config('services.stripe.key')); ?>";</script>

    
    <?php if(config('services.crisp.website_id')): ?>
    <script>
        window.$crisp = [];
        window.CRISP_WEBSITE_ID = "<?php echo e(config('services.crisp.website_id')); ?>";
        (function() {
            var d = document;
            var s = d.createElement('script');
            s.src = 'https://client.crisp.chat/l.js';
            s.async = 1;
            d.getElementsByTagName('head')[0].appendChild(s);
        })();
    </script>
    <?php endif; ?>

    <?php echo app('Illuminate\Foundation\Vite')->reactRefresh(); ?>
    <?php echo app('Illuminate\Foundation\Vite')(['resources/css/app.css', 'resources/js/app.jsx']); ?>
</head>
<body>
    <div id="app"></div>
</body>
</html>
<?php /**PATH /var/www/html/resources/views/app.blade.php ENDPATH**/ ?>