<?php

namespace App\Mail;

use App\Models\Job;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class StalledJobWarning extends Mailable
{
    use Queueable, SerializesModels;

    public Job $job;
    public int $stalledDays;

    public function __construct(Job $job, int $stalledDays)
    {
        $this->job = $job;
        $this->stalledDays = $stalledDays;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '【Atally】求人への応募が未対応です',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.stalled-job-warning',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
