<?php

namespace App\Http\Controllers;

use App\Support\Totp;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * 管理者/ユーザー向け 2要素認証（TOTP・opt-in）。
 * 有効化フロー: enable（シークレット発行）→ 認証アプリ登録 → confirm（6桁で確認）→ 有効化＋リカバリコード発行。
 */
class TwoFactorController extends Controller
{
    /** 現在の2FA状態 */
    public function status(Request $request)
    {
        $u = $request->user();
        return response()->json([
            'enabled' => $u->hasTwoFactorEnabled(),
        ]);
    }

    /** 有効化開始: シークレット発行（まだ確認前。confirmで確定） */
    public function enable(Request $request)
    {
        $u = $request->user();
        if ($u->hasTwoFactorEnabled()) {
            return response()->json(['message' => '既に2要素認証は有効です'], 422);
        }

        $secret = Totp::generateSecret();
        $u->two_factor_secret = $secret;
        $u->two_factor_confirmed_at = null;
        $u->save();

        return response()->json([
            'secret'   => $secret, // 認証アプリへ手動登録する用（QRのotpauthも返す）
            'otpauth'  => Totp::provisioningUri($secret, $u->email, 'Atally'),
        ]);
    }

    /** 6桁コードで確認して有効化。成功時にリカバリコード（平文・一度きり）を返す */
    public function confirm(Request $request)
    {
        $data = $request->validate(['code' => 'required|string']);
        $u = $request->user();

        if (empty($u->two_factor_secret)) {
            return response()->json(['message' => '先に有効化を開始してください'], 422);
        }
        if (!Totp::verify($u->two_factor_secret, $data['code'])) {
            return response()->json(['message' => 'コードが正しくありません。認証アプリの時刻同期をご確認ください。'], 422);
        }

        // リカバリコード8個を発行（表示は今回のみ・DBはハッシュ保存）
        $plain = [];
        $hashed = [];
        for ($i = 0; $i < 8; $i++) {
            $code = strtoupper(Str::random(5) . '-' . Str::random(5));
            $plain[] = $code;
            $hashed[] = Hash::make($code);
        }

        $u->two_factor_recovery_codes = $hashed;
        $u->two_factor_confirmed_at = now();
        $u->save();

        return response()->json([
            'message'        => '2要素認証を有効化しました',
            'recovery_codes' => $plain,
        ]);
    }

    /** 無効化（パスワード再確認が必要） */
    public function disable(Request $request)
    {
        $data = $request->validate(['password' => 'required|string']);
        $u = $request->user();

        if (!Hash::check($data['password'], $u->password)) {
            return response()->json(['message' => 'パスワードが正しくありません'], 422);
        }

        $u->two_factor_secret = null;
        $u->two_factor_recovery_codes = null;
        $u->two_factor_confirmed_at = null;
        $u->save();

        return response()->json(['message' => '2要素認証を無効化しました']);
    }
}
