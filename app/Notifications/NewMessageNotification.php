<?php

namespace App\Notifications;

use App\Models\Message;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NewMessageNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private Message $message,
    ) {}

    public function via(object $notifiable): array
    {
        return $notifiable->email_on_message ? ['mail'] : [];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $sender = $this->message->sender;
        $application = $this->message->application;
        $job = $application->job;

        return (new MailMessage)
            ->subject('【Atally】新しいメッセージがあります')
            ->greeting("{$notifiable->name} 様")
            ->line("{$sender->name} から「{$job->title}」に関するメッセージが届きました。")
            ->action('メッセージを確認する', url("/messages/{$application->id}"))
            ->salutation('Atally');
    }
}
