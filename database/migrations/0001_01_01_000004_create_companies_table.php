<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration 
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('company_name');
            $table->string('company_type')->default('direct_employer'); // direct_employer, recruitment_agency
            $table->text('description')->nullable();
            $table->string('website')->nullable();
            $table->string('phone')->nullable();
            $table->text('address')->nullable();
            $table->decimal('daily_budget', 10, 2)->default(0);
            $table->decimal('quality_score', 8, 4)->default(1.0);
            $table->string('status')->default('active'); // active, needs_attention, suspended
            $table->string('verification_status')->default('pending'); // pending, approved, rejected
            $table->timestamp('payment_failed_at')->nullable();
            $table->string('stripe_customer_id')->nullable();
            $table->string('stripe_subscription_id')->nullable();
            $table->jsonb('documents')->nullable(); // [{type, path, uploaded_at}]
            $table->string('permit_number')->nullable(); // 人材会社許可番号
            $table->timestamps();

            $table->index(['status', 'verification_status']);
            $table->index('daily_budget');
            $table->index('quality_score');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
