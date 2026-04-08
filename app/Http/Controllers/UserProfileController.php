<?php

namespace App\Http\Controllers;

use App\Models\UserProfile;
use Illuminate\Http\Request;

class UserProfileController extends Controller
{
    /**
     * プロフィール取得
     */
    public function show(Request $request)
    {
        $profile = $request->user()->profile;

        if (!$profile) {
            return response()->json(['message' => 'プロフィールが見つかりません。'], 404);
        }

        return response()->json([
            'profile' => $profile,
            'completion_rate' => $profile->completionRate(),
        ]);
    }

    /**
     * プロフィール更新（1ユーザー1レコード）
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'full_name' => ['sometimes', 'string', 'max:255'],
            'full_name_kana' => ['sometimes', 'string', 'max:255'],
            'birth_date' => ['sometimes', 'date'],
            'gender' => ['sometimes', 'string', 'in:male,female,other'],
            'phone' => ['sometimes', 'string', 'max:20'],
            'postal_code' => ['sometimes', 'string', 'max:10'],
            'address' => ['sometimes', 'string', 'max:500'],
            'education' => ['sometimes', 'array'],
            'education.*.school' => ['required_with:education', 'string'],
            'education.*.faculty' => ['sometimes', 'string'],
            'education.*.start_date' => ['sometimes', 'string'],
            'education.*.end_date' => ['sometimes', 'string'],
            'work_history' => ['sometimes', 'array'],
            'work_history.*.company' => ['required_with:work_history', 'string'],
            'work_history.*.position' => ['sometimes', 'string'],
            'work_history.*.start_date' => ['sometimes', 'string'],
            'work_history.*.end_date' => ['sometimes', 'string'],
            'work_history.*.description' => ['sometimes', 'string'],
            'licenses' => ['sometimes', 'array'],
            'licenses.*.name' => ['required_with:licenses', 'string'],
            'licenses.*.date' => ['sometimes', 'string'],
            'skills' => ['sometimes', 'array'],
            'skills.*' => ['string'],
            'self_pr' => ['sometimes', 'string', 'max:2000'],
        ]);

        $profile = $request->user()->profile;

        if (!$profile) {
            $profile = UserProfile::create(array_merge(
            ['user_id' => $request->user()->id],
                $validated
            ));
        }
        else {
            $profile->update($validated);
        }

        return response()->json([
            'profile' => $profile->fresh(),
            'completion_rate' => $profile->completionRate(),
        ]);
    }

    /**
     * プロフィール写真アップロード
     */
    public function uploadPhoto(Request $request)
    {
        $request->validate([
            'photo' => ['required', 'image', 'max:10240'], // 10MB
        ]);

        $path = $request->file('photo')->store('profile-photos', 'public');

        $profile = $request->user()->profile;
        if (!$profile) {
            $profile = UserProfile::create([
                'user_id' => $request->user()->id,
                'photo_path' => $path,
            ]);
        } else {
            $profile->update(['photo_path' => $path]);
        }

        return response()->json([
            'photo_path' => $path,
            'completion_rate' => $profile->completionRate(),
        ]);
    }
}
