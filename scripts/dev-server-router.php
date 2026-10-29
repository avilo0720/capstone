<?php

/**
 * Router for PHP's built-in server (started by serve.ps1).
 *
 * The built-in server handles one request at a time and sends no caching headers,
 * so every page used to re-download every script. Scripts and stylesheets requested
 * with a ?v= version tag never change for that tag, so browsers may keep them.
 * Everything else goes through Laravel's normal router.
 */
$publicPath = realpath(getcwd());
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '');
$file = $uri !== '/' ? realpath($publicPath.$uri) : false;

$versionedTypes = [
    'js' => 'text/javascript; charset=UTF-8',
    'css' => 'text/css; charset=UTF-8',
];
$extension = $file ? strtolower(pathinfo($file, PATHINFO_EXTENSION)) : '';

if (
    isset($_GET['v'])
    && $file !== false
    && is_file($file)
    && str_starts_with($file, $publicPath.DIRECTORY_SEPARATOR)
    && isset($versionedTypes[$extension])
) {
    header('Content-Type: '.$versionedTypes[$extension]);
    header('Content-Length: '.filesize($file));
    header('Cache-Control: public, max-age=31536000, immutable');
    readfile($file);

    return true;
}

return require __DIR__.'/../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php';
