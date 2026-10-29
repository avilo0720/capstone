<?php

use App\Http\Middleware\RequireAbility;
use App\Http\Middleware\RequireAuth;
use App\Http\Middleware\RequirePage;
use App\Http\Middleware\ShareUserData;
use App\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
            ShareUserData::class,
        ], replace: [
            \Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class => ValidateCsrfToken::class,
        ]);

        $middleware->alias([
            'auth.custom' => RequireAuth::class,
            'page' => RequirePage::class,
            'ability' => RequireAbility::class,
        ]);

        // Login has no session to protect yet, and the login page can sit open
        // longer than the session lifetime, so it is the only exemption.
        $middleware->validateCsrfTokens(except: [
            'api/auth/login',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Laravel turns a CSRF token mismatch into an HTTP 419 before this runs.
        $exceptions->render(function (HttpException $e, Request $request) {
            if ($e->getStatusCode() === 419 && $request->is('api/*')) {
                return response()->json([
                    'error' => 'Your session has expired. Please refresh the page and try again.',
                ], 419);
            }
        });
    })->create();
