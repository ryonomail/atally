import React from 'react';
import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'Atally';
const DEFAULT_DESCRIPTION = '品質重視の次世代求人マッチングプラットフォーム。求職者は無料で高機能な履歴書作成、企業は品質スコアで最適な採用を。';
const DEFAULT_IMAGE = '/images/og-default.png';

export default function SEO({ title, description, image, url, type = 'website', noindex = false, jsonLd }) {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - 次世代求人マッチングプラットフォーム`;
    const desc = description || DEFAULT_DESCRIPTION;
    const ogImage = image || DEFAULT_IMAGE;
    const canonical = url || window.location.href;

    return (
        <Helmet>
            <title>{fullTitle}</title>
            <meta name="description" content={desc} />
            {noindex && <meta name="robots" content="noindex, nofollow" />}
            <link rel="canonical" href={canonical} />

            {/* Open Graph */}
            <meta property="og:type" content={type} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={desc} />
            <meta property="og:image" content={ogImage} />
            <meta property="og:url" content={canonical} />
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:locale" content="ja_JP" />

            {/* Twitter Card */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={desc} />
            <meta name="twitter:image" content={ogImage} />

            {/* JSON-LD */}
            {jsonLd && (
                <script type="application/ld+json">
                    {JSON.stringify(jsonLd)}
                </script>
            )}
        </Helmet>
    );
}
