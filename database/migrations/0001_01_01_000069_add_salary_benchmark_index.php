<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * 給与相場（業種×都道府県×給与種別）集計用の部分インデックス。
     * 求人詳細ページに相場コンテキストを載せるため、コールドキャッシュ時の
     * percentile/count クエリを83万行のスキャンからインデックス参照に変える。
     * CONCURRENTLY で本番ロックなし作成（トランザクション外必須）。
     */
    public $withinTransaction = false;

    public function up(): void
    {
        DB::statement("
            CREATE INDEX CONCURRENTLY IF NOT EXISTS jobs_salary_benchmark_idx
            ON jobs (industry, salary_type, prefecture, salary_min)
            WHERE status = 'active' AND salary_min > 0
        ");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX CONCURRENTLY IF EXISTS jobs_salary_benchmark_idx');
    }
};
