<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->string('industry', 100)->nullable()->after('address');
            $table->string('number_of_employees', 50)->nullable()->after('industry');
            $table->string('founded_year', 20)->nullable()->after('number_of_employees');
            $table->string('office_address', 500)->nullable()->after('founded_year');
            $table->string('nearest_station', 200)->nullable()->after('office_address');
            $table->text('company_culture')->nullable()->after('nearest_station');
            $table->text('work_environment')->nullable()->after('company_culture');
            $table->text('benefits_default')->nullable()->after('work_environment');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn([
                'industry', 'number_of_employees', 'founded_year',
                'office_address', 'nearest_station',
                'company_culture', 'work_environment', 'benefits_default',
            ]);
        });
    }
};
