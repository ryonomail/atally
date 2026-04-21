<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            // source フィルタ高速化
            $table->index('source');
            // status + source 複合インデックス（一覧クエリの主要条件）
            $table->index(['status', 'source']);
            // location フィルタ高速化
            $table->index('location');
            // employment_type フィルタ高速化
            $table->index('employment_type');
        });
    }

    public function down(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            $table->dropIndex(['source']);
            $table->dropIndex(['status', 'source']);
            $table->dropIndex(['location']);
            $table->dropIndex(['employment_type']);
        });
    }
};
