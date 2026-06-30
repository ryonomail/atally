<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * 派遣・紹介の法令明示対応。
     * - companies.dispatch_license_number: 派遣事業許可番号（紹介の permit_number とは別制度）
     * - jobs.listing_type: direct(直接) / dispatch(派遣) / referral(紹介) を明示選択
     * - jobs.dispatch_client_name / show_dispatch_client: 派遣先名と公開可否（派遣元の判断）
     */
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->string('dispatch_license_number')->nullable()->after('permit_number');
        });

        Schema::table('jobs', function (Blueprint $table) {
            $table->string('listing_type', 20)->default('direct')->after('employment_type');
            $table->string('dispatch_client_name')->nullable()->after('listing_type');
            $table->boolean('show_dispatch_client')->default(false)->after('dispatch_client_name');
        });

        // 既存求人の種別を推定してバックフィル
        DB::table('jobs')->where('is_agency_job', true)->update(['listing_type' => 'referral']);
        DB::table('jobs')->where('employment_type', '派遣')->where('is_agency_job', false)->update(['listing_type' => 'dispatch']);
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn('dispatch_license_number');
        });
        Schema::table('jobs', function (Blueprint $table) {
            $table->dropColumn(['listing_type', 'dispatch_client_name', 'show_dispatch_client']);
        });
    }
};
