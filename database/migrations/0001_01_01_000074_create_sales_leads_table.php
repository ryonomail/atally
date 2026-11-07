<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 営業リード（Google Places APIで収集した企業候補）。
     * 対象: 中小企業・不動産・人材・飲食・観光業。Web制作/マーケティング会社は収集時に除外。
     * SNSリンクは企業の公式サイトに掲載されている情報のみを転記する（SNS自体のスクレイピングは行わない）。
     */
    public function up(): void
    {
        if (!Schema::hasTable('sales_leads')) {
            Schema::create('sales_leads', function (Blueprint $table) {
                $table->id();
                $table->string('google_place_id')->unique();
                $table->string('company_name');
                $table->string('industry_category', 30); // real_estate / staffing / restaurant / tourism / sme_general
                $table->string('prefecture', 20)->nullable();
                $table->string('address')->nullable();
                $table->string('phone', 50)->nullable();
                $table->string('website_url')->nullable();
                $table->string('email')->nullable();
                $table->string('instagram_url')->nullable();
                $table->string('facebook_url')->nullable();
                $table->string('tiktok_url')->nullable();
                $table->json('raw_place_types')->nullable();
                $table->string('status', 20)->default('new'); // new / contacted / qualified / rejected / excluded
                $table->string('exclusion_reason')->nullable();
                $table->string('source', 30)->default('google_places');
                $table->timestamp('discovered_at')->nullable();
                $table->timestamps();

                $table->index('industry_category');
                $table->index('prefecture');
                $table->index('status');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_leads');
    }
};
