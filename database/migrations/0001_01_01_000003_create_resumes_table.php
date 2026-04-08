<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration 
{
    public function up(): void
    {
        Schema::create('resumes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('profile_id')->constrained('user_profiles')->cascadeOnDelete();
            $table->string('title'); // e.g. "A社用", "営業職向け"
            $table->text('motivation')->nullable(); // 志望動機（子データ独自）
            $table->string('desired_salary')->nullable();
            $table->string('desired_location')->nullable();
            $table->date('available_date')->nullable();
            $table->jsonb('custom_fields')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resumes');
    }
};
