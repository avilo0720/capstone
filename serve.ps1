# Starts XAMPP MySQL (if needed) and the Laravel app using XAMPP PHP.
# After a reboot, use this instead of `php artisan serve` so login works.
$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$XamppPhp = 'C:\xampp\php\php.exe'
$XamppMysql = 'C:\xampp\mysql\bin\mysqld.exe'
$MysqlIni = 'C:\xampp\mysql\bin\my.ini'

function Test-MysqlPort {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect('127.0.0.1', 3306, $null, $null)
        $ok = $async.AsyncWaitHandle.WaitOne(500)
        if ($ok -and $client.Connected) {
            $client.Close()
            return $true
        }
        $client.Close()
    } catch {
        # ignore
    }
    return $false
}

function Start-XamppMysql {
    if (Test-MysqlPort) {
        Write-Host 'MySQL already running on port 3306.'
        return
    }

    if (-not (Test-Path $XamppMysql)) {
        throw "MySQL not found at $XamppMysql. Start MySQL from XAMPP Control Panel, then run this script again."
    }

    Write-Host 'Starting XAMPP MySQL...'
    Start-Process -FilePath $XamppMysql -ArgumentList @(
        "--defaults-file=$MysqlIni",
        '--standalone'
    ) -WindowStyle Hidden

    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        if (Test-MysqlPort) {
            Write-Host 'MySQL is ready.'
            return
        }
        Start-Sleep -Milliseconds 500
    }

    throw 'MySQL did not become ready on port 3306 within 30 seconds. Open XAMPP Control Panel and start MySQL.'
}

function Resolve-PhpExe {
    if (Test-Path $XamppPhp) {
        # Prefer XAMPP PHP: system PHP often lacks/blocks mbstring & pdo_mysql after reboot.
        # Avoid loading the user PHP_INI_SCAN_DIR extras (they target system PHP).
        Remove-Item Env:PHP_INI_SCAN_DIR -ErrorAction SilentlyContinue
        return $XamppPhp
    }

    $phpConfD = Join-Path $env:USERPROFILE 'php-conf.d'
    if (-not (Test-Path $phpConfD)) {
        New-Item -ItemType Directory -Path $phpConfD | Out-Null
    }
    $extraIni = Join-Path $phpConfD '99-mysql.ini'
    if (-not (Test-Path $extraIni)) {
        Set-Content -Path $extraIni -Value "extension=pdo_mysql`nextension=mysqli`nextension=mbstring`n"
    }
    $env:PHP_INI_SCAN_DIR = ";$phpConfD"
    return 'php'
}

Set-Location $Root
Start-XamppMysql

$Php = Resolve-PhpExe
$ServerRouter = Join-Path $Root 'vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php'
if (-not (Test-Path $ServerRouter)) {
    throw "Laravel server router not found at $ServerRouter. Run composer install first."
}

Write-Host "Using PHP: $Php"
Write-Host 'Starting app at http://127.0.0.1:8000 ...'
Write-Host 'Press Ctrl+C to stop.'

# cwd must be public/ — Laravel's server.php uses getcwd() as the docroot.
Set-Location (Join-Path $Root 'public')
& $Php -S 127.0.0.1:8000 $ServerRouter
