<?php

namespace App\Console\Commands;

use App\Models\Job;
use App\Models\JobAlert;
use App\Notifications\JobAlertNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendJobAlertNotifications extends Command
{
    protected $signature = 'app:send-job-alert-notifications';
    protected $description = '求人アラートに一致する新着求人を通知';

    public function handle(): void
    {
        $since = now()->subDay();
        $sent = 0;

        JobAlert::where('is_active', true)
            ->with('user')
            ->chunkById(100, function ($alerts) use ($since, &$sent) {
                foreach ($alerts as $alert) {
                    $query = Job::where('status', 'active')
                        ->where('created_at', '>=', $since);

                    if ($alert->keyword) {
                        $query->where(function ($q) use ($alert) {
                            $q->where('title', 'ilike', "%{$alert->keyword}%")
                              ->orWhere('description', 'ilike', "%{$alert->keyword}%");
                        });
                    }

                    if ($alert->location) {
                        $query->where('prefecture', $alert->location);
                    }

                    if ($alert->employment_type) {
                        $query->where('employment_type', $alert->employment_type);
                    }

                    if ($alert->salary_min) {
                        $query->where('salary_max', '>=', $alert->salary_min);
                    }

                    $matchedJobs = $query->with('company:id,company_name')->get();

                    if ($matchedJobs->isEmpty()) {
                        continue;
                    }

                    $alert->user->notify(
                        new JobAlertNotification($alert->keyword ?? '条件一致', $matchedJobs)
                    );

                    $sent++;
                    Log::info("Job alert notification sent to user #{$alert->user_id} ({$matchedJobs->count()} jobs matched)");
                }
            });

        $this->info("Sent {$sent} job alert notifications.");
    }
}
