# Local Network Setup

This guide explains how to install the Nawad Inventory Management System on a Windows computer that hosts the application for other computers on the same local network.

## 1. Host computer requirements

Install the following on the computer that will host the application:

- Windows 10 or Windows 11, 64-bit
- PHP 8.2 or newer
- Composer
- XAMPP with PHP and MySQL
- Git
- At least 4 GB RAM; 8 GB is recommended
- A wired or wireless connection to the local network

The client computers only need a modern web browser and a connection to the same local network.

## 2. Install XAMPP

Install XAMPP using the default location:

```text
C:\xampp
```

The included `serve.ps1` script expects PHP and MySQL at these paths:

```text
C:\xampp\php\php.exe
C:\xampp\mysql\bin\mysqld.exe
```

If XAMPP is installed elsewhere, either install it again in `C:\xampp` or update those paths in `serve.ps1`.

Make sure the PHP extensions required by Laravel are enabled. The required extensions are:

- `pdo_mysql`
- `mbstring`
- `openssl`
- `tokenizer`
- `xml`
- `ctype`
- `json`
- `fileinfo`

## 3. Download the project from GitHub

Open PowerShell and run:

```powershell
cd C:\Users\Public
git clone https://github.com/avilo0720/capstone.git
cd capstone
composer install
```

A different folder may be used, but avoid moving or renaming the project while the server is running.

## 4. Create the environment file

Create the local environment file from the template:

```powershell
copy .env.example .env
php artisan key:generate
```

Edit `.env` and configure the database:

```env
APP_NAME="Nawad Inventory"
APP_ENV=production
APP_DEBUG=false
APP_URL=http://HOST_IPV4:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=inventory_db
DB_USERNAME=root
DB_PASSWORD=

SESSION_DRIVER=file
SESSION_LIFETIME=15
```

Replace `HOST_IPV4` with the host computer's local IPv4 address, for example `192.168.1.25`.

Never commit `.env` to GitHub. It contains machine-specific settings and may contain passwords.

## 5. Create and initialize a new database

