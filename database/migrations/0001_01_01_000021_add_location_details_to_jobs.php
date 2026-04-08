<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            $table->string('prefecture')->nullable()->after('location');
            $table->string('city')->nullable()->after('prefecture');
            $table->string('nearest_station')->nullable()->after('office_address');
            $table->string('access_info')->nullable()->after('nearest_station');
            $table->string('transfer_policy')->nullable()->after('access_info');
        });
    }

    public function down(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            $table->dropColumn(['prefecture', 'city', 'nearest_station', 'access_info', 'transfer_policy']);
        });
    }
};
