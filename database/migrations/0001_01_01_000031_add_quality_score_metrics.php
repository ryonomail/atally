<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 企業ユーザーのログイン追跡
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('last_login_at')->nullable()->after('remember_token');
        });

        // daily_usages に品質スコア算出用メトリクスを追加
        Schema::table('daily_usages', function (Blueprint $table) {
            $table->decimal('reply_rate', 5, 4)->nullable()->after('base_budget');        // 返信率 0.0000〜1.0000
            $table->decimal('reply_speed_hours', 8, 2)->nullable()->after('reply_rate');  // 平均返信時間（時間）
            $table->decimal('interview_setup_rate', 5, 4)->nullable()->after('reply_speed_hours'); // 面接設定率
            $table->boolean('logged_in')->default(false)->after('interview_setup_rate');   // その日ログインしたか
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('last_login_at');
        });

        Schema::table('daily_usages', function (Blueprint $table) {
            $table->dropColumn(['reply_rate', 'reply_speed_hours', 'interview_setup_rate', 'logged_in']);
        });
    }
};
