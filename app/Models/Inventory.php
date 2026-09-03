<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Inventory extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'slug',
        'name',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(Item::class);
    }
}
