<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // pg_trgm: LIKE '%keyword%' をインデックスで高速化（50〜100倍）
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');

        // title に GIN trigram インデックス（キーワード検索の主対象）
        DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_title_trgm ON jobs USING GIN (title gin_trgm_ops)');

        // location に GIN trigram インデックス（LIKE '%都道府県%' の高速化）
        DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_location_trgm ON jobs USING GIN (location gin_trgm_ops)');

        // feature_tags JSONB に GIN インデックス（whereJsonContains の高速化）
        DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_feature_tags_gin ON jobs USING GIN (feature_tags)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS idx_jobs_title_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_jobs_location_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_jobs_feature_tags_gin');
    }
};