This section is for a completely new server with no existing inventory data. If you need to transfer the current database and its records, follow the [existing database transfer](#transferring-an-existing-database) section instead.

### Start MySQL

Open the XAMPP Control Panel and click **Start** beside MySQL. Wait until MySQL shows as running.

### Create the database with phpMyAdmin

1. Open `http://localhost/phpmyadmin` on the host computer.
2. Select **New** in the left sidebar.
3. Enter this database name:

```text
inventory_db
```

4. Select the `utf8mb4_unicode_ci` collation if it is available.
5. Click **Create**.

### Create the database from the command line

Alternatively, open Command Prompt and run:

```bat
C:\xampp\mysql\bin\mysql.exe -u root -p -e "CREATE DATABASE inventory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Enter the MySQL root password when prompted. If the XAMPP root account has no password, press Enter.

### Create the tables and default users

From the project folder, verify that `.env` points to the new database:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=inventory_db
DB_USERNAME=root
DB_PASSWORD=
```

Then run:

```powershell
php artisan migrate --seed
```

This creates the tables and default users. Change the default passwords after logging in.

Clear cached configuration if the application still uses old database settings:

```powershell
php artisan optimize:clear
```

Do not run `migrate:fresh` on a database containing real data. It deletes all tables and data.

## Transferring an existing database

The database is not stored in GitHub. Export it from the current computer, copy the SQL file to the new host using a secure method, and import it there.

On the current computer, from the project folder, run:

```text
scripts\export-database.bat
```

The script asks for the MySQL password and creates a timestamped file in:

```text
database-backups\inventory_YYYYMMDD_HHMMSS.sql
```

The `database-backups` SQL files are ignored by Git so private inventory data cannot be pushed to GitHub. Copy the generated SQL file to the new host using a USB drive or another secure transfer method.

On the new host, create the empty `inventory_db` database first, then run this from the project folder:

```text
scripts\import-database.bat path\to\inventory_backup.sql
```

The import script asks for confirmation and the MySQL password. It imports the existing users, inventory, transactions, requests, and other database records. Do not run `migrate --seed` after importing an existing complete database unless you specifically need to seed missing data.

The scripts expect XAMPP at `C:\xampp`. If XAMPP is installed somewhere else, update the `MYSQLDUMP` or `MYSQL` path near the top of the corresponding script.

The equivalent manual commands are:

```bat
mysql -u root -p inventory_db < inventory_backup.sql
```

A backup can be created with:

```powershell
mysqldump -u root -p inventory_db > inventory_backup.sql
```

Back up the current database before importing a replacement. The import process can overwrite existing records.

## 6. Bind the application to the local network

The PHP development server must listen on all network interfaces. Open `serve.ps1` and change:

```powershell
& $Php -S 127.0.0.1:8000 $ServerRouter
```

to:

```powershell
& $Php -S 0.0.0.0:8000 $ServerRouter
```

`127.0.0.1` allows access only from the host computer. `0.0.0.0` allows other devices on the local network to connect.

The built-in PHP server provides HTTP, not HTTPS. Use an address beginning with `http://`:

```text
http://192.168.1.25:8000
```

Do not use `https://` unless Apache or another reverse proxy has been configured with an SSL certificate.

## 7. Start the application

From the project folder, run:

```powershell
.\serve.bat
```

This starts XAMPP MySQL when necessary and starts the Laravel server.

Keep the process running. Closing the terminal stops the application when it was started manually.

## 8. Find the host address

On the host computer, run:

```powershell
ipconfig
```

Use the IPv4 address under the adapter that is actually connected to the same network as the client computers:

- Use `Wireless LAN adapter Wi-Fi` when connected by Wi-Fi.
- Use `Ethernet adapter` when connected by network cable.

Use an address such as `192.168.1.25` or `10.0.0.25`. Do not use `127.0.0.1`, `169.254.x.x`, or a VirtualBox/VMware adapter such as `192.168.56.1`.

Client computers open:

```text
http://HOST_IPV4:8000
```

For example:

```text
http://192.168.1.25:8000
```

All computers must be connected to the same LAN. Guest Wi-Fi networks may block communication between devices.

## 9. Allow the port through Windows Firewall

Open PowerShell as Administrator and run:

```powershell
New-NetFirewallRule -DisplayName "Nawad Inventory Laravel" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private
```

Set the host network profile to `Private` when appropriate. Do not forward port `8000` from the router to the public internet.

## 10. Start automatically after login

Use Windows Task Scheduler:

1. Open `taskschd.msc`.
2. Select **Create Task**.
3. Name it `Nawad Inventory Server`.
4. Select **Run whether user is logged on or not**.
5. Add an **At log on** trigger.
6. Add an action to start `powershell.exe`.
7. Use these arguments, replacing the path if necessary:

```text
-NoProfile -ExecutionPolicy Bypass -File "C:\Users\Public\capstone\serve.ps1"
```

Test the task with **Run**. Verify that MySQL and the Laravel server start, then access the application from another computer.

## 11. Updating from GitHub

Before making changes on the development computer:

```powershell
git checkout main
git pull origin main
git checkout -b describe-your-change
```

After making and testing changes:

```powershell
git add .
git commit -m "Describe the change"
git push -u origin describe-your-change
```

Merge the branch into `main` on GitHub. On the host computer, update the application:

```powershell
cd C:\Users\Public\capstone
git checkout main
git pull origin main
composer install
php artisan migrate
php artisan optimize:clear
```

Restart the server after updating PHP code, configuration, migrations, or Composer packages. Stop the running server with `Ctrl+C`, then run `serve.bat` again.

Create a Laravel migration for database structure changes. Do not manually change the host database schema and do not commit the database files to GitHub.

## 12. Backups and security

Back up the database regularly:

```powershell
mysqldump -u root -p inventory_db > inventory_backup.sql
```

Also back up uploaded files from:

```text
public\uploads
```

Keep backups outside the Git repository.

Change all default user passwords. Do not expose the application directly to the internet. For HTTPS on the LAN, place Apache or Nginx with a trusted local certificate in front of Laravel; the built-in PHP server itself does not provide HTTPS.

## 13. Quick checks

Check PHP and Composer:

```powershell
php -v
composer --version
composer check-platform-reqs
```

Check that the host is listening on port 8000:

```powershell
Get-NetTCPConnection -LocalPort 8000
```

If another computer cannot connect, verify these items in order:

1. The server is running with `0.0.0.0:8000`.
2. The client is using `http://`, not `https://`.
3. The client is using the host's Wi-Fi or Ethernet IPv4 address.
4. Both computers are on the same network.
5. Windows Firewall allows TCP port 8000.
6. The host computer is awake and not disconnected from the network.
