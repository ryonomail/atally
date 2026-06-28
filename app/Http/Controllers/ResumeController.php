<?php

namespace App\Http\Controllers;

use App\Models\Resume;
use App\Models\UserProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ResumeController extends Controller
{
    /**
     * ゲスト（未ログイン）が作成した履歴書ドラフトを、登録/ログイン後のアカウントへ取り込む。
     * 履歴書本体データはプロフィールに保存し、履歴書(Resume)を1件作成する。
     * 登録フロー中に呼ばれるため、失敗しても例外を投げず常に200で返す（登録を止めない）。
     */
    public function importGuest(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->role !== 'jobseeker') {
            return response()->json(['skipped' => true, 'reason' => 'not_jobseeker'], 200);
        }
        // 既に履歴書がある場合は二重取り込みしない
        if ($user->resumes()->exists()) {
            return response()->json(['skipped' => true, 'reason' => 'already_has_resume'], 200);
        }

        $d = $request->input('draft', []);
        if (!is_array($d) || empty($d)) {
            return response()->json(['skipped' => true, 'reason' => 'no_draft'], 200);
        }

        try {
            // skills: 文字列なら配列化
            $skills = $d['skills'] ?? null;
            if (is_string($skills)) {
                $skills = array_values(array_filter(array_map('trim', preg_split('/[,、\s]+/u', $skills)), fn ($s) => $s !== ''));
            }
            // birth_date: YYYY-MM-DD のみ採用（不正値はスキップしてcastエラーを防ぐ）
            $birth = (!empty($d['birth_date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d['birth_date'])) ? $d['birth_date'] : null;

            $profileData = array_filter([
                'full_name'      => $d['full_name'] ?? null,
                'full_name_kana' => $d['full_name_kana'] ?? null,
                'birth_date'     => $birth,
                'phone'          => $d['phone'] ?? null,
                'address'        => $d['address'] ?? null,
                'work_history'   => isset($d['work_history']) && is_array($d['work_history']) ? $d['work_history'] : null,
                'education'      => isset($d['education']) && is_array($d['education']) ? $d['education'] : null,
                'self_pr'        => $d['self_pr'] ?? null,
                'skills'         => $skills,
            ], fn ($v) => $v !== null && $v !== '');

            $profile = $user->profile;
            if ($profile) {
                $profile->update($profileData);
            } else {
                $profile = UserProfile::create(array_merge(['user_id' => $user->id], $profileData));
            }

            $resume = $user->resumes()->create([
                'profile_id'       => $profile->id,
                'title'            => $d['title'] ?? '履歴書',
                'type'             => 'resume',
                'desired_location' => $d['desired_location'] ?? null,
                'desired_salary'   => $d['desired_salary'] ?? null,
            ]);

            return response()->json(['imported' => true, 'resume' => $resume->load('profile')], 201);
        } catch (\Throwable $e) {
            Log::warning('importGuest failed', ['user' => $user->id, 'error' => $e->getMessage()]);
            return response()->json(['skipped' => true, 'reason' => 'error'], 200);
        }
    }

    public function index(Request $request)
    {
        $resumes = $request->user()->resumes()
            ->with('profile')
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json(['resumes' => $resumes]);
    }

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

    public function show(Request $request, Resume $resume)
    {
        $this->authorize('manage', $resume);

        return response()->json([
            'resume' => $resume->load('profile'),
        ]);
    }

    public function update(Request $request, Resume $resume)
    {
        $this->authorize('manage', $resume);

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

        foreach (['motivation', 'desired_salary', 'desired_location', 'available_date'] as $field) {
            if (array_key_exists($field, $validated) && $validated[$field] === '') {
                $validated[$field] = null;
            }
        }

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

    public function destroy(Request $request, Resume $resume)
    {
        $this->authorize('manage', $resume);
        $resume->delete();

        return response()->json(['message' => '削除しました。']);
    }

    public function toCv(Request $request, Resume $resume)
    {
        $this->authorize('manage', $resume);

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

    public function duplicate(Request $request, Resume $resume)
    {
        $this->authorize('manage', $resume);

        $newResume = $resume->replicate();
        $newResume->title = $resume->title . ' (コピー)';
        $newResume->is_default = false;
        $newResume->save();

        return response()->json([
            'resume' => $newResume->load('profile'),
        ], 201);
    }

    public function preview(Request $request, Resume $resume)
    {
        $this->authorize('manage', $resume);
        $resume->load('profile');

        return response()->json([
            'snapshot' => $resume->toSnapshotData(),
        ]);
    }
}
