<?php

namespace App\Providers;

use App\Models\Application;
use App\Models\InterviewSchedule;
use App\Models\Job;
use App\Models\Resume;
use App\Policies\ApplicationPolicy;
use App\Policies\InterviewSchedulePolicy;
use App\Policies\JobPolicy;
use App\Policies\ResumePolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        if (config('app.env') === 'production') {
            URL::forceScheme('https');
        }

        Gate::policy(Job::class, JobPolicy::class);
        Gate::policy(Resume::class, ResumePolicy::class);
        Gate::policy(Application::class, ApplicationPolicy::class);
        Gate::policy(InterviewSchedule::class, InterviewSchedulePolicy::class);
    }
}
