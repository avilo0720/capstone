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

    public static function canAddProcurement(?array $sessionUser): bool
    {
        return self::hasAbility($sessionUser, 'procurement.add')
            || self::hasAbility($sessionUser, 'procurement.edit'); // legacy
    }

    /** @deprecated Use canAddProcurement() */
    public static function canEditProcurement(?array $sessionUser): bool
    {
        return self::canAddProcurement($sessionUser);
    }

    public static function canDeleteProcurement(?array $sessionUser): bool
    {
        return self::hasAbility($sessionUser, 'procurement.delete')
            || self::canManageUsers($sessionUser);
    }

    public static function canActOnProcurementStep(?array $sessionUser, ?string $step): bool
    {
        return self::canAccessPage($sessionUser, 'procurement') && $step !== null;
    }

    public static function canActOnAssignedProcurement(?array $sessionUser, ?int $assignedTo): bool
    {
        if (self::canManageUsers($sessionUser)) {
            return true;
        }

        $userId = (int) ($sessionUser['id'] ?? 0);
        if ($userId <= 0 || !self::canAccessPage($sessionUser, 'procurement')) {
            return false;
        }

        if ($assignedTo === null) {
            return true;
        }

        return $userId === (int) $assignedTo;
    }

    public static function canPrintProcurementSlip(?array $sessionUser, ?int $assignedTo = null, ?int $checkedBy = null): bool
    {
        if (self::canManageUsers($sessionUser) || self::canAddProcurement($sessionUser)) {
            return true;
        }

        $userId = (int) ($sessionUser['id'] ?? 0);
        if ($userId <= 0) {
            return false;
        }

        if ($assignedTo !== null && $userId === (int) $assignedTo) {
            return true;
        }

        if ($checkedBy !== null && $userId === (int) $checkedBy) {
            return true;
        }

        return self::canAccessPage($sessionUser, 'procurement');
    }

    public static function canEditIssuance(?array $sessionUser): bool
    {
        return self::hasAbility($sessionUser, 'issuance.edit');
    }

    public static function canReviewIssuance(?array $sessionUser): bool
    {
        return self::hasAbility($sessionUser, 'issuance.review');
    }

    public static function canDeleteProcurementRequest(?array $sessionUser, ?int $uploadedBy = null): bool
    {
        if (self::canDeleteProcurement($sessionUser)) {
            return true;
        }

        // Legacy: submitters with add (or old edit) can remove their own pending/denied slips.
        if (!self::canAddProcurement($sessionUser)) {
            return false;
        }

        $userId = (int) ($sessionUser['id'] ?? 0);

        return $userId > 0 && $uploadedBy !== null && (int) $uploadedBy === $userId;
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
