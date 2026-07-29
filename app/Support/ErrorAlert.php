<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * 500系エラーの即時アラート。
 * 「エラーが出続けているのに誰も気づかない」状態を防ぐ（履歴書APIが500を返し続けた障害の再発防止）。
 *
 * ・同一エラー（例外クラス＋発生箇所）は30分に1回だけ通知＝メール爆撃を防ぐ
 * ・通知は AdminNotify 経由（メール＋管理画面内通知）
 * ・アラート処理自体が失敗してもリクエストは壊さない
 */
class ErrorAlert
{
    /** 同一エラーの再通知を抑制する時間（秒） */
    private const THROTTLE_SECONDS = 1800;

    public static function notify(\Throwable $e, ?string $path = null, ?string $method = null): void
    {
        try {
            $key = 'err_alert_' . md5(get_class($e) . '|' . $e->getFile() . ':' . $e->getLine());
            if (Cache::has($key)) {
                return; // 直近で同じエラーを通知済み
            }
            Cache::put($key, 1, self::THROTTLE_SECONDS);

            // 直近30分の同種エラー件数（規模感を伝える）
            $countKey = 'err_count_' . now()->format('YmdH');
            $count = Cache::increment($countKey) ?: 1;
            Cache::put($countKey, $count, 3600);

            AdminNotify::send(
                '🚨 エラー発生: ' . class_basename($e) . ($path ? ' @ ' . $path : ''),
                array_filter([
                    'エラー: ' . get_class($e),
                    'メッセージ: ' . mb_substr($e->getMessage(), 0, 300),
                    '発生箇所: ' . str_replace(base_path() . '/', '', $e->getFile()) . ':' . $e->getLine(),
                    $path ? 'URL: ' . ($method ? $method . ' ' : '') . $path : null,
                    '発生時刻: ' . now()->format('Y-m-d H:i:s'),
                    'この1時間のエラー総数: ' . $count . '件',
                    '',
                    '※同じエラーの通知は30分に1回に抑制されます',
                ])
            );
        } catch (\Throwable $inner) {
            Log::warning('error-alert failed: ' . $inner->getMessage());
        }
    }
}
