<?php

use Illuminate\Support\Facades\Schedule;

// 毎日0時: 日額予算 + 品質メトリクスを記録
Schedule::command('app:record-daily-usage')->dailyAt('00:00');

// 毎日0:05: アクティブ求人・キャンペーンへの継続課金（日額は毎日、月額は月初のみ）
Schedule::command('app:charge-daily-billing')->dailyAt('00:05');

// 毎日0:30: 品質スコア更新（メトリクス記録後に実行）
Schedule::command('app:update-quality-scores')->dailyAt('00:30');

// 毎時: Phase2ペナルティチェック
Schedule::command('app:check-payment-penalties')->hourly();

// 毎日1:00: 採用実績スコア更新（品質スコア更新後に実行）
Schedule::command('app:update-hiring-reputation')->dailyAt('01:00');

// 毎日6:00: 放置求人の検出・段階対応（通知→ラベル→自動クローズ）
Schedule::command('app:detect-stalled-jobs')->dailyAt('06:00');

// 毎朝8時: 面接リマインダー送信
Schedule::command('app:send-interview-reminders')->dailyAt('08:00');

// 毎朝9時: 求人アラート通知（前日の新着求人をマッチング）
Schedule::command('app:send-job-alert-notifications')->dailyAt('09:00');
