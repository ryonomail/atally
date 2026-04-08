<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // companies テーブルにエージェント関連カラム追加
        Schema::table('companies', function (Blueprint $table) {
            $table->string('license_document_path')->nullable()->after('permit_number');
            $table->boolean('license_verified')->default(false)->after('license_document_path');
        });

        // 求人紹介（エージェント間の求人共有・手数料シェア）
        Schema::create('job_referrals', function (Blueprint $table) {
            $table->id();

            // 求人元エージェント（求人を持っている側）
            $table->foreignId('job_id')->constrained()->cascadeOnDelete();
            $table->foreignId('source_company_id')->constrained('companies')->cascadeOnDelete();

            // 紹介エージェント（候補者を紹介する側）
            $table->foreignId('referrer_company_id')->constrained('companies')->cascadeOnDelete();

            // 手数料シェア設定（求人ごと）
            $table->decimal('fee_percentage', 5, 2)->default(30.00); // 成約報酬の割合（年収の%）
            $table->decimal('source_share', 5, 2)->default(50.00);   // 求人元の取り分（%）
            $table->decimal('referrer_share', 5, 2)->default(50.00); // 紹介側の取り分（%）

            // ステータス
            $table->string('status')->default('pending'); // pending, approved, rejected, placed, completed
            $table->text('message')->nullable(); // 紹介時のメッセージ
            $table->text('candidate_summary')->nullable(); // 候補者概要（個人情報なし）

            // 成約情報
            $table->decimal('placement_salary', 12, 0)->nullable(); // 成約年収
            $table->decimal('total_fee', 12, 0)->nullable(); // 総手数料
            $table->decimal('source_fee', 12, 0)->nullable(); // 求人元手数料
            $table->decimal('referrer_fee', 12, 0)->nullable(); // 紹介側手数料
            $table->timestamp('placed_at')->nullable(); // 成約日

            $table->timestamps();

            $table->index(['source_company_id', 'status']);
            $table->index(['referrer_company_id', 'status']);
            $table->index(['job_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_referrals');

        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn(['license_document_path', 'license_verified']);
        });
    }
};
