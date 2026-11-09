<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 営業リストにハローワーク求人由来の企業を取り込むためのカラム。
     * - job_count: その企業のハローワーク求人件数（多い順に優先して HP/メール調査する）
     * - website_found_by: ホームページの出どころ（hellowork / google / osm / search）
     */
    public function up(): void
    {
        Schema::table('lead_companies', function (Blueprint $table) {
            if (!Schema::hasColumn('lead_companies', 'job_count')) {
                $table->unsignedInteger('job_count')->nullable()->after('review_count');
            }
            if (!Schema::hasColumn('lead_companies', 'website_found_by')) {
                $table->string('website_found_by', 20)->nullable()->after('has_website');
            }
            $table->index('enriched_at');
            $table->index('source');
        });
    }

    public function down(): void
    {
        Schema::table('lead_companies', function (Blueprint $table) {
            $table->dropIndex(['enriched_at']);
            $table->dropIndex(['source']);
            $table->dropColumn(['job_count', 'website_found_by']);
        });
    }
};
