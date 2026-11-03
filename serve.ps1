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

# With a certificate in conf\https (see scripts\make-https-cert.ps1), XAMPP's Apache serves
# the app at https://<host>/ and redirects the old http://<host>:8000 address there.
$XamppHttpd = 'C:\xampp\apache\bin\httpd.exe'
$HttpsConf = Join-Path $Root 'conf\apache\httpd-https.conf'
$HttpsDir = Join-Path $Root 'conf\https'
if ((Test-Path (Join-Path $HttpsDir 'server.crt')) -and (Test-Path (Join-Path $HttpsDir 'server.key')) -and (Test-Path $XamppHttpd)) {
    $env:NAWAD_APP_ROOT = $Root -replace '\\', '/'
    $hostFile = Join-Path $HttpsDir 'host.txt'
    $env:NAWAD_HOST = if (Test-Path $hostFile) { (Get-Content $hostFile -Raw).Trim() } else { 'localhost' }

    & $XamppHttpd -t -f $HttpsConf
    if ($LASTEXITCODE -ne 0) {
        throw "Apache rejected $HttpsConf (see the message above)."
    }

    Write-Host "Starting app at https://$($env:NAWAD_HOST)/ (http://$($env:NAWAD_HOST):8000 redirects there) ..."
    Write-Host 'Press Ctrl+C to stop.'
    & $XamppHttpd -f $HttpsConf
    return
}
$LaravelRouter = Join-Path $Root 'vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php'
if (-not (Test-Path $LaravelRouter)) {
    throw "Laravel server router not found at $LaravelRouter. Run composer install first."
}
# Wraps Laravel's router and lets browsers cache versioned (?v=) scripts and styles.
$ServerRouter = Join-Path $Root 'scripts\dev-server-router.php'

Write-Host "Using PHP: $Php"
Write-Host 'Starting app at http://127.0.0.1:8000 ...'
Write-Host 'Press Ctrl+C to stop.'

# cwd must be public/ — Laravel's server.php uses getcwd() as the docroot.
Set-Location (Join-Path $Root 'public')
& $Php -S 0.0.0.0:8000 $ServerRouter
