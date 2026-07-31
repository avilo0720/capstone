<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Transaction extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'itemId',
        'action',
        'quantity',
        'transactionDate',
        'created_at',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'transactionDate' => 'datetime',
        'created_at' => 'datetime',
    ];
}
