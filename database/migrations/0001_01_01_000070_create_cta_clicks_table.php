<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * CTAクリック計測。求職者がどのボタンで動いた/止まったか（応募ファネルの離脱点）を可視化する。
     * job_views（閲覧）とセットで 閲覧→CTA→応募 のファネルが引けるようになる。
     */
    public function up(): void
    {
        if (!Schema::hasTable('cta_clicks')) {
            Schema::create('cta_clicks', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('job_id')->nullable(); // 求人に紐づかないイベントもあるためFKなし
                $table->string('event', 30);   // apply_open / quick_apply / guest_resume_start / login_to_apply / save / phone_tap
                $table->string('source', 30)->nullable(); // detail / search_panel / fixed_bar 等
                $table->unsignedBigInteger('user_id')->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->timestamp('created_at');
                $table->index(['event', 'created_at']);
                $table->index('job_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('cta_clicks');
    }
};
