<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_referrals', function (Blueprint $table) {
            $table->unsignedBigInteger('candidate_user_id')->nullable()->after('referrer_company_id');
            $table->string('resume_file_path')->nullable()->after('candidate_summary');
            $table->foreign('candidate_user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('job_referrals', function (Blueprint $table) {
            $table->dropForeign(['candidate_user_id']);
            $table->dropColumn(['candidate_user_id', 'resume_file_path']);
        });
    }
};
