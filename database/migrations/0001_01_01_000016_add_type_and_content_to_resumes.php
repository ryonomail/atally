<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('resumes', function (Blueprint $table) {
            // resume=アルバイト用, career_resume=転職用履歴書, cv=職務経歴書
            $table->string('type')->default('resume')->after('title');
            // タイプ別の追加データ（転職用: career_summary, employment_status 等、職務経歴書: projects, achievements 等）
            $table->jsonb('content')->nullable()->after('custom_fields');
        });
    }

    public function down(): void
    {
        Schema::table('resumes', function (Blueprint $table) {
            $table->dropColumn(['type', 'content']);
        });
    }
};
