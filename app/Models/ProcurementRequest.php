<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProcurementRequest extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_DENIED = 'denied';
    public const STATUS_STOCK_ENTERED = 'stock_entered';

    protected $fillable = [
        'inventory_id',
        'status',
        'source',
        'original_filename',
        'amc_mode',
        'uploaded_by',
        'reviewed_by',
        'reviewed_at',
        'rejection_reason',
        'previous_rejection_reason',
        'stock_applied_at',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'stock_applied_at' => 'datetime',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(ProcurementRequestItem::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function inventory(): BelongsTo
    {
        return $this->belongsTo(Inventory::class);
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isDenied(): bool
    {
        return $this->status === self::STATUS_DENIED;
    }

    public function stockAlreadyApplied(): bool
    {
        return $this->stock_applied_at !== null;
    }
}
