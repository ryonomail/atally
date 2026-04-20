<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckSuspended
{
    /**
     * 停止済みアカウントによるAPIアクセスを遮断する
     * 既存トークンが残っていても停止直後から全エンドポイントをブロック
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->suspended_at !== null) {
            // 全トークンを無効化して即時アクセス不可にする
            $user->tokens()->delete();

            return response()->json([
                'message' => 'このアカウントは停止されています。詳細はサポートまでお問い合わせください。',
            ], 403);
        }

        return $next($request);
    }
}
