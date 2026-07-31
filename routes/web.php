<?php

use App\Http\Controllers\SocialAuthController;
use Illuminate\Support\Facades\Route;

// Google OAuth
Route::get('/auth/google/redirect', [SocialAuthController::class, 'redirectToGoogle']);
Route::get('/auth/google/callback', [SocialAuthController::class, 'handleGoogleCallback']);

// /agency/* → /company へのサーバーサイド301リダイレクト（SEO: クライアントサイドリダイレクトを置き換え）
Route::redirect('/agency', '/company', 301);
Route::redirect('/agency/job-database', '/company', 301);
Route::redirect('/agency/clients', '/company', 301);
Route::redirect('/agency/bulk-upload', '/company/bulk-upload', 301);
Route::get('/agency/{any}', fn() => redirect('/company', 301))->where('any', '.*');

// ── 主要ページのサーバーサイドSEO ────────────────────────────────────────────────

// トップページ
Route::get('/', function () {
    $baseUrl  = config('app.url');
    $jobCount = \Illuminate\Support\Facades\Cache::remember('seo_total_jobs', 3600,
        fn() => \App\Models\Job::where('status', 'active')->count());
    $seo = [
        'title'       => '履歴書を無料で作って仕事を探す | ' . number_format($jobCount) . '件掲載 | Atally',
        'description' => '登録不要・完全無料で履歴書が作れる求人サイト。' . number_format($jobCount) . '件以上の求人掲載中（ハローワーク求人含む）。作成した履歴書でそのまま応募できます。ブラック求人ゼロ・職業安定法準拠。',
        'url'         => $baseUrl . '/',
        'jsonLd'      => [
            '@context'       => 'https://schema.org',
            '@type'          => 'WebSite',
            'name'           => 'Atally',
            'url'            => $baseUrl,
            'description'    => '登録不要・完全無料で使える履歴書作成ツール付き求人サイト',
            'potentialAction' => [
                '@type'       => 'SearchAction',
                'target'      => $baseUrl . '/jobs?keyword={search_term_string}',
                'query-input' => 'required name=search_term_string',
            ],
        ],
    ];
    return view('app', compact('seo'));
});

// 無料登録ページ
Route::get('/register', function () {
    $baseUrl = config('app.url');
    $seo = [
        'title'       => '無料会員登録 | 履歴書管理・求人応募が使い放題 | Atally',
        'description' => 'Atallyに無料登録すると、履歴書を何枚でも管理でき、47万件以上の求人にワンクリックで応募できます。Googleアカウントで30秒登録。クレジットカード不要。',
        'url'         => $baseUrl . '/register',
        'noindex'     => false,
    ];
    return view('app', compact('seo'));
});

// ログインページ
// ★ ->name('login') は必須: 未認証時にLaravelが route('login') を解決する。
//    名前が無いと RouteNotFoundException になり、APIが401ではなく500を返す（履歴書が作れない障害の原因だった）
Route::get('/login', function () {
    $seo = [
        'title'       => 'ログイン | Atally',
        'description' => 'Atallyにログインして求人応募・履歴書管理・メッセージ機能を使いましょう。',
        'url'         => config('app.url') . '/login',
    ];
    return view('app', compact('seo'));
})->name('login');

// 企業向けランディングページ
Route::get('/for-companies', function () {
    $baseUrl = config('app.url');
    $seo = [
        'title'       => '企業・採用担当者の方へ | 成果報酬型・品質スコアで採用効率UP | Atally',
        'description' => '採用担当者向け求人掲載サービス。品質スコアで優良企業を見える化。成果報酬型プランあり。47万件のハローワーク求人と同じプラットフォームで求職者にリーチ。まず無料で試せます。',
        'url'         => $baseUrl . '/for-companies',
    ];
    return view('app', compact('seo'));
});

// 料金ページ
Route::get('/pricing', function () {
    $baseUrl = config('app.url');
    $seo = [
        'title'       => '料金プラン | 求人掲載・スカウト・応募管理 | Atally',
        'description' => 'Atallyの料金プラン一覧。求人掲載・スカウト機能・応募管理など、企業規模に合わせたプランを用意。まずは無料プランでお試しいただけます。',
        'url'         => $baseUrl . '/pricing',
    ];
    return view('app', compact('seo'));
});

// 人材紹介会社向けランディングページ
Route::get('/for-agencies', function () {
    $baseUrl = config('app.url');
    $seo = [
        'title'       => '人材紹介・派遣会社の方へ | 紹介・派遣求人を歓迎、無料掲載 | Atally',
        'description' => '大手求人サイトで掲載制限を受けがちな人材紹介・派遣の求人も、Atallyならそのまま無料掲載。許可番号・紹介元/派遣元の法令表示はシステムが自動対応。CSV一括登録・変換サポートあり。',
        'url'         => $baseUrl . '/for-agencies',
    ];
    return view('app', compact('seo'));
});

// コラム一覧ページ
Route::get('/column', function () {
    $seo = [
        'title'       => '転職・就活お役立ちコラム | 履歴書・志望動機の書き方 | Atally',
        'description' => '履歴書の書き方、志望動機の書き方、職務経歴書の作り方など転職・就活に役立つ情報を掲載。無料の履歴書作成ツールと合わせてご活用ください。',
        'url'         => config('app.url') . '/column',
    ];
    return view('app', compact('seo'));
});

