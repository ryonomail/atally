<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            // 掲載元 ('atally' | 'hellowork')
            $table->string('source')->default('atally')->after('status');
            // ハローワーク求人番号（重複防止・更新判定に使用）
            $table->string('hellowork_id')->nullable()->unique()->after('source');
        });
    }

    public function down(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            $table->dropColumn(['source', 'hellowork_id']);
        });
    }
};
