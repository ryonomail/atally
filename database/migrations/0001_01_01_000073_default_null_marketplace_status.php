<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * パートナー申請制への移行: marketplace_status の既定を NULL（未申請）に変更。
     * 明示的に申請した企業だけが pending になる（applyPartnerで設定）。
     */
    public function up(): void
    {
        // 000067で string() 既定の NOT NULL が付いているため先に解除（これを忘れて本番障害になった）
        DB::statement("ALTER TABLE companies ALTER COLUMN marketplace_status DROP NOT NULL");
        DB::statement("ALTER TABLE companies ALTER COLUMN marketplace_status DROP DEFAULT");
        DB::statement("UPDATE companies SET marketplace_status = NULL WHERE marketplace_status = 'pending' AND marketplace_listed = false");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE companies ALTER COLUMN marketplace_status SET DEFAULT 'pending'");
    }
};
