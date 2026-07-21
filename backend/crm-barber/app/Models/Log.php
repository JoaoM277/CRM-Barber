<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Log extends Model
{
    protected $fillable = [
        'action',
        'model',
        'user_id',
        'description',
        'ip'
    ];


    public function user()
    {
        return $this->belongsTo(Client::class);
    }
}
