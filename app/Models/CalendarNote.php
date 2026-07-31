<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CalendarNote extends Model
{
    public const COLORS = [
        'blue',
        'green',
        'amber',
        'red',
        'purple',
        'teal',
        'pink',
        'slate',
    ];

    protected $fillable = [
        'created_by',
        'title',
        'body',
        'color',
        'note_date',
        'end_date',
    ];

    protected $casts = [
        'note_date' => 'date',
        'end_date' => 'date',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(
            Department::class,
            'calendar_note_departments',
            'calendar_note_id',
            'department_id'
        );
    }

    public function viewers(): BelongsToMany
    {
        return $this->belongsToMany(
            User::class,
            'calendar_note_users',
            'calendar_note_id',
            'user_id'
        );
    }

    public function scopeVisibleTo(Builder $query, array $sessionUser): Builder
    {
        $userId = (int) ($sessionUser['id'] ?? 0);
        $departmentId = $sessionUser['departmentId'] ?? null;

        return $query->where(function (Builder $q) use ($userId, $departmentId) {
            $q->where('created_by', $userId)
                ->orWhereHas('viewers', fn (Builder $v) => $v->where('users.id', $userId));

            if ($departmentId) {
                $q->orWhereHas(
                    'departments',
                    fn (Builder $d) => $d->where('departments.id', (int) $departmentId)
                );
            }
        });
    }
}
