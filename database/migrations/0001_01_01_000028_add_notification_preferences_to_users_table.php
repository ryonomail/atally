<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('email_on_new_application')->default(true)->after('company_role');
            $table->boolean('email_on_message')->default(true)->after('email_on_new_application');
            $table->boolean('email_on_scout')->default(true)->after('email_on_message');
            $table->boolean('email_on_job_alert')->default(true)->after('email_on_scout');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'email_on_new_application',
                'email_on_message',
                'email_on_scout',
                'email_on_job_alert',
            ]);
        });
    }
};
