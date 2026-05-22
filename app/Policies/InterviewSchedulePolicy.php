<?php

namespace App\Policies;

use App\Models\InterviewSchedule;
use App\Models\User;

class InterviewSchedulePolicy
{
    /**
     * 面接日程の閲覧: 応募者本人 または 求人を所有する企業
     */
    public function view(User $user, InterviewSchedule $schedule): bool
    {
        $application = $schedule->application;

        if ($user->isJobSeeker()) {
            return $application->user_id === $user->id;
        }

        if ($user->isCompany() && $user->company) {
            return $application->job->company_id === $user->company->id;
        }

        return false;
    }

    /**
     * 面接日程の作成・変更: 求人を所有する企業のみ
     */
    public function manage(User $user, InterviewSchedule $schedule): bool
    {
        return $user->isCompany()
            && $user->company !== null
            && $schedule->application->job->company_id === $user->company->id;
    }
}
