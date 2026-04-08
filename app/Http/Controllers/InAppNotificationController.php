<?php

namespace App\Http\Controllers;

use App\Models\InAppNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class InAppNotificationController extends Controller
{
    /**
     * 通知一覧（ページネーション付き）
     */
    public function index(Request $request)
    {
        $notifications = InAppNotification::where('user_id', Auth::id())
            ->orderByDesc('created_at')
            ->paginate($request->input('per_page', 20));

        return response()->json($notifications);
    }

    /**
     * 未読件数
     */
    public function unreadCount()
    {
        $count = InAppNotification::where('user_id', Auth::id())
            ->unread()
            ->count();

        return response()->json(['unread_count' => $count]);
    }

    /**
     * 最新の通知（ドロップダウン用、最大10件）
     */
    public function recent()
    {
        $notifications = InAppNotification::where('user_id', Auth::id())
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        $unreadCount = InAppNotification::where('user_id', Auth::id())
            ->unread()
            ->count();

        return response()->json([
            'notifications' => $notifications,
            'unread_count' => $unreadCount,
        ]);
    }

    /**
     * 単一通知を既読にする
     */
    public function markAsRead(InAppNotification $notification)
    {
        if ($notification->user_id !== Auth::id()) {
            return response()->json(['message' => '権限がありません'], 403);
        }

        $notification->update(['read_at' => now()]);

        return response()->json(['message' => '既読にしました']);
    }

    /**
     * 全通知を既読にする
     */
    public function markAllAsRead()
    {
        InAppNotification::where('user_id', Auth::id())
            ->unread()
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'すべて既読にしました']);
    }
}
