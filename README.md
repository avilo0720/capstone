# Water Inventory Management System

Web-based inventory and procurement planning tool for water utility materials.

## Purpose

This system helps track stock items and support restocking decisions using planning formulas.

It is built to:
- Manage item master data (description, size, stock, AMC, price)
- Automatically compute FSN and replenishment metrics (LTD, SS, ROP, MSL, Trigger)
- Show operational summaries in the dashboard
- Export the currently visible inventory table to Excel or PDF

## Core Modules

- **Dashboard (Overview)**
  - Number of items, total quantity, value in hand
  - Subtotal of total cost
  - Subtotal of RS Needed cost
  - RS Needed subtotal divided by total procurement lead time
  - Half of RS Needed subtotal

- **Inventory**
  - Add/edit/delete items
  - Summary table with key fields (No, Item, Size, Stock, AMC, FSN, Trigger)
  - **View module** for full procurement metrics (LTD, SS, ROP, MSL, costs)
  - Paginated table (10 rows per page)
  - FSN and Trigger-based filtering (dropdown toggles)
  - Adjustable column widths (saved in localStorage)
  - Export full metrics to PDF/Excel

- **Forecasting**
  - **Weighted Moving Average (WMA)** for regular demand patterns
  - **Croston's Method** for intermittent/sporadic demand
  - Automatic method selection based on usage frequency
  - Demand-based projection (3 months, 6 months, 1 year)
  - Per-item demand timeline chart on row click
  - Paginated forecast results table

- **User Authentication**
  - Secure login validation and credential verification
  - Role-based access control by page and action
  - Session management with automatic timeout/logout protection

- **Reporting and Alerting**
  - Inventory summary reports for management visibility
  - **Graphical forecasting overview** (method distribution + top restock needs)
  - Low-stock alert detection based on computed restock triggers
  - Summary alerts table with **View module** for full alert details
  - Paginated alerts table
  - Downloadable reports and exports (PDF/Excel)

## Tech Stack

- **Backend:** PHP 8.2+, Laravel 11
- **Frontend:** Blade templates, vanilla JS, CSS
- **Database:** MySQL
- **Export libs:** PhpSpreadsheet, DomPDF

## Requirements

- PHP 8.2 or higher
- Composer
- MySQL server running locally or remotely
- PHP extensions: `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `fileinfo`

## Setup and Run

1. Install PHP dependencies:
   ```bash
   composer install
   ```

2. Create a `.env` file from the example:
   ```bash
   copy .env.example .env
   ```

3. Generate the application key:
   ```bash
   php artisan key:generate
   ```

4. Configure database credentials in `.env`:
   ```env
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=inventory_db
   DB_USERNAME=root
   DB_PASSWORD=your_password
   ```

5. Run migrations and seed default users (skip if you already have the database from the previous Node version):
   ```bash
   php artisan migrate --seed
   ```

6. Start the development server (Windows / XAMPP):
   ```bat
   serve.bat
   ```
   This starts XAMPP MySQL if needed and uses XAMPP’s PHP (with MySQL + mbstring), then serves the app at http://127.0.0.1:8000.

   After a reboot, always use `serve.bat` — not `php artisan serve` alone. Plain `artisan serve` often fails login because MySQL is not running yet, or the system PHP is missing/blocked drivers.

7. Open:
   [http://127.0.0.1:8000](http://127.0.0.1:8000)

### Default Login Accounts

| Username | Password | Role |
|----------|----------|------|
| `admin` | `password123` | Administrator (can manage users & departments) |
| `branch_manager` | `password123` | Branch Manager |
| `dept_manager` | `password123` | Department Manager |
| `inventory_clerk` | `password123` | Inventory Clerk |
| `warehouse_staff` | `password123` | Warehouse Staff |

Users store first name, last name, username, birthday, role label, password, and optional department.
Permissions come from the department by default, or can be customized per user on the **Users** page.

## Forecasting Algorithms

The system uses two primary forecasting methods, selected automatically per item:

| Method | When Used | Formula |
|--------|-----------|---------|
| **Weighted Moving Average (WMA)** | Regular demand (usage on ≥33% of days in the analysis window) | `(M₁×1 + M₂×2 + M₃×3) ÷ 6` using the last 3 calendar months |
| **Croston's Method** | Intermittent demand (usage on <33% of days) | `Daily Rate = Smoothed Size ÷ Smoothed Interval` (α = 0.2), monthly = daily × 30 |
| **Static fallback** | Fewer than 2 usage records | Uses the item's configured AMC (`monthlyDemand`) |

Usage data is sourced from stock "use" transactions over the last 3 months.

## Important Behavior Notes

- Item code is auto-generated for new items.
- FSN in Inventory is computed automatically from cumulative percentage.
- Trigger Point is shown as:
  - green badge: `Sufficient`
  - red badge: `RS Needed`
- Inventory export uses the **currently shown rows** (including active filters).
- Sessions expire after 15 minutes of inactivity.

## Project Structure

- `app/Http/Controllers/` - Page and API controllers
- `app/Http/Middleware/` - Auth and role-based access middleware
- `app/Services/` - Report and export business logic
- `app/Support/PermissionCatalog.php` - Available pages and abilities
- `app/Services/PermissionService.php` - Resolves department vs custom user permissions
- `public/src/js/` - Frontend UI logic (`Dashboard.js`, `InventoryView.js`, etc.)
- `public/src/css/style.css` - Main styling
- `resources/views/` - Blade templates and partials
- `routes/web.php` - Web pages and API routes
- `database/migrations/` - Database schema
- `database/seeders/` - Default user seed data
