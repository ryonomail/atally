<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 営業リスト（見込み企業）収集機能。
     * - lead_collection_runs: 「収集」ボタン1回分の実行履歴
     * - lead_companies: 収集した企業（Googleマップ / OpenStreetMap / 公式サイト / SNS から統合）
     */
    public function up(): void
    {
        if (!Schema::hasTable('lead_collection_runs')) {
            Schema::create('lead_collection_runs', function (Blueprint $table) {
                $table->id();
                $table->string('keyword', 100);
                $table->string('area', 100);
                $table->json('sources')->nullable();          // ['google', 'osm']
                $table->string('status', 20)->default('queued'); // queued / running / done / failed
                $table->unsignedInteger('found_count')->default(0);
                $table->unsignedInteger('new_count')->default(0);
                $table->unsignedInteger('updated_count')->default(0);
                $table->text('message')->nullable();
                $table->unsignedBigInteger('admin_id')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('finished_at')->nullable();
                $table->timestamps();
                $table->index('created_at');
            });
        }

        if (!Schema::hasTable('lead_companies')) {
            Schema::create('lead_companies', function (Blueprint $table) {
                $table->id();
                $table->string('source', 20);             // google / osm
                $table->string('external_id', 191);       // place_id / osm "node/123"
                $table->string('name', 255);
                $table->string('category', 100)->nullable();
                $table->string('address', 255)->nullable();
                $table->string('phone', 50)->nullable();
                $table->string('email', 191)->nullable();
                $table->string('website', 500)->nullable();
                $table->boolean('has_website')->default(false);
                $table->decimal('lat', 10, 7)->nullable();
                $table->decimal('lng', 10, 7)->nullable();
                $table->string('google_maps_url', 500)->nullable();
                $table->decimal('rating', 2, 1)->nullable();
                $table->unsignedInteger('review_count')->nullable();
                // SNS
                $table->string('instagram', 500)->nullable();
                $table->string('twitter', 500)->nullable();
                $table->string('facebook', 500)->nullable();
                $table->string('tiktok', 500)->nullable();
                $table->string('youtube', 500)->nullable();
                $table->string('line', 500)->nullable();
                // 営業管理
                $table->string('status', 20)->default('new'); // new / contacted / negotiating / won / lost / excluded
                $table->text('memo')->nullable();
                $table->string('search_keyword', 100)->nullable();
                $table->string('search_area', 100)->nullable();
                $table->unsignedBigInteger('last_run_id')->nullable();
                $table->timestamp('enriched_at')->nullable();
                $table->timestamps();

                $table->unique(['source', 'external_id']);
                $table->index('status');
                $table->index('has_website');
                $table->index('last_run_id');
                $table->index('name');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_companies');
        Schema::dropIfExists('lead_collection_runs');
    }
};
