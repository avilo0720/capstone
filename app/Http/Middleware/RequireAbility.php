<?php

namespace App\Http\Middleware;

use App\Support\RolePermissions;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireAbility
{
    public function handle(Request $request, Closure $next, string $ability): Response
    {
        $user = $request->session()->get('user');

        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        if (!RolePermissions::hasAbility($user, $ability)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        return $next($request);
    }
}
