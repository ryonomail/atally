<?php

namespace App\Policies;

use App\Models\Job;
use App\Models\User;

class JobPolicy
{
    /**
     * 求人の管理（編集・削除・公開）: 求人を所有する企業のみ
     */
    public function manage(User $user, Job $job): bool
    {
        return $user->isCompany()
            && $user->company !== null
            && $user->company->id === $job->company_id;
    }
}
