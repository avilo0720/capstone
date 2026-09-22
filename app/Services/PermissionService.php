<?php

namespace App\Services;

use App\Models\Department;
use App\Models\User;
use App\Support\PermissionCatalog;

class PermissionService
{
    public function resolve(User $user): array
    {
        $user->loadMissing(['department.permissions', 'permissions']);

        if ($user->use_custom_permissions) {
            $rows = $user->permissions;
        } elseif ($user->department) {
            $rows = $user->department->permissions;
        } else {
            $rows = collect();
        }

        $abilities = [];
        $pages = [];

        foreach ($rows as $row) {
            $pages[$row->page] = true;
            $abilities[] = $row->page.'.'.$row->ability;
        }

        $abilityList = array_values(array_unique($abilities));
        $canManageUsers = in_array('users.manage', $abilityList, true)
            || in_array('users.view', $abilityList, true);

        // Admins with user access can open Activity Logs without a separate grant.
        if ($canManageUsers && !isset($pages['activity-logs'])) {
            $pages['activity-logs'] = true;
            $abilityList[] = 'activity-logs.view';
            $abilityList = array_values(array_unique($abilityList));
        }

        $pageList = array_values(array_keys($pages));
        $inventories = [];
        foreach (PermissionCatalog::inventoryDatasetSlugs() as $slug) {
            if (isset($pages[$slug])) {
                $inventories[] = $slug;
            }
        }

        return [
            'pages' => $pageList,
            'abilities' => $abilityList,
            'inventories' => $inventories,
            'canEdit' => in_array('inventory.edit', $abilityList, true),
            'canManageUsers' => $canManageUsers,
            'canViewCalendarTable' => in_array('calendar.table', $abilityList, true),
            'canEditProcurement' => in_array('procurement.add', $abilityList, true)
                || in_array('procurement.edit', $abilityList, true),
            'canAddProcurement' => in_array('procurement.add', $abilityList, true)
                || in_array('procurement.edit', $abilityList, true),
            'canDeleteProcurement' => in_array('procurement.delete', $abilityList, true),
            'canEditIssuance' => in_array('issuance.edit', $abilityList, true),
            'canReviewIssuance' => in_array('issuance.review', $abilityList, true),
        ];
    }

    public function sessionPayload(User $user): array
    {
        $user->loadMissing('department');
        $resolved = $this->resolve($user);

        return [
            'id' => $user->id,
            'username' => $user->username,
            'firstName' => $user->first_name,
            'lastName' => $user->last_name,
            'fullName' => $user->full_name,
            'birthday' => $user->birthday?->format('Y-m-d'),
            'profilePicture' => $user->profile_picture_url,
            'role' => $user->role,
            'departmentId' => $user->department_id,
            'departmentName' => $user->department?->name,
            'useCustomPermissions' => (bool) $user->use_custom_permissions,
            'pages' => $resolved['pages'],
            'abilities' => $resolved['abilities'],
            'inventories' => $resolved['inventories'],
            'canEdit' => $resolved['canEdit'],
            'canManageUsers' => $resolved['canManageUsers'],
            'canViewCalendarTable' => $resolved['canViewCalendarTable'],
            'canEditProcurement' => $resolved['canEditProcurement'],
            'canAddProcurement' => $resolved['canAddProcurement'],
            'canDeleteProcurement' => $resolved['canDeleteProcurement'],
            'canEditIssuance' => $resolved['canEditIssuance'],
            'canReviewIssuance' => $resolved['canReviewIssuance'],
        ];
    }

    public function syncDepartmentPermissions(Department $department, array $permissions): void
    {
        $normalized = PermissionCatalog::normalize($permissions);
        $department->permissions()->delete();

        foreach ($normalized as $row) {
            $department->permissions()->create($row);
        }
    }

    public function syncUserPermissions(User $user, array $permissions): void
    {
        $normalized = PermissionCatalog::normalize($permissions);
        $user->permissions()->delete();

        foreach ($normalized as $row) {
            $user->permissions()->create($row);
        }
    }

    public function permissionRowsFromFlags(array $pageFlags): array
    {
        $rows = [];

        foreach ($pageFlags as $page => $flags) {
            if (!isset(PermissionCatalog::PAGES[$page])) {
                continue;
            }

            $allowed = PermissionCatalog::PAGES[$page]['abilities'];
            $anyGranted = false;
            foreach ($allowed as $ability) {
                if (empty($flags[$ability])) {
                    continue;
                }
                $anyGranted = true;
                $rows[] = ['page' => $page, 'ability' => $ability];
            }
            if ($anyGranted || !empty($flags['view'])) {
                $rows[] = ['page' => $page, 'ability' => 'view'];
            }
        }

        return PermissionCatalog::normalize($rows);
    }
}
