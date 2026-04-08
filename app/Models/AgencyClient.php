<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AgencyClient extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'client_name',
        'client_description',
        'contact_person',
        'contact_email',
        'contact_phone',
        'address',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function jobs()
    {
        return $this->hasMany(Job::class);
    }
}
