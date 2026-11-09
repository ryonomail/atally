<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeadCollectionRun extends Model
{
    protected $fillable = [
        'keyword', 'area', 'sources', 'status', 'found_count', 'new_count',
        'updated_count', 'message', 'admin_id', 'started_at', 'finished_at',
    ];

    protected function casts(): array
    {
        return [
            'sources'     => 'array',
            'started_at'  => 'datetime',
            'finished_at' => 'datetime',
        ];
    }
}
