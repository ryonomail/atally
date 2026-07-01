<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\UserProfileController;
use App\Http\Controllers\ResumeController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\JobController;
use App\Http\Controllers\ApplicationController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\InterviewScheduleController;
use App\Http\Controllers\ScoutController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AgencyController;
use App\Http\Controllers\MarketplaceController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\SavedJobController;
use App\Http\Controllers\JobAlertController;
use App\Http\Controllers\AgencyClientController;
use App\Http\Controllers\StripeWebhookController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\CampaignController;
use App\Http\Controllers\InAppNotificationController;
use Illuminate\Support\Facades\Route;

/* |-------------------------------------------------------------------------- | 認証（パブリック・レート制限付き） |-------------------------------------------------------------------------- */
// 登録・ログイン（10回/分）
Route::middleware('throttle:10,1')->group(function () {
    Route::post('/register', [AuthController::class , 'register']);
    Route::post('/login', [AuthController::class , 'login']);
    Route::post('/auth/exchange-code', [\App\Http\Controllers\SocialAuthController::class , 'exchangeAuthCode']);
});

// パスワードリセット・メール認証（3回/分）ブルートフォース対策
Route::middleware('throttle:3,1')->group(function () {
    Route::post('/forgot-password', [PasswordResetController::class , 'forgotPassword']);
    Route::post('/reset-password', [PasswordResetController::class , 'resetPassword']);
    Route::post('/verify-email', [AuthController::class , 'verifyEmail']);
    Route::post('/resend-verification', [AuthController::class , 'resendVerification']);
});

// Stripe Webhook（認証不要・署名検証で保護・レート制限でDDoS対策）
Route::middleware('throttle:120,1')->post('/webhook/stripe', [StripeWebhookController::class , 'handle']);

/* |-------------------------------------------------------------------------- | 求人検索（パブリック・レート制限+ボット対策付き） |-------------------------------------------------------------------------- */
Route::middleware(['block.bots', 'throttle:60,1'])->group(function () {
    Route::get('/jobs', [JobController::class , 'index']);
    // SEO: 都道府県内の市区町村一覧（{job} より前に定義）
    Route::get('/jobs/cities', [JobController::class , 'citiesByPrefecture']);
    Route::get('/jobs/{job}', [JobController::class , 'show']);
});

// サイト統計（パブリック・レート制限付き）
Route::middleware(['block.bots', 'throttle:30,1'])->get('/stats', [JobController::class , 'stats']);

// 企業プロフィール（パブリック）
Route::middleware(['block.bots', 'throttle:60,1'])->get('/companies/{company}/profile', [CompanyController::class , 'publicProfile']);

