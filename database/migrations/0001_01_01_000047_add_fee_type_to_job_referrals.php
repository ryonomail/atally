<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_referrals', function (Blueprint $table) {
            // 手数料タイプ: percentage（料率）or fixed（固定金額）
            $table->string('referral_fee_type', 20)->default('percentage')->after('fee_percentage');
            // 固定金額の場合の手数料額（円）
            $table->unsignedBigInteger('referral_fee_amount')->nullable()->after('referral_fee_type');
            // パターン: direct（企業←エージェント）or revenue_share（エージェント間）
            $table->string('referral_pattern', 20)->default('revenue_share')->after('referral_fee_amount');
        });
    }

    public function down(): void
    {
        Schema::table('job_referrals', function (Blueprint $table) {
            $table->dropColumn(['referral_fee_type', 'referral_fee_amount', 'referral_pattern']);
        });
    }
};
