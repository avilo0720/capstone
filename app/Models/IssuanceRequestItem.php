<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IssuanceRequestItem extends Model
{
    protected $fillable = [
        'issuance_request_id',
        'item_id',
        'item_code',
        'title',
        'size',
        'current_qty',
        'amc',
        'need_3m',
        'need_6m',
        'need_1y',
        'method',
        'requested_qty',
        'applied_qty',
    ];

    protected $casts = [
        'current_qty' => 'integer',
        'amc' => 'decimal:2',
        'need_3m' => 'integer',
        'need_6m' => 'integer',
        'need_1y' => 'integer',
        'requested_qty' => 'integer',
        'applied_qty' => 'integer',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(IssuanceRequest::class, 'issuance_request_id');
    }

    public function catalogItem(): BelongsTo
    {
        return $this->belongsTo(Item::class, 'item_id');
    }
}
