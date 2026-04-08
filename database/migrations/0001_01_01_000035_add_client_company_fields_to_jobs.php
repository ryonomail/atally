<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            $table->string('client_company_industry', 100)->nullable()->after('referral_conditions');
            $table->string('client_company_employees', 50)->nullable()->after('client_company_industry');
        });
    }

    public function down(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            $table->dropColumn(['client_company_industry', 'client_company_employees']);
        });
    }
};
