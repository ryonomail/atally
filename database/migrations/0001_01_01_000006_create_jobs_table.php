<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration 
{
    public function up(): void
    {
        Schema::create('jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('agency_client_id')->nullable()->constrained('agency_clients')->nullOnDelete();
            $table->string('title');
            $table->text('description');
            $table->text('requirements')->nullable();
            $table->integer('salary_min')->nullable();
            $table->integer('salary_max')->nullable();
            $table->string('salary_type')->nullable(); // 月給, 年収, 時給
            $table->string('location')->nullable();
            $table->string('employment_type')->nullable(); // 正社員, 契約社員, パート
            $table->string('work_hours')->nullable();
            $table->jsonb('benefits')->nullable();
            $table->string('status')->default('draft'); // draft, pending_review, active, suspended, closed
            $table->boolean('ng_word_flagged')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'published_at']);
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('jobs');
    }
};
