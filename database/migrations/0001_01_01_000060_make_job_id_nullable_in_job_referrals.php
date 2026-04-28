<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 求人が削除されても紹介レコード（手数料データ含む）が消えないよう
     * job_id を nullable + SET NULL に変更する。
     * 成約済み・拒否済み紹介の手数料データは双方に残り続ける。
     */
    public function up(): void
    {
        Schema::table('job_referrals', function (Blueprint $table) {
            // 既存の CASCADE DELETE 外部キーを削除
            $table->dropForeign(['job_id']);

            // job_id を nullable に変更（求人削除後も紹介レコードを保持）
            $table->unsignedBigInteger('job_id')->nullable()->change();

            // SET NULL 制約で再設定（求人削除 → job_id が null になるだけで紹介レコードは残る）
            $table->foreign('job_id')->references('id')->on('jobs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('job_referrals', function (Blueprint $table) {
            $table->dropForeign(['job_id']);
            $table->unsignedBigInteger('job_id')->nullable(false)->change();
            $table->foreign('job_id')->references('id')->on('jobs')->cascadeOnDelete();
        });
    }
};
