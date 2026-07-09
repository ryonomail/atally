<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * jobs.campaign_id にインデックスが無く、予算グループの件数集計・所属求人取得・
     * activeJobs()->sum() が83万行のフルスキャンになっていた（詳細表示17秒の主因）。
     * campaign_id を持つ行だけの部分インデックスで解消。CONCURRENTLYで本番ロックなし。
     */
    public $withinTransaction = false;

    public function up(): void
    {
        DB::statement("
            CREATE INDEX CONCURRENTLY IF NOT EXISTS jobs_campaign_id_idx
            ON jobs (campaign_id, status)
            WHERE campaign_id IS NOT NULL
        ");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX CONCURRENTLY IF EXISTS jobs_campaign_id_idx');
    }
};
