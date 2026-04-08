<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            // 職種カテゴリ
            $table->string('job_category_major', 100)->nullable()->after('title');
            $table->string('job_category_minor', 100)->nullable()->after('job_category_major');
            // 採用情報
            $table->string('application_type', 20)->nullable()->after('employment_type'); // 中途/新卒/both
            $table->unsignedSmallInteger('positions_available')->nullable()->after('application_type');
            // 特徴タグ
            $table->json('feature_tags')->nullable()->after('positions_available');
            // 仕事内容補足
            $table->text('preferred_qualifications')->nullable()->after('requirements');
            $table->text('recruitment_background')->nullable()->after('preferred_qualifications');
            $table->text('scope_of_change')->nullable()->after('description');
            $table->text('location_scope_of_change')->nullable()->after('location');
            // 勤務条件補足
            $table->string('dormitory', 100)->nullable()->after('transfer_policy');
            $table->string('smoking_policy', 200)->nullable()->after('dormitory');
            // エージェント限定情報（人材紹介求人用）
            $table->unsignedSmallInteger('age_min')->nullable()->after('referral_conditions');
            $table->unsignedSmallInteger('age_max')->nullable()->after('age_min');
            $table->string('gender_requirement', 20)->nullable()->after('age_max');
            $table->string('nationality_requirement', 100)->nullable()->after('gender_requirement');
            $table->string('education_requirement', 50)->nullable()->after('nationality_requirement');
            $table->string('referral_fee_distribution', 200)->nullable()->after('education_requirement');
            $table->text('refund_policy')->nullable()->after('referral_fee_distribution');
            $table->string('payment_terms', 200)->nullable()->after('refund_policy');
            $table->string('disclosure_scope', 200)->nullable()->after('payment_terms');
            $table->text('likely_candidates')->nullable()->after('disclosure_scope');
            $table->text('ng_targets')->nullable()->after('likely_candidates');
            $table->text('selection_details_agent')->nullable()->after('ng_targets');
        });

        Schema::table('companies', function (Blueprint $table) {
            $table->string('revenue', 100)->nullable()->after('founded_year');
            $table->string('capital', 100)->nullable()->after('revenue');
        });
    }

    public function down(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            $table->dropColumn([
                'job_category_major', 'job_category_minor',
                'application_type', 'positions_available', 'feature_tags',
                'preferred_qualifications', 'recruitment_background',
                'scope_of_change', 'location_scope_of_change',
                'dormitory', 'smoking_policy',
                'age_min', 'age_max', 'gender_requirement', 'nationality_requirement',
                'education_requirement', 'referral_fee_distribution', 'refund_policy',
                'payment_terms', 'disclosure_scope', 'likely_candidates',
                'ng_targets', 'selection_details_agent',
            ]);
        });

        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn(['revenue', 'capital']);
        });
    }
};
