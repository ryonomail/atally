<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * デモデータを本番DBから全削除する
 *
 * 対象ユーザー:
 *   - *@demo.com  (LargeDataSeeder: company1-20, agency1-10, seeker1-50)
 *   - company@example.com, agency@example.com (DemoSeeder)
 */
return new class extends Migration
{
    public function up(): void
    {
        // デモユーザーのID一覧
        $demoUserIds = DB::table('users')
            ->where('email', 'like', '%@demo.com')
            ->orWhereIn('email', ['company@example.com', 'agency@example.com'])
            ->pluck('id');

        if ($demoUserIds->isEmpty()) {
            return; // 既に削除済み
        }

        // デモユーザーが所有する企業・求人ID
        $demoCompanyIds = DB::table('companies')
            ->whereIn('user_id', $demoUserIds)
            ->pluck('id');

        $demoJobIds = DB::table('jobs')
            ->whereIn('company_id', $demoCompanyIds)
            ->pluck('id');

        // デモ求人に紐づく応募ID
        $demoAppIds = DB::table('applications')
            ->whereIn('job_id', $demoJobIds)
            ->orWhereIn('user_id', $demoUserIds)
            ->pluck('id');

        // 削除（外部キー制約の順序を守る）
        DB::table('messages')
            ->whereIn('application_id', $demoAppIds)
            ->orWhereIn('sender_id', $demoUserIds)
            ->delete();

        DB::table('application_status_histories')
            ->whereIn('application_id', $demoAppIds)
            ->delete();

        DB::table('interview_schedules')
            ->whereIn('application_id', $demoAppIds)
            ->delete();

        DB::table('applications')
            ->whereIn('id', $demoAppIds)
            ->delete();

        DB::table('job_views')
            ->whereIn('job_id', $demoJobIds)
            ->orWhereIn('user_id', $demoUserIds)
            ->delete();

        DB::table('job_referrals')
            ->whereIn('job_id', $demoJobIds)
            ->delete();

        DB::table('job_photos')
            ->whereIn('job_id', $demoJobIds)
            ->delete();

        DB::table('job_personas')
            ->whereIn('job_id', $demoJobIds)
            ->delete();

        DB::table('saved_jobs')
            ->whereIn('job_id', $demoJobIds)
            ->orWhereIn('user_id', $demoUserIds)
            ->delete();

        DB::table('jobs')
            ->whereIn('id', $demoJobIds)
            ->delete();

        DB::table('campaigns')
            ->whereIn('company_id', $demoCompanyIds)
            ->delete();

        DB::table('agency_clients')
            ->whereIn('agency_id', $demoCompanyIds)
            ->orWhereIn('client_company_id', $demoCompanyIds)
            ->delete();

        DB::table('company_invitations')
            ->whereIn('company_id', $demoCompanyIds)
            ->delete();

        DB::table('companies')
            ->whereIn('id', $demoCompanyIds)
            ->delete();

        DB::table('in_app_notifications')
            ->whereIn('user_id', $demoUserIds)
            ->delete();

        DB::table('job_alerts')
            ->whereIn('user_id', $demoUserIds)
            ->delete();

        DB::table('resumes')
            ->whereIn('user_id', $demoUserIds)
            ->delete();

        DB::table('user_profiles')
            ->whereIn('user_id', $demoUserIds)
            ->delete();

        DB::table('reports')
            ->whereIn('reporter_id', $demoUserIds)
            ->delete();

        // users.company_id の外部キーをクリアしてからユーザー削除
        DB::table('users')
            ->whereIn('id', $demoUserIds)
            ->update(['company_id' => null]);

        DB::table('users')
            ->whereIn('id', $demoUserIds)
            ->delete();
    }

    public function down(): void
    {
        // 削除したデモデータの復元は不要
    }
};
