<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * admin_audit_logs.admin_id を nullable にする。
     * logSystem() は admin_id=null（システム操作）で記録するが、
     * 元は NOT NULL + users への外部キーだったため admin_id=0 が常に
     * FK違反を起こし、カード登録など logSystem を呼ぶ処理が500になっていた。
     */
    public function up(): void
    {
        // Postgres: NOT NULL 制約のみ外す（外部キーは null を許容するので保持してよい）
        DB::statement('ALTER TABLE admin_audit_logs ALTER COLUMN admin_id DROP NOT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE admin_audit_logs ALTER COLUMN admin_id SET NOT NULL');
    }
};
