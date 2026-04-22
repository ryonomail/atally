<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * パフォーマンス改善: jobs テーブルの追加インデックス
 *
 * - published_at の降順インデックス（新着順ソート高速化）
 * - salary_max の降順インデックス（年収順ソート高速化）
 * - (status, published_at) 複合インデックス（status フィルタ + 新着順の組み合わせ）
 */
return new class extends Migration
{
    // CONCURRENTLY はトランザクション内で実行不可 → Laravel のトランザクションを無効化
    // 注意: 親クラスは型なしで宣言しているため、ここも型なしで上書きする必要がある
    public $withinTransaction = false;

    public function up(): void
    {
        DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_active_published
            ON jobs (published_at DESC) WHERE status = \'active\'');

        DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_active_salary
            ON jobs (salary_max DESC NULLS LAST) WHERE status = \'active\'');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX CONCURRENTLY IF EXISTS idx_jobs_active_published');
        DB::statement('DROP INDEX CONCURRENTLY IF EXISTS idx_jobs_active_salary');
    }
};
