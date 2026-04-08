<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_personas', function (Blueprint $table) {
            // 業界ターゲティング
            $table->jsonb('target_industries')->nullable()->after('target_education');
            // 希望年収帯
            $table->unsignedInteger('target_salary_min')->nullable()->after('target_industries');
            $table->unsignedInteger('target_salary_max')->nullable()->after('target_salary_min');
            // 語学力
            $table->jsonb('target_languages')->nullable()->after('target_salary_max');
            // 資格
            $table->jsonb('target_certifications')->nullable()->after('target_languages');
            // マネジメント経験
            $table->string('target_management_experience', 50)->nullable()->after('target_certifications');
            // 前職企業規模
            $table->jsonb('target_company_sizes')->nullable()->after('target_management_experience');
            // 転職回数上限
            $table->unsignedSmallInteger('max_company_changes')->nullable()->after('target_company_sizes');
            // 求める人物像（ソフトスキル）
            $table->jsonb('personality_traits')->nullable()->after('max_company_changes');
            // 重視する条件
            $table->jsonb('priority_conditions')->nullable()->after('personality_traits');
            // NG条件
            $table->text('ng_conditions')->nullable()->after('priority_conditions');
            // 理想の候補者像
            $table->text('ideal_candidate_description')->nullable()->after('ng_conditions');
        });
    }

    public function down(): void
    {
        Schema::table('job_personas', function (Blueprint $table) {
            $table->dropColumn([
                'target_industries', 'target_salary_min', 'target_salary_max',
                'target_languages', 'target_certifications',
                'target_management_experience', 'target_company_sizes',
                'max_company_changes', 'personality_traits', 'priority_conditions',
                'ng_conditions', 'ideal_candidate_description',
            ]);
        });
    }
};
