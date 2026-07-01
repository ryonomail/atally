<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * マーケットプレイス掲載の運営審査。
     * 許可番号の有無は問わず（営業代行等も想定）、運営が非公開基準で審査したものだけを公開する。
     * marketplace_status: pending(審査中) / approved(承認・公開) / rejected(却下)
     */
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            if (!Schema::hasColumn('companies', 'marketplace_status')) {
                $table->string('marketplace_status')->default('pending')->after('marketplace_listed');
            }
            if (!Schema::hasColumn('companies', 'marketplace_reviewed_at')) {
                $table->timestamp('marketplace_reviewed_at')->nullable()->after('marketplace_status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn(['marketplace_status', 'marketplace_reviewed_at']);
        });
    }
};
