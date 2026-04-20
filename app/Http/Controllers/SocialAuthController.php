<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserProfile;
use App\Enums\UserRole;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

class SocialAuthController extends Controller
{
    /**
     * Google認証ページへリダイレクト
     * ?role=jobseeker or ?role=company を受け取りstateに埋め込む
     * CSRF対策: ランダムnonceをRedisに保存し、stateに含める
     */
    public function redirectToGoogle(Request $request)
    {
        $role = in_array($request->query('role'), ['jobseeker', 'company']) ? $request->query('role') : 'jobseeker';

        // ランダムnonceを生成してRedisに保存（10分有効・使い捨て）
        $nonce = Str::random(40);
        Cache::put("oauth_state:{$nonce}", $role, 600);

        return Socialite::driver('google')->stateless()->with(['state' => $nonce])->redirect();
    }

    /**
     * Googleコールバック処理
     * トークンをURLに含めず、短命の一時コード経由で安全に渡す
     */
    public function handleGoogleCallback()
    {
        // CSRF対策: stateに含まれるnonceをRedisで検証（取得と同時に削除）
        $nonce = request()->query('state', '');
        $role = Cache::pull("oauth_state:{$nonce}");

        if (!$role) {
            return redirect('/?auth_error=' . urlencode('認証セッションが無効です。もう一度お試しください。'));
        }

        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (\Exception $e) {
            return redirect('/?auth_error=' . urlencode('Google認証に失敗しました。'));
        }

        // 既存ユーザーをgoogle_idまたはメールで検索
        $user = User::where('google_id', $googleUser->getId())->first();

        if (!$user) {
            $user = User::where('email', $googleUser->getEmail())->first();

            if ($user) {
                // 既存メールユーザーにGoogle IDを紐付け（roleは変更しない）
                $user->update([
                    'google_id' => $googleUser->getId(),
                    'avatar_url' => $googleUser->getAvatar(),
                ]);
            } else {
                // 新規ユーザー作成（選択されたroleで登録）
                $user = User::create([
                    'name' => $googleUser->getName(),
                    'email' => $googleUser->getEmail(),
                    'google_id' => $googleUser->getId(),
                    'avatar_url' => $googleUser->getAvatar(),
                    'role' => $role,
                    'email_verified_at' => now(),
                ]);

                // 求職者の場合はプロフィール自動作成
                if ($role === 'jobseeker') {
                    UserProfile::create([
                        'user_id' => $user->id,
                        'full_name' => $user->name,
                    ]);
                }
            }
        } else {
            // アバターを更新
            $user->update(['avatar_url' => $googleUser->getAvatar()]);
        }

        // 短命の一時コードを生成（60秒で失効）
        $authCode = Str::random(64);
        Cache::put("oauth_code:{$authCode}", $user->id, 60);

        // フロントエンドに一時コードを渡してリダイレクト（トークン自体はURLに含めない）
        return redirect('/?auth_code=' . $authCode);
    }

    /**
     * 一時コードをSanctumトークンに交換するAPI
     * フロントエンドから POST で呼ばれる
     */
    public function exchangeAuthCode(Request $request)
    {
        $request->validate([
            'code' => 'required|string|size:64',
        ]);

        $cacheKey = "oauth_code:{$request->code}";
        $userId = Cache::pull($cacheKey); // 取得と同時に削除（一度きり）

        if (!$userId) {
            return response()->json(['message' => '認証コードが無効または期限切れです。'], 401);
        }

        $user = User::with('company')->find($userId);

        if (!$user) {
            return response()->json(['message' => 'ユーザーが見つかりません。'], 404);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user,
        ]);
    }
}
