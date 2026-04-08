<?php

namespace App\Notifications;

use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NewApplicationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private Application $application,
    ) {}

    public function via(object $notifiable): array
    {
        return $notifiable->email_on_new_application ? ['mail'] : [];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $job = $this->application->job;
        $applicant = $this->application->user;

        return (new MailMessage)
            ->subject('【Atally】新しい応募がありました')
            ->greeting("{$notifiable->name} 様")
            ->line("「{$job->title}」に新しい応募がありました。")
            ->line("応募者: {$applicant->name}")
            ->action('応募を確認する', url("/company/jobs/{$job->id}/applications"))
            ->salutation('Atally');
    }
}
