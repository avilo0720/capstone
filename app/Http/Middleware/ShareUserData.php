<?php

namespace App\Http\Middleware;

use App\Support\InventoryContext;
use App\Support\PermissionCatalog;
use App\Support\RolePermissions;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\View;
use Symfony\Component\HttpFoundation\Response;

class ShareUserData
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->session()->get('user');

        // Keep older admin sessions able to open the new Activity Logs page.
        if (is_array($user) && RolePermissions::canManageUsers($user)) {
            $pages = $user['pages'] ?? [];
            $abilities = $user['abilities'] ?? [];
            $changed = false;

            if (!in_array('activity-logs', $pages, true)) {
                $pages[] = 'activity-logs';
                $user['pages'] = $pages;
                $changed = true;
            }
            if (!in_array('activity-logs.view', $abilities, true)) {
                $abilities[] = 'activity-logs.view';
                $user['abilities'] = $abilities;
                $changed = true;
            }

            if ($changed) {
                $request->session()->put('user', $user);
            }
        }

        if (is_array($user)) {
            $pages = $user['pages'] ?? [];
            $abilities = $user['abilities'] ?? [];
            $changed = false;

            if (in_array('forecast', $pages, true) && !in_array('procurement', $pages, true)) {
                $pages[] = 'procurement';
                $user['pages'] = $pages;
                $changed = true;
            }

            if (in_array('procurement', $user['pages'] ?? [], true)) {
                if (!in_array('procurement.view', $abilities, true)) {
                    $abilities[] = 'procurement.view';
                    $changed = true;
                }
                if (!in_array('procurement.edit', $abilities, true)
                    && (in_array('forecast.view', $abilities, true) || in_array('inventory.edit', $abilities, true))
                ) {
                    $abilities[] = 'procurement.edit';
                    $user['canEditProcurement'] = true;
                    $changed = true;
                }
                if (!in_array('procurement.review', $abilities, true)
                    && (in_array('reports.view', $abilities, true) || in_array('users.manage', $abilities, true))
                ) {
                    $abilities[] = 'procurement.review';
                    $user['canReviewProcurement'] = true;
                    $changed = true;
                }
                $user['abilities'] = $abilities;
            }

            $user['canEditProcurement'] = in_array('procurement.edit', $user['abilities'] ?? [], true);
            $user['canReviewProcurement'] = in_array('procurement.review', $user['abilities'] ?? [], true);

            if ($changed) {
                $request->session()->put('user', $user);
            }
        }

        View::share('user', $user);
        View::share('permissionCatalog', PermissionCatalog::PAGES);

        try {
            $inventories = InventoryContext::allowed($request);
            $currentInventory = InventoryContext::current($request);
            if ($currentInventory) {
                InventoryContext::remember($request, $currentInventory);
            }
            View::share('inventories', $inventories);
            View::share('currentInventory', $currentInventory);
        } catch (\Throwable $e) {
            View::share('inventories', collect());
            View::share('currentInventory', null);
        }

        return $next($request);
    }
}
