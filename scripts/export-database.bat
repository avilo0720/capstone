@echo off
setlocal
cd /d "%~dp0.."

set "MYSQLDUMP=C:\xampp\mysql\bin\mysqldump.exe"
set "BACKUP_DIR=%CD%\database-backups"

if not exist "%MYSQLDUMP%" (
    echo XAMPP mysqldump was not found at %MYSQLDUMP%.
    echo Install XAMPP there or update MYSQLDUMP in this script.
    exit /b 1
)

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%I"
set "OUTPUT=%BACKUP_DIR%\inventory_%STAMP%.sql"

echo Exporting inventory_db to:
echo %OUTPUT%
echo.
"%MYSQLDUMP%" -u root -p --single-transaction --routines --triggers --default-character-set=utf8mb4 inventory_db --result-file="%OUTPUT%"

if errorlevel 1 (
    echo Database export failed.
    if exist "%OUTPUT%" del "%OUTPUT%"
    exit /b 1
)

echo.
echo Database export completed successfully.
echo Copy the SQL file to the new host using a secure method.
endlocal
