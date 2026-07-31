<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class User extends Model
{
    const CREATED_AT = 'created';
    const UPDATED_AT = 'updated';

    protected $fillable = [
        'first_name',
        'last_name',
        'username',
        'birthday',
        'profile_picture',
        'password',
        'role',
        'department_id',
        'use_custom_permissions',
    ];

    public function getProfilePictureUrlAttribute(): ?string
    {
        if (!$this->profile_picture) {
            return null;
        }

        return '/uploads/profiles/'.$this->profile_picture;
    }

    protected $hidden = [
        'password',
    ];

    protected $casts = [
        'birthday' => 'date',
        'use_custom_permissions' => 'boolean',
    ];

    protected $appends = [
        'full_name',
    ];

    public function getFullNameAttribute(): string
    {
        return trim($this->first_name.' '.$this->last_name);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function permissions(): HasMany
    {
        return $this->hasMany(UserPermission::class);
    }
}
