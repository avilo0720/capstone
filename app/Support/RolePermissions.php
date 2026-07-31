<?php

namespace App\Support;

/**
 * Session-based permission helpers.
 * Effective pages/abilities are resolved at login and stored on the session user.
 */
class RolePermissions
{
    public const SESSION_MAX_AGE_MS = 15 * 60 * 1000;

    public static function canEdit(?array $sessionUser): bool
    {
        return (bool) ($sessionUser['canEdit'] ?? false);
    }

    public static function canAccessPage(?array $sessionUser, string $page): bool
    {
        return in_array($page, $sessionUser['pages'] ?? [], true);
    }

    public static function hasAbility(?array $sessionUser, string $ability): bool
    {
        return in_array($ability, $sessionUser['abilities'] ?? [], true);
    }

    public static function canManageUsers(?array $sessionUser): bool
    {
        return self::hasAbility($sessionUser, 'users.manage')
            || self::hasAbility($sessionUser, 'users.view');
    }

    public static function canViewActivityLogs(?array $sessionUser): bool
    {
        return self::canAccessPage($sessionUser, 'activity-logs')
            || self::canManageUsers($sessionUser);
    }
}
