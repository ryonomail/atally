<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('email');
            $table->string('role')->default('member'); // admin, member
            $table->string('token')->unique();
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index(['email', 'company_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_invitations');
    }
};
