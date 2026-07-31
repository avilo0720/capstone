<?php

use App\Http\Middleware\RequireAbility;
use App\Http\Middleware\RequireAuth;
use App\Http\Middleware\RequirePage;
use App\Http\Middleware\ShareUserData;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
            ShareUserData::class,
        ]);

        $middleware->alias([
            'auth.custom' => RequireAuth::class,
            'page' => RequirePage::class,
            'ability' => RequireAbility::class,
        ]);

        $middleware->validateCsrfTokens(except: [
            'api/*',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