// コラム個別ページ（slug別サーバーサイドSEO）
Route::get('/column/{slug}', function (string $slug) {
    $meta = [
        'rirekisho-kakikata'     => [
            'title'       => '履歴書の書き方【2026年最新版】各項目の記入例・よくあるNG例も解説 | Atally',
            'description' => '履歴書の正しい書き方を各項目ごとに解説。学歴・職歴の書き方、志望動機・自己PRの例文、手書きvsPC比較、よくあるNG例まで網羅した完全ガイド。',
            'published'   => '2026-01-10T00:00:00+09:00',
            'modified'    => '2026-05-19T00:00:00+09:00',
        ],
        'shibo-doki-kakikata'    => [
            'title'       => '志望動機の書き方【例文10選】採用担当者の目線で徹底解説 | Atally',
            'description' => '採用担当者が見ている志望動機のポイントを解説。事務・営業・IT・介護など業界別の例文10選、NG例、転職者向けの書き方まで完全網羅。',
            'published'   => '2026-01-15T00:00:00+09:00',
            'modified'    => '2026-05-19T00:00:00+09:00',
        ],
        'shokumukeirekisho-toha' => [
            'title'       => '職務経歴書とは？履歴書との違い・書き方・テンプレート【2026年】 | Atally',
            'description' => '職務経歴書と履歴書の違いを分かりやすく解説。書くべき内容、編年体・機能別の選び方、事務・営業・エンジニア別のテンプレートも掲載。',
            'published'   => '2026-01-20T00:00:00+09:00',
            'modified'    => '2026-05-19T00:00:00+09:00',
        ],
        'jiko-pr-kakikata'       => [
            'title'       => '自己PRの書き方【例文8選】強みの見つけ方から構成まで完全ガイド | Atally',
            'description' => '自己PRの書き方をSTAR法で解説。強みの見つけ方、職種別例文8選、字数の目安、新卒と転職者の違いまで網羅した完全ガイド。',
            'published'   => '2026-02-01T00:00:00+09:00',
            'modified'    => '2026-05-19T00:00:00+09:00',
        ],
        'rirekisho-shikaku'      => [
            'title'       => '履歴書に書ける資格・書き方一覧【採用に効く資格ランキング2026】 | Atally',
            'description' => '履歴書に書くべき資格・書かない方がいい資格を解説。業種別おすすめ資格、TOEICスコアの書き方、取得中の資格の扱い方まで詳しく解説。',
            'published'   => '2026-02-10T00:00:00+09:00',
            'modified'    => '2026-05-19T00:00:00+09:00',
        ],
        'tensyoku-rirekisho' => [
            'title'       => '転職用履歴書の書き方【職歴が多い場合の整理方法・例文付き】 | Atally',
            'description' => '転職回数が多い方・職歴が複雑な方向けの履歴書の書き方。職歴の整理方法、転職理由の書き方、採用担当者が転職用履歴書で見るポイントを解説。',
            'published'   => '2026-03-01T00:00:00+09:00',
            'modified'    => '2026-05-19T00:00:00+09:00',
        ],
        'shokureki-nashi-rirekisho' => [
            'title'       => '職歴なし履歴書の書き方｜職歴欄「なし」の書き方・例文・サンプル【フリーター・既卒】 | Atally',
            'description' => '職歴なしの履歴書の書き方を完全ガイド。職歴欄に「なし」と書く方法、完成サンプル、自己PR・志望動機の例文、職務経歴書は必要かまで網羅。フリーター・既卒・社会人未経験の方向け。無料で履歴書も作成できます。',
            'published'   => '2026-03-10T00:00:00+09:00',
            'modified'    => '2026-06-18T00:00:00+09:00',
        ],
        'blank-period-rirekisho' => [
            'title'       => '空白期間・ブランクがある履歴書の書き方【採用担当者への伝え方】 | Atally',
            'description' => '育児・介護・病気・留学などで空白期間がある場合の履歴書の書き方。ブランクをポジティブに説明する方法と、採用担当者が納得する伝え方を例文付きで解説。',
            'published'   => '2026-03-20T00:00:00+09:00',
            'modified'    => '2026-05-19T00:00:00+09:00',
        ],
        'part-rirekisho-shibo-doki' => [
            'title'       => 'パート・アルバイト応募の志望動機の書き方【主婦・未経験向け例文集】 | Atally',
            'description' => 'パート・アルバイト応募の志望動機の書き方と例文。主婦・育児中・ブランクあり・未経験の方向けの書き方テンプレート。スーパー・コンビニ・飲食・事務など職種別例文も。',
            'published'   => '2026-04-01T00:00:00+09:00',
            'modified'    => '2026-05-19T00:00:00+09:00',
        ],
        'tenshoku-riyuu-kakikata' => [
            'title'       => '転職理由・退職理由の書き方【ネガティブをポジティブに変換する例文集】 | Atally',
            'description' => '転職理由・退職理由の書き方を解説。「給与が低い」「人間関係が嫌だった」などのネガティブな本音をポジティブに言い換える例文集と、面接での答え方まで。',
            'published'   => '2026-04-10T00:00:00+09:00',
            'modified'    => '2026-05-19T00:00:00+09:00',
        ],
        'mensetsu-manner' => [
            'title'       => '面接のマナー・服装・当日の流れ【採用担当者が見るポイント完全ガイド】 | Atally',
            'description' => '転職・就活の面接マナーを完全解説。入室から退室までの正しい流れ、服装のポイント、よく聞かれる質問と回答例、オンライン面接の注意点まで網羅。',
            'published'   => '2026-04-20T00:00:00+09:00',
            'modified'    => '2026-05-19T00:00:00+09:00',
        ],
        'engineer-shokumukeirekisho' => [
            'title'       => 'エンジニアの職務経歴書の書き方【スキルシート・プロジェクト記載のコツ】 | Atally',
            'description' => 'ITエンジニアの職務経歴書の書き方。スキルシートの書き方、プロジェクト経歴の記載方法、採用担当者・技術面接官が見るポイントを例文付きで解説。',
            'published'   => '2026-05-01T00:00:00+09:00',
            'modified'    => '2026-05-19T00:00:00+09:00',
        ],
        'rirekisho-template' => [
            'title'       => '履歴書テンプレート 無料ダウンロード【Word・PDF対応】2026年最新版 | Atally',
            'description' => '履歴書テンプレートを無料でダウンロード。JIS規格対応・A4サイズ・Word/PDF形式。新卒・転職・パートどれにも使えるフォーマットと正しい書き方を解説。',
            'published'   => '2026-06-04T00:00:00+09:00',
            'modified'    => '2026-06-04T00:00:00+09:00',
        ],
        'baito-rirekisho-kakikata' => [
            'title'       => 'バイト・アルバイトの履歴書の書き方【採用されやすい書き方＋例文】 | Atally',
            'description' => 'バイト・アルバイト応募の履歴書の書き方を解説。学生・初めてのバイト・未経験でも書ける志望動機の例文、本人希望欄の書き方、採用担当者が見るポイントまで。',
            'published'   => '2026-06-04T00:00:00+09:00',
            'modified'    => '2026-06-04T00:00:00+09:00',
        ],
        'rirekisho-futo-kakikata' => [
            'title'       => '履歴書の封筒の書き方・送り方マナー【宛名・添え状・折り方まで】 | Atally',
            'description' => '履歴書を郵送するときの封筒の書き方を完全解説。宛名の書き方、表裏の記載ルール、「応募書類在中」の書き方、添え状の例文、クリアファイルの使い方まで。',
            'published'   => '2026-06-04T00:00:00+09:00',
            'modified'    => '2026-06-04T00:00:00+09:00',
        ],
        'mensetsu-yokuaru-shitsumon' => [
            'title'       => '面接でよく聞かれる質問と回答例【転職・就活 想定質問15選】 | Atally',
            'description' => '面接でよく聞かれる質問と回答例を徹底解説。自己紹介・志望動機・転職理由・強み・弱み・逆質問まで15問。NG例と言い換え例付きで、転職・就活どちらにも使えます。',
            'published'   => '2026-06-24T00:00:00+09:00',
            'modified'    => '2026-06-24T00:00:00+09:00',
        ],
        'taishoku-todoke-kakikata' => [
            'title'       => '退職届・退職願の書き方と例文【手書きテンプレート・提出タイミングまで解説】 | Atally',
            'description' => '退職届・退職願の書き方を完全解説。退職届と退職願の違い、手書き縦書きの例文テンプレート、封筒の書き方、提出タイミング・マナー、引き留めへの対処まで網羅。',
            'published'   => '2026-06-25T00:00:00+09:00',
            'modified'    => '2026-06-25T00:00:00+09:00',
        ],
        'rirekisho-shumi-tokugi' => [
            'title'       => '履歴書の趣味・特技欄の書き方【例文30選】採用担当者が見るポイントも解説 | Atally',
            'description' => '履歴書の趣味・特技欄の書き方を採用担当者目線で徹底解説。ジャンル別例文30選、「特技がない」時の対処法、NGワード、仕事への結びつけ方まで網羅。',
            'published'   => '2026-06-26T00:00:00+09:00',
            'modified'    => '2026-06-26T00:00:00+09:00',
        ],
        'daini-shinsotsu-tenshoku' => [
            'title'       => '第二新卒の転職完全ガイド【定義・メリット・転職のコツ・面接対策まで】 | Atally',
            'description' => '第二新卒とは何か・採用市場での評価・転職のタイミング・履歴書・職務経歴書の書き方・面接でよく聞かれる質問まで。第二新卒での転職を検討している方の実践的ガイド。',
            'published'   => '2026-06-26T00:00:00+09:00',
            'modified'    => '2026-06-26T00:00:00+09:00',
        ],
        'mensetsu-jikoshokai' => [
            'title'       => '面接での自己紹介の仕方【例文10選・1分/3分版】転職・就活完全ガイド | Atally',
            'description' => '面接での自己紹介の仕方を例文10選で解説。1分・3分の時間別テンプレート、転職・新卒・パート向けの例文集、NGパターンと改善例まで。面接 自己紹介 例文を探している方に。',
            'published'   => '2026-06-27T00:00:00+09:00',
            'modified'    => '2026-06-27T00:00:00+09:00',
        ],
        'rirekisho-mail-okurikata' => [
            'title'       => '履歴書をメールで送る方法【件名・本文 例文付き】送り方マナー完全ガイド | Atally',
            'description' => '履歴書をメールで送る件名・本文の書き方を例文付きで解説。ファイル名の付け方・PDF形式の使い方・送信前チェックリストまで。転職・就活・バイト応募の「履歴書 メール 送り方」ならAtally。',
            'published'   => '2026-06-29T00:00:00+09:00',
            'modified'    => '2026-06-29T00:00:00+09:00',
        ],
        'rirekisho-honnin-kibo-kakikata' => [
            'title'       => '履歴書の本人希望記入欄の書き方【記入例・NG例・書かない場合も解説】 | Atally',
            'description' => '履歴書の本人希望記入欄の書き方を解説。「特になし」「貴社規定に従います」の使い分け、希望職種・勤務地・勤務時間・給与の記入例、パートや転職者向けの書き方まで網羅。本人希望記入欄 書き方の完全ガイド。',
            'published'   => '2026-06-30T00:00:00+09:00',
            'modified'    => '2026-06-30T00:00:00+09:00',
        ],
        'rirekisho-gakureki-kakikata' => [
            'title'       => '履歴書の学歴の書き方【卒業年度・留年・中退・専門学校まで完全解説】 | Atally',
            'description' => '履歴書の学歴欄の書き方を完全解説。中学校からの書き方・元号と西暦の統一・大学の学部学科名の正式表記・留年・休学・中退・卒業見込みの書き方まで。履歴書 学歴 書き方のNG例も紹介。',
            'published'   => '2026-07-01T00:00:00+09:00',
            'modified'    => '2026-07-01T00:00:00+09:00',
        ],
        'web-oubo-rirekisho' => [
            'title'       => 'Web応募の履歴書の書き方・送り方【ファイル形式・写真データ・入力フォームの注意点】 | Atally',
            'description' => 'Web応募での履歴書提出方法を解説。PDFなどファイル形式・ファイル名の付け方、証明写真データの用意、入力フォームで気をつけたいポイント、送信前の最終チェックリストまで実務的にまとめました。',
            'published'   => '2026-07-02T00:00:00+09:00',
            'modified'    => '2026-07-02T00:00:00+09:00',
        ],
        'mensetsu-orei-mail' => [
            'title'       => '面接後のお礼メールの書き方【例文集】送るタイミング・件名・NG例まで | Atally',
            'description' => '面接後のお礼メールの書き方を解説。送るべきタイミング、件名・本文のコピペOK例文（一次面接・最終面接・複数面接官・オンライン面接別）、書いてはいけないNG例まで網羅。面接 お礼メール 例文の完全ガイド。',
            'published'   => '2026-07-03T00:00:00+09:00',
            'modified'    => '2026-07-03T00:00:00+09:00',
        ],
        'mensetsu-gyakushitsumon' => [
            'title'       => '面接の逆質問 例文20選【好印象を与える質問とNG例】転職・就活対応 | Atally',
            'description' => '面接の最後に聞かれる「何か質問はありますか」への回答例を場面別に20選紹介。逆質問を準備すべき理由、質問の考え方、聞いてはいけないNG質問、一次・最終面接別の例文まで解説。面接 逆質問 例文の完全ガイド。',
            'published'   => '2026-07-04T00:00:00+09:00',
            'modified'    => '2026-07-04T00:00:00+09:00',
        ],
        'web-mensetsu-yarikata' => [
            'title'       => 'Web面接（オンライン面接）のやり方・マナー完全ガイド【服装・背景・トラブル対策】 | Atally',
            'description' => 'Web面接（オンライン面接）のやり方を完全解説。事前準備のチェックリスト、服装・背景・目線のマナー、通信トラブル時の対処法、対面との違いまで実践的にまとめました。Web面接 やり方 マナーの完全ガイド。',
            'published'   => '2026-07-06T00:00:00+09:00',
            'modified'    => '2026-07-06T00:00:00+09:00',
        ],
        'rirekisho-shomeishashin' => [
            'title'       => '履歴書の証明写真の撮り方・選び方完全ガイド【サイズ・服装・撮影方法まで】 | Atally',
            'description' => '履歴書の証明写真の一般的なサイズ・撮影時期の目安、服装・身だしなみのマナー、写真館・証明写真機・スマホ撮影の違いと選び方、データ添付時の注意点、よくあるNG例まで解説します。履歴書 証明写真 サイズ・撮り方の完全ガイド。',
            'published'   => '2026-07-06T00:00:00+09:00',
            'modified'    => '2026-07-06T00:00:00+09:00',
        ],
        'shokumukeirekisho-template' => [
            'title'       => '職務経歴書テンプレート 無料ダウンロード【編年体・キャリア式】書き方つき2026年版 | Atally',
            'description' => '職務経歴書のテンプレートを無料で紹介。編年体式・逆編年体式・キャリア式の違いと選び方、項目ごとの書き方例、Word・PDFで作る際の注意点、Atallyでの無料作成方法まで解説します。職務経歴書 テンプレート 無料の完全ガイド。',
            'published'   => '2026-07-07T00:00:00+09:00',
            'modified'    => '2026-07-07T00:00:00+09:00',
        ],
        'naitei-jitai-tsutaekata' => [
            'title'       => '内定辞退の伝え方【電話・メール例文つき】言うタイミングとマナー完全ガイド | Atally',
            'description' => '内定辞退の伝え方を徹底解説。電話・メールそれぞれの例文、伝えるタイミングの目安、辞退理由の伝え方、内定承諾後に辞退する場合の注意点、やってはいけないNG例まで。内定辞退 電話 メール 例文の完全ガイド。',
            'published'   => '2026-07-08T00:00:00+09:00',
            'modified'    => '2026-07-08T00:00:00+09:00',
        ],
        'naitei-shodaku-henji' => [
            'title'       => '内定承諾の返事メール・電話の書き方【例文付き】タイミングとマナー完全ガイド | Atally',
            'description' => '内定承諾の返事の書き方を徹底解説。メール・電話それぞれの例文、返事のタイミングの目安、内定承諾書との違い、返事を保留したい場合の伝え方、承諾後のNG例まで。内定承諾 メール 電話 例文の完全ガイド。',
            'published'   => '2026-07-09T00:00:00+09:00',
            'modified'    => '2026-07-09T00:00:00+09:00',
        ],
        'tenshoku-katsudo-susumekata' => [
            'title'       => '転職活動の進め方・スケジュール完全ガイド【初めての転職者向け】 | Atally',
            'description' => '初めての転職活動の進め方を解説。自己分析から内定・入社準備までの全体の流れ、在職中と離職中の進め方の違い、スケジュールを立てるときのポイント、よくある失敗例まで。転職活動 進め方 スケジュールの完全ガイド。',
            'published'   => '2026-07-10T00:00:00+09:00',
            'modified'    => '2026-07-10T00:00:00+09:00',
        ],
        'baito-mensetsu-shitsumon' => [
            'title'       => 'パート・アルバイト面接でよく聞かれる質問と答え方【シフト・志望動機・NG回答例】 | Atally',
            'description' => 'パート・アルバイトの面接でよく聞かれる質問と回答のコツを解説。志望動機・シフトの希望・経験・長所短所など定番質問への答え方、面接前の準備、当日の服装・持ち物、よくあるNG回答例まで。バイト 面接 質問の完全ガイド。',
            'published'   => '2026-07-11T00:00:00+09:00',
            'modified'    => '2026-07-11T00:00:00+09:00',
        ],
        'mensetsu-nittei-chosei-mail' => [
            'title'       => '面接の日程調整メールの返信マナー・例文【候補日の選び方・変更依頼・リスケ対応まで】 | Atally',
            'description' => '面接の日程調整メールの返信の書き方を解説。候補日から選んで返信する例文、候補日が合わない場合の代替日提示、やむを得ない変更・リスケ依頼、返信までの目安時間、オンライン面接での注意点まで。',
            'published'   => '2026-07-13T00:00:00+09:00',
            'modified'    => '2026-07-13T00:00:00+09:00',
        ],
        'mensetsu-chikoku-kesseki-renraku' => [
            'title'       => '面接に遅刻・欠席する場合の連絡マナー・例文【電話・メール】転職・就活対応 | Atally',
            'description' => '面接に遅刻しそう・欠席せざるを得ない場合の連絡方法を解説。電話で伝える例文、メールで連絡する場合の文例、体調不良・交通機関の遅延など理由別の伝え方、無断キャンセルのリスク、リスケのお願いの仕方まで。',
            'published'   => '2026-07-14T00:00:00+09:00',
            'modified'    => '2026-07-14T00:00:00+09:00',
        ],
        'saishu-mensetsu-taisaku' => [
            'title'       => '最終面接で聞かれること・対策【一次面接との違い・逆質問・確認されやすいポイント】 | Atally',
            'description' => '最終面接で聞かれやすい質問と対策を解説。一次・二次面接との違い、面接官が確認しやすいポイント、志望動機・入社意思を聞かれたときの答え方例文、最終面接ならではの逆質問、当日のNG例まで。',
            'published'   => '2026-07-15T00:00:00+09:00',
            'modified'    => '2026-07-15T00:00:00+09:00',
        ],
        'mensetsu-chosho-tansho-kotaekata' => [
            'title'       => '面接で聞かれる「長所・短所」の答え方【例文20選】転職・パート・アルバイト対応 | Atally',
            'description' => '面接で聞かれる長所・短所の答え方を解説。長所の伝え方の基本構成、短所を答えるときのコツ、長所・短所の例文20選、転職・パート・アルバイト別の答え方、NG例まで。',
            'published'   => '2026-07-17T00:00:00+09:00',
            'modified'    => '2026-07-17T00:00:00+09:00',
        ],
        'mensetsu-goohi-renraku-konai' => [
            'title'       => '面接の合否連絡が来ない時の対処法【問い合わせメール・電話の例文つき】 | Atally',
            'description' => '面接後、合否の連絡が来ないときの対処法を解説。連絡が来るまでの目安、問い合わせをしてよいタイミング、メール・電話での問い合わせ例文、パート・アルバイトの場合の注意点まで。',
            'published'   => '2026-07-23T00:00:00+09:00',
            'modified'    => '2026-07-23T00:00:00+09:00',
        ],
        'taishoku-tsutaekata' => [
            'title'       => '退職の伝え方・切り出し方【上司への言い出しにくい退職理由も】円満退職の例文つき | Atally',
            'description' => '退職を上司にどう切り出すか悩む方向けに、伝えるタイミング・順番・切り出し方の例文を解説。引き止められたときの対応、人手不足で言い出しにくい場合の伝え方、伝えたあとの流れまで。',
            'published'   => '2026-07-29T00:00:00+09:00',
            'modified'    => '2026-07-29T00:00:00+09:00',
        ],
        'mikeiken-tenshoku-shibo-doki' => [
            'title'       => '未経験職種への転職 志望動機・自己PRの書き方【異業種チェンジ例文つき】前職の経験の活かし方 | Atally',
            'description' => '未経験の職種・異業種へ転職する際の志望動機・自己PRの書き方を解説。前職の経験を新しい仕事にどう言い換えて伝えるか（ポータブルスキル）、職種別の例文、面接で聞かれる「なぜ未経験なのに」への答え方、NG例まで。',
            'published'   => '2026-07-31T00:00:00+09:00',
            'modified'    => '2026-07-31T00:00:00+09:00',
        ],
    ];

    $m = $meta[$slug] ?? null;
    $title = $m['title']       ?? '転職コラム | Atally';
    $desc  = $m['description'] ?? 'Atallyの転職・就活お役立ちコラム。';
    $url   = config('app.url') . '/column/' . $slug;

    $jsonLd = [
        '@context'         => 'https://schema.org',
        '@type'            => 'Article',
        'headline'         => $title,
        'description'      => $desc,
        'url'              => $url,
        'datePublished'    => $m['published'] ?? '2026-01-01T00:00:00+09:00',
        'dateModified'     => $m['modified']  ?? '2026-05-19T00:00:00+09:00',
        'author'           => ['@type' => 'Organization', 'name' => 'Atally編集部', 'url' => config('app.url')],
        'publisher'        => ['@type' => 'Organization', 'name' => 'Atally', 'url' => config('app.url')],
        'inLanguage'       => 'ja',
        'isPartOf'         => ['@type' => 'WebSite', 'name' => 'Atally', 'url' => config('app.url')],
    ];

    $seo = [
        'title'       => $title,
        'description' => $desc,
        'url'         => $url,
        'type'        => 'article',
        'jsonLd'      => $jsonLd,
    ];
    return view('app', compact('seo'));
});

