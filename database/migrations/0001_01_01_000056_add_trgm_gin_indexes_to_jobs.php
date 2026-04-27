<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // pg_trgm extension — may already exist or require superuser; skip silently on failure
        try {
            DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        } catch (\Throwable $e) {
            // Extension may already exist or require superuser — continue without it
        }

        // GIN trigram indexes — skip if pg_trgm unavailable
        try {
            DB::statement('CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON jobs USING GIN (title gin_trgm_ops)');
        } catch (\Throwable $e) {
            // pg_trgm not available; index skipped
        }

        try {
            DB::statement('CREATE INDEX IF NOT EXISTS idx_jobs_location_trgm ON jobs USING GIN (location gin_trgm_ops)');
        } catch (\Throwable $e) {
            // pg_trgm not available; index skipped
        }

        // feature_tags は json 型（jsonb ではない）のため GIN インデックス不可 → スキップ
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS idx_jobs_title_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_jobs_location_trgm');
        // idx_jobs_feature_tags_gin は作成されていないためスキップ
    }
};
