<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_usages', function (Blueprint $table) {
            $table->decimal('boost_factor', 3, 1)->default(1.0)->after('budget_amount');
            $table->decimal('base_budget', 10, 2)->nullable()->after('boost_factor');
        });
    }

    public function down(): void
    {
        Schema::table('daily_usages', function (Blueprint $table) {
            $table->dropColumn(['boost_factor', 'base_budget']);
        });
    }
};
