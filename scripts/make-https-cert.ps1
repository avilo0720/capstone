# Makes the HTTPS certificate that conf/apache/httpd-https.conf uses, signed by a small
# certificate authority (CA) of your own. Browsers trust the site once the CA's
# certificate (nawad-local-ca.crt) is installed as a trusted root on that device.
#
#   .\scripts\make-https-cert.ps1 -Names 192.168.1.209,DESKTOP-NGE4SG1,localhost,127.0.0.1
#
# The CA is created on first run and reused afterwards; keep its folder private and
# outside the app, since its key can sign certificates for any site.
param(
    [Parameter(Mandatory = $true)][string[]]$Names,
    [string]$CaDir = (Join-Path $env:USERPROFILE 'nawad-https-ca'),
    [string]$OutDir = (Join-Path (Split-Path $PSScriptRoot -Parent) 'conf\https'),
    [int]$Days = 825
)
$ErrorActionPreference = 'Stop'
$OpenSsl = 'C:\xampp\apache\bin\openssl.exe'
if (-not (Test-Path $OpenSsl)) { throw "OpenSSL not found at $OpenSsl." }

function Invoke-OpenSsl {
    # OpenSSL reports progress on stderr, which Windows PowerShell would treat as an error.
    $ErrorActionPreference = 'Continue'
    $output = & $OpenSsl @args 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) { throw "openssl $($args[0]) failed:`n$($output -join "`n")" }
}

New-Item -ItemType Directory -Force $CaDir, $OutDir | Out-Null
$caKey = Join-Path $CaDir 'nawad-local-ca.key'
$caCrt = Join-Path $CaDir 'nawad-local-ca.crt'

# XAMPP's OpenSSL looks for a config file that may not exist; give it a minimal one.
$conf = Join-Path $env:TEMP 'nawad-openssl.cnf'
Set-Content -Path $conf -Encoding ascii -Value "[req]`ndistinguished_name = dn`n[dn]`n"
$env:OPENSSL_CONF = $conf

if (-not (Test-Path $caCrt)) {
    Write-Host "Creating certificate authority in $CaDir"
    Invoke-OpenSsl genrsa -out $caKey 4096
    Invoke-OpenSsl req -x509 -new -key $caKey -sha256 -days 3650 -out $caCrt `
        -subj '/O=Nawad System/CN=Nawad System Local CA' `
        -addext 'basicConstraints=critical,CA:TRUE' `
        -addext 'keyUsage=critical,keyCertSign,cRLSign'
}

$san = ($Names | ForEach-Object {
    if ($_ -match '^\d{1,3}(\.\d{1,3}){3}$') { "IP:$_" } else { "DNS:$_" }
}) -join ','

$key = Join-Path $OutDir 'server.key'
$csr = Join-Path $OutDir 'server.csr'
$crt = Join-Path $OutDir 'server.crt'
$ext = Join-Path $OutDir 'server.ext'
Set-Content -Path $ext -Encoding ascii -Value @"
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = $san
"@

Invoke-OpenSsl genrsa -out $key 2048
Invoke-OpenSsl req -new -key $key -out $csr -subj "/O=Nawad System/CN=$($Names[0])"
Invoke-OpenSsl x509 -req -in $csr -CA $caCrt -CAkey $caKey -CAcreateserial -out $crt -days $Days -sha256 -extfile $ext
Remove-Item $csr, $ext
# The first name doubles as Apache's ServerName (read by serve.ps1).
Set-Content -Path (Join-Path $OutDir 'host.txt') -Encoding ascii -Value $Names[0]
Copy-Item $caCrt (Join-Path $OutDir 'nawad-local-ca.crt') -Force

Write-Host "Certificate for $($Names -join ', ') written to $OutDir (valid $Days days)."
