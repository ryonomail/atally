<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeadCompany extends Model
{
    public const STATUSES = ['new', 'contacted', 'negotiating', 'won', 'lost', 'excluded'];

    public const SNS_FIELDS = ['instagram', 'twitter', 'facebook', 'tiktok', 'youtube', 'line'];

    protected $fillable = [
        'source', 'external_id', 'name', 'category', 'address', 'phone', 'email',
        'website', 'has_website', 'lat', 'lng', 'google_maps_url', 'rating', 'review_count',
        'instagram', 'twitter', 'facebook', 'tiktok', 'youtube', 'line',
        'status', 'memo', 'search_keyword', 'search_area', 'last_run_id', 'enriched_at',
    ];

    protected function casts(): array
    {
        return [
            'has_website'  => 'boolean',
            'lat'          => 'float',
            'lng'          => 'float',
            'rating'       => 'float',
            'review_count' => 'integer',
            'enriched_at'  => 'datetime',
        ];
    }
}