/* |-------------------------------------------------------------------------- | 認証済みユーザー |-------------------------------------------------------------------------- */
Route::middleware(['auth:sanctum', 'check.suspended'])->group(function () {
    // 認証
    Route::post('/logout', [AuthController::class , 'logout']);
    Route::get('/me', [AuthController::class , 'me']);

    // 通報（スパム防止: 5回/分）— MVP期間中は無効化（管理者が手動対応）
    // Route::middleware('throttle:5,1')->post('/reports', [ReportController::class , 'store']);

    // 設定（全認証ユーザー共通）
    Route::put('/settings/password', [SettingsController::class , 'updatePassword']);
    Route::get('/settings/notifications', [SettingsController::class , 'getNotifications']);
    Route::put('/settings/notifications', [SettingsController::class , 'updateNotifications']);
    // 個人データエクスポート（1時間に2回まで）
    Route::middleware('throttle:2,60')->get('/settings/export-data', [SettingsController::class , 'exportData']);
    // 退会（5分に1回まで）
    Route::middleware('throttle:3,5')->post('/settings/deactivate', [SettingsController::class , 'deactivate']);

    // アプリ内通知（一括既読はレート制限付き）
    Route::get('/notifications', [InAppNotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [InAppNotificationController::class, 'unreadCount']);
    Route::get('/notifications/recent', [InAppNotificationController::class, 'recent']);
    Route::middleware('throttle:60,1')->group(function () {
        Route::put('/notifications/{notification}/read', [InAppNotificationController::class, 'markAsRead']);
        Route::put('/notifications/read-all', [InAppNotificationController::class, 'markAllAsRead']);
    });

    // メッセージ
    Route::get('/messages/unread-count', [MessageController::class , 'unreadCount']);
    Route::get('/messages/conversations', [MessageController::class , 'conversations']);
    Route::get('/applications/{application}/messages', [MessageController::class , 'index']);
    Route::post('/applications/{application}/messages', [MessageController::class , 'store']);
    Route::get('/messages/{message}/attachment', [MessageController::class , 'downloadAttachment']);

    /*
     |----------------------------------------------------------------------
     | 求職者専用
     |----------------------------------------------------------------------
     */
    Route::middleware('role:jobseeker')->group(function () {
            // プロフィール
            Route::get('/profile', [UserProfileController::class , 'show']);
            Route::put('/profile', [UserProfileController::class , 'update']);
            Route::post('/profile/photo', [UserProfileController::class , 'uploadPhoto']);

            // 履歴書
            // ゲスト履歴書の取り込み（{resume}に取られないよう apiResource より前に定義）
            Route::post('/resumes/import-guest', [ResumeController::class , 'importGuest']);
            Route::apiResource('resumes', ResumeController::class);
            Route::post('/resumes/{resume}/duplicate', [ResumeController::class , 'duplicate']);
            Route::post('/resumes/{resume}/to-cv', [ResumeController::class , 'toCv']);
            Route::get('/resumes/{resume}/preview', [ResumeController::class , 'preview']);

            // 応募
            Route::get('/my-applications', [ApplicationController::class , 'myApplications']);
            Route::get('/my-applications/job-ids', [ApplicationController::class , 'myApplicationJobIds']);
            Route::post('/jobs/{job}/apply', [ApplicationController::class , 'apply']);
            // MVP期間中は無効化（スカウト機能は後フェーズ）
            // Route::post('/applications/{application}/accept-scout', [ApplicationController::class , 'acceptScout']);
            // Route::post('/applications/{application}/decline-scout', [ApplicationController::class , 'declineScout']);

            // 求人保存（ブックマーク）
            Route::get('/saved-jobs', [SavedJobController::class , 'index']);
            Route::post('/saved-jobs/{job}', [SavedJobController::class , 'store']);
            Route::delete('/saved-jobs/{job}', [SavedJobController::class , 'destroy']);

            // 求人アラート — MVP期間中は無効化（後フェーズ）
            // Route::get('/job-alerts', [JobAlertController::class , 'index']);
            // Route::post('/job-alerts', [JobAlertController::class , 'store']);
            // Route::delete('/job-alerts/{alert}', [JobAlertController::class , 'destroy']);
        }
        );

        /*
     |----------------------------------------------------------------------
     | 企業専用
     |----------------------------------------------------------------------
     */
        Route::middleware('role:company')->group(function () {
            // 企業情報
            Route::post('/company', [CompanyController::class , 'store']);
            Route::get('/company', [CompanyController::class , 'show']);
            Route::put('/company', [CompanyController::class , 'update']);
            Route::post('/company/documents', [CompanyController::class , 'uploadDocument']);
            Route::put('/company/budget', [CompanyController::class , 'updateBudget']);
            Route::get('/company/billing-history', [CompanyController::class , 'billingHistory']);

            // チーム管理 — MVP期間中は無効化（1社1アカウントで十分）
            // Route::get('/company/team', [TeamController::class, 'index']);
            // Route::post('/company/team/invite', [TeamController::class, 'invite']);
            // Route::put('/company/team/{user}', [TeamController::class, 'updateRole']);
            // Route::delete('/company/team/{user}', [TeamController::class, 'removeMember']);
            // Route::delete('/company/team/invitations/{invitation}', [TeamController::class, 'cancelInvitation']);

            // 決済（カード登録）
            Route::post('/payment/setup-intent', [PaymentController::class , 'createSetupIntent']);
            Route::post('/payment/confirm-card', [PaymentController::class , 'confirmCard']);
            Route::get('/payment/method', [PaymentController::class , 'getPaymentMethod']);
            Route::delete('/payment/method', [PaymentController::class , 'deletePaymentMethod']);
            Route::get('/payment/check', [PaymentController::class , 'checkPaymentReady']);

            // エージェント: 審査前も利用可能（ダッシュボード・ライセンス提出）
            Route::post('/agency/license', [AgencyController::class , 'uploadLicense']);
            Route::get('/agency/dashboard', [AgencyController::class , 'dashboard']);

            // マーケットプレイス（運用代行・代理店）
            // 求人主向け
            Route::get('/marketplace/agencies', [MarketplaceController::class , 'agencies']);
            Route::get('/marketplace/my-engagement', [MarketplaceController::class , 'myEngagement']);
            Route::post('/marketplace/engagements', [MarketplaceController::class , 'requestEngagement']);
            Route::post('/marketplace/engagements/{engagement}/end', [MarketplaceController::class , 'endEngagement']);
            // 代理店向け
            Route::post('/marketplace/profile', [MarketplaceController::class , 'updateProfile']);
            Route::get('/marketplace/engagements', [MarketplaceController::class , 'engagements']);
            Route::post('/marketplace/engagements/{engagement}/respond', [MarketplaceController::class , 'respondEngagement']);
            Route::get('/marketplace/payouts', [MarketplaceController::class , 'payouts']);

            // 審査済み企業のみ
            Route::middleware('verified.company')->group(function () {
                    // 求人管理
                    Route::get('/my-jobs', [JobController::class , 'myJobs']);
                    Route::get('/my-jobs/analytics', [JobController::class , 'analytics']);
                    Route::post('/jobs/market-benchmark', [JobController::class , 'marketBenchmark']);
                    Route::post('/jobs', [JobController::class , 'store']);
                    Route::put('/jobs/{job}', [JobController::class , 'update']);
                    Route::post('/jobs/bulk-budget', [JobController::class , 'bulkBudget']);
                    Route::post('/jobs/bulk-status', [JobController::class , 'bulkStatus']);
                    Route::post('/jobs/bulk-delete', [JobController::class , 'bulkDestroy']);

                    // 予算グループ（日額まとめ管理）
                    Route::get('/campaigns', [CampaignController::class , 'index']);
                    Route::post('/campaigns', [CampaignController::class , 'store']);
                    Route::get('/campaigns/{campaign}', [CampaignController::class , 'show']);
                    Route::put('/campaigns/{campaign}', [CampaignController::class , 'update']);
                    Route::delete('/campaigns/{campaign}', [CampaignController::class , 'destroy']);
                    Route::post('/campaigns/{campaign}/jobs', [CampaignController::class , 'addJobs']);
                    Route::delete('/campaigns/{campaign}/jobs', [CampaignController::class , 'removeJobs']);
                    Route::post('/campaigns/{campaign}/redistribute', [CampaignController::class , 'redistribute']);

                    // スカウト — MVP期間中は無効化（後フェーズ）
                    // Route::middleware('throttle:30,1')->get('/scout/search', [ScoutController::class , 'search']);
                    // Route::middleware('throttle:20,1')->post('/scout', [ApplicationController::class , 'scout']);
                    // Route::middleware('throttle:5,1')->post('/scout/bulk', [ScoutController::class , 'bulkScout']);

                    // 順位シミュレーター — MVP期間中は無効化（キャンペーンで運用可能）
                    // Route::post('/ranking/simulate', [JobController::class , 'simulateRanking']);

                    // ペルソナ設定 — MVP期間中は無効化（後フェーズ）
                    // Route::get('/jobs/{job}/persona', [JobController::class , 'getPersona']);
                    // Route::put('/jobs/{job}/persona', [JobController::class , 'savePersona']);
                    // Route::delete('/jobs/{job}/persona', [JobController::class , 'deletePersona']);

                    // 求人写真
                    Route::get('/jobs/{job}/photos', [JobController::class , 'photos']);
                    Route::post('/jobs/{job}/photos', [JobController::class , 'uploadPhoto']);
                    Route::delete('/jobs/{job}/photos/{photo}', [JobController::class , 'deletePhoto']);

                    // 求人複製・エクスポート
                    Route::post('/jobs/{job}/duplicate', [JobController::class , 'duplicate']);
                    // CSVエクスポート（個人情報含む: 1時間に10回まで）
                    Route::middleware('throttle:10,60')->get('/jobs-export-csv', [JobController::class , 'exportCsv']);

                    // 求人削除
                    Route::delete('/jobs/{job}', [JobController::class , 'destroy']);

                    // 応募管理
                    Route::get('/jobs/{job}/applications', [ApplicationController::class , 'jobApplications']);
                    // 応募者CSV（個人情報含む: 1時間に10回まで）
                    Route::middleware('throttle:10,60')->get('/jobs/{job}/applications-csv', [ApplicationController::class , 'exportApplicationsCsv']);

                    // エージェント機能（審査済み必須）
                    // 収益アナリティクス — MVP期間中は無効化（後フェーズ）
                    // Route::get('/agency/revenue-analytics', [AgencyController::class , 'revenueAnalytics']);
                    Route::get('/agency/job-database', [AgencyController::class , 'jobDatabase']);
                    Route::post('/agency/bulk-upload', [AgencyController::class , 'bulkUpload']);
                    // 候補者検索 — MVP期間中は無効化（スカウトと一体、後フェーズ）
                    // Route::get('/agency/candidates', [AgencyController::class , 'searchCandidates']);
                    // 紹介成功報酬管理 — MVP期間中は無効化（別ビジネスモデル、後フェーズ）
                    // Route::post('/agency/referrals/{job}', [AgencyController::class , 'createReferral']);
                    // Route::get('/agency/referrals/received', [AgencyController::class , 'receivedReferrals']);
                    // Route::get('/agency/referrals/sent', [AgencyController::class , 'sentReferrals']);
                    // Route::put('/agency/referrals/{referral}/status', [AgencyController::class , 'updateReferralStatus']);
                    // Route::post('/agency/referrals/{referral}/placement', [AgencyController::class , 'reportPlacement']);

                    // エージェント クライアント管理
                    Route::get('/agency/clients', [AgencyClientController::class , 'index']);
                    Route::post('/agency/clients', [AgencyClientController::class , 'store']);
                    Route::put('/agency/clients/{client}', [AgencyClientController::class , 'update']);
                    Route::delete('/agency/clients/{client}', [AgencyClientController::class , 'destroy']);
                }
                );
            }
            );

            /*
         |----------------------------------------------------------------------
         | 共通: 面接日程 — MVP期間中は無効化（メッセージで代用）
         |----------------------------------------------------------------------
         */
            // Route::middleware('active.company')->group(function () {
            //     Route::get('/applications/{application}/schedules', [InterviewScheduleController::class , 'index']);
            //     Route::post('/applications/{application}/schedules', [InterviewScheduleController::class , 'store']);
            //     Route::put('/schedules/{schedule}', [InterviewScheduleController::class , 'update']);
            //     Route::put('/schedules/{schedule}/confirm', [InterviewScheduleController::class , 'confirm']);
            //     Route::get('/schedules/{schedule}/ical', [InterviewScheduleController::class , 'exportIcal']);
            // });

        // ステータス更新
        Route::put('/applications/bulk-status', [ApplicationController::class , 'bulkUpdateStatus']);
        Route::put('/applications/{application}/status', [ApplicationController::class , 'updateStatus']);

        // 応募タイムライン
        Route::get('/applications/{application}/timeline', [ApplicationController::class , 'timeline']);

        /*
     |----------------------------------------------------------------------
     | 管理者専用
     |----------------------------------------------------------------------
     */
        Route::middleware('role:admin')->prefix('admin')->group(function () {
            Route::get('/overview', [AdminController::class , 'overview']);
            Route::get('/dashboard', [AdminController::class , 'dashboard']);
            Route::get('/companies/pending', [AdminController::class , 'pendingCompanies']);
            Route::put('/companies/{company}/review', [AdminController::class , 'reviewCompany']);
            Route::get('/jobs/pending', [AdminController::class , 'pendingJobs']);
            Route::get('/hellowork-status', [AdminController::class , 'helloworkStatus']);
            Route::post('/hellowork-sync', [AdminController::class , 'triggerHelloworkSync']);
            Route::put('/jobs/bulk-review', [AdminController::class , 'bulkReviewJobs']);
            Route::put('/jobs/{job}/review', [AdminController::class , 'reviewJob']);
            Route::get('/reports', [AdminController::class , 'reports']);
            Route::put('/reports/{report}/resolve', [AdminController::class , 'resolveReport']);
            Route::get('/licenses/pending', [AdminController::class , 'pendingLicenses']);
            Route::put('/licenses/{company}/review', [AdminController::class , 'reviewLicense']);
            Route::get('/jobseekers', [AdminController::class , 'jobseekers']);
            Route::get('/jobseekers/{user}/resumes', [AdminController::class , 'jobseekerResumes']);
            Route::get('/companies/all', [AdminController::class , 'allCompanies']);
            Route::get('/jobs/all', [AdminController::class , 'allJobs']);
            Route::get('/revenue', [AdminController::class , 'revenue']);
            Route::put('/users/{user}/suspend', [AdminController::class , 'suspendUser']);
            Route::put('/users/{user}/unsuspend', [AdminController::class , 'unsuspendUser']);
            Route::delete('/users/{user}', [AdminController::class , 'deleteUser']);
            Route::get('/audit-logs', [AdminController::class , 'auditLogs']);
            Route::get('/users/{user}/detail', [AdminController::class , 'userDetail']);
            Route::get('/settings', [AdminController::class , 'getSettings']);
            Route::put('/settings', [AdminController::class , 'updateSettings']);
        }
        );    });
