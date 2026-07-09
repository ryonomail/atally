<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * パートナー申請制への移行: marketplace_status の既定を NULL（未申請）に変更。
     * 旧実装では default 'pending' だったため、放置すると全企業が「申請中」として審査タブに並んでしまう。
     * 明示的に申請した企業だけが pending になる（applyPartnerで設定）。
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE companies ALTER COLUMN marketplace_status DROP DEFAULT");
        // 申請していないのに既定値でpendingになっている企業を未申請(NULL)へ
        // （実申請は掲載申請者のみ＝marketplace_listed=true。現時点で該当0件なのは確認済み）
        DB::statement("UPDATE companies SET marketplace_status = NULL WHERE marketplace_status = 'pending' AND marketplace_listed = false");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE companies ALTER COLUMN marketplace_status SET DEFAULT 'pending'");
    }
};
