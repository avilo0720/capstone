<?php

// Merged with Laravel's built-in cache config. Login throttling uses the
// file store so it works without a `cache` database table.
return [
    'limiter' => env('CACHE_LIMITER_STORE', 'file'),
];
