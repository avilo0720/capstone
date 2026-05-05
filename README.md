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
  - FSN and Trigger-based filtering (dropdown toggles)
  - Adjustable column widths (saved in localStorage)
  - Procurement metrics and trigger labels
  - Export current table view to PDF/Excel

- **Forecasting**
  - Demand-based projection (3 months, 6 months, 1 year)

- **User Authentication**
  - Secure login validation and credential verification
  - Role-based access control by page and action
  - Session management with automatic timeout/logout protection

- **Reporting and Alerting**
  - Inventory summary reports for management visibility
  - Low-stock alert detection based on computed restock triggers
  - Downloadable reports and exports (PDF/Excel)

## Additional Functional Requirements

- **User Authentication**
  - **Description:** Manages secure login validation, credential verification, and access control, restricting unauthorized users from accessing system pages and ensuring session management through automatic timeouts.
  - **Purpose:** To protect system data and ensure that only authorized personnel (Branch Manager, Department Managers, Inventory Clerks, and Warehouse Staff) can access role-appropriate functions.

- **Reporting and Alerting**
  - **Description:** Generates inventory summary reports and automatically triggers low-stock alert notifications when item quantities fall below a defined minimum threshold.
  - **Purpose:** To keep management and staff informed of current stock conditions and prompt timely restocking actions through automated alerts and downloadable reports.

## Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** EJS, vanilla JS, CSS
- **Database:** MySQL
- **File/Export libs:** `xlsx`, `pdfkit`

## Requirements

- Node.js 18+ recommended
- MySQL server running locally or remotely

## Setup and Run

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=inventory_db
   PORT=3000
   ```

3. Start the app:
   ```bash
   npm start
   ```

4. Open:
   [http://localhost:3000](http://localhost:3000)

On startup, the app auto-creates the database/tables if they do not exist.

## Important Behavior Notes

- Item code is auto-generated for new items.
- FSN in Inventory is computed automatically from cumulative percentage.
- Trigger Point is shown as:
  - green badge: `Sufficient`
  - red badge: `RS Needed`
- Inventory export uses the **currently shown rows** (including active filters).

## Project Structure

- `server.js` - Express server, API routes, export routes
- `db.js` - MySQL initialization + query helper
- `public/src/js/` - Frontend UI logic (`Dashboard.js`, `InventoryView.js`, `ForecastingView.js`, etc.)
- `public/src/css/style.css` - Main styling
- `views/` - EJS templates and partials
