<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProcurementRequest extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_DEPT_NOTED = 'dept_noted';
    public const STATUS_CHECKED = 'procurement_checked';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_DENIED = 'denied';
    public const STATUS_STOCK_ENTERED = 'stock_entered';

    public const STEP_DEPT = 'dept';
    public const STEP_CHECK = 'check';
    public const STEP_MANAGER = 'manager';

    protected $fillable = [
        'inventory_id',
        'department_id',
        'rs_number',
        'status',
        'source',
        'original_filename',
        'amc_mode',
        'destination',
        'purpose',
        'date_needed',
        'uploaded_by',
        'requested_signature',
        'attachment_image',
        'assigned_to',
        'reviewed_by',
        'reviewed_at',
        'noted_by',
        'noted_at',
        'noted_signature',
        'checked_by',
        'checked_at',
        'checked_signature',
        'approved_by',
        'approved_at',
        'approved_signature',
        'printed_at',
        'rejection_reason',
        'previous_rejection_reason',
        'stock_applied_at',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'noted_at' => 'datetime',
        'checked_at' => 'datetime',
        'approved_at' => 'datetime',
        'printed_at' => 'datetime',
        'date_needed' => 'date',
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

    public function assignedToUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function notedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'noted_by');
    }

    public function checkedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by');
    }

    public function approvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
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

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    public function canReceiveStock(): bool
    {
        return in_array($this->status, [self::STATUS_APPROVED, self::STATUS_STOCK_ENTERED], true)
            && $this->stock_applied_at === null;
    }

    public function stockAlreadyApplied(): bool
    {
        return $this->stock_applied_at !== null;
    }

    public function isInWorkflow(): bool
    {
        return in_array($this->status, [
            self::STATUS_PENDING,
            self::STATUS_DEPT_NOTED,
            self::STATUS_CHECKED,
        ], true);
    }

    public function currentStep(): ?string
    {
        return match ($this->status) {
            self::STATUS_PENDING => self::STEP_DEPT,
            self::STATUS_DEPT_NOTED => self::STEP_CHECK,
            self::STATUS_CHECKED => self::STEP_MANAGER,
            default => null,
        };
    }

    public function nextStatus(): ?string
    {
        return match ($this->status) {
            self::STATUS_PENDING => self::STATUS_DEPT_NOTED,
            self::STATUS_DEPT_NOTED => self::STATUS_CHECKED,
            self::STATUS_CHECKED => self::STATUS_APPROVED,
            default => null,
        };
    }

    public static function makeRsNumber(int $sequence, $when = null): string
    {
        $stamp = ($when ? \Illuminate\Support\Carbon::parse($when) : now())->format('Y-m');

        return sprintf('NB-%s-%05d', $stamp, $sequence);
    }

    /**
     * Next RS number for the month, reusing the lowest free sequence
     * (so denied/deleted slips do not permanently skip numbers).
     * Call inside a DB transaction so lockForUpdate is effective.
     */
    public static function allocateRsNumber($when = null, ?int $inventoryId = null): string
    {
        $when = $when ? \Illuminate\Support\Carbon::parse($when) : now();
        $stamp = $when->format('Y-m');
        $prefix = 'NB-'.$stamp.'-';

        $query = static::query()
            ->whereNotNull('rs_number')
            ->where('rs_number', 'like', $prefix.'%');

        if ($inventoryId) {
            $query->where('inventory_id', $inventoryId);
        }

        $used = $query
            ->lockForUpdate()
            ->pluck('rs_number')
            ->map(function (?string $rs) use ($prefix) {
                if (!$rs || !str_starts_with($rs, $prefix)) {
                    return null;
                }
                $seq = (int) substr($rs, strlen($prefix));

                return $seq > 0 ? $seq : null;
            })
            ->filter()
            ->unique()
            ->sort()
            ->values()
            ->all();

        $next = 1;
        foreach ($used as $seq) {
            if ((int) $seq === $next) {
                $next++;
                continue;
            }
            if ((int) $seq > $next) {
                break;
            }
        }

        return self::makeRsNumber($next, $when);
    }

    public function signatureUrl(?string $filename): ?string
    {
        if (!$filename) {
            return null;
        }

        return '/uploads/procurement-signatures/'.$filename;
    }

    public function attachmentUrl(): ?string
    {
        if (!$this->attachment_image) {
            return null;
        }

        return '/uploads/procurement-attachments/'.$this->attachment_image;
    }
}
