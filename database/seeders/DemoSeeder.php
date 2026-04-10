<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Company;
use App\Models\Job;
use App\Models\Application;
use App\Models\JobView;
use App\Models\InAppNotification;
use App\Models\Message;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        // ========================================
        // テスト用固定アカウント（企業）
        // ========================================

        // 一般企業アカウント: company@example.com
        $companyUser = User::firstOrCreate(
            ['email' => 'company@example.com'],
            [
                'name' => 'テスト株式会社',
                'password' => Hash::make('password'),
                'role' => 'company',
                'email_verified_at' => now(),
            ]
        );
        if (!$companyUser->company) {
            $company = Company::create([
                'user_id' => $companyUser->id,
                'company_name' => 'テスト株式会社',
                'company_type' => 'direct_employer',
            ]);
            $companyUser->update(['company_id' => $company->id, 'company_role' => 'owner']);
        } else {
            // company_type が違う場合は修正
            $companyUser->company->update(['company_type' => 'direct_employer']);
        }

        // 人材紹介会社アカウント: agency@example.com
        $agencyUser = User::firstOrCreate(
            ['email' => 'agency@example.com'],
            [
                'name' => 'テスト人材紹介株式会社',
                'password' => Hash::make('password'),
                'role' => 'company',
                'email_verified_at' => now(),
            ]
        );
        if (!$agencyUser->company) {
            $agencyCompany = Company::create([
                'user_id' => $agencyUser->id,
                'company_name' => 'テスト人材紹介株式会社',
                'company_type' => 'recruitment_agency',
                'permit_number' => '13-ユ-999999',
                'license_verified' => true,
            ]);
            $agencyUser->update(['company_id' => $agencyCompany->id, 'company_role' => 'owner']);
        } else {
            $agencyUser->company->update(['company_type' => 'recruitment_agency']);
        }

        // ========================================
        // テスト用求人データ
        // ========================================
        $directCompany = $companyUser->fresh()->company;
        $agencyCompany2 = $agencyUser->fresh()->company;

        $jobsData = [
            [
                'company_id' => $directCompany->id,
                'title' => 'Webエンジニア（フロントエンド）',
                'description' => 'React/TypeScriptを使ったWebアプリケーション開発をお任せします。チームで協力しながら、ユーザー体験の向上に取り組んでいただきます。',
                'status' => 'active',
                'employment_type' => '正社員',
                'location' => '東京都渋谷区',
                'salary_min' => 4500000,
                'salary_max' => 7000000,
                'industry' => 'IT・通信',
                'job_category_major' => 'エンジニア・技術職',
                'job_category_minor' => 'フロントエンドエンジニア',
                'remote_policy' => 'フルリモート',
                'allow_referral' => true,
            ],
            [
                'company_id' => $directCompany->id,
                'title' => 'バックエンドエンジニア（Laravel）',
                'description' => 'LaravelベースのAPIサーバー開発・保守をお任せします。PostgreSQL、Redisを使用したシステム設計も担当いただきます。',
                'status' => 'active',
                'employment_type' => '正社員',
                'location' => '東京都新宿区',
                'salary_min' => 5000000,
                'salary_max' => 8000000,
                'industry' => 'IT・通信',
                'job_category_major' => 'エンジニア・技術職',
                'job_category_minor' => 'バックエンドエンジニア',
                'remote_policy' => 'ハイブリッド',
                'allow_referral' => true,
            ],
            [
                'company_id' => $directCompany->id,
                'title' => '営業マネージャー（SaaS）',
                'description' => 'SaaS製品の法人営業をリードするポジションです。チームのマネジメントから大手顧客の新規開拓まで幅広くお任せします。',
                'status' => 'active',
                'employment_type' => '正社員',
                'location' => '大阪府大阪市',
                'salary_min' => 5500000,
                'salary_max' => 9000000,
                'industry' => 'IT・通信',
                'job_category_major' => '営業職',
                'job_category_minor' => '法人営業',
                'remote_policy' => '出社必須',
                'allow_referral' => true,
            ],
            [
                'company_id' => $agencyCompany2->id,
                'title' => 'プロジェクトマネージャー（金融系SI）',
                'description' => '大手金融機関向けシステム開発のプロジェクトマネジメントをお任せします。要件定義から運用まで一貫して担当いただきます。',
                'status' => 'active',
                'employment_type' => '正社員',
                'location' => '東京都千代田区',
                'salary_min' => 7000000,
                'salary_max' => 11000000,
                'industry' => '金融・保険',
                'job_category_major' => 'エンジニア・技術職',
                'job_category_minor' => 'プロジェクトマネージャー',
                'remote_policy' => 'ハイブリッド',
                'allow_referral' => true,
            ],
            [
                'company_id' => $agencyCompany2->id,
                'title' => '人事・採用担当',
                'description' => '中途採用を中心とした採用業務全般をお任せします。母集団形成から内定フォローまで幅広く担当いただきます。',
                'status' => 'active',
                'employment_type' => '正社員',
                'location' => '東京都港区',
                'salary_min' => 4000000,
                'salary_max' => 6000000,
                'industry' => '人材・教育',
                'job_category_major' => '人事・総務・法務',
                'job_category_minor' => '採用・人材開発',
                'remote_policy' => 'ハイブリッド',
                'allow_referral' => true,
            ],
        ];

        foreach ($jobsData as $jobData) {
            if (Job::where('title', $jobData['title'])->where('company_id', $jobData['company_id'])->doesntExist()) {
                Job::create($jobData);
            }
        }

        // ========================================
        // 求職者を追加（3名）
        // ========================================
        $seekers = [];

        $seekerData = [
            ['name' => '山田 太郎', 'email' => 'yamada@demo.com'],
            ['name' => '鈴木 花子', 'email' => 'suzuki@demo.com'],
            ['name' => '田中 一郎', 'email' => 'tanaka@demo.com'],
        ];

        foreach ($seekerData as $sd) {
            $s = User::firstOrCreate(
                ['email' => $sd['email']],
                [
                    'name' => $sd['name'],
                    'password' => Hash::make('password123'),
                    'role' => 'jobseeker',
                    'email_verified_at' => now(),
                ]
            );
            $seekers[] = $s;

            // プロフィール作成
            if (!$s->profile) {
                $s->profile()->create([
                    'full_name' => $sd['name'],
                    'full_name_kana' => 'ヤマダ タロウ',
                    'birth_date' => fake()->dateTimeBetween('-40 years', '-22 years')->format('Y-m-d'),
                    'gender' => fake()->randomElement(['male', 'female']),
                    'phone' => '090' . fake()->numerify('########'),
                    'postal_code' => fake()->numerify('###-####'),
                    'address' => fake()->randomElement(['東京都渋谷区', '大阪府大阪市', '神奈川県横浜市', '愛知県名古屋市']),
                    'education' => fake()->randomElement(['大学卒', '大学院卒', '専門学校卒']),
                    'work_history' => "株式会社ABC（2019年4月〜2023年3月）\nWebエンジニアとして開発業務に従事",
                    'skills' => fake()->randomElements(['PHP', 'Laravel', 'React', 'JavaScript', 'TypeScript', 'Python', 'AWS', 'Docker'], 4),
                    'self_pr' => '前職ではWebアプリケーション開発に3年間携わり、フロントエンドからバックエンドまで一貫して担当しました。',
                ]);
            }
        }

        // 既存の求職者も含める
        $existingSeeker = User::where('email', 'user@example.com')->first();
        if ($existingSeeker) {
            array_unshift($seekers, $existingSeeker);
        }

        // ========================================
        // 各求人に閲覧数を追加
        // ========================================
        $jobs = \App\Models\Job::where('status', 'active')->get();

        foreach ($jobs as $job) {
            $existingViews = JobView::where('job_id', $job->id)->count();
            $targetViews = rand(30, 200);
            $newViews = max(0, $targetViews - $existingViews);

            for ($i = 0; $i < $newViews; $i++) {
                JobView::create([
                    'job_id' => $job->id,
                    'user_id' => $seekers[array_rand($seekers)]->id ?? null,
                    'ip_address' => fake()->ipv4(),
                    'viewed_at' => fake()->dateTimeBetween('-30 days', 'now'),
                ]);
            }
        }

        // ========================================
        // 応募データを作成（様々なステータス）
        // ========================================
        $statuses = ['pending', 'under_review', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn'];

        foreach ($jobs as $job) {
            $existingApps = Application::where('job_id', $job->id)->count();
            if ($existingApps >= 3) continue;

            $numApps = rand(2, 5);
            $usedSeekers = Application::where('job_id', $job->id)->pluck('user_id')->toArray();

            foreach ($seekers as $seeker) {
                if ($numApps <= 0) break;
                if (in_array($seeker->id, $usedSeekers)) continue;

                $status = $statuses[array_rand($statuses)];
                $createdAt = fake()->dateTimeBetween('-20 days', '-1 day');

                Application::create([
                    'user_id' => $seeker->id,
                    'job_id' => $job->id,
                    'status' => $status,
                    'type' => 'standard',
                    'cover_letter' => fake()->randomElement([
                        '貴社の求人に強い関心を持ち応募いたしました。前職での経験を活かして貢献できると考えております。',
                        'この度は求人を拝見し、ぜひ貴社で働きたいと思い応募させていただきました。',
                        null,
                    ]),
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ]);

                $numApps--;
            }
        }

        // ========================================
        // メッセージデータ（応募に紐づくやり取り）
        // ========================================
        $appsWithMessages = Application::whereIn('status', ['under_review', 'interviewing', 'offered', 'hired'])
            ->inRandomOrder()
            ->limit(6)
            ->get();

        foreach ($appsWithMessages as $app) {
            $job = $app->job;
            if (!$job) continue;
            $company = $job->company;
            if (!$company) continue;
            $companyUser = User::where('id', $company->user_id)->first();
            if (!$companyUser) continue;

            // 企業からの最初のメッセージ
            $existingMsgs = Message::where('application_id', $app->id)->count();
            if ($existingMsgs > 0) continue;

            Message::create([
                'application_id' => $app->id,
                'sender_id' => $companyUser->id,
                'body' => 'ご応募ありがとうございます。書類を拝見し、ぜひ面談の機会をいただきたいと思いご連絡いたしました。ご都合の良い日時をお知らせいただけますでしょうか。',
                'created_at' => now()->subDays(rand(1, 10)),
            ]);

            // 求職者からの返信
            Message::create([
                'application_id' => $app->id,
                'sender_id' => $app->user_id,
                'body' => 'ご連絡ありがとうございます。来週の火曜日か水曜日の午後であれば対応可能です。よろしくお願いいたします。',
                'created_at' => now()->subDays(rand(0, 5)),
            ]);
        }

        // ========================================
        // 通知データ
        // ========================================
        foreach ($seekers as $seeker) {
            $existingNotifs = InAppNotification::where('user_id', $seeker->id)->count();
            if ($existingNotifs >= 3) continue;

            InAppNotification::create([
                'user_id' => $seeker->id,
                'type' => 'application',
                'title' => '応募が受理されました',
                'body' => 'あなたの応募が企業に届きました。',
                'link' => '/dashboard',
                'created_at' => now()->subDays(rand(0, 7)),
            ]);

            InAppNotification::create([
                'user_id' => $seeker->id,
                'type' => 'message',
                'title' => '新しいメッセージがあります',
                'body' => '企業からメッセージが届いています。',
                'link' => '/messages',
                'created_at' => now()->subDays(rand(0, 3)),
            ]);
        }

        echo "Demo data seeded successfully!\n";
        echo "New seekers: yamada@demo.com, suzuki@demo.com, tanaka@demo.com (password: password123)\n";
    }
}
