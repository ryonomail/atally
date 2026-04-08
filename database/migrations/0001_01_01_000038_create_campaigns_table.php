<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);                        // キャンペーン名
            $table->decimal('daily_budget', 10, 2)->default(0); // キャンペーン全体の日額予算
            $table->string('budget_allocation', 20)->default('even'); // 配分方法: even(均等), weighted(パフォーマンス比)
            $table->string('status', 20)->default('active');     // active, paused, ended
            $table->date('start_date')->nullable();              // 開始日
            $table->date('end_date')->nullable();                // 終了日
            $table->timestamps();
        });

        // 求人にキャンペーンIDを追加
        Schema::table('jobs', function (Blueprint $table) {
            $table->foreignId('campaign_id')->nullable()->after('company_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('campaign_id');
        });
        Schema::dropIfExists('campaigns');
    }
};
