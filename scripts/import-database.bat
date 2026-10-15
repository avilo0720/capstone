@echo off
setlocal
cd /d "%~dp0.."

set "MYSQL=C:\xampp\mysql\bin\mysql.exe"
set "BACKUP=%~1"

if "%BACKUP%"=="" (
    echo Usage: scripts\import-database.bat path\to\inventory_backup.sql
    exit /b 1
)

if not exist "%MYSQL%" (
    echo XAMPP mysql was not found at %MYSQL%.
    echo Install XAMPP there or update MYSQL in this script.
    exit /b 1
)

if not exist "%BACKUP%" (
    echo Backup file was not found:
    echo %BACKUP%
    exit /b 1
)

echo WARNING: importing this file will replace matching data in inventory_db.
choice /M "Continue with the database import"
if errorlevel 2 exit /b 0

echo.
echo Enter the MySQL password when prompted.
"%MYSQL%" -u root -p inventory_db < "%BACKUP%"

if errorlevel 1 (
    echo Database import failed.
    exit /b 1
)

echo.
echo Database import completed successfully.
endlocal
