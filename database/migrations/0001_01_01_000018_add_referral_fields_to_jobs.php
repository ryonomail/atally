<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            $table->boolean('allow_referral')->default(false)->after('notes');
            $table->string('referral_fee_type', 20)->nullable()->after('allow_referral'); // 'percentage' or 'fixed'
            $table->decimal('referral_fee', 12, 2)->nullable()->after('referral_fee_type');
            $table->text('referral_conditions')->nullable()->after('referral_fee');
        });
    }

    public function down(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            $table->dropColumn(['allow_referral', 'referral_fee_type', 'referral_fee', 'referral_conditions']);
        });
    }
};
