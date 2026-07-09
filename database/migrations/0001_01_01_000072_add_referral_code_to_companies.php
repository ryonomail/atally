<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * パートナー（代理店）の紹介コード。
     * 代理店が「?ref=コード」付き登録URLで顧客企業を連れてくると、
     * 登録時に自動でエンゲージメント（担当関係）が作られ、以後その企業の求人課金の25%が代理店に還元される。
     */
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            if (!Schema::hasColumn('companies', 'referral_code')) {
                $table->string('referral_code', 20)->nullable()->unique();
            }
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn('referral_code');
        });
    }
};
