<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserProfile;
use App\Models\Company;
use App\Enums\UserRole;
use App\Mail\EmailVerificationCode;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rules;
use Carbon\Carbon;

class AuthController extends Controller
{
    /**
     * 新規登録
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'role' => ['required', 'in:jobseeker,company'],
            'company_name' => ['required_if:role,company', 'nullable', 'string', 'max:255'],
            'company_type' => ['nullable', 'in:direct_employer,recruitment_agency'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
        ]);

        // 求職者は自動的に親プロフィールを作成
        if ($user->role === UserRole::JobSeeker) {
            UserProfile::create([
                'user_id' => $user->id,
                'full_name' => $user->name,
            ]);
        }

        // 企業は自動的にcompanyレコードを作成
        if ($validated['role'] === 'company' && !empty($validated['company_name'])) {
            $company = Company::create([
                'user_id' => $user->id,
                'company_name' => $validated['company_name'],
                'company_type' => $validated['company_type'] ?? 'direct_employer',
            ]);
            $user->update([
                'company_id' => $company->id,
                'company_role' => 'owner',
            ]);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        // メール確認コードを送信
        $this->sendVerificationCode($user->email);

        return response()->json([
            'user' => $user->load(['profile', 'company']),
            'token' => $token,
            'requires_email_verification' => true,
        ], 201);
    }

    /**
     * ログイン
     */
    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'メールアドレスまたはパスワードが正しくありません。',
            ], 401);
        }

        if ($user->deactivated_at) {
            return response()->json([
                'message' => 'このアカウントは退会済みです。',
            ], 403);
        }

        if ($user->suspended_at) {
            return response()->json([
                'message' => 'このアカウントは停止されています。詳細はサポートまでお問い合わせください。',
            ], 403);
        }

        $user->update(['last_login_at' => Carbon::now()]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user' => $user->load(['profile', 'company']),
            'token' => $token,
        ]);
    }

    /**
     * ログアウト
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'ログアウトしました。']);
    }

    /**
     * 現在のユーザー情報取得
     */
    public function me(Request $request)
    {
        return response()->json([
            'user' => $request->user()->load(['profile', 'company']),
        ]);
    }

    /**
     * メール確認コードを検証
     */
    public function verifyEmail(Request $request)
    {
        $request->validate([
            'email' => ['required', 'email', 'exists:users,email'],
            'code' => ['required', 'string', 'size:6'],
        ]);

        $record = DB::table('email_verifications')
            ->where('email', $request->email)
            ->first();

        if (!$record) {
            return response()->json([
                'message' => '確認コードが見つかりません。再度コードを送信してください。',
            ], 422);
        }

        // 有効期限チェック（60分以内）
        if (Carbon::parse($record->created_at)->addMinutes(60)->isPast()) {
            DB::table('email_verifications')->where('email', $request->email)->delete();
            return response()->json([
                'message' => 'コードの有効期限が切れています。再度コードを送信してください。',
            ], 422);
        }

        // コード照合
        if (!Hash::check($request->code, $record->code)) {
            return response()->json([
                'message' => 'コードが正しくありません。',
            ], 422);
        }

        // メール認証完了
        User::where('email', $request->email)->update([
            'email_verified_at' => Carbon::now(),
        ]);

        // 使用済みコードを削除
        DB::table('email_verifications')->where('email', $request->email)->delete();

        return response()->json([
            'message' => 'メールアドレスが確認されました。',
        ]);
    }

    /**
     * メール確認コードを再送信
     */
    public function resendVerification(Request $request)
    {
        $request->validate([
            'email' => ['required', 'email', 'exists:users,email'],
        ]);

        $user = User::where('email', $request->email)->first();

        if ($user->email_verified_at) {
            return response()->json([
                'message' => 'このメールアドレスは既に確認済みです。',
            ], 422);
        }

        $this->sendVerificationCode($request->email);

        return response()->json([
            'message' => '確認コードを再送信しました。メールをご確認ください。',
        ]);
    }

    /**
     * 確認コードを生成して送信
     */
    private function sendVerificationCode(string $email): void
    {
        $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::table('email_verifications')->updateOrInsert(
            ['email' => $email],
            [
                'code' => Hash::make($code),
                'created_at' => Carbon::now(),
            ]
        );

        Mail::to($email)->queue(new EmailVerificationCode($code));
    }
}
