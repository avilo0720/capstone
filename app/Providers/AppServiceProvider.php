<?php

namespace App\Providers;

use Illuminate\Foundation\Console\ServeCommand;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Keep PHP_INI_SCAN_DIR on the built-in server child process so pdo_mysql stays loaded.
        if (! in_array('PHP_INI_SCAN_DIR', ServeCommand::$passthroughVariables, true)) {
            ServeCommand::$passthroughVariables[] = 'PHP_INI_SCAN_DIR';
        }
    }
}
