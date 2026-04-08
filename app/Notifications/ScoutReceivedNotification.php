<?php

namespace App\Notifications;

use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ScoutReceivedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private Application $application,
    ) {}

    public function via(object $notifiable): array
    {
        return $notifiable->email_on_scout ? ['mail'] : [];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $job = $this->application->job;
        $company = $job->company;

        return (new MailMessage)
            ->subject('【Atally】スカウトが届きました')
            ->greeting("{$notifiable->name} 様")
            ->line("{$company->company_name} から「{$job->title}」のスカウトが届きました。")
            ->line($this->application->scout_message ? "メッセージ: {$this->application->scout_message}" : '')
            ->action('スカウトを確認する', url('/applications'))
            ->salutation('Atally');
    }
}
