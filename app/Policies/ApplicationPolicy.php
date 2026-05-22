<?php

namespace App\Policies;

use App\Models\Application;
use App\Models\User;

class ApplicationPolicy
{
    /**
     * 応募の閲覧: 応募した求職者 または 求人を所有する企業
     */
    public function view(User $user, Application $application): bool
    {
        if ($user->isJobSeeker()) {
            return $application->user_id === $user->id;
        }

        if ($user->isCompany() && $user->company) {
            return $application->job->company_id === $user->company->id;
        }

        return false;
    }

    /**
     * 応募ステータス変更: 求人を所有する企業のみ
     */
    public function updateStatus(User $user, Application $application): bool
    {
        return $user->isCompany()
            && $user->company !== null
            && $application->job->company_id === $user->company->id;
    }

    /**
     * スカウト応募の操作: 対象の求職者本人のみ
     */
    public function manageScout(User $user, Application $application): bool
    {
        return $application->user_id === $user->id
            && $application->type === 'scout';
    }
}
