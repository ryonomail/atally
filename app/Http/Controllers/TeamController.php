<?php

namespace App\Http\Controllers;

use App\Mail\TeamInvitationMail;
use App\Models\User;
use App\Models\CompanyInvitation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;

class TeamController extends Controller
{
    /**
     * チームメンバー一覧
     */
    public function index(Request $request)
    {
        $company = $request->user()->resolveCompany();

        if (!$company) {
            return response()->json(['message' => '企業情報が見つかりません。'], 404);
        }

        $members = $company->teamMembers()
            ->select('id', 'name', 'email', 'company_role', 'created_at')
            ->orderByRaw("CASE company_role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'member' THEN 3 ELSE 4 END")
            ->get();

        $invitations = $company->invitations()
            ->where('expires_at', '>', now())
            ->select('id', 'email', 'role', 'created_at', 'expires_at')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'members' => $members,
            'invitations' => $invitations,
        ]);
    }

    /**
     * メンバー招待
     */
    public function invite(Request $request)
    {
        $user = $request->user();
        $company = $user->resolveCompany();

        if (!$company) {
            return response()->json(['message' => '企業情報が見つかりません。'], 404);
        }

        if (!$user->isCompanyAdmin()) {
            return response()->json(['message' => '招待権限がありません。'], 403);
        }

        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'role' => ['required', 'in:admin,member'],
        ]);

        // 既にチームメンバーかチェック
        $existing = User::where('email', $validated['email'])
            ->where('company_id', $company->id)
            ->first();

        if ($existing) {
            return response()->json(['message' => 'このメールアドレスは既にチームメンバーです。'], 422);
        }

        // 既存の有効な招待をチェック
        $existingInvitation = CompanyInvitation::where('email', $validated['email'])
            ->where('company_id', $company->id)
            ->where('expires_at', '>', now())
            ->first();

        if ($existingInvitation) {
            return response()->json(['message' => 'このメールアドレスには既に招待を送信済みです。'], 422);
        }

        $token = Str::random(64);

        $invitation = CompanyInvitation::create([
            'company_id' => $company->id,
            'email' => $validated['email'],
            'role' => $validated['role'],
            'token' => $token,
            'expires_at' => now()->addDays(7),
        ]);

        // 既存ユーザーの場合は直接チームに追加
        $existingUser = User::where('email', $validated['email'])
            ->whereNull('company_id')
            ->where('role', 'company')
            ->first();

        if ($existingUser) {
            $existingUser->update([
                'company_id' => $company->id,
                'company_role' => $validated['role'],
            ]);
            $invitation->delete();

            return response()->json([
                'message' => '既存ユーザーをチームに追加しました。',
                'member' => $existingUser->only(['id', 'name', 'email', 'company_role', 'created_at']),
                'added_directly' => true,
            ]);
        }

        // 新規ユーザーの場合は仮パスワードでアカウント作成
        $tempPassword = Str::random(12);
        $newUser = User::create([
            'name' => explode('@', $validated['email'])[0],
            'email' => $validated['email'],
            'password' => Hash::make($tempPassword),
            'role' => 'company',
            'company_id' => $company->id,
            'company_role' => $validated['role'],
        ]);

        $invitation->delete();

        // 仮パスワードをメールで送信（APIレスポンスには含めない）
        try {
            Mail::to($newUser->email)->send(new TeamInvitationMail(
                companyName: $company->company_name,
                temporaryPassword: $tempPassword,
                loginUrl: config('app.url') . '/login',
            ));
        } catch (\Exception $e) {
            Log::error('TeamInvitationMail send error', ['error' => $e->getMessage()]);
        }

        return response()->json([
            'message' => 'チームメンバーを追加しました。ログイン情報をメールで送信しました。',
            'member' => $newUser->only(['id', 'name', 'email', 'company_role', 'created_at']),
            'added_directly' => true,
        ], 201);
    }

    /**
     * メンバーロール変更
     */
    public function updateRole(Request $request, User $user)
    {
        $currentUser = $request->user();
        $company = $currentUser->resolveCompany();

        if (!$company) {
            return response()->json(['message' => '企業情報が見つかりません。'], 404);
        }

        if (!$currentUser->isCompanyOwner()) {
            return response()->json(['message' => 'ロール変更はオーナーのみ可能です。'], 403);
        }

        if ($user->company_id !== $company->id) {
            return response()->json(['message' => '指定されたユーザーはチームメンバーではありません。'], 404);
        }

        if ($user->id === $currentUser->id) {
            return response()->json(['message' => '自分のロールは変更できません。'], 422);
        }

        if ($user->company_role === 'owner') {
            return response()->json(['message' => 'オーナーのロールは変更できません。'], 422);
        }

        $validated = $request->validate([
            'role' => ['required', 'in:admin,member'],
        ]);

        $user->update(['company_role' => $validated['role']]);

        return response()->json([
            'message' => 'ロールを更新しました。',
            'member' => $user->only(['id', 'name', 'email', 'company_role', 'created_at']),
        ]);
    }

    /**
     * メンバー削除
     */
    public function removeMember(Request $request, User $user)
    {
        $currentUser = $request->user();
        $company = $currentUser->resolveCompany();

        if (!$company) {
            return response()->json(['message' => '企業情報が見つかりません。'], 404);
        }

        if (!$currentUser->isCompanyAdmin()) {
            return response()->json(['message' => 'メンバー削除権限がありません。'], 403);
        }

        if ($user->company_id !== $company->id) {
            return response()->json(['message' => '指定されたユーザーはチームメンバーではありません。'], 404);
        }

        if ($user->id === $currentUser->id) {
            return response()->json(['message' => '自分自身を削除することはできません。'], 422);
        }

        if ($user->company_role === 'owner') {
            return response()->json(['message' => 'オーナーを削除することはできません。'], 422);
        }

        // admin が admin を削除しようとした場合もブロック
        if ($user->company_role === 'admin' && !$currentUser->isCompanyOwner()) {
            return response()->json(['message' => '管理者の削除はオーナーのみ可能です。'], 403);
        }

        $user->update([
            'company_id' => null,
            'company_role' => null,
        ]);

        return response()->json([
            'message' => 'メンバーを削除しました。',
        ]);
    }

    /**
     * 招待キャンセル
     */
    public function cancelInvitation(Request $request, CompanyInvitation $invitation)
    {
        $currentUser = $request->user();
        $company = $currentUser->resolveCompany();

        if (!$company || $invitation->company_id !== $company->id) {
            return response()->json(['message' => '招待が見つかりません。'], 404);
        }

        if (!$currentUser->isCompanyAdmin()) {
            return response()->json(['message' => '権限がありません。'], 403);
        }

        $invitation->delete();

        return response()->json(['message' => '招待をキャンセルしました。']);
    }
}
