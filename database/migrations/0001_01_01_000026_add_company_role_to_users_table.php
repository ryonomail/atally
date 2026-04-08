<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->after('role')->constrained()->nullOnDelete();
            $table->string('company_role')->nullable()->after('company_id'); // owner, admin, member
        });

        // 既存の企業オーナーに company_id と company_role を設定
        DB::statement("
            UPDATE users
            SET company_id = (SELECT id FROM companies WHERE companies.user_id = users.id),
                company_role = 'owner'
            WHERE id IN (SELECT user_id FROM companies)
        ");
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['company_id']);
            $table->dropColumn(['company_id', 'company_role']);
        });
    }
};
