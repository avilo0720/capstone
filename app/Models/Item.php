<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Item extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'inventory_id',
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

    public static function catalogForInventory(int $inventoryId)
    {
        return static::query()
            ->where('inventory_id', $inventoryId)
            ->get()
            ->sortBy(function (self $item) {
                preg_match('/(\d+)/', (string) ($item->itemCode ?? ''), $matches);

                return sprintf('%010d-%010d', (int) ($matches[1] ?? 0), (int) $item->id);
            })
            ->values();
    }
}
