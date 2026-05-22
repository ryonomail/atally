<?php

namespace App\Policies;

use App\Models\Resume;
use App\Models\User;

class ResumePolicy
{
    /**
     * 履歴書の管理（閲覧・編集・削除）: 作成した求職者本人のみ
     */
    public function manage(User $user, Resume $resume): bool
    {
        return $resume->user_id === $user->id;
    }
}
