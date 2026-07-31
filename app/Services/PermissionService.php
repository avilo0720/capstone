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

        return [
            'pages' => $pageList,
            'abilities' => $abilityList,
            'canEdit' => in_array('inventory.edit', $abilityList, true),
            'canManageUsers' => $canManageUsers,
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
            'canEdit' => $resolved['canEdit'],
            'canManageUsers' => $resolved['canManageUsers'],
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

            $canView = !empty($flags['view']) || !empty($flags['edit']) || !empty($flags['manage']);
            $canEdit = !empty($flags['edit']);
            $canManage = !empty($flags['manage']);

            if ($canView) {
                $rows[] = ['page' => $page, 'ability' => 'view'];
            }
            if ($canEdit && in_array('edit', PermissionCatalog::PAGES[$page]['abilities'], true)) {
                $rows[] = ['page' => $page, 'ability' => 'edit'];
            }
            if ($canManage && in_array('manage', PermissionCatalog::PAGES[$page]['abilities'], true)) {
                $rows[] = ['page' => $page, 'ability' => 'manage'];
            }
        }

        return PermissionCatalog::normalize($rows);
    }
}
