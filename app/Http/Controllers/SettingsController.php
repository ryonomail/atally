<?php

namespace App\Http\Controllers;

use App\Models\Application;
use App\Models\InAppNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;

class SettingsController extends Controller
{
    /**
     * パスワード変更
     */
    public function updatePassword(Request $request)
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'new_password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();

        if (!Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'message' => '現在のパスワードが正しくありません。',
                'errors' => ['current_password' => ['現在のパスワードが正しくありません。']],
            ], 422);
        }

        $user->update([
            'password' => Hash::make($validated['new_password']),
        ]);

        return response()->json([
            'message' => 'パスワードを変更しました。',
        ]);
    }

    /**
     * 通知設定の取得
     */
    public function getNotifications(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'notifications' => [
                'email_on_new_application' => (bool) $user->email_on_new_application,
                'email_on_message' => (bool) $user->email_on_message,
                'email_on_scout' => (bool) $user->email_on_scout,
                'email_on_job_alert' => (bool) $user->email_on_job_alert,
            ],
        ]);
    }

    /**
     * 通知設定の更新
     */
    public function updateNotifications(Request $request)
    {
        $validated = $request->validate([
            'email_on_new_application' => ['required', 'boolean'],
            'email_on_message' => ['required', 'boolean'],
            'email_on_scout' => ['required', 'boolean'],
            'email_on_job_alert' => ['required', 'boolean'],
        ]);

        $request->user()->update($validated);

        return response()->json([
            'message' => '通知設定を更新しました。',
            'notifications' => $validated,
        ]);
    }

    /**
     * 個人データエクスポート（GDPR対応）
     */
    public function exportData(Request $request)
    {
        $user = $request->user();
        $profile = $user->profile;

        $data = [
            'account' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'created_at' => $user->created_at?->toIso8601String(),
            ],
            'profile' => $profile ? [
                'full_name' => $profile->full_name,
                'full_name_kana' => $profile->full_name_kana,
                'birth_date' => $profile->birth_date,
                'gender' => $profile->gender,
                'phone' => $profile->phone,
                'postal_code' => $profile->postal_code,
                'address' => $profile->address,
                'education' => $profile->education,
                'work_history' => $profile->work_history,
                'skills' => $profile->skills,
                'licenses' => $profile->licenses,
                'self_pr' => $profile->self_pr,
            ] : null,
            'applications' => Application::where('user_id', $user->id)
                ->with('job:id,title')
                ->get()
                ->map(fn ($a) => [
                    'job_title' => $a->job?->title,
                    'status' => $a->status,
                    'type' => $a->type,
                    'cover_letter' => $a->cover_letter,
                    'created_at' => $a->created_at?->toIso8601String(),
                ]),
            'saved_jobs' => $user->savedJobs()->pluck('title'),
            'job_alerts' => $user->jobAlerts()->get()->map(fn ($a) => [
                'keyword' => $a->keyword,
                'location' => $a->location,
                'created_at' => $a->created_at?->toIso8601String(),
            ]),
            'notifications' => InAppNotification::where('user_id', $user->id)
                ->latest()
                ->limit(100)
                ->get()
                ->map(fn ($n) => [
                    'title' => $n->title,
                    'description' => $n->description,
                    'created_at' => $n->created_at?->toIso8601String(),
                ]),
            'exported_at' => now()->toIso8601String(),
        ];

        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        return response($json, 200, [
            'Content-Type' => 'application/json; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="my_data_export.json"',
        ]);
    }

    /**
     * アカウント退会（ソフト退会：データは残す）
     */
    public function deactivate(Request $request)
    {
        $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $user = $request->user();

        if ($user->role === 'admin') {
            return response()->json(['message' => '管理者アカウントは退会できません。'], 422);
        }

        $user->update(['deactivated_at' => now()]);

        // 全トークンを無効化
        $user->tokens()->delete();

        return response()->json(['message' => '退会処理が完了しました。']);
    }
}
