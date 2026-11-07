<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalesLead extends Model
{
    protected $fillable = [
        'google_place_id',
        'company_name',
        'industry_category',
        'prefecture',
        'address',
        'phone',
        'website_url',
        'email',
        'instagram_url',
        'facebook_url',
        'tiktok_url',
        'raw_place_types',
        'status',
        'exclusion_reason',
        'source',
        'discovered_at',
    ];

    protected $casts = [
        'raw_place_types' => 'array',
        'discovered_at' => 'datetime',
    ];
}
