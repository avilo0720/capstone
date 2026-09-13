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

            if (in_array('procurement', $pages, true) && !in_array('issuance', $pages, true)) {
                $pages[] = 'issuance';
                $user['pages'] = $pages;
                $changed = true;
            }

            if (in_array('procurement', $user['pages'] ?? [], true)) {
                if (!in_array('procurement.view', $abilities, true)) {
                    $abilities[] = 'procurement.view';
                    $changed = true;
                }
                $user['abilities'] = $abilities;
            }

            if (in_array('issuance', $user['pages'] ?? [], true)) {
                $abilities = $user['abilities'] ?? [];
                if (!in_array('issuance.view', $abilities, true)) {
                    $abilities[] = 'issuance.view';
                    $changed = true;
                }
                if (!in_array('issuance.edit', $abilities, true)
                    && (in_array('procurement.edit', $abilities, true)
                        || in_array('forecast.view', $abilities, true)
                        || in_array('inventory.edit', $abilities, true))
                ) {
                    $abilities[] = 'issuance.edit';
                    $changed = true;
                }
                if (!in_array('issuance.review', $abilities, true)
                    && (in_array('procurement.review', $abilities, true)
                        || in_array('reports.view', $abilities, true)
                        || in_array('users.manage', $abilities, true))
                ) {
                    $abilities[] = 'issuance.review';
                    $changed = true;
                }
                $user['abilities'] = $abilities;
            }

            $abilities = $user['abilities'] ?? [];
            $user['canEditProcurement'] = in_array('procurement.edit', $abilities, true);
            $user['canReviewProcurement'] = in_array('procurement.review', $abilities, true);
            $user['canDeptReviewProcurement'] = in_array('procurement.review', $abilities, true)
                || in_array('procurement.dept_review', $abilities, true);
            $user['canCheckProcurement'] = in_array('procurement.review', $abilities, true)
                || in_array('procurement.check', $abilities, true);
            $user['canFinalApproveProcurement'] = in_array('procurement.review', $abilities, true)
                || in_array('procurement.final_approve', $abilities, true);
            $user['canEditIssuance'] = in_array('issuance.edit', $abilities, true);
            $user['canReviewIssuance'] = in_array('issuance.review', $abilities, true);

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
