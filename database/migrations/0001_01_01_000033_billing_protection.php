<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. 求人をソフトデリートに変更
        Schema::table('jobs', function (Blueprint $table) {
            $table->softDeletes();
        });

        // 2. 予算変更の監査ログ
        Schema::create('budget_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('job_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('action'); // 'budget_change', 'job_delete', 'job_create'
            $table->decimal('old_budget', 10, 2)->nullable();
            $table->decimal('new_budget', 10, 2)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        // 3. daily_usagesに「その日の最高額」カラム追加
        Schema::table('daily_usages', function (Blueprint $table) {
            $table->decimal('max_budget_amount', 10, 2)->default(0)->after('budget_amount');
        });
    }

    public function down(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        Schema::dropIfExists('budget_audit_logs');

        Schema::table('daily_usages', function (Blueprint $table) {
            $table->dropColumn('max_budget_amount');
        });
    }
};
