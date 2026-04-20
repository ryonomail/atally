<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Mail\PasswordResetCode;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;

class PasswordResetController extends Controller
{
    /**
     * パスワードリセットコードを送信
     */
    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        // メールアドレスの存在有無に関わらず同じレスポンスを返す（列挙攻撃対策）
        $user = User::where('email', $request->email)->first();

        if ($user) {
            // 6桁のランダムコードを生成
            $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

            // password_reset_tokensテーブルに保存（既存レコードは上書き）
            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $request->email],
                [
                    'token' => Hash::make($code),
                    'created_at' => Carbon::now(),
                ]
            );

            Mail::to($request->email)->queue(new PasswordResetCode($code));
        }

        return response()->json([
            'message' => '登録済みのメールアドレスの場合、リセットコードを送信しました。',
        ]);
    }

    /**
     * パスワードをリセット
     */
    public function resetPassword(Request $request)
    {
        $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'string', 'size:6'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'code.size' => 'コードは6桁で入力してください。',
            'password.min' => 'パスワードは8文字以上で入力してください。',
            'password.confirmed' => 'パスワードが一致しません。',
        ]);

        // トークンを検索（メールアドレスの存在有無を明かさない汎用メッセージを返す）
        $record = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->first();

        if (!$record) {
            return response()->json([
                'message' => 'コードが正しくないか、有効期限が切れています。再度コードを送信してください。',
            ], 422);
        }

        // 有効期限チェック（60分以内）
        if (Carbon::parse($record->created_at)->addMinutes(60)->isPast()) {
            DB::table('password_reset_tokens')->where('email', $request->email)->delete();
            return response()->json([
                'message' => 'コードの有効期限が切れています。再度コードを送信してください。',
            ], 422);
        }

        // コード照合
        if (!Hash::check($request->code, $record->token)) {
            return response()->json([
                'message' => 'コードが正しくありません。',
            ], 422);
        }

        // パスワード更新
        $user = User::where('email', $request->email)->first();
        $user->update([
            'password' => Hash::make($request->password),
        ]);

        // 使用済みトークンを削除
        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        return response()->json([
            'message' => 'パスワードが正常にリセットされました。',
        ]);
    }
}
