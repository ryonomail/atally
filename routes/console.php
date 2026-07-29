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

// 毎日4:00: 無料掲載求人を掲載期限(30日)で自動終了（ハロワ・ブースト中は除外）
Schedule::command('app:close-expired-jobs')->dailyAt('04:00');

// 毎朝8時: 面接リマインダー送信
Schedule::command('app:send-interview-reminders')->dailyAt('08:00');

// 毎朝9時: 求人アラート通知（前日の新着求人をマッチング）
Schedule::command('app:send-job-alert-notifications')->dailyAt('09:00');

// 毎朝7時: ハローワーク求人同期（メンテナンス時間帯 0:00-6:00 を避けて実行）
Schedule::command('app:sync-hellowork-jobs')->dailyAt('07:00');

// 4分ごと: 求人リストキャッシュをウォームアップ（TTL5分切れ前に再生成）
Schedule::command('app:warm-jobs-cache')->everyFourMinutes();

// 毎朝10時: 新着求人をX（旧Twitter）に自動投稿（最大5件/日）
Schedule::command('app:post-jobs-to-x --limit=5')->dailyAt('10:00');

// 毎朝6時30分: Google Search Console のSEOレポート生成（狙い目クエリ抽出）。朝の記事ルーチンが読む
Schedule::command('app:seo-report')->dailyAt('06:30');

// 10分ごと: 主要ページ/APIの死活監視。異常時のみアラート（500の放置を防ぐ）
Schedule::command('app:health-check')->everyTenMinutes()->withoutOverlapping();
