<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration 
{
    public function up(): void
    {
        Schema::create('daily_usages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->decimal('budget_amount', 10, 2);
            $table->boolean('billed')->default(false);
            $table->timestamps();

            $table->unique(['company_id', 'date']); // 1企業1日1レコード
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_usages');
    }
};
