<?php

namespace App\Support;

use App\Models\InAppNotification;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * 運営（オーナー）への重要イベント通知。
 * 企業登録・課金・パートナー申請・応募など「いつ何が起きたか」をメール＋管理画面内通知で届ける。
 * メールはSMTP未設定でも本処理を壊さない（失敗はログのみ・アプリ内通知は常に入る）。
 */
class AdminNotify
{
    /**
     * @param string $subject 件名（例: 「新規企業登録: 株式会社◯◯」）
     * @param array  $lines   本文の行（そのまま改行結合）
     */
    public static function send(string $subject, array $lines): void
    {
        $body = implode("\n", $lines);

        // 1) メール（SMTP設定済みなら届く。未設定・失敗時はログのみ）
        try {
            $to = env('ADMIN_NOTIFY_EMAIL', 'ryonomail20@gmail.com');
            if (config('mail.mailers.smtp.host')) {
                Mail::raw($body . "\n\n-- Atally 運営通知", function ($m) use ($to, $subject) {
                    $m->to($to)->subject('【Atally】' . $subject);
                });
            } else {
                Log::info("admin-notify (mail未設定のためスキップ): {$subject} | " . str_replace("\n", ' / ', $body));
            }
        } catch (\Throwable $e) {
            Log::warning('admin-notify mail failed: ' . $e->getMessage());
        }

        // 2) 管理画面内通知（admin全員へ・常に入る）
        try {
            User::where('role', 'admin')->pluck('id')->each(function ($adminId) use ($subject, $body) {
                InAppNotification::notify($adminId, 'system', $subject, $body, '/admin');
            });
        } catch (\Throwable $e) {
            Log::warning('admin-notify in-app failed: ' . $e->getMessage());
        }
    }
}
