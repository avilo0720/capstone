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

    public static function canViewCalendarTable(?array $sessionUser): bool
    {
        return self::hasAbility($sessionUser, 'calendar.table');
    }

    public static function canEditProcurement(?array $sessionUser): bool
    {
        return self::hasAbility($sessionUser, 'procurement.edit');
    }

    public static function canReviewProcurement(?array $sessionUser): bool
    {
        return self::hasAbility($sessionUser, 'procurement.review');
    }

    public static function canEditIssuance(?array $sessionUser): bool
    {
        return self::hasAbility($sessionUser, 'issuance.edit');
    }

    public static function canReviewIssuance(?array $sessionUser): bool
    {
        return self::hasAbility($sessionUser, 'issuance.review');
    }

    public static function canDeleteProcurementRequest(?array $sessionUser, ?int $uploadedBy): bool
    {
        return self::canDeleteSubmittedRequest(
            $sessionUser,
            $uploadedBy,
            self::canReviewProcurement($sessionUser),
            self::canEditProcurement($sessionUser),
        );
    }

    public static function canDeleteIssuanceRequest(?array $sessionUser, ?int $uploadedBy): bool
    {
        return self::canDeleteSubmittedRequest(
            $sessionUser,
            $uploadedBy,
            self::canReviewIssuance($sessionUser),
            self::canEditIssuance($sessionUser),
        );
    }

    private static function canDeleteSubmittedRequest(
        ?array $sessionUser,
        ?int $uploadedBy,
        bool $isReviewer,
        bool $canEdit,
    ): bool {
        if (self::canManageUsers($sessionUser) || $isReviewer) {
            return true;
        }

        if (!$canEdit) {
            return false;
        }

        $userId = (int) ($sessionUser['id'] ?? 0);

        return $userId > 0 && $uploadedBy !== null && (int) $uploadedBy === $userId;
    }
}
