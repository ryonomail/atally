<?php

return [

    // 1回の収集コマンド実行で新規に保存する件数の上限（Google Places APIの呼び出し課金を抑えるため）
    'daily_limit' => (int) env('SALES_LEADS_DAILY_LIMIT', 300),

    // 公式サイトのクロールに使うUser-Agent（企業自身が公開しているページのみを対象とし、
    // Instagram/Facebook/TikTok 等のSNSプラットフォーム自体へはアクセスしない）
    'crawler_user_agent' => 'AtallySalesLeadBot/1.0 (+https://atally.io; contact: support@atally.io)',

    'website_fetch_timeout_sec' => 8,

    // 対象業種: 中小企業・不動産・人材・飲食・観光
    // queries はそのまま「{キーワード} {都道府県}」の形でGoogle Places Text Searchに投げる
    'target_industries' => [
        'real_estate' => [
            'label' => '不動産',
            'queries' => ['不動産会社', '不動産仲介', '賃貸管理会社', '不動産管理会社'],
        ],
        'staffing' => [
            'label' => '人材',
            'queries' => ['人材紹介会社', '人材派遣会社', '転職エージェント', '求人紹介会社'],
        ],
        'restaurant' => [
            'label' => '飲食',
            'queries' => ['レストラン', '居酒屋', 'カフェ', '飲食店 経営会社'],
        ],
        'tourism' => [
            'label' => '観光',
            'queries' => ['旅行会社', '観光協会', 'ホテル', '旅館'],
        ],
        'sme_general' => [
            'label' => '中小企業（製造・卸・サービス業）',
            'queries' => ['製造業 中小企業', '卸売業 会社', '運送会社', '建設会社'],
        ],
    ],

    // 除外キーワード: Web制作・マーケティング会社（会社名・公式サイトのタイトル/説明文に
    // いずれか含まれていたら機械的に除外する）
    'exclude_keywords' => [
        'web制作', 'ウェブ制作', 'ホームページ制作', 'ホームページ作成', 'hp制作',
        'web広告', 'ウェブ広告', 'マーケティング', 'seo', 'sns運用代行',
        '広告代理店', '広告代理', 'デジタルマーケティング', 'コンテンツマーケティング',
        '制作会社', 'デザイン会社', 'クリエイティブエージェンシー',
        'システム開発', 'アプリ開発会社', 'ec制作',
    ],

    // Google Places API (New) の types ヒント（検索結果の確度確認・将来の絞り込み用。必須ではない）
    'industry_place_types' => [
        'real_estate' => ['real_estate_agency'],
        'staffing' => ['employment_agency'],
        'restaurant' => ['restaurant', 'cafe', 'bar', 'meal_takeaway'],
        'tourism' => ['travel_agency', 'lodging', 'tourist_attraction'],
        'sme_general' => [],
    ],

    // 全国47都道府県（ローテーション収集用）
    'prefectures' => [
        '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
        '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
        '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
        '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
        '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
        '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
        '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
    ],
];