// ── 求人一覧ページ: 都道府県・キーワード検索時のサーバーサイドSEO
Route::get('/jobs', function () {
    $prefecture = request()->query('prefecture', '');
    $city       = request()->query('city', '');
    $keyword    = request()->query('keyword', '');
    $baseUrl    = config('app.url');
    $region     = trim($prefecture . $city); // 例: 沖縄県那覇市

    $cacheKey = 'seo_jobs_count_' . md5($prefecture . '|' . $city . '|' . $keyword);
    $count = \Illuminate\Support\Facades\Cache::remember($cacheKey, 900, function () use ($prefecture, $city, $keyword) {
        return \App\Models\Job::where('status', 'active')
            ->when($prefecture, fn($q) => $q->where('prefecture', $prefecture))
            ->when($city, fn($q) => $q->where('city', $city))
            ->when($keyword, fn($q) => $q->where('title', 'ILIKE', "%{$keyword}%"))
            ->count();
    });

    if ($prefecture || $city || $keyword) {
        $parts     = array_filter([$keyword ?: null, $region ?: null]);
        $titlePart = implode('・', $parts);
        $seo = [
            'title'       => $titlePart . 'の求人・仕事探し ' . number_format($count) . '件 | Atally',
            'description' => ($region ?: '全国') . 'の' . ($keyword ?: '求人') . '情報 ' . number_format($count) . '件以上掲載中。給与・勤務時間・待遇など詳細条件で検索できます。正社員・パート・アルバイト・派遣求人あり。',
            'url'         => $baseUrl . '/jobs?' . http_build_query(array_filter(compact('prefecture', 'city', 'keyword'))),
        ];
    } else {
        $seo = [
            'title'       => '求人・仕事探し ' . number_format($count) . '件 | Atally',
            'description' => '全国' . number_format($count) . '件以上の求人掲載中。正社員・パート・アルバイト・派遣など雇用形態や地域・職種で絞り込み検索。ハローワーク求人も掲載。無料で簡単に応募できます。',
            'url'         => $baseUrl . '/jobs',
        ];
    }

    return view('app', compact('seo'));
});

