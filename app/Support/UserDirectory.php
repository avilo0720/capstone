<?php

namespace App\Support;

use App\Models\User;
use Throwable;

class UserDirectory
{
    public static function assignees(): array
    {
        try {
            return User::query()
                ->with('department')
                ->orderBy('last_name')
                ->orderBy('first_name')
                ->get(['id', 'first_name', 'last_name', 'username', 'role', 'department_id'])
                ->map(fn (User $user) => [
                    'id' => (int) $user->id,
                    'name' => trim((string) $user->full_name) ?: (string) $user->username,
                    'role' => $user->role,
                    'department' => $user->department?->name,
                ])
                ->values()
                ->all();
        } catch (Throwable $e) {
            report($e);

            return [];
        }
    }
}
