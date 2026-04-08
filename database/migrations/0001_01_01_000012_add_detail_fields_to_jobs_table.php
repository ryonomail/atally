<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            // ---- 待遇・条件 ----
            $table->string('holidays')->nullable();              // 休日・休暇（例: 土日祝、年間休日120日）
            $table->text('holiday_details')->nullable();          // 休暇詳細（有給・慶弔・育休など）
            $table->jsonb('insurance')->nullable();               // 社会保険（["健康保険","厚生年金","雇用保険","労災保険"]）
            $table->text('allowances')->nullable();               // 手当（交通費・住宅手当・残業手当など）
            $table->string('probation_period')->nullable();       // 試用期間（例: 3ヶ月）
            $table->text('probation_conditions')->nullable();     // 試用期間中の条件変更

            // ---- 給与詳細 ----
            $table->text('salary_details')->nullable();           // 給与補足（賞与・昇給・モデル年収など）
            $table->string('raise_frequency')->nullable();        // 昇給（例: 年1回）
            $table->string('bonus')->nullable();                  // 賞与（例: 年2回・実績4ヶ月分）

            // ---- 勤務環境 ----
            $table->string('remote_policy')->nullable();          // リモート勤務（フルリモート/ハイブリッド/出社）
            $table->string('office_address')->nullable();         // 勤務地詳細・最寄り駅
            $table->string('overtime_average')->nullable();       // 月平均残業時間（例: 月20時間程度）
            $table->text('work_environment')->nullable();         // 職場環境・チーム構成

            // ---- 選考情報 ----
            $table->text('selection_process')->nullable();        // 選考フロー（書類→1次→最終 等）
            $table->string('required_documents')->nullable();     // 必要書類（履歴書・職務経歴書 等）
            $table->string('estimated_timeline')->nullable();     // 選考期間目安（例: 2〜3週間）

            // ---- 会社の魅力 ----
            $table->text('company_culture')->nullable();          // 社風・職場の雰囲気
            $table->string('number_of_employees')->nullable();    // 従業員数
            $table->string('founded_year')->nullable();           // 設立年
            $table->string('industry')->nullable();               // 業界・業種

            // ---- その他 ----
            $table->text('appeal_points')->nullable();            // アピールポイント・この求人の魅力
            $table->string('contract_period')->nullable();        // 契約期間（契約社員の場合）
            $table->text('notes')->nullable();                    // 備考・その他
        });
    }

    public function down(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            $table->dropColumn([
                'holidays', 'holiday_details', 'insurance', 'allowances',
                'probation_period', 'probation_conditions',
                'salary_details', 'raise_frequency', 'bonus',
                'remote_policy', 'office_address', 'overtime_average', 'work_environment',
                'selection_process', 'required_documents', 'estimated_timeline',
                'company_culture', 'number_of_employees', 'founded_year', 'industry',
                'appeal_points', 'contract_period', 'notes',
            ]);
        });
    }
};