// 給料・年収相場チェッカー（求職者向け・SEOランディング）
Route::get('/kyuyo/{prefecture?}/{industry?}', function ($prefecture = '', $industry = '') {
    $prefecture = trim(urldecode((string) $prefecture));
    $industry   = trim(urldecode((string) $industry));
    $baseUrl    = config('app.url');
    $region     = $prefecture !== '' ? $prefecture : '全国';

    if ($industry !== '') {
        $cacheKey = 'seo_kyuyo_' . md5($prefecture . '|' . $industry);
        $count = \Illuminate\Support\Facades\Cache::remember($cacheKey, 1800, function () use ($prefecture, $industry) {
            return \App\Models\Job::where('status', 'active')
                ->where('industry', $industry)
                ->where('salary_min', '>', 0)
                ->when($prefecture !== '', fn($q) => $q->where('prefecture', $prefecture))
                ->count();
        });
        $seo = [
            'title'       => $region . 'の' . $industry . 'の給料・年収相場【求人' . number_format($count) . '件から算出】| Atally',
            'description' => $region . 'の' . $industry . 'の給与相場を実際の求人' . number_format($count) . '件から算出。下位25%・中央値・上位25%が無料でわかります（登録不要）。相場以上の求人もその場で探せます。',
            'url'         => $baseUrl . '/kyuyo/' . rawurlencode($prefecture) . '/' . rawurlencode($industry),
        ];
    } else {
        $seo = [
            'title'       => ($prefecture !== '' ? $prefecture . 'の' : '') . '給料・年収相場チェッカー | 業種×地域の給与相場が無料でわかる | Atally',
            'description' => '業種・地域・給与種別を選ぶだけで、実際の求人データから給与相場（下位25%・中央値・上位25%）が無料でわかります。登録不要。' . ($prefecture !== '' ? $prefecture . 'の相場もチェックできます。' : ''),
            'url'         => $baseUrl . '/kyuyo' . ($prefecture !== '' ? '/' . rawurlencode($prefecture) : ''),
        ];
    }

    return view('app', compact('seo'));
})->where('prefecture', '[^/]*')->where('industry', '[^/]*');

