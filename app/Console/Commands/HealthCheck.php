<?php

namespace App\Console\Commands;

use App\Support\AdminNotify;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * 主要ページ・APIの死活監視。異常時のみアラート（メール＋管理画面）。
 * 「500が出続けているのに気づかない」を防ぐための定期チェック。
 *
 * 監視対象の期待ステータス:
 *   - 公開ページ: 200
 *   - 未認証API: 401（500になったら異常＝今回の障害パターン）
 *   - DB接続
 */
class HealthCheck extends Command
{
    protected $signature = 'app:health-check {--notify-ok : 正常時も通知する（動作確認用）}';
    protected $description = '主要ページ/APIの死活監視。異常時にアラートを送る';

    /** [パス => 期待ステータス] */
    private const TARGETS = [
        '/'                        => 200,
        '/jobs'                    => 200,
        '/login'                   => 200,
        '/resumes/guest'           => 200,
        '/for-agencies'            => 200,
        '/api/stats'               => 200,
        '/api/jobs'                => 200,
        '/api/me'                  => 401,  // 未認証は401が正常。500なら認証周りの障害
        '/api/resumes'             => 401,  // 履歴書API（今回の障害箇所）
        '/api/resumes/import-guest'=> 401,
    ];

    public function handle(): int
    {
        $base = rtrim(config('app.url'), '/');
        $failures = [];

        foreach (self::TARGETS as $path => $expected) {
            try {
                $res = Http::withHeaders(['User-Agent' => 'Atally-HealthCheck/1.0 (Mozilla/5.0 compatible)'])
                    ->timeout(15)->get($base . $path);
                $code = $res->status();
                if ($code !== $expected) {
                    $failures[] = "{$path} → {$code}（期待: {$expected}）";
                    $this->error("NG {$path}: {$code} (expected {$expected})");
                } else {
                    $this->line("OK {$path}: {$code}");
                }
            } catch (\Throwable $e) {
                $failures[] = "{$path} → 接続失敗（" . mb_substr($e->getMessage(), 0, 80) . '）';
                $this->error("NG {$path}: " . $e->getMessage());
            }
        }

        // DB接続
        try {
            DB::select('select 1');
            $this->line('OK database');
        } catch (\Throwable $e) {
            $failures[] = 'データベース接続失敗（' . mb_substr($e->getMessage(), 0, 80) . '）';
            $this->error('NG database: ' . $e->getMessage());
        }

        if ($failures) {
            // 連続通知の抑制（30分に1回）。ただし内容が変わったら即通知する
            $sig = md5(implode('|', $failures));
            if (Cache::get('health_alert_sig') !== $sig) {
                Cache::put('health_alert_sig', $sig, 1800);
                AdminNotify::send('🚨 サイト異常検知（' . count($failures) . '件）', array_merge(
                    ['以下の監視項目が異常です:', ''],
                    array_map(fn($f) => '・' . $f, $failures),
                    ['', '確認: ' . $base, '検知時刻: ' . now()->format('Y-m-d H:i:s')]
                ));
                $this->error('アラート送信: ' . count($failures) . '件の異常');
            } else {
                $this->warn('同一内容の異常が継続中（通知は抑制）');
            }
            return self::FAILURE;
        }

        // 復旧時: 直前に異常があれば復旧通知
        if (Cache::has('health_alert_sig')) {
            Cache::forget('health_alert_sig');
            AdminNotify::send('✅ サイト復旧', ['監視していた異常が解消しました。', '確認時刻: ' . now()->format('Y-m-d H:i:s')]);
        }

        if ($this->option('notify-ok')) {
            AdminNotify::send('✅ 死活監視テスト: 全項目正常', ['監視対象すべて正常です（' . count(self::TARGETS) . '項目＋DB）。']);
        }

        $this->info('全項目正常（' . count(self::TARGETS) . '項目＋DB）');
        return self::SUCCESS;
    }
}
