<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    use HasFactory;

    protected $fillable = [
        'application_id',
        'sender_id',
        'body',
        'read_at',
        'attachment_path',
        'attachment_name',
    ];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
        ];
    }

    public function application()
    {
        return $this->belongsTo(Application::class);
    }

    public function sender()
    {
        return $this->belongsTo(User::class , 'sender_id');
    }

    public function isRead(): bool
    {
        return $this->read_at !== null;
    }
}
