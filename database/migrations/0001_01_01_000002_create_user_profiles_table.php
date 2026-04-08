<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration 
{
    public function up(): void
    {
        Schema::create('user_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('full_name')->nullable();
            $table->string('full_name_kana')->nullable();
            $table->date('birth_date')->nullable();
            $table->string('gender')->nullable();
            $table->string('phone')->nullable();
            $table->string('postal_code')->nullable();
            $table->text('address')->nullable();
            $table->string('photo_path')->nullable();
            $table->jsonb('education')->nullable(); // [{school, faculty, start, end}]
            $table->jsonb('work_history')->nullable(); // [{company, position, start, end, description}]
            $table->jsonb('licenses')->nullable(); // [{name, date}]
            $table->jsonb('skills')->nullable(); // [string]
            $table->text('self_pr')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_profiles');
    }
};
