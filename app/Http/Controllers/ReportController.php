<?php

namespace App\Http\Controllers;

use App\Models\Report;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    /**
     * 非公開通報送信
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'reported_user_id' => ['sometimes', 'exists:users,id'],
            'reported_job_id' => ['sometimes', 'exists:jobs,id'],
            'reason' => ['required', 'string', 'max:255'],
            'description' => ['sometimes', 'string', 'max:2000'],
        ]);

        $reporter = $request->user();

        // 自分自身のアカウントへの通報を防止
        if (isset($validated['reported_user_id']) && $validated['reported_user_id'] == $reporter->id) {
            return response()->json(['message' => '自分自身を通報することはできません。'], 422);
        }

        // 自分の求人への通報を防止
        if (isset($validated['reported_job_id'])) {
            $ownsJob = \App\Models\Job::where('id', $validated['reported_job_id'])
                ->where('company_id', $reporter->company_id)
                ->exists();
            if ($ownsJob) {
                return response()->json(['message' => '自分の求人を通報することはできません。'], 422);
            }
        }

        // 1時間以内の同一対象への重複通報を防止（スパム対策）
        $duplicate = Report::where('reporter_id', $reporter->id)
            ->where(function ($q) use ($validated) {
                if (isset($validated['reported_user_id'])) {
                    $q->where('reported_user_id', $validated['reported_user_id']);
                }
                if (isset($validated['reported_job_id'])) {
                    $q->orWhere('reported_job_id', $validated['reported_job_id']);
                }
            })
            ->where('created_at', '>', now()->subHour())
            ->exists();

        if ($duplicate) {
            return response()->json(['message' => '同じ対象への重複した通報はできません（1時間以内）。'], 422);
        }

        $report = Report::create(array_merge($validated, [
            'reporter_id' => $reporter->id,
        ]));

        return response()->json([
            'report' => $report,
            'message' => '通報を受け付けました。運営にて確認いたします。',
        ], 201);
    }
}
