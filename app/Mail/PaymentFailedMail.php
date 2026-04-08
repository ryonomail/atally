<?php

namespace App\Mail;

use App\Models\Company;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PaymentFailedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Company $company,
        public int     $amount,
        public string  $targetName,  // 求人名 or キャンペーン名
        public string  $targetType,  // 'job' or 'campaign'
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '【Atally】決済に失敗しました — 掲載が一時停止されました',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.payment-failed',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
