<?php

namespace App\Support;

class PermissionCatalog
{
    /**
     * Available pages and the abilities that can be granted on each.
     * view  = can open the page / related read APIs
     * edit  = can mutate data on that page
     * manage = admin-level control (users page)
     */
    public const PAGES = [
        'dashboard' => [
            'label' => 'Dashboard',
            'abilities' => ['view'],
        ],
        'inventory' => [
            'label' => 'Inventory',
            'abilities' => ['view', 'edit'],
        ],
        'forecast' => [
            'label' => 'Forecasting',
            'abilities' => ['view'],
        ],
        'reports' => [
            'label' => 'Reports',
            'abilities' => ['view'],
        ],
        'calendar' => [
            'label' => 'Calendar',
            'abilities' => ['view'],
        ],
        'activity-logs' => [
            'label' => 'Activity Logs',
            'abilities' => ['view'],
        ],
        'users' => [
            'label' => 'Users',
            'abilities' => ['view', 'manage'],
        ],
    ];

    public static function pageKeys(): array
    {
        return array_keys(self::PAGES);
    }

    public static function isValid(string $page, string $ability): bool
    {
        $pageDef = self::PAGES[$page] ?? null;

        return $pageDef && in_array($ability, $pageDef['abilities'], true);
    }

    public static function normalize(array $permissions): array
    {
        $normalized = [];

        foreach ($permissions as $entry) {
            $page = $entry['page'] ?? null;
            $ability = $entry['ability'] ?? null;

            if (!$page || !$ability || !self::isValid($page, $ability)) {
                continue;
            }

            // view is implied when edit/manage is granted
            if ($ability !== 'view') {
                $normalized[] = ['page' => $page, 'ability' => 'view'];
            }

            $normalized[] = ['page' => $page, 'ability' => $ability];
        }

        $unique = [];
        foreach ($normalized as $row) {
            $key = $row['page'].'.'.$row['ability'];
            $unique[$key] = $row;
        }

        return array_values($unique);
    }
}
