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

        $report = Report::create(array_merge($validated, [
            'reporter_id' => $request->user()->id,
        ]));

        return response()->json([
            'report' => $report,
            'message' => '通報を受け付けました。運営にて確認いたします。',
        ], 201);
    }
}
