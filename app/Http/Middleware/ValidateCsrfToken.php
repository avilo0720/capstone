<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken as Middleware;
use Symfony\Component\HttpFoundation\Response;

class ValidateCsrfToken extends Middleware
{
    /**
     * The SPA reads cookies from the page. This app does not use the
     * XSRF-TOKEN cookie, so it must not be written into the browser.
     */
    protected $addHttpCookie = false;

    public function handle($request, \Closure $next)
    {
        $response = parent::handle($request, $next);

        if ($response instanceof Response) {
            $response->headers->clearCookie(
                'XSRF-TOKEN',
                config('session.path') ?: '/',
                config('session.domain'),
                (bool) config('session.secure'),
                false,
                config('session.same_site')
            );
        }

        return $response;
    }
}
