<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Item extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'itemCode',
        'title',
        'size',
        'category',
        'quantity',
        'price',
        'monthlyDemand',
        'updated',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'price' => 'decimal:2',
        'monthlyDemand' => 'integer',
        'updated' => 'datetime',
    ];
}