// 求人詳細ページ: サーバーサイドでメタ情報を埋め込み（Google しごと検索 + SNSシェア対応）
Route::get('/jobs/{id}', function ($id) {
    try {
        $job = \App\Models\Job::with('company:id,company_name,website')->find($id);
    } catch (\Throwable $e) {
        return response(view('app'), 500);
    }

    if (!$job || ($job->status?->value ?? '') !== 'active') {
        return response(view('app'), 404);
    }

    $employmentTypeMap = [
        '正社員' => 'FULL_TIME', '契約社員' => 'CONTRACTOR', 'パート' => 'PART_TIME',
        '派遣' => 'TEMPORARY', '業務委託' => 'OTHER', 'インターン' => 'INTERN',
    ];

    $salaryUnitMap = ['時給' => 'HOUR', '日給' => 'DAY', '月給' => 'MONTH', '年収' => 'YEAR'];
    $salaryUnit = $salaryUnitMap[$job->salary_type ?? ''] ?? 'YEAR';

    $validThrough = $job->expires_at
        ?? ($job->published_at ?? $job->created_at)?->copy()->addDays(90);

    $defaultOgImage = config('app.og_image');
    $baseUrl        = config('app.url');

    // meta description: 給与を正しくフォーマット（JS の formatSalary と同一ロジック）
    $salaryMin  = $job->salary_min;
    $salaryMax  = $job->salary_max;
    $salaryType = $job->salary_type ?? '';
    $salaryText = '';
    if ($salaryMin || $salaryMax) {
        $isSmall  = in_array($salaryType, ['時給', '日給']);
        $fmtVal   = fn($v) => ($v ? ($isSmall || $v < 100000 ? number_format((int)$v) . '円' : round($v / 10000) . '万円') : null);
        if ($salaryMin && $salaryMax) $salaryRange = $fmtVal($salaryMin) . '〜' . $fmtVal($salaryMax);
        elseif ($salaryMin)           $salaryRange = $fmtVal($salaryMin) . '〜';
        else                          $salaryRange = '〜' . $fmtVal($salaryMax);
        $salaryLabel = $salaryType ?: (($salaryMin >= 1000000 || $salaryMax >= 1000000) ? '年収' : '');
        $salaryText  = $salaryLabel ? "{$salaryLabel} {$salaryRange}" : $salaryRange;
    }
    $descSnippet = '';
    if ($job->description) {
        $clean       = trim(preg_replace('/【[^】]*】\n?/', '', $job->description));
        $descSnippet = ' ' . mb_substr($clean, 0, 50);
    }
    // 相場コンテキスト（独自性）: 同業種×地域の相場中央値をmeta descriptionに含める。
    // 統計は12hキャッシュ。失敗してもページ生成は止めない。
    $marketText = '';
    try {
        $mc = \App\Support\SalaryBenchmark::contextForJob($job);
        if ($mc) {
            $sign = $mc['diff_pct'] > 0 ? '+' : '';
            $marketText = ' / ' . $mc['area_label'] . 'の同業種相場'
                . '（中央値' . number_format($mc['median']) . '円）比 ' . $sign . $mc['diff_pct'] . '%';
        }
    } catch (\Throwable $e) {
        // 相場が出せなくてもmetaは通常どおり生成
    }
    $metaDesc = mb_substr(
        ($job->company->company_name ?? '') . 'の' . $job->title . '。'
        . ($job->prefecture ? $job->prefecture . ' ' : '')
        . ($job->location ? $job->location . ' / ' : '')
        . ($job->employment_type ?? '')
        . ($salaryText ? ' / ' . $salaryText : '')
        . $marketText
        . $descSnippet,
        0, 160
    );

    // ---- Google for Jobs（しごと検索）用の補強値 ----
    $isHelloWork = ($job->source ?? '') === 'hellowork';
    // 雇用主名: ハローワーク求人はダミー企業「ハローワーク」ではなく実際の事業所名を使う
    $orgName = ($isHelloWork ? ($job->employer_name ?: null) : null)
        ?: ($job->company->company_name ?? '求人企業');
    $orgSameAs = $isHelloWork ? ($job->homepage_url ?: null) : ($job->company->website ?? null);
    // 求人の識別子（ハローワーク求人番号 or 内部ID）
    $jobIdentifier = $isHelloWork ? ($job->hellowork_id ?: (string) $job->id) : (string) $job->id;
    // 構造化データ用の詳細な職務内容（Google for Jobs は網羅的な説明を推奨）
    $jpDescription = mb_substr(trim(
        ($job->description ?? '')
        . ($job->requirements ? "\n\n【応募要件】\n" . $job->requirements : '')
        . ($job->work_hours ? "\n\n【勤務時間】" . $job->work_hours : '')
        . ($job->holidays ? "\n\n【休日・休暇】" . $job->holidays : '')
    ), 0, 5000);

    // thin-content対策: 説明が薄い/給与なしの求人はnoindex（リンクはfollowして評価は流す）。
    // 品質ライン = 給与あり かつ 説明文120字以上。薄い約1/3を検索対象から外し、サイト全体の評価毀損を防ぐ。
    $descLen  = mb_strlen(trim((string) ($job->description ?? '')));
    $thinPage = !(($job->salary_min ?? 0) > 0 && $descLen >= 120);

    $seo = [
        'title'       => $job->title . '【' . ($job->prefecture ?? $job->location ?? '') . '】 - ' . $orgName . ' | Atally',
        'description' => $metaDesc,
        'url'         => $baseUrl . '/jobs/' . $job->id,
        'type'        => 'website',
        'image'       => $defaultOgImage,
        'noindex'     => $thinPage,
        'jsonLd'      => [
            '@context' => 'https://schema.org',
            '@graph'   => [
                [
                    '@type'          => 'JobPosting',
                    'title'          => $job->title,
                    'description'    => $jpDescription,
                    'datePosted'     => ($job->published_at ?? $job->created_at)?->toIso8601String(),
                    'validThrough'   => $validThrough?->toIso8601String(),
                    // 直接応募できるのは自社掲載求人のみ。ハローワーク求人はHW経由のため false
                    'directApply'    => !$isHelloWork,
                    'employmentType' => $employmentTypeMap[$job->employment_type] ?? 'OTHER',
                    'identifier'     => [
                        '@type' => 'PropertyValue',
                        'name'  => $orgName,
                        'value' => $jobIdentifier,
                    ],
                    'hiringOrganization' => array_filter([
                        '@type'  => 'Organization',
                        'name'   => $orgName,
                        'sameAs' => $orgSameAs ?: null,
                    ]),
                    'jobLocation' => [
                        '@type'   => 'Place',
                        'address' => array_filter([
                            '@type'           => 'PostalAddress',
                            'streetAddress'   => $job->office_address ?: null,
                            'addressLocality' => $job->city ?: ($job->location ?: null),
                            'addressRegion'   => $job->prefecture ?: null,
                            'postalCode'      => $job->postal_code ?: null,
                            'addressCountry'  => 'JP',
                        ]),
                    ],
                    ...($job->salary_min || $job->salary_max ? [
                        'baseSalary' => [
                            '@type'    => 'MonetaryAmount',
                            'currency' => 'JPY',
                            'value'    => array_filter([
                                '@type'    => 'QuantitativeValue',
                                'minValue' => $job->salary_min ?: null,
                                'maxValue' => $job->salary_max ?: null,
                                'unitText' => $salaryUnit,
                            ]),
                        ],
                    ] : []),
                ],
                [
                    '@type'           => 'BreadcrumbList',
                    'itemListElement' => array_values(array_filter([
                        ['@type' => 'ListItem', 'position' => 1, 'name' => 'ホーム',   'item' => $baseUrl . '/'],
                        ['@type' => 'ListItem', 'position' => 2, 'name' => '求人一覧', 'item' => $baseUrl . '/jobs'],
                        $job->prefecture ? ['@type' => 'ListItem', 'position' => 3, 'name' => $job->prefecture . 'の求人', 'item' => $baseUrl . '/jobs?prefecture=' . urlencode($job->prefecture)] : null,
                        ['@type' => 'ListItem', 'position' => $job->prefecture ? 4 : 3, 'name' => $job->title],
                    ])),
                ],
            ],
        ],
    ];

    return view('app', compact('seo'));
})->where('id', '[0-9]+');

