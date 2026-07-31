<?php

namespace App\Http\Middleware;

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

        View::share('user', $user);
        View::share('permissionCatalog', PermissionCatalog::PAGES);

        return $next($request);
    }
}
