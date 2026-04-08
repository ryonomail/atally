<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_personas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_id')->constrained()->cascadeOnDelete();

            // ターゲット年齢層
            $table->integer('age_min')->nullable();         // 例: 25
            $table->integer('age_max')->nullable();         // 例: 35

            // 経験年数
            $table->integer('experience_min')->nullable();  // 最低経験年数
            $table->integer('experience_max')->nullable();  // 最大経験年数

            // スキルマッチ（JSONで複数指定）
            $table->jsonb('target_skills')->nullable();     // ["React", "TypeScript", "Laravel"]

            // 希望勤務地（JSONで複数エリア指定）
            $table->jsonb('target_locations')->nullable();  // ["東京都", "神奈川県", "リモート"]

            // 希望職種・業界
            $table->jsonb('target_job_types')->nullable();  // ["エンジニア", "デザイナー"]

            // 現在の雇用状況
            $table->string('target_employment_status')->nullable(); // 在職中, 離職中, どちらでも

            // 学歴
            $table->string('target_education')->nullable(); // 大卒以上, 高卒以上, 不問

            // ペルソナブースト倍率（高いほど強く表示）
            $table->decimal('boost_factor', 3, 1)->default(1.5);

            $table->timestamps();

            $table->unique('job_id'); // 1求人につき1ペルソナ
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_personas');
    }
};
