<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * マーケットプレイス（代理店）機能。
     * - 代理店(recruitment_agency)が運用代行をマーケットプレイスに掲載できる（marketplace_listed / service_* ）。
     * - agency_engagements: どの代理店がどの求人企業を運用するか（依頼→稼働）。管理料と求人課金レベニューシェア率を保持。
     * - payment_transactions に agency_id / agency_share_amount を追加し、求人課金の25%を自動でpayout計上。
     * 料金モデルはA（分離型）: 求人課金は企業→Atallyのまま、その25%を代理店へ。管理料は代理店が企業へ別請求。
     */
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            if (!Schema::hasColumn('companies', 'marketplace_listed')) {
                $table->boolean('marketplace_listed')->default(false)->after('permit_number');
            }
            if (!Schema::hasColumn('companies', 'service_fee')) {
                $table->integer('service_fee')->nullable()->after('marketplace_listed'); // 管理料の目安(月額・円)
            }
            if (!Schema::hasColumn('companies', 'service_description')) {
                $table->text('service_description')->nullable()->after('service_fee');
            }
            if (!Schema::hasColumn('companies', 'service_specialties')) {
                $table->string('service_specialties')->nullable()->after('service_description'); // 得意領域（カンマ区切り）
            }
        });

        if (!Schema::hasTable('agency_engagements')) {
            Schema::create('agency_engagements', function (Blueprint $table) {
                $table->id();
                $table->foreignId('agency_id')->constrained('companies')->cascadeOnDelete();       // 運用する代理店
                $table->foreignId('client_company_id')->constrained('companies')->cascadeOnDelete(); // 運用される求人企業
                $table->string('status')->default('requested'); // requested / active / declined / ended
                $table->integer('monthly_fee')->nullable();     // 合意した管理料(月額・円)
                $table->decimal('revenue_share_rate', 4, 3)->default(0.250); // 求人課金の代理店取り分
                $table->text('note')->nullable();
                $table->timestamp('requested_at')->nullable();
                $table->timestamp('activated_at')->nullable();
                $table->timestamp('ended_at')->nullable();
                $table->timestamps();
                $table->index(['agency_id', 'status']);
                $table->index(['client_company_id', 'status']);
            });
        }

        Schema::table('payment_transactions', function (Blueprint $table) {
            if (!Schema::hasColumn('payment_transactions', 'agency_id')) {
                $table->unsignedBigInteger('agency_id')->nullable()->after('company_id');
                $table->index('agency_id');
            }
            if (!Schema::hasColumn('payment_transactions', 'agency_share_amount')) {
                $table->integer('agency_share_amount')->default(0)->after('amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn(['marketplace_listed', 'service_fee', 'service_description', 'service_specialties']);
        });
        Schema::dropIfExists('agency_engagements');
        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->dropColumn(['agency_id', 'agency_share_amount']);
        });
    }
};
