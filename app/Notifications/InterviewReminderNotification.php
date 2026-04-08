<?php

namespace App\Notifications;

use App\Models\InterviewSchedule;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InterviewReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private InterviewSchedule $schedule,
        private string $timing, // 'day_before' or 'day_of'
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $job = $this->schedule->application->job;
        $date = $this->schedule->scheduled_at->format('Y年n月j日 H:i');
        $isTomorrow = $this->timing === 'day_before';

        $mail = (new MailMessage)
            ->subject('【Atally】面接リマインダー')
            ->greeting("{$notifiable->name} 様")
            ->line($isTomorrow ? "明日、面接が予定されています。" : "本日、面接が予定されています。")
            ->line("求人: {$job->title}")
            ->line("日時: {$date}");

        if ($this->schedule->location) {
            $mail->line("場所: {$this->schedule->location}");
        }

        if ($this->schedule->meeting_url) {
            $mail->action('オンライン面接に参加', $this->schedule->meeting_url);
        } else {
            $mail->action('詳細を確認する', url('/applications'));
        }

        return $mail->salutation('Atally');
    }
}
