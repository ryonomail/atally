<?php

namespace App\Console\Commands;

use App\Models\InterviewSchedule;
use App\Notifications\InterviewReminderNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendInterviewReminders extends Command
{
    protected $signature = 'app:send-interview-reminders';
    protected $description = '面接前日・当日のリマインドメール送信';

    public function handle(): void
    {
        $tomorrow = now()->addDay()->toDateString();
        $today = now()->toDateString();
        $sent = 0;

        // 前日リマインド
        InterviewSchedule::where('confirmed', true)
            ->where('reminder_day_before_sent', false)
            ->whereDate('scheduled_at', $tomorrow)
            ->with('application.user', 'application.job.company.user')
            ->each(function ($schedule) use (&$sent) {
                $this->sendReminder($schedule, 'day_before');
                $schedule->update(['reminder_day_before_sent' => true]);
                $sent++;
            });

        // 当日リマインド
        InterviewSchedule::where('confirmed', true)
            ->where('reminder_day_of_sent', false)
            ->whereDate('scheduled_at', $today)
            ->with('application.user', 'application.job.company.user')
            ->each(function ($schedule) use (&$sent) {
                $this->sendReminder($schedule, 'day_of');
                $schedule->update(['reminder_day_of_sent' => true]);
                $sent++;
            });

        $this->info("Sent {$sent} interview reminders.");
    }

    private function sendReminder(InterviewSchedule $schedule, string $timing): void
    {
        $notification = new InterviewReminderNotification($schedule, $timing);

        // 求職者に送信
        $jobseeker = $schedule->application->user;
        if ($jobseeker) {
            $jobseeker->notify($notification);
            Log::info("Interview reminder ({$timing}) sent to jobseeker #{$jobseeker->id} for schedule #{$schedule->id}");
        }

        // 企業担当者にも送信
        $companyUser = $schedule->application->job->company->user;
        if ($companyUser) {
            $companyUser->notify($notification);
            Log::info("Interview reminder ({$timing}) sent to company user #{$companyUser->id} for schedule #{$schedule->id}");
        }
    }
}
