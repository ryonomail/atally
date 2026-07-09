<?php

namespace App\Http\Controllers;

use App\Enums\JobStatus;
use App\Models\Application;
use App\Models\ApplicationStatusHistory;
use App\Models\InAppNotification;
use App\Models\Job;
use App\Models\Resume;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ApplicationController extends Controller
{
    // 求職者: 自分の応募・スカウト一覧
    public function myApplications()
    {
        $user = Auth::user();
        $applications = Application::with(['job.company', 'interviewSchedules'])
            ->where('user_id', $user->id)
            ->latest()
            ->get();

        return response()->json($applications);
    }

    // 求職者: 応募済み求人IDの一覧
    public function myApplicationJobIds()
    {
        $user = Auth::user();
        $jobIds = Application::where('user_id', $user->id)->pluck('job_id');

        return response()->json($jobIds);
    }

    // 企業: 求人ごとの応募者一覧
    public function jobApplications(Job $job)
    {
        $this->authorize('manage', $job);

        $applications = Application::with(['user.profile'])
            ->where('job_id', $job->id)
            ->latest()
            ->get();

        return response()->json($applications);
    }

    // 企業: 応募者CSVエクスポート
    public function exportApplicationsCsv(Job $job)
    {
        $this->authorize('manage', $job);

        $applications = Application::with(['user.profile'])
            ->where('job_id', $job->id)
            ->latest()
            ->get();

        $headers = ['応募ID', '氏名', 'メール', 'ステータス', '応募種別', '応募日', '更新日'];
        $rows = $applications->map(fn($a) => [
            $a->id,
            $a->user?->name ?? '',
            $a->user?->email ?? '',
            $a->status->value ?? $a->status,
            $a->type ?? 'standard',
            $a->created_at?->format('Y-m-d'),
            $a->updated_at?->format('Y-m-d'),
        ]);

        $csv = implode(',', $headers) . "\n";
        foreach ($rows as $row) {
            $csv .= implode(',', array_map(fn($v) => '"' . str_replace('"', '""', (string) $v) . '"', $row)) . "\n";
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="applications_job_' . $job->id . '.csv"',
        ]);
    }

    // 求職者: 応募する
    public function apply(Request $request, Job $job)
    {
        if (!in_array($job->status->value, ['active'])) {
            return response()->json(['message' => 'この求人は現在応募を受け付けていません'], 422);
        }

        $request->validate([
            'resume_id' => 'required|exists:resumes,id',
        ]);

        $user = Auth::user();

        $alreadyApplied = Application::where('job_id', $job->id)
            ->where('user_id', $user->id)
            ->exists();

        if ($alreadyApplied) {
            return response()->json(['message' => 'この求人にはすでに応募済みです。'], 422);
        }

        $resume = Resume::where('id', $request->resume_id)
            ->where('user_id', $user->id)
            ->with('profile')
            ->firstOrFail();

        $snapshot = [
            'profile' => $resume->profile->toArray(),
            'resume' => $resume->toArray(),
        ];

        $application = Application::create([
            'job_id' => $job->id,
            'user_id' => $user->id,
            'resume_snapshot' => $snapshot,
            'status' => 'pending',
            'type' => 'standard',
        ]);

        ApplicationStatusHistory::create([
            'application_id' => $application->id,
            'status' => 'pending',
            'changed_at' => now(),
            'note' => '応募しました',
        ]);

        // 運営へ通知（応募は最重要KPI）
        \App\Support\AdminNotify::send('応募発生: ' . $job->title, [
            '求人: ' . $job->title,
            '企業: ' . ($job->company->company_name ?? '—'),
            '応募者: ' . $user->name,
        ]);

        $companyUser = $job->company->user;
        if ($companyUser) {
            $companyUser->notify(new \App\Notifications\NewApplicationNotification($application));
            InAppNotification::notify(
                $companyUser->id,
                'application',
                '新しい応募があります',
                "「{$job->title}」に新しい応募がありました。",
                "/company/jobs/{$job->id}/applications"
            );
        }

        return response()->json($application, 201);
    }

    // 企業: スカウトを送る
    public function scout(Request $request)
    {
        $request->validate([
            'job_id' => 'required|exists:jobs,id',
            'user_id' => 'required|exists:users,id',
        ]);

        $job = Job::findOrFail($request->job_id);
        $this->authorize('manage', $job);

        if (!$job->isActive()) {
            return response()->json(['message' => 'スカウトを送るには、対象の求人がアクティブ（掲載中）である必要があります。'], 403);
        }

        $scoutEnabled = \App\Models\UserProfile::where('user_id', $request->user_id)
            ->whereHas('resumes', fn($q) => $q->where('scout_enabled', true))
            ->exists();
        if (!$scoutEnabled) {
            return response()->json(['message' => 'このユーザーはスカウト受信を無効にしています。'], 422);
        }

        $application = Application::create([
            'job_id' => $job->id,
            'user_id' => $request->user_id,
            'resume_snapshot' => null,
            'status' => 'pending',
            'type' => 'scout',
        ]);

        $targetUser = \App\Models\User::find($request->user_id);
        if ($targetUser) {
            $targetUser->notify(new \App\Notifications\ScoutReceivedNotification($application));
            InAppNotification::notify(
                $targetUser->id,
                'scout',
                'スカウトが届きました',
                "「{$job->title}」のスカウトが届きました。",
                '/applications'
            );
        }

        return response()->json($application, 201);
    }

    // 求職者: スカウトを受諾
    public function acceptScout(Request $request, Application $application)
    {
        $this->authorize('manageScout', $application);

        $user = Auth::user();

        $request->validate([
            'resume_id' => 'required|exists:resumes,id',
        ]);

        $resume = Resume::where('id', $request->resume_id)
            ->where('user_id', $user->id)
            ->with('profile')
            ->firstOrFail();

        $snapshot = [
            'profile' => $resume->profile->toArray(),
            'resume' => $resume->toArray(),
        ];

        $application->update([
            'resume_snapshot' => $snapshot,
            'status' => 'accepted',
        ]);

        return response()->json($application);
    }

    // 求職者: スカウトを辞退
    public function declineScout(Application $application)
    {
        $this->authorize('manageScout', $application);

        $application->update(['status' => 'rejected']);

        return response()->json($application);
    }

    // 共通: ステータス更新（辞退・不採用など）
    public function updateStatus(Request $request, Application $application)
    {
        $rules = [
            'status' => 'required|in:pending,under_review,interviewing,offered,accepted,rejected,withdrawn,hired',
            'note' => 'nullable|string|max:500',
        ];

        if ($request->status === 'rejected') {
            $rules['rejection_reason'] = 'nullable|string|in:experience_mismatch,skill_mismatch,salary_mismatch,position_filled,other';
            $rules['rejection_feedback'] = 'nullable|string|max:2000';
        }

        $request->validate($rules);

        $user = Auth::user();

        if ($user->isJobSeeker()) {
            $this->authorize('view', $application);
            if (!in_array($request->status, ['withdrawn', 'accepted'])) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        } elseif ($user->isCompany()) {
            $this->authorize('updateStatus', $application);
        } elseif ($user->role->value !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $updateData = ['status' => $request->status];

        if ($request->status === 'rejected') {
            $updateData['rejection_reason'] = $request->rejection_reason;
            $updateData['rejection_feedback'] = $request->rejection_feedback;
        }

        $application->update($updateData);

        if ($user->isCompany()) {
            $application->job?->update(['last_company_action_at' => now()]);
        }

        ApplicationStatusHistory::create([
            'application_id' => $application->id,
            'status' => $request->status,
            'changed_at' => now(),
            'note' => $request->note,
        ]);

        $statusLabels = [
            'under_review' => '書類選考中',
            'interviewing' => '面接中',
            'offered' => '内定',
            'rejected' => '不採用',
            'hired' => '採用決定',
            'withdrawn' => '辞退',
            'accepted' => '承諾',
        ];
        $label = $statusLabels[$request->status] ?? $request->status;
        $jobTitle = $application->job->title ?? '求人';

        if ($user->isCompany() || $user->role->value === 'admin') {
            InAppNotification::notify(
                $application->user_id,
                'application',
                "応募ステータスが「{$label}」に更新されました",
                "「{$jobTitle}」の応募ステータスが変更されました。",
                '/applications'
            );
        } else {
            $companyUser = $application->job->company->user ?? null;
            if ($companyUser) {
                InAppNotification::notify(
                    $companyUser->id,
                    'application',
                    "応募者が「{$label}」しました",
                    "「{$jobTitle}」の応募者がステータスを変更しました。",
                    "/company/jobs/{$application->job_id}/applications"
                );
            }
        }

        return response()->json($application);
    }

    // 企業: 一括ステータス更新
    public function bulkUpdateStatus(Request $request)
    {
        $request->validate([
            'application_ids' => 'required|array|min:1',
            'application_ids.*' => 'integer|exists:applications,id',
            'status' => 'required|in:pending,under_review,interviewing,offered,accepted,rejected,withdrawn,hired',
        ]);

        $user = Auth::user();
        $company = $user->company;

        if (!$company) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $companyJobIds = Job::where('company_id', $company->id)->pluck('id');

        $applications = Application::whereIn('id', $request->application_ids)
            ->whereIn('job_id', $companyJobIds)
            ->get();

        if ($applications->count() !== count($request->application_ids)) {
            return response()->json(['message' => '一部の応募が見つからないか、権限がありません。'], 403);
        }

        $updatedCount = Application::whereIn('id', $request->application_ids)
            ->whereIn('job_id', $companyJobIds)
            ->update(['status' => $request->status]);

        $now = now();
        $histories = $applications->map(fn ($app) => [
            'application_id' => $app->id,
            'status' => $request->status,
            'changed_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ])->toArray();
        ApplicationStatusHistory::insert($histories);

        return response()->json([
            'message' => "{$updatedCount}件のステータスを更新しました。",
            'updated_count' => $updatedCount,
        ]);
    }

    // 応募のタイムライン（ステータス履歴）
    public function timeline(Application $application)
    {
        $this->authorize('view', $application);

        $histories = $application->statusHistories()
            ->orderBy('changed_at', 'asc')
            ->get();

        return response()->json($histories);
    }
}
