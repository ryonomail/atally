<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->string('rejection_reason')->nullable()->after('company_note');
            $table->text('rejection_feedback')->nullable()->after('rejection_reason');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn(['rejection_reason', 'rejection_feedback']);
        });
    }
};
