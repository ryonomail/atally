<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_referrals', function (Blueprint $table) {
            $table->integer('proposal_fee')->default(500)->after('candidate_summary');
            $table->boolean('terms_accepted')->default(false)->after('proposal_fee');
        });
    }

    public function down(): void
    {
        Schema::table('job_referrals', function (Blueprint $table) {
            $table->dropColumn(['proposal_fee', 'terms_accepted']);
        });
    }
};
