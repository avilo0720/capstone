<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $fillable = [
        'id',
        'title',
        'description',
        'updated',
    ];

    protected $casts = [
        'updated' => 'datetime',
    ];
}