// 企業プロフィール: サーバーサイドメタ
Route::get('/companies/{id}', function ($id) {
    try {
        $company = \App\Models\Company::find($id);
    } catch (\Throwable $e) {
        return response(view('app'), 500);
    }

    if (!$company || ($company->verification_status?->value ?? '') !== 'verified') {
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

// 履歴書作成ページ: 「履歴書 作成 無料」「履歴書 テンプレート」等の高ボリューム検索向けSEO
Route::get('/resumes/guest', function () {
    $baseUrl = config('app.url');
    $seo = [
        'title'       => '履歴書テンプレート 無料作成 | 登録不要・ダウンロード・スマホ対応 | Atally',
        'description' => '履歴書テンプレートを無料で作成・ダウンロード。登録不要・JIS規格対応・スマホ対応。ブラウザ自動保存で途中から再開可能。作成後そのまま47万件の求人に応募できます。',
        'url'         => $baseUrl . '/resumes/guest',
        'type'        => 'website',
        'jsonLd'      => [
            '@context' => 'https://schema.org',
            '@graph'   => [
                [
                    '@type'            => 'SoftwareApplication',
                    'name'             => 'Atally 履歴書作成ツール',
                    'applicationCategory' => 'BusinessApplication',
                    'operatingSystem'  => 'Web',
                    'offers'           => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'JPY'],
                    'description'      => '登録不要・完全無料で使える履歴書作成ツール。JIS規格対応、スマホ対応、ブラウザ自動保存。作成後は47万件以上の求人にそのまま応募できます。',
                    'url'              => $baseUrl . '/resumes/guest',

                ],
                [
                    '@type'      => 'FAQPage',
                    'mainEntity' => [
                        ['@type' => 'Question', 'name' => '無料で使えますか？', 'acceptedAnswer' => ['@type' => 'Answer', 'text' => 'はい、完全無料です。登録・ログインも不要でそのまま使えます。']],
                        ['@type' => 'Question', 'name' => '作成した履歴書はどこに保存されますか？', 'acceptedAnswer' => ['@type' => 'Answer', 'text' => '入力内容はブラウザ（localStorage）に自動保存されます。アカウント登録することでクラウドにも保存できます。']],
                        ['@type' => 'Question', 'name' => 'スマートフォンでも使えますか？', 'acceptedAnswer' => ['@type' => 'Answer', 'text' => 'はい、スマートフォン・タブレットに対応しています。']],
                        ['@type' => 'Question', 'name' => '作成した履歴書でそのまま求人に応募できますか？', 'acceptedAnswer' => ['@type' => 'Answer', 'text' => 'はい、Atally に掲載されている47万件以上の求人に、作成した履歴書でそのまま応募できます。']],
                    ],
                ],
                [
                    '@type'           => 'BreadcrumbList',
                    'itemListElement' => [
                        ['@type' => 'ListItem', 'position' => 1, 'name' => 'ホーム',      'item' => $baseUrl . '/'],
                        ['@type' => 'ListItem', 'position' => 2, 'name' => '履歴書を無料作成'],
                    ],
                ],
            ],
        ],
    ];
    return view('app', compact('seo'));
});

// ── サイトマップ（インデックス形式 → 最大50K件ずつ分割）─────────────────────────
// Googleの上限: 1サイトマップ50,000URL / 50MB。47万件 → 約10ファイルに自動分割。
Route::get('/sitemap.xml', function () {
    try {
        $baseUrl   = config('app.url');
        // 求人サイトマップは品質ライン（給与あり＋説明120字以上）のみ掲載するため、ページ数もその件数で算出
        $totalJobs = \App\Models\Job::where('status', 'active')
            ->where('salary_min', '>', 0)
            ->whereRaw('char_length(coalesce(description, \'\')) >= 120')
            ->count();
        $jobPages  = max(1, (int) ceil($totalJobs / 50000));
        $now       = now()->toAtomString();

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        $xml .= "  <sitemap><loc>{$baseUrl}/sitemap-priority.xml</loc><lastmod>{$now}</lastmod></sitemap>\n";
        $xml .= "  <sitemap><loc>{$baseUrl}/sitemap-static.xml</loc><lastmod>{$now}</lastmod></sitemap>\n";
        $xml .= "  <sitemap><loc>{$baseUrl}/sitemap-areas.xml</loc><lastmod>{$now}</lastmod></sitemap>\n";
        $xml .= "  <sitemap><loc>{$baseUrl}/sitemap-salary.xml</loc><lastmod>{$now}</lastmod></sitemap>\n";
        for ($i = 1; $i <= $jobPages; $i++) {
            $xml .= "  <sitemap><loc>{$baseUrl}/sitemap-jobs-{$i}.xml</loc><lastmod>{$now}</lastmod></sitemap>\n";
        }
        $xml .= '</sitemapindex>';
    } catch (\Throwable $e) {
        \Illuminate\Support\Facades\Log::error('sitemap.xml error', ['error' => $e->getMessage()]);
        $baseUrl = config('app.url');
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
             . '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n"
             . "  <sitemap><loc>{$baseUrl}/sitemap-static.xml</loc></sitemap>\n"
             . '</sitemapindex>';
    }

    return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
});

// 市区町村ランディング（求人が一定数ある市区町村のみ。空ページの量産を避ける）
Route::get('/sitemap-areas.xml', function () {
    try {
        $baseUrl = config('app.url');
        $rows = \Illuminate\Support\Facades\Cache::remember('sitemap_areas', 3600, function () {
            return \App\Models\Job::where('status', 'active')
                ->whereNotNull('prefecture')->where('prefecture', '!=', '')
                ->whereNotNull('city')->where('city', '!=', '')
                ->selectRaw('prefecture, city, COUNT(*) as total')
                ->groupBy('prefecture', 'city')
                ->havingRaw('COUNT(*) >= 5')
                ->orderBy('prefecture')->orderByDesc('total')
                ->get();
        });

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        foreach ($rows as $r) {
            $url = $baseUrl . '/jobs?' . http_build_query(['prefecture' => $r->prefecture, 'city' => $r->city]);
            $loc = htmlspecialchars($url, ENT_XML1 | ENT_QUOTES, 'UTF-8'); // & を &amp; 等にXMLエスケープ（必須）
            $xml .= "  <url><loc>{$loc}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>\n";
        }
        $xml .= '</urlset>';
    } catch (\Throwable $e) {
        \Illuminate\Support\Facades\Log::error('sitemap-areas.xml error', ['error' => $e->getMessage()]);
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
    }
    return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
});

// 優先サイトマップ: 主要ハブページ約100件のみの小さなサイトマップ。
// 新規ドメインではクロール順が回らず「発見済み・未クロール」で滞留するため、
// GSCに個別送信して主要ページのクロールを優先させる＋サイトマップ別のインデックス状況を可視化する。
Route::get('/sitemap-priority.xml', function () {
    $baseUrl = config('app.url');
    $prefectures = [
        '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県',
        '埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県',
        '岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
        '鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県',
        '佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県',
    ];

    $urls = ['/', '/jobs', '/kyuyo', '/column', '/for-companies', '/for-agencies'];
    foreach ($prefectures as $pref) {
        $urls[] = '/jobs?prefecture=' . urlencode($pref);
        $urls[] = '/kyuyo/' . rawurlencode($pref);
    }

    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    foreach ($urls as $path) {
        $loc = htmlspecialchars($baseUrl . $path, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        $xml .= "  <url><loc>{$loc}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n";
    }
    $xml .= '</urlset>';
    return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
});

// 給料相場ランディング（母数のある上位業種 × 47都道府県）
Route::get('/sitemap-salary.xml', function () {
    try {
        $baseUrl = config('app.url');
        $data = \Illuminate\Support\Facades\Cache::remember('sitemap_salary', 3600, function () {
            $industries = \App\Models\Job::where('status', 'active')
                ->whereNotNull('industry')->where('industry', '!=', '')
                ->where('salary_min', '>', 0)
                ->selectRaw('industry, COUNT(*) as cnt')
                ->groupBy('industry')
                ->havingRaw('COUNT(*) >= 200')
                ->orderByDesc('cnt')
                ->limit(30)
                ->pluck('industry');
            $prefectures = [
                '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県',
                '埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県',
                '岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
                '鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県',
                '佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県',
            ];
            return ['industries' => $industries, 'prefectures' => $prefectures];
        });

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        // 業種 × 都道府県（検索価値の高い組み合わせ）
        foreach ($data['industries'] as $ind) {
            foreach ($data['prefectures'] as $pref) {
                $url = $baseUrl . '/kyuyo/' . rawurlencode($pref) . '/' . rawurlencode($ind);
                $xml .= "  <url><loc>{$url}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>\n";
            }
        }
        $xml .= '</urlset>';
    } catch (\Throwable $e) {
        \Illuminate\Support\Facades\Log::error('sitemap-salary.xml error', ['error' => $e->getMessage()]);
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
    }
    return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
});

// 静的ページ + 都道府県ランディング + 企業ページ
Route::get('/sitemap-static.xml', function () {
    try {
        $baseUrl = config('app.url');
        $prefectures = [
            '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
            '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
            '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
            '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
            '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
            '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
            '熊本県','大分県','宮崎県','鹿児島県','沖縄県',
        ];

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

        foreach ([
            ['/', 'daily', '1.0'], ['/jobs', 'hourly', '0.9'], ['/register', 'monthly', '0.6'],
            ['/login', 'monthly', '0.5'], ['/resumes/guest', 'monthly', '0.8'],
            ['/column', 'weekly', '0.8'],
            ['/column/rirekisho-kakikata', 'monthly', '0.9'],
            ['/column/shibo-doki-kakikata', 'monthly', '0.9'],
            ['/column/shokumukeirekisho-toha', 'monthly', '0.9'],
            ['/column/jiko-pr-kakikata', 'monthly', '0.9'],
            ['/column/rirekisho-shikaku', 'monthly', '0.8'],
            ['/terms', 'yearly', '0.3'], ['/privacy', 'yearly', '0.3'],
            ['/for-companies', 'monthly', '0.7'],
            ['/for-agencies', 'monthly', '0.6'],
            ['/column/tensyoku-rirekisho', 'monthly', '0.8'],
            ['/column/shokureki-nashi-rirekisho', 'monthly', '0.8'],
            ['/column/blank-period-rirekisho', 'monthly', '0.8'],
            ['/column/part-rirekisho-shibo-doki', 'monthly', '0.8'],
            ['/column/tenshoku-riyuu-kakikata', 'monthly', '0.8'],
            ['/column/mensetsu-manner', 'monthly', '0.8'],
            ['/column/engineer-shokumukeirekisho', 'monthly', '0.8'],
            ['/column/rirekisho-template', 'monthly', '0.9'],
            ['/column/baito-rirekisho-kakikata', 'monthly', '0.9'],
            ['/column/rirekisho-futo-kakikata', 'monthly', '0.8'],
            ['/column/mensetsu-yokuaru-shitsumon', 'monthly', '0.8'],
            ['/column/taishoku-todoke-kakikata', 'monthly', '0.8'],
            ['/column/rirekisho-shumi-tokugi', 'monthly', '0.8'],
            ['/column/daini-shinsotsu-tenshoku', 'monthly', '0.8'],
            ['/column/mensetsu-jikoshokai', 'monthly', '0.8'],
            ['/column/rirekisho-mail-okurikata', 'monthly', '0.8'],
            ['/column/rirekisho-honnin-kibo-kakikata', 'monthly', '0.8'],
            ['/column/rirekisho-gakureki-kakikata', 'monthly', '0.8'],
            ['/column/web-oubo-rirekisho', 'monthly', '0.8'],
            ['/column/mensetsu-orei-mail', 'monthly', '0.8'],
            ['/column/mensetsu-gyakushitsumon', 'monthly', '0.8'],
            ['/column/web-mensetsu-yarikata', 'monthly', '0.8'],
            ['/column/rirekisho-shomeishashin', 'monthly', '0.8'],
            ['/column/shokumukeirekisho-template', 'monthly', '0.8'],
            ['/column/naitei-jitai-tsutaekata', 'monthly', '0.8'],
            ['/column/naitei-shodaku-henji', 'monthly', '0.8'],
            ['/column/tenshoku-katsudo-susumekata', 'monthly', '0.8'],
            ['/column/baito-mensetsu-shitsumon', 'monthly', '0.8'],
            ['/column/mensetsu-nittei-chosei-mail', 'monthly', '0.8'],
            ['/column/mensetsu-chikoku-kesseki-renraku', 'monthly', '0.8'],
            ['/column/saishu-mensetsu-taisaku', 'monthly', '0.8'],
            ['/column/mensetsu-chosho-tansho-kotaekata', 'monthly', '0.8'],
            ['/column/mensetsu-goohi-renraku-konai', 'monthly', '0.8'],
            ['/column/taishoku-tsutaekata', 'monthly', '0.8'],
            ['/column/mikeiken-tenshoku-shibo-doki', 'monthly', '0.8'],
        ] as [$path, $freq, $pri]) {
            $xml .= "  <url><loc>{$baseUrl}{$path}</loc><changefreq>{$freq}</changefreq><priority>{$pri}</priority></url>\n";
        }

        foreach ($prefectures as $pref) {
            $url = $baseUrl . '/jobs?prefecture=' . urlencode($pref);
            $loc = htmlspecialchars($url, ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $xml .= "  <url><loc>{$loc}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>\n";
        }

        \App\Models\Company::where('verification_status', 'verified')
            ->select('id', 'updated_at')->orderBy('id')
            ->cursor()->each(function ($c) use (&$xml, $baseUrl) {
                $xml .= "  <url><loc>{$baseUrl}/companies/{$c->id}</loc>";
                if ($c->updated_at) $xml .= "<lastmod>{$c->updated_at->toAtomString()}</lastmod>";
                $xml .= "<changefreq>weekly</changefreq><priority>0.6</priority></url>\n";
            });

        $xml .= '</urlset>';
    } catch (\Throwable $e) {
        \Illuminate\Support\Facades\Log::error('sitemap-static.xml error', ['error' => $e->getMessage()]);
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
             . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
    }

    return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
});

// 求人サイトマップ（1ページ50,000件、ストリーミング出力）
Route::get('/sitemap-jobs-{page}.xml', function ($page) {
    $baseUrl   = config('app.url');
    $page      = max(1, (int) $page);
    $perPage   = 50000;
    $offset    = ($page - 1) * $perPage;
    // thin-content対策: サイトマップは品質ライン（給与あり＋説明120字以上）を満たす求人のみ掲載
    $qualityJobs = fn() => \App\Models\Job::where('status', 'active')
        ->where('salary_min', '>', 0)
        ->whereRaw('char_length(coalesce(description, \'\')) >= 120');
    $totalJobs = $qualityJobs()->count();

    if ($offset >= $totalJobs) abort(404);

    $callback = function () use ($baseUrl, $offset, $perPage, $qualityJobs) {
        echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

        $fetched = 0;
        $qualityJobs()
            ->select('id', 'updated_at')
            ->orderBy('id')
            ->skip($offset)
            ->take($perPage)
            ->cursor()
            ->each(function ($job) use ($baseUrl, &$fetched) {
                echo "  <url><loc>{$baseUrl}/jobs/{$job->id}</loc>";
                if ($job->updated_at) echo "<lastmod>{$job->updated_at->toAtomString()}</lastmod>";
                echo "<changefreq>weekly</changefreq><priority>0.7</priority></url>\n";
                $fetched++;
                // 2000件ごとに送出。出力バッファが無い場合に ob_flush() が警告→例外化して
                // ループが途中(2000件)で止まる事故があったため、バッファ有無を確認し @ で抑止する。
                if ($fetched % 2000 === 0) {
                    if (ob_get_level() > 0) { @ob_flush(); }
                    flush();
                }
            });

        echo '</urlset>';
    };

    return response()->stream($callback, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
})->where('page', '[0-9]+');

// SPA catch-all (must be last)
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '.*');
