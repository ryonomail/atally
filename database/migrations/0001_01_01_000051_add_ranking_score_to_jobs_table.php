<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            // 事前計算済みランキングスコア
            // Atally求人: 10000 + daily_budget * quality_score * hiring_reputation
            // HelloWork求人: published_at の UNIX時間 / 10^12 (≈ 0.0017, 常にAtally未満)
            $table->decimal('ranking_score', 14, 6)->default(0)->after('hellowork_id');
        });

        // 検索・ソート用の部分インデックス（status='active' のみ）
        DB::statement("CREATE INDEX idx_jobs_active_ranking ON jobs (ranking_score DESC) WHERE status = 'active'");
        DB::statement("CREATE INDEX idx_jobs_active_source_ranking ON jobs (source, ranking_score DESC) WHERE status = 'active'");

        // 既存Atally求人のスコアを一括計算
        DB::statement("
            UPDATE jobs
            SET ranking_score = 10000 + COALESCE(jobs.daily_budget, 0) * c.quality_score * c.hiring_reputation
            FROM companies c
            WHERE jobs.company_id = c.id
              AND jobs.source = 'atally'
        ");

        // 既存HelloWork求人のスコアを設定（published_at基準、新しい求人ほど高い）
        DB::statement("
            UPDATE jobs
            SET ranking_score = EXTRACT(EPOCH FROM COALESCE(published_at, created_at)) / 1000000000000.0
            WHERE source = 'hellowork'
        ");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS idx_jobs_active_ranking');
        DB::statement('DROP INDEX IF EXISTS idx_jobs_active_source_ranking');

        Schema::table('jobs', function (Blueprint $table) {
            $table->dropColumn('ranking_score');
        });
    }
};
