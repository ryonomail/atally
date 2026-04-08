<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration 
{
    public function up(): void
    {
        Schema::create('applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type')->default('application'); // application, scout
            $table->string('status')->default('pending'); // pending, accepted, rejected, withdrawn
            $table->jsonb('resume_snapshot')->nullable(); // 応募時の履歴書データ凍結
            $table->text('cover_letter')->nullable();
            $table->text('company_note')->nullable();
            $table->timestamps();

            $table->unique(['job_id', 'user_id']); // 同一求人への重複応募防止
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('applications');
    }
};
