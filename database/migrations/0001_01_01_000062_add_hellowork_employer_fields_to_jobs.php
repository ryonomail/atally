<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * ハローワーク求人は全件が単一のダミー企業「ハローワーク」に紐づくため、
     * 事業所固有の会社情報を company テーブルに持てない。
     * そこで求人レコード自体に事業所情報カラムを追加する。
     */
    public function up(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            $table->string('employer_name')->nullable()->after('company_id');        // 事業所名（実際の会社名）
            $table->string('representative_name')->nullable()->after('employer_name'); // 代表者名
            $table->text('business_content')->nullable()->after('representative_name'); // 事業内容
            $table->string('capital')->nullable()->after('business_content');          // 資本金
            $table->string('homepage_url')->nullable()->after('capital');              // 企業ホームページ
            $table->string('postal_code', 20)->nullable()->after('homepage_url');      // 郵便番号
        });
    }

    public function down(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            $table->dropColumn([
                'employer_name', 'representative_name', 'business_content',
                'capital', 'homepage_url', 'postal_code',
            ]);
        });
    }
};
