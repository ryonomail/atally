<?php

namespace App\Http\Controllers;

use App\Enums\JobStatus;
use App\Models\Application;
use App\Models\InAppNotification;
use App\Models\Job;
use App\Models\UserProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ScoutController extends Controller
{
    /**
     * スカウト検索（匿名データ表示）
     */
    public function search(Request $request)
    {
        $company = $request->user()->company;

        if ($company->needsAttention() || $company->isSuspended()) {
            return response()->json(['message' => '未払いのためスカウト機能はロックされています。'], 403);
        }

        // 有料掲載中（アクティブ求人あり）の企業のみスカウト可能
        $hasActiveJob = $company->jobs()->where('status', JobStatus::Active->value)->exists();
        if (!$hasActiveJob) {
            return response()->json(['message' => 'スカウト機能を利用するには、求人を掲載（有料）してください。'], 403);
        }

        $query = UserProfile::with('user:id,name,role,created_at')
            ->whereHas('user', function ($q) {
            $q->where('role', 'jobseeker');
        })
            ->whereHas('resumes', function ($q) {
            $q->where('scout_enabled', true);
        });

        // スキルフィルタ
        if ($skills = $request->get('skills')) {
            $query->whereJsonContains('skills', $skills);
        }

        // 勤務地フィルタ
        if ($location = $request->get('location')) {
            $query->where('address', 'ilike', "%{$location}%");
        }

        $profiles = $query->paginate(20);

        // 匿名化: 氏名・詳細住所・顔写真を非表示
        $profiles->getCollection()->transform(function ($profile) {
            return [
            'id' => $profile->user_id,
            'display_name' => $this->anonymizeName($profile->full_name),
            'age' => $profile->birth_date ? $profile->birth_date->age : null,
            'gender' => $profile->gender,
            'area' => $this->extractArea($profile->address),
            'education_summary' => $this->summarizeEducation($profile->education),
            'work_history_summary' => $this->summarizeWorkHistory($profile->work_history),
            'skills' => $profile->skills,
            'self_pr_excerpt' => mb_substr($profile->self_pr ?? '', 0, 100) . '...',
            'profile_completion' => $profile->completionRate(),
            ];
        });

        return response()->json($profiles);
    }

    /**
     * 一括スカウト送信
     */
    public function bulkScout(Request $request)
    {
        $request->validate([
            'user_ids' => 'required|array|min:1|max:50',
            'user_ids.*' => 'required|integer|exists:users,id',
            'job_id' => 'required|integer|exists:jobs,id',
            'message' => 'nullable|string|max:2000',
        ]);

        $company = $request->user()->company;

        if ($company->needsAttention() || $company->isSuspended()) {
            return response()->json(['message' => '未払いのためスカウト機能はロックされています。'], 403);
        }

        $job = Job::findOrFail($request->job_id);

        if ($job->company_id !== $company->id) {
            return response()->json(['message' => '権限がありません。'], 403);
        }

        if (!$job->isActive()) {
            return response()->json(['message' => 'スカウトを送るには、対象の求人がアクティブ（掲載中）である必要があります。'], 403);
        }

        $sentCount = 0;
        $skippedCount = 0;
        $errors = [];

        // スカウト有効でないユーザーを事前チェック
        $scoutEnabledUserIds = UserProfile::whereIn('user_id', $request->user_ids)
            ->whereHas('resumes', function ($q) {
                $q->where('scout_enabled', true);
            })
            ->pluck('user_id')
            ->toArray();

        // この求人で既にスカウト済みのユーザーを取得
        $alreadyScoutedUserIds = Application::where('job_id', $job->id)
            ->where('type', 'scout')
            ->whereIn('user_id', $request->user_ids)
            ->pluck('user_id')
            ->toArray();

        // N+1防止: ループ前にユーザーを一括取得
        $targetUsers = \App\Models\User::whereIn('id', $request->user_ids)->get()->keyBy('id');

        DB::beginTransaction();
        try {
            foreach ($request->user_ids as $userId) {
                if (in_array($userId, $alreadyScoutedUserIds)) {
                    $skippedCount++;
                    $errors[] = ['user_id' => $userId, 'reason' => 'この求人で既にスカウト送信済みです。'];
                    continue;
                }

                if (!in_array($userId, $scoutEnabledUserIds)) {
                    $skippedCount++;
                    $errors[] = ['user_id' => $userId, 'reason' => 'スカウト受信が無効になっています。'];
                    continue;
                }

                $application = Application::create([
                    'job_id' => $job->id,
                    'user_id' => $userId,
                    'resume_snapshot' => null,
                    'status' => 'pending',
                    'type' => 'scout',
                    'cover_letter' => $request->message,
                ]);

                // 求職者にスカウト通知メール + アプリ内通知
                $targetUser = $targetUsers->get($userId);
                if ($targetUser) {
                    $targetUser->notify(new \App\Notifications\ScoutReceivedNotification($application));
                    InAppNotification::notify(
                        $userId,
                        'scout',
                        'スカウトが届きました',
                        "「{$job->title}」のスカウトが届きました。",
                        '/applications'
                    );
                }

                $sentCount++;
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => '一括スカウトの送信中にエラーが発生しました。'], 500);
        }

        return response()->json([
            'sent_count' => $sentCount,
            'skipped_count' => $skippedCount,
            'errors' => $errors,
        ]);
    }

    private function anonymizeName(?string $name): string
    {
        if (!$name)
            return '非公開';
        $first = mb_substr($name, 0, 1);
        return $first . str_repeat('●', mb_strlen($name) - 1);
    }

    private function extractArea(?string $address): string
    {
        if (!$address)
            return '非公開';
        // 都道府県名のみ抽出
        preg_match('/^(北海道|.{2,3}[都道府県])/', $address, $matches);
        return $matches[0] ?? '非公開';
    }

    private function summarizeEducation(?array $education): string
    {
        if (!$education || count($education) === 0)
            return '未登録';
        $latest = end($education);
        return $latest['school'] ?? '情報あり';
    }

    private function summarizeWorkHistory(?array $history): string
    {
        if (!$history || count($history) === 0)
            return '未登録';
        return count($history) . '社経験';
    }
}
