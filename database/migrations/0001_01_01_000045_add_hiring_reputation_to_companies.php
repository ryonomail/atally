<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            // 採用実績スコア（時間経過で減衰しない信頼の蓄積値）
            $table->decimal('hiring_reputation', 5, 4)->default(1.0000)->after('quality_score');
        });

        Schema::table('jobs', function (Blueprint $table) {
            // 求人放置検知用: 企業が最後にアクションした日時
            $table->timestamp('last_company_action_at')->nullable()->after('expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn('hiring_reputation');
        });

        Schema::table('jobs', function (Blueprint $table) {
            $table->dropColumn('last_company_action_at');
        });
    }
};
