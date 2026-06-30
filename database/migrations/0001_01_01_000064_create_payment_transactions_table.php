<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 実際のStripe課金を記録する決済台帳。
     * これまで売上は daily_usages（日額予算の推計）から集計しており、
     * 即時課金や月額前払いの実入金が反映されなかった。本テーブルで実課金を記録する。
     */
    public function up(): void
    {
        Schema::create('payment_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('campaign_id')->nullable();
            $table->unsignedBigInteger('job_id')->nullable();
            $table->integer('amount'); // 円（JPYは最小単位=円）
            $table->string('currency', 3)->default('jpy');
            // campaign_activation / campaign_billing / daily_billing / job_activation
            $table->string('type', 40);
            $table->string('stripe_payment_intent_id')->nullable()->unique();
            $table->string('status', 20)->default('succeeded');
            $table->timestamp('charged_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'charged_at']);
            $table->index('charged_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_transactions');
    }
};
