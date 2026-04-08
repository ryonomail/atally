<?php

namespace App\Http\Controllers;

use App\Models\Job;
use Illuminate\Support\Facades\Auth;

class SavedJobController extends Controller
{
    // 求職者: 保存済み求人一覧（詳細付き）
    public function index()
    {
        $user = Auth::user();
        $jobs = $user->savedJobs()
            ->where('status', 'active')
            ->select('jobs.id', 'jobs.title', 'jobs.location', 'jobs.employment_type', 'jobs.salary_min', 'jobs.salary_max', 'jobs.company_id')
            ->with('company:id,company_name')
            ->orderByDesc('saved_jobs.created_at')
            ->get();

        return response()->json($jobs);
    }

    // 求職者: 求人を保存
    public function store(Job $job)
    {
        $user = Auth::user();
        $user->savedJobs()->syncWithoutDetaching([$job->id]);

        return response()->json(['message' => '求人を保存しました'], 201);
    }

    // 求職者: 求人の保存を解除
    public function destroy(Job $job)
    {
        $user = Auth::user();
        $user->savedJobs()->detach($job->id);

        return response()->json(['message' => '保存を解除しました']);
    }
}
