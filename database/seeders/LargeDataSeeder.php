<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Company;
use App\Models\Job;
use App\Models\Application;
use App\Models\JobView;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class LargeDataSeeder extends Seeder
{
    public function run(): void
    {
        // ============================================================
        // マスターデータ
        // ============================================================

        $locations = [
            '東京都渋谷区', '東京都新宿区', '東京都港区', '東京都千代田区', '東京都中央区',
            '東京都品川区', '東京都豊島区', '東京都台東区', '神奈川県横浜市', '神奈川県川崎市',
            '大阪府大阪市', '大阪府堺市', '愛知県名古屋市', '福岡県福岡市', '北海道札幌市',
            '宮城県仙台市', '広島県広島市', '京都府京都市', '兵庫県神戸市', '埼玉県さいたま市',
        ];

        $industries = [
            'IT・通信', '金融・保険', '製造業', '小売・流通', '医療・福祉',
            '不動産・建設', '教育・研究', '人材・教育', 'コンサルティング', 'メディア・広告',
        ];

        $remoteOptions = ['フルリモート', 'ハイブリッド', '出社'];
        $employmentTypes = ['正社員', '契約社員', '業務委託'];

        // ============================================================
        // 一般企業 20 社
        // ============================================================

        $directCompanyNames = [
            '株式会社テックビジョン', '株式会社グローバルソリューションズ', '株式会社フューチャーワークス',
            '株式会社デジタルイノベーション', '株式会社スマートシステムズ', '株式会社クラウドネクスト',
            '株式会社ビジネスブリッジ', '株式会社アクティブコンサルティング', '株式会社ネクストステップ',
            '株式会社パワーテクノロジー', '株式会社リアルテック', '株式会社メガソリューション',
            '株式会社プライムワークス', '株式会社クリエイティブラボ', '株式会社スターアライアンス',
            '株式会社インフィニティ', '株式会社グリーンフォース', '株式会社ブルーオーシャン',
            '株式会社オープンゲート', '株式会社ユナイテッドコープ',
        ];

        $directCompanies = [];
        foreach ($directCompanyNames as $i => $name) {
            $email = 'company' . ($i + 1) . '@demo.com';
            $user = User::firstOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'password' => Hash::make('password123'),
                    'role' => 'company',
                    'email_verified_at' => now(),
                ]
            );
            if (!$user->company) {
                $company = Company::create([
                    'user_id' => $user->id,
                    'company_name' => $name,
                    'company_type' => 'direct_employer',
                    'description' => '私たちは革新的なソリューションを提供し、お客様のビジネス成長を支援しています。優秀な人材を積極的に採用中です。',
                    'address' => $locations[array_rand($locations)],
                    'website' => 'https://example.com/' . ($i + 1),
                ]);
                $user->update(['company_id' => $company->id, 'company_role' => 'owner']);
            }
            $directCompanies[] = $user->fresh()->company;
        }

        // ============================================================
        // 人材紹介会社 10 社
        // ============================================================

        $agencyNames = [
            '株式会社キャリアパートナーズ', '株式会社プロフェッショナルリンク', '株式会社エリートコネクト',
            '株式会社タレントブリッジ', '株式会社ジョブマスター', '株式会社キャリアナビゲーター',
            '株式会社ヒューマンキャピタル', '株式会社プレミアムリクルート', '株式会社ベストマッチング',
            '株式会社フューチャーキャリア',
        ];

        $agencies = [];
        foreach ($agencyNames as $i => $name) {
            $email = 'agency' . ($i + 1) . '@demo.com';
            $user = User::firstOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'password' => Hash::make('password123'),
                    'role' => 'company',
                    'email_verified_at' => now(),
                ]
            );
            if (!$user->company) {
                $company = Company::create([
                    'user_id' => $user->id,
                    'company_name' => $name,
                    'company_type' => 'recruitment_agency',
                    'description' => '専門性の高いキャリアコンサルタントが、求職者と企業の最適なマッチングを実現します。',
                    'address' => $locations[array_rand($locations)],
                    'permit_number' => '13-ユ-' . str_pad($i + 100001, 6, '0', STR_PAD_LEFT),
                    'license_verified' => true,
                ]);
                $user->update(['company_id' => $company->id, 'company_role' => 'owner']);
            }
            $agencies[] = $user->fresh()->company;
        }

        echo "Companies created: " . count($directCompanies) . " direct, " . count($agencies) . " agencies\n";

        // ============================================================
        // 求人 100 件
        // ============================================================

        $jobTemplates = [
            // IT職種
            ['title' => 'フロントエンドエンジニア', 'major' => 'ITエンジニア【Web・モバイル・ゲーム】', 'minor' => 'フロントエンドエンジニア', 'industry' => 'IT・通信', 'salary_min' => 4500000, 'salary_max' => 7000000, 'app_type' => '中途', 'desc' => 'React/Vue.jsを用いたWebアプリケーションのフロントエンド開発をお任せします。UXの改善に情熱を持った方を募集しています。'],
            ['title' => 'バックエンドエンジニア', 'major' => 'ITエンジニア【Web・モバイル・ゲーム】', 'minor' => 'バックエンドエンジニア', 'industry' => 'IT・通信', 'salary_min' => 5000000, 'salary_max' => 8000000, 'app_type' => '中途', 'desc' => 'PHPまたはNode.jsを使用したAPIサーバーの設計・開発をお任せします。スケーラブルなシステム構築に挑戦できます。'],
            ['title' => 'インフラエンジニア（AWS）', 'major' => 'ITエンジニア【システム開発・SE・インフラ】', 'minor' => 'インフラエンジニア', 'industry' => 'IT・通信', 'salary_min' => 5500000, 'salary_max' => 9000000, 'app_type' => '中途', 'desc' => 'AWSを活用したクラウドインフラの設計・構築・運用をお任せします。IaCやCI/CDの整備も推進していただきます。'],
            ['title' => 'データエンジニア', 'major' => 'ITエンジニア【データ・AI・機械学習】', 'minor' => 'データエンジニア', 'industry' => 'IT・通信', 'salary_min' => 6000000, 'salary_max' => 10000000, 'app_type' => '中途', 'desc' => 'データパイプラインの構築・運用、BIツールの整備など、データ活用基盤の整備をリードしていただきます。'],
            ['title' => 'プロダクトマネージャー', 'major' => 'マーケティング・企画', 'minor' => 'プロダクトマネージャー', 'industry' => 'IT・通信', 'salary_min' => 7000000, 'salary_max' => 12000000, 'app_type' => '中途', 'desc' => 'SaaS製品のロードマップ策定からリリースまで、プロダクト全体を牽引するPMを募集します。'],
            ['title' => 'iOSエンジニア', 'major' => 'ITエンジニア【Web・モバイル・ゲーム】', 'minor' => 'モバイルアプリエンジニア（iOS）', 'industry' => 'IT・通信', 'salary_min' => 5000000, 'salary_max' => 8500000, 'app_type' => '中途', 'desc' => 'Swiftを使ったiOSアプリの開発・保守をお任せします。ユーザー数1000万人超えのサービスに携わるチャンスです。'],
            ['title' => 'Androidエンジニア', 'major' => 'ITエンジニア【Web・モバイル・ゲーム】', 'minor' => 'モバイルアプリエンジニア（Android）', 'industry' => 'IT・通信', 'salary_min' => 5000000, 'salary_max' => 8500000, 'app_type' => '中途', 'desc' => 'Kotlinを使ったAndroidアプリの開発をお任せします。最新のAndroid技術を積極的に活用できる環境です。'],
            ['title' => 'セキュリティエンジニア', 'major' => 'ITエンジニア【システム開発・SE・インフラ】', 'minor' => 'セキュリティエンジニア', 'industry' => 'IT・通信', 'salary_min' => 6500000, 'salary_max' => 11000000, 'app_type' => '中途', 'desc' => 'システムのセキュリティ診断・脆弱性対応・セキュリティポリシー策定をリードしていただきます。'],
            ['title' => 'QAエンジニア', 'major' => 'ITエンジニア【システム開発・SE・インフラ】', 'minor' => 'QAエンジニア', 'industry' => 'IT・通信', 'salary_min' => 4000000, 'salary_max' => 6500000, 'app_type' => '中途・新卒', 'desc' => 'テスト自動化の推進やQAプロセスの整備を担当していただきます。品質向上への強い意志を持つ方を歓迎します。'],
            ['title' => 'SREエンジニア', 'major' => 'ITエンジニア【システム開発・SE・インフラ】', 'minor' => 'SRE', 'industry' => 'IT・通信', 'salary_min' => 7000000, 'salary_max' => 12000000, 'app_type' => '中途', 'desc' => 'サービスの信頼性・可用性向上のためのSRE活動をリードしていただきます。オンコール対応もあります。'],

            // 営業職
            ['title' => '法人営業（IT製品）', 'major' => '営業', 'minor' => '法人営業', 'industry' => 'IT・通信', 'salary_min' => 4500000, 'salary_max' => 8000000, 'app_type' => '中途', 'desc' => '大手法人を中心に、クラウドサービスや業務システムの提案・販売を担当していただきます。インセンティブ制度充実。'],
            ['title' => 'カスタマーサクセス', 'major' => '営業', 'minor' => 'カスタマーサクセス', 'industry' => 'IT・通信', 'salary_min' => 4000000, 'salary_max' => 6500000, 'app_type' => '中途・新卒', 'desc' => 'SaaSプロダクトの導入支援から活用促進まで、顧客の成功を伴走するCSをお任せします。'],
            ['title' => 'インサイドセールス', 'major' => '営業', 'minor' => 'インサイドセールス', 'industry' => 'IT・通信', 'salary_min' => 3800000, 'salary_max' => 6000000, 'app_type' => '中途・新卒', 'desc' => '見込み顧客への電話・メール・オンライン商談による新規開拓をお任せします。マーケティングとの連携も重要です。'],
            ['title' => '海外営業（英語必須）', 'major' => '営業', 'minor' => '海外営業', 'industry' => '製造業', 'salary_min' => 5000000, 'salary_max' => 9000000, 'app_type' => '中途', 'desc' => '東南アジア・北米市場への製品展開を担う海外営業を募集します。英語でのビジネスコミュニケーション必須。'],
            ['title' => '不動産営業', 'major' => '営業', 'minor' => '不動産営業', 'industry' => '不動産・建設', 'salary_min' => 4000000, 'salary_max' => 9000000, 'app_type' => '中途', 'desc' => '投資用不動産・収益物件の仕入れ・販売を担当していただきます。高インセンティブで実力次第で高収入を実現。'],

            // マーケティング
            ['title' => 'デジタルマーケター', 'major' => 'マーケティング・企画', 'minor' => 'デジタルマーケティング', 'industry' => 'IT・通信', 'salary_min' => 4500000, 'salary_max' => 7500000, 'app_type' => '中途', 'desc' => 'SEO/SEM/SNS広告などのデジタルマーケティング施策の企画・実行・効果測定をお任せします。'],
            ['title' => 'グロースハッカー', 'major' => 'マーケティング・企画', 'minor' => 'グロースマーケティング', 'industry' => 'IT・通信', 'salary_min' => 5500000, 'salary_max' => 9000000, 'app_type' => '中途', 'desc' => 'データドリブンにプロダクトのグロースを推進。ABテスト設計から施策実行まで幅広く担っていただきます。'],
            ['title' => 'ブランドマネージャー', 'major' => 'マーケティング・企画', 'minor' => 'ブランドマーケティング', 'industry' => '小売・流通', 'salary_min' => 6000000, 'salary_max' => 10000000, 'app_type' => '中途', 'desc' => 'ブランド戦略の立案から広告・PR施策の実行まで、ブランド全体のマネジメントをお任せします。'],

            // 人事・バックオフィス
            ['title' => '人事（採用担当）', 'major' => '管理・事務', 'minor' => '人事・採用', 'industry' => 'IT・通信', 'salary_min' => 4000000, 'salary_max' => 6500000, 'app_type' => '中途', 'desc' => '中途・新卒採用の全プロセスをご担当いただきます。採用媒体の選定から内定フォローまで幅広く対応いただきます。'],
            ['title' => '人事（労務担当）', 'major' => '管理・事務', 'minor' => '総務・労務', 'industry' => 'IT・通信', 'salary_min' => 4000000, 'salary_max' => 6000000, 'app_type' => '中途', 'desc' => '給与計算・社会保険手続き・就業規則管理など労務全般を担当いただきます。人事システムの導入も推進します。'],
            ['title' => '経理・財務', 'major' => '管理・事務', 'minor' => '経理・財務', 'industry' => '金融・保険', 'salary_min' => 4500000, 'salary_max' => 7000000, 'app_type' => '中途', 'desc' => '月次・年次決算業務、資金管理、財務分析などをお任せします。IPO準備フェーズへの関与も可能です。'],
            ['title' => '法務スペシャリスト', 'major' => 'コンサルタント・士業', 'minor' => '法務・コンプライアンス', 'industry' => 'IT・通信', 'salary_min' => 5500000, 'salary_max' => 9000000, 'app_type' => '中途', 'desc' => '契約書のレビュー・作成、コンプライアンス体制の整備、法的リスク管理をお任せします。'],

            // デザイン
            ['title' => 'UIUXデザイナー', 'major' => 'クリエイティブ', 'minor' => 'UI/UXデザイナー', 'industry' => 'IT・通信', 'salary_min' => 4500000, 'salary_max' => 7500000, 'app_type' => '中途', 'desc' => 'ユーザーリサーチからUIデザイン・プロトタイピングまで、プロダクトデザイン全般をお任せします。'],
            ['title' => 'グラフィックデザイナー', 'major' => 'クリエイティブ', 'minor' => 'グラフィックデザイナー', 'industry' => 'メディア・広告', 'salary_min' => 3500000, 'salary_max' => 6000000, 'app_type' => '中途・新卒', 'desc' => 'ブランドビジュアルの制作からWebバナー・SNSクリエイティブまで幅広いデザイン業務をお任せします。'],

            // コンサル
            ['title' => 'ITコンサルタント', 'major' => 'コンサルタント・士業', 'minor' => 'ITコンサルタント', 'industry' => 'コンサルティング', 'salary_min' => 7000000, 'salary_max' => 15000000, 'app_type' => '中途', 'desc' => 'クライアント企業のDX推進をリードするITコンサルタントを募集します。上流工程から実装支援まで幅広く対応。'],
            ['title' => '経営コンサルタント', 'major' => 'コンサルタント・士業', 'minor' => '経営コンサルタント', 'industry' => 'コンサルティング', 'salary_min' => 8000000, 'salary_max' => 18000000, 'app_type' => '中途', 'desc' => '中堅・大手企業の経営課題解決を支援する経営コンサルタントを募集します。幅広い業界への提案経験が積めます。'],

            // 医療・福祉
            ['title' => '看護師（病院）', 'major' => '医療・福祉・介護', 'minor' => '看護師・准看護師', 'industry' => '医療・福祉', 'salary_min' => 4000000, 'salary_max' => 6000000, 'app_type' => '中途', 'desc' => '急性期病院での病棟看護業務をお任せします。充実した研修制度と働きやすい環境を整えています。'],
            ['title' => 'ケアマネージャー', 'major' => '医療・福祉・介護', 'minor' => 'ケアマネージャー', 'industry' => '医療・福祉', 'salary_min' => 3800000, 'salary_max' => 5500000, 'app_type' => '中途', 'desc' => '在宅・施設ケアマネとして、利用者様のケアプラン作成・管理・調整業務をお任せします。'],

            // 教育
            ['title' => '教育コンテンツ開発', 'major' => 'マーケティング・企画', 'minor' => 'コンテンツ企画・編集', 'industry' => '教育・研究', 'salary_min' => 4000000, 'salary_max' => 6500000, 'app_type' => '中途', 'desc' => 'オンライン教育プラットフォームのコンテンツ企画・開発・品質管理をお任せします。'],

            // 製造
            ['title' => '生産管理', 'major' => '製造・技術', 'minor' => '生産管理・品質管理', 'industry' => '製造業', 'salary_min' => 4000000, 'salary_max' => 6500000, 'app_type' => '中途', 'desc' => '生産計画の立案・管理、工程改善、品質管理など製造現場のマネジメントをお任せします。'],
            ['title' => '機械設計エンジニア', 'major' => '製造・技術', 'minor' => '機械設計・CAD', 'industry' => '製造業', 'salary_min' => 4500000, 'salary_max' => 7500000, 'app_type' => '中途', 'desc' => 'CADを使った機械設計から試作・量産立ち上げまで、製品開発の全工程に携わることができます。'],
        ];

        $allCompanies = array_merge($directCompanies, $agencies);
        $jobCount = 0;

        // テンプレートを使い回して100件になるまで生成
        for ($i = 0; $jobCount < 100; $i++) {
            $template = $jobTemplates[$i % count($jobTemplates)];
            $company = $allCompanies[$i % count($allCompanies)];
            $suffix = $i >= count($jobTemplates) ? '（' . ceil($i / count($jobTemplates) + 1) . '）' : '';

            $title = $template['title'] . $suffix;
            if (Job::where('title', $title)->where('company_id', $company->id)->exists()) {
                $jobCount++;
                continue;
            }

            Job::create([
                'company_id'         => $company->id,
                'title'              => $title,
                'description'        => $template['desc'],
                'status'             => $i % 15 === 0 ? 'closed' : 'active',
                'employment_type'    => $employmentTypes[$i % count($employmentTypes)],
                'location'           => $locations[$i % count($locations)],
                'salary_min'         => $template['salary_min'],
                'salary_max'         => $template['salary_max'],
                'industry'           => $template['industry'],
                'job_category_major' => $template['major'],
                'job_category_minor' => $template['minor'],
                'remote_policy'      => $remoteOptions[$i % count($remoteOptions)],
                'application_type'   => $template['app_type'],
                'allow_referral'     => true,
                'positions_available' => rand(1, 5),
                'overtime_average'   => ['月10時間以下', '月20時間程度', '月30時間程度'][($i % 3)],
            ]);

            $jobCount++;
        }

        echo "Jobs created: {$jobCount}\n";

        // ============================================================
        // 求職者 50 名
        // ============================================================

        $lastNames = ['田中', '鈴木', '佐藤', '高橋', '渡辺', '伊藤', '山本', '中村', '小林', '加藤',
                      '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水',
                      '山崎', '阿部', '池田', '橋本', '森', '石川', '前田', '小川', '岡田', '後藤'];
        $firstNames = ['翔太', '拓也', '大輝', '健太', '遥', '彩', '里奈', '麻衣', '俊介', '和也',
                       '美咲', '奈々', '愛', '真一', '浩二', '悠斗', '光', '蓮', '凛', '葵',
                       '陽菜', '春奈', '桜', '楓', '涼', '朝陽', '海斗', '航', '颯', '優'];
        $skills = ['PHP', 'Laravel', 'React', 'Vue.js', 'JavaScript', 'TypeScript', 'Python',
                   'AWS', 'Docker', 'Kubernetes', 'Go', 'Ruby', 'Rails', 'Swift', 'Kotlin',
                   'Java', 'C#', '.NET', 'PostgreSQL', 'MySQL', 'Redis', 'GraphQL', 'Next.js'];
        $educations = ['大学卒', '大学院卒', '専門学校卒', '高校卒', '短期大学卒'];
        $addresses = ['東京都渋谷区', '東京都新宿区', '東京都港区', '神奈川県横浜市', '大阪府大阪市',
                      '愛知県名古屋市', '福岡県福岡市', '埼玉県さいたま市', '千葉県千葉市', '北海道札幌市'];

        $seekers = [];
        for ($i = 0; $i < 50; $i++) {
            $lastName  = $lastNames[$i % count($lastNames)];
            $firstName = $firstNames[$i % count($firstNames)];
            $name = $lastName . ' ' . $firstName;
            $email = 'seeker' . ($i + 1) . '@demo.com';

            $user = User::firstOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'password' => Hash::make('password123'),
                    'role' => 'jobseeker',
                    'email_verified_at' => now(),
                ]
            );

            if (!$user->profile) {
                $userSkills = array_slice($skills, ($i * 3) % count($skills), 4);
                $age = rand(22, 45);
                $expYears = rand(1, 15);
                $user->profile()->create([
                    'full_name'      => $name,
                    'full_name_kana' => $lastName . ' ' . $firstName,
                    'birth_date'     => now()->subYears($age)->format('Y-m-d'),
                    'gender'         => $i % 3 === 0 ? 'female' : 'male',
                    'phone'          => '090' . str_pad(rand(10000000, 99999999), 8, '0'),
                    'postal_code'    => rand(100, 999) . '-' . rand(1000, 9999),
                    'address'        => $addresses[$i % count($addresses)],
                    'education'      => $educations[$i % count($educations)],
                    'work_history'   => "株式会社サンプル（" . (2024 - $expYears) . "年4月〜現在）\n" . $userSkills[0] . "を中心としたシステム開発に従事。チームリードも経験。",
                    'skills'         => $userSkills,
                    'self_pr'        => "{$expYears}年のエンジニア経験を持ち、" . implode('、', array_slice($userSkills, 0, 2)) . "に強みがあります。チームワークを大切にし、プロダクトの成長に貢献できる環境を求めています。",
                ]);
            }
            $seekers[] = $user;
        }

        echo "Seekers created: " . count($seekers) . "\n";

        // ============================================================
        // 閲覧数・応募データを追加
        // ============================================================

        $activeJobs = Job::where('status', 'active')->get();
        $statuses = ['pending', 'under_review', 'interviewing', 'offered', 'hired', 'rejected'];

        foreach ($activeJobs as $job) {
            // 閲覧数
            $views = rand(10, 150);
            for ($v = 0; $v < $views; $v++) {
                JobView::create([
                    'job_id'    => $job->id,
                    'user_id'   => $seekers[array_rand($seekers)]->id,
                    'ip_address' => long2ip(rand(0, 4294967295)),
                    'viewed_at' => now()->subDays(rand(0, 60)),
                ]);
            }

            // 応募（1〜4件）
            $existingApps = Application::where('job_id', $job->id)->count();
            if ($existingApps >= 4) continue;

            $appCount = rand(1, 4);
            $usedIds = Application::where('job_id', $job->id)->pluck('user_id')->toArray();
            $shuffled = $seekers;
            shuffle($shuffled);

            foreach ($shuffled as $seeker) {
                if ($appCount <= 0) break;
                if (in_array($seeker->id, $usedIds)) continue;

                $createdAt = now()->subDays(rand(1, 30));
                Application::create([
                    'user_id'      => $seeker->id,
                    'job_id'       => $job->id,
                    'status'       => $statuses[array_rand($statuses)],
                    'type'         => 'standard',
                    'cover_letter' => rand(0, 1) ? '貴社の事業に強い関心を持ち、ぜひ貢献したいと思い応募いたしました。' : null,
                    'created_at'   => $createdAt,
                    'updated_at'   => $createdAt,
                ]);
                $usedIds[] = $seeker->id;
                $appCount--;
            }
        }

        echo "Large demo data seeded successfully!\n";
        echo "  Direct companies : " . count($directCompanies) . "\n";
        echo "  Agencies         : " . count($agencies) . "\n";
        echo "  Jobs             : {$jobCount}\n";
        echo "  Seekers          : " . count($seekers) . "\n";
        echo "  Login: seeker1@demo.com / company1@demo.com / agency1@demo.com (password: password123)\n";
    }
}
