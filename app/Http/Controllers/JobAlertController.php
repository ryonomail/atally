<?php

namespace App\Http\Controllers;

use App\Models\JobAlert;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class JobAlertController extends Controller
{
    // 求職者: 自分のアラート一覧
    public function index()
    {
        $alerts = Auth::user()
            ->jobAlerts()
            ->orderByDesc('created_at')
            ->get();

        return response()->json($alerts);
    }

    // 求職者: アラートを作成
    public function store(Request $request)
    {
        $data = $request->validate([
            'keyword' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:255',
            'employment_type' => 'nullable|string|max:255',
            'salary_min' => 'nullable|integer|min:0',
        ]);

        $alert = Auth::user()->jobAlerts()->create($data);

        return response()->json($alert, 201);
    }

    // 求職者: アラートを削除
    public function destroy(JobAlert $alert)
    {
        if ($alert->user_id !== Auth::id()) {
            return response()->json(['message' => '権限がありません'], 403);
        }

        $alert->delete();

        return response()->json(['message' => '求人アラートを削除しました']);
    }
}
