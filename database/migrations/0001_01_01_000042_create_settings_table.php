<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->text('value')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        // デフォルト設定
        DB::table('settings')->insert([
            ['key' => 'site_name', 'value' => 'Atally', 'updated_at' => now()],
            ['key' => 'maintenance_mode', 'value' => 'false', 'updated_at' => now()],
            ['key' => 'max_jobs_per_company', 'value' => '100', 'updated_at' => now()],
            ['key' => 'auto_approve_companies', 'value' => 'false', 'updated_at' => now()],
            ['key' => 'default_job_expiry_days', 'value' => '30', 'updated_at' => now()],
            ['key' => 'support_email', 'value' => 'support@atally.jp', 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
