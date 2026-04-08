<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;

class JobAlertNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private string $alertKeyword,
        private Collection $matchedJobs,
    ) {}

    public function via(object $notifiable): array
    {
        return $notifiable->email_on_job_alert ? ['mail'] : [];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $count = $this->matchedJobs->count();

        $mail = (new MailMessage)
            ->subject("【Atally】「{$this->alertKeyword}」の新着求人 {$count}件")
            ->greeting("{$notifiable->name} 様")
            ->line("あなたが登録したキーワード「{$this->alertKeyword}」に一致する新着求人が{$count}件あります。");

        foreach ($this->matchedJobs->take(5) as $job) {
            $mail->line("・ {$job->title}（{$job->company->company_name}）");
        }

        if ($count > 5) {
            $mail->line("...ほか " . ($count - 5) . " 件");
        }

        return $mail
            ->action('求人を検索する', url('/jobs?keyword=' . urlencode($this->alertKeyword)))
            ->salutation('Atally');
    }
}
