<?php

namespace App\Http\Middleware;

use App\Support\RolePermissions;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequirePage
{
    public function handle(Request $request, Closure $next, string $pageName): Response
    {
        $user = $request->session()->get('user');

        if (!$user) {
            if ($request->is('api/*')) {
                return response()->json(['error' => 'Unauthorized'], 401);
            }

            return redirect('/login');
        }

        if (!RolePermissions::canAccessPage($user, $pageName)) {
            if ($request->is('api/*')) {
                return response()->json(['error' => 'Forbidden'], 403);
            }

            return response()->view('forbidden', [
                'title' => 'Access Denied',
                'user' => $user,
            ], 403);
        }

        return $next($request);
    }
}
