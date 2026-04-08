<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobPhoto extends Model
{
    protected $fillable = [
        'job_id',
        'path',
        'caption',
        'sort_order',
    ];

    protected $appends = ['url'];

    public function job()
    {
        return $this->belongsTo(Job::class);
    }

    public function getUrlAttribute(): string
    {
        return asset('storage/' . $this->path);
    }
}
