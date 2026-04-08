<?php

namespace App\Http\Controllers;

use App\Models\Resume;
use Illuminate\Http\Request;

class ResumeController extends Controller
{
    /**
     * 履歴書一覧
     */
    public function index(Request $request)
    {
        $resumes = $request->user()->resumes()
            ->with('profile')
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json(['resumes' => $resumes]);
    }

    /**
     * 親プロフィールから子履歴書を作成
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'in:resume,career_resume,cv'],
            'motivation' => ['nullable', 'string', 'max:2000'],
            'desired_salary' => ['nullable', 'string', 'max:100'],
            'desired_location' => ['nullable', 'string', 'max:255'],
            'available_date' => ['nullable', 'date'],
            'custom_fields' => ['nullable', 'array'],
            'content' => ['nullable', 'array'],
        ]);

        $profile = $request->user()->profile;

        if (!$profile) {
            return response()->json(['message' => 'まずプロフィールを作成してください。'], 400);
        }

        $type = $validated['type'] ?? 'resume';

        // CV作成時、プロフィールのデータをcontentに自動セット
        if ($type === 'cv' && empty($validated['content'])) {
            $validated['content'] = [
                'career_summary' => $profile->self_pr ?? '',
                'technical_skills' => is_array($profile->skills) ? implode(' / ', $profile->skills) : '',
                'projects' => [],
                'achievements' => '',
                'management_experience' => '',
            ];
        }

        $resume = Resume::create(array_merge(
            $validated,
            [
                'user_id' => $request->user()->id,
                'profile_id' => $profile->id,
                'type' => $type,
            ]
        ));

        return response()->json([
            'resume' => $resume->load('profile'),
        ], 201);
    }

    /**
     * 履歴書詳細
     */
    public function show(Request $request, Resume $resume)
    {
        $this->authorizeResume($request, $resume);

        return response()->json([
            'resume' => $resume->load('profile'),
        ]);
    }

    /**
     * 履歴書更新
     */
    public function update(Request $request, Resume $resume)
    {
        $this->authorizeResume($request, $resume);

        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'motivation' => ['nullable', 'string', 'max:2000'],
            'desired_salary' => ['nullable', 'string', 'max:100'],
            'desired_location' => ['nullable', 'string', 'max:255'],
            'available_date' => ['nullable', 'date'],
            'custom_fields' => ['nullable', 'array'],
            'content' => ['nullable', 'array'],
            'is_default' => ['nullable', 'boolean'],
            'scout_enabled' => ['nullable', 'boolean'],
        ]);

        // 空文字は null に変換
        foreach (['motivation', 'desired_salary', 'desired_location', 'available_date'] as $field) {
            if (array_key_exists($field, $validated) && $validated[$field] === '') {
                $validated[$field] = null;
            }
        }

        // デフォルト設定の場合、他のデフォルトを解除
        if (isset($validated['is_default']) && $validated['is_default']) {
            $request->user()->resumes()
                ->where('id', '!=', $resume->id)
                ->update(['is_default' => false]);
        }

        $resume->update($validated);

        return response()->json([
            'resume' => $resume->fresh()->load('profile'),
        ]);
    }

    /**
     * 履歴書削除
     */
    public function destroy(Request $request, Resume $resume)
    {
        $this->authorizeResume($request, $resume);
        $resume->delete();

        return response()->json(['message' => '削除しました。']);
    }

    /**
     * 履歴書から職務経歴書を作成
     */
    public function toCv(Request $request, Resume $resume)
    {
        $this->authorizeResume($request, $resume);

        $profile = $resume->profile;

        $content = [
            'career_summary' => $resume->motivation ?? $profile?->self_pr ?? '',
            'technical_skills' => is_array($profile?->skills) ? implode(' / ', $profile->skills) : '',
            'projects' => [],
            'achievements' => '',
            'management_experience' => '',
        ];

        $newResume = Resume::create([
            'user_id' => $request->user()->id,
            'profile_id' => $resume->profile_id,
            'title' => '職務経歴書',
            'type' => 'cv',
            'motivation' => $resume->motivation,
            'desired_salary' => $resume->desired_salary,
            'desired_location' => $resume->desired_location,
            'available_date' => $resume->available_date,
            'content' => $content,
        ]);

        return response()->json([
            'resume' => $newResume->load('profile'),
        ], 201);
    }

    /**
     * 履歴書を複製
     */
    public function duplicate(Request $request, Resume $resume)
    {
        $this->authorizeResume($request, $resume);

        $newResume = $resume->replicate();
        $newResume->title = $resume->title . ' (コピー)';
        $newResume->is_default = false;
        $newResume->save();

        return response()->json([
            'resume' => $newResume->load('profile'),
        ], 201);
    }

    /**
     * スナップショットデータ取得（PDFプレビュー用）
     */
    public function preview(Request $request, Resume $resume)
    {
        $this->authorizeResume($request, $resume);
        $resume->load('profile');

        return response()->json([
            'snapshot' => $resume->toSnapshotData(),
        ]);
    }

    private function authorizeResume(Request $request, Resume $resume): void
    {
        if ($resume->user_id !== $request->user()->id) {
            abort(403, 'この履歴書にアクセスする権限がありません。');
        }
    }
}
