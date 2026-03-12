# EPA Database Management System

**Environmental Protection Agency — Database Management System**  
Version 5.2.0 | Electron Desktop Application | Windows x64

A comprehensive desktop application for managing environmental permits, vehicle fleet records, waste inspection data, stores inventory, document filing, employee records, scan logs, and quarterly records entries for the Environmental Protection Agency (EPA), Ghana.

---

## Table of Contents

- [Overview](#overview)
- [Features at a Glance](#features-at-a-glance)
- [Installation](#installation)
- [First-Run Setup](#first-run-setup)
- [Application Layout](#application-layout)
- [Navigation Views](#navigation-views)
  - [Dashboard](#1-dashboard)
  - [Data Tables](#2-data-tables)
  - [Queries](#3-queries)
  - [Forms](#4-forms)
  - [Reports](#5-reports)
  - [Scan Log](#6-scan-log)
  - [Permit Filter & Export](#7-permit-filter--export)
  - [Data Enrichment](#8-data-enrichment)
  - [Records Entries](#9-records-entries)
  - [Records Analytics](#10-records-analytics)
  - [Activity Log](#11-activity-log)
  - [User Management](#12-user-management)
  - [Settings](#13-settings)
- [Database Tables](#database-tables)
- [Authentication & Permissions](#authentication--permissions)
- [Backup System](#backup-system)
- [Special Features](#special-features)
- [Technology Stack](#technology-stack)
- [Development](#development)
- [Building](#building)
- [Troubleshooting](#troubleshooting)
- [Version History](#version-history)

---

## Overview

The EPA Database Management System is a full-featured Electron desktop application that replaces legacy Microsoft Access databases with a modern, multi-user web-based interface. The application runs an embedded Express.js server with an SQLite database (via sql.js) and serves a single-page application (SPA) frontend.

Key highlights:

- **Offline-first** — all data stored locally, no internet required for core functionality
- **Multi-user** — JWT authentication with role-based access control (admin/user)
- **Network accessible** — accessible from any device on the local network via browser
- **PWA capable** — installable as a Progressive Web App on mobile devices
- **Dark/Light theme** — VS Code-inspired dark theme with light mode toggle
- **MS Access import** — import data directly from `.accdb`/`.mdb` Access database files

---

## Features at a Glance

| Feature             | Description                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------- |
| 5 Data Tables       | PERMIT, MOVEMENT, WASTE, Stores, tbl_keyword (Documents)                                     |
| 35+ Saved Queries   | Pre-built parameterized queries across all data categories                                   |
| 5 Data Entry Forms  | Permit, Vehicle Movement, Waste Inspection, Stores, Document Filing                          |
| 8 Reports           | Permit Status, Quarterly, Compliance, Financial, Expiration, Fleet, District, Classification |
| Records Module      | Quarterly records management with tree navigation and Excel import                           |
| Analytics Dashboard | Charts and visualizations for records data                                                   |
| Scan Log            | Track document scanning progress by file                                                     |
| Permit Filter       | Advanced multi-criteria permit filtering and Excel export                                    |
| Data Enrichment     | Match and update existing records from uploaded Excel/CSV data                               |
| File Attachments    | Upload and attach files to any database record                                               |
| Digitized Files     | Browse and link network-shared scanned documents to records                                  |
| Backup System       | Manual + scheduled backups with Google Drive integration                                     |
| Activity Logging    | Full audit trail of all user actions with revert capability                                  |
| Access Gate         | Optional 6-digit PIN barrier before the login screen                                         |
| QR Code Access      | Generate QR codes for quick network access from mobile devices                               |
| mDNS Discovery      | Auto-discoverable on the local network via Bonjour/mDNS                                      |
| In-App Updates      | Upload and apply update installers from within the app                                       |

---

## Installation

### From Installer

1. Run `EPA Database System Update 5.2.0.exe`
2. Follow the NSIS installer wizard
3. Choose installation directory (default: `C:\Program Files\EPA Database System`)
4. Launch from desktop shortcut or Start Menu

### From Source

```bash
# Clone or copy the project
cd "TRY EPA"

# Install dependencies
npm install

# Run in development mode (browser)
npm start
# Open http://localhost:3000

# Run as Electron desktop app
npm run electron
```

The server starts on **port 3000** by default (configurable via `PORT` environment variable).

### Accessing from Other Computers on Your Network

1. Find your computer's IP address (shown in the app's status bar or Settings → Network Info)
2. On any other computer/phone on the same network, open a browser and go to `http://<YOUR_IP>:3000`
3. Alternatively, use the QR code feature in Settings to scan with a mobile device

---

## First-Run Setup

On first launch:

1. The app detects no users exist and shows a **Setup Screen**
2. Create the first administrator account (username, password, full name)
3. After setup, you're redirected to the login screen
4. Log in with the credentials you just created

### Importing Existing Data

If you have an existing Access database (`.accdb` or `.mdb`):

1. Go to **Settings** → **Admin** → **Upload Access Database**
2. The app previews all tables and columns from the Access file
3. Select which tables and columns to import
4. Click Import — data is mapped to the corresponding database tables

---

## Application Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌───────────┐ ┌─────────────────────────────┐ │
│ │ Activity │ │  Sidebar  │ │  Tab Bar                    │ │
│ │   Bar    │ │           │ ├─────────────────────────────┤ │
│ │          │ │  Tree or  │ │                             │ │
│ │  Icons   │ │  List     │ │  Main Content Area          │ │
│ │  for     │ │  items    │ │                             │ │
│ │  each    │ │  for      │ │  (Tables, Charts, Forms,    │ │
│ │  view    │ │  current  │ │   Reports, etc.)            │ │
│ │          │ │  view     │ │                             │ │
│ │          │ │           │ │                             │ │
│ │  44px    │ │  260px    │ │  flex: 1                    │ │
│ └──────────┘ └───────────┘ └─────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Status Bar: User • Theme Toggle • Version • Logout     │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

- **Activity Bar** (left edge, 44px) — Icon buttons for each view, settings pinned at the bottom
- **Sidebar** (left panel, 260px) — Context-sensitive navigation (table lists, tree nodes, query categories, etc.)
- **Main Content** (center, fills remaining space) — Dynamic content area with a tab bar at the top
- **Status Bar** (bottom) — Logged-in user info, dark/light theme toggle, version number, logout button

On mobile, the sidebar collapses into an overlay triggered by a hamburger menu button.

---

## Navigation Views

The Activity Bar contains 13 navigation buttons (some admin-only):

### 1. Dashboard

The landing page after login. Shows a comprehensive overview of all data:

- **Summary Cards** — Row counts for each data table (PERMIT, MOVEMENT, WASTE, Stores, Documents) and user count
- **Quick Stats** — Expired permits, expiring soon (90 days), active permits, new applications, renewals, permits issued, compliance enforcements, Sekondi office permits
- **Financial Overview** — Total revenue from processing and permit fees, counts of paid processing/permit fees
- **Application Status Breakdown** — Chart of permits by application status
- **Classification Breakdown** — Permits grouped by industry sector/classification
- **District Distribution** — Permit counts by geographic district (top 10)
- **Monthly Trend** — 12-month permit issuance trend chart
- **Permit Validity Donut** — Active vs. expired vs. expiring vs. no-date permits
- **Recent Activity** — Last 30 activity log entries with 24-hour action count
- **Quick Lists** — Filterable lists of expired permits and expiring-soon permits

### 2. Data Tables

Full CRUD (Create, Read, Update, Delete) interface for all 5 data tables:

| Table           | Purpose                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| **PERMIT**      | Environmental permit applications — file numbers, company info, permit dates, fees, compliance, status (~70 columns) |
| **MOVEMENT**    | Vehicle fleet management — licence, insurance, road worthy, maintenance, trip records (24 columns)                   |
| **WASTE**       | Waste inspection records — company info, waste categories, inspection/consignment dates (18 columns)                 |
| **Stores**      | Stores inventory — item descriptions, invoices, quantities, unit prices, conditions (10 columns)                     |
| **tbl_keyword** | Document filing index — document codes, project names, classifications, review tracking (12 columns)                 |

**Features:**

- Paginated data table with sortable columns (click column header)
- Search bar filters across all fields
- Click any row to open a detail/edit panel on the right
- Add Record, Delete (with confirmation), Bulk Delete
- Export entire table to Excel (.xlsx)
- File Attachments — right-click or double-click a record to manage attached files
- Custom Dropdown Options — admin can define dropdowns for any field
- Custom Fields — admin can add new columns to any table
- Field Renames — admin can change the display label of any column

### 3. Queries

35+ pre-built parameterized queries organized by category:

| Category       | Queries                                                                                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Financial**  | Accounts Status, Paid Both Fees Not Issued, Paid Processing Fee, Paid Permit Fee                                                                                                                |
| **General**    | All Applications, New Applications, Renewals, Permits Issued, Active Permits, Not Expired Permits                                                                                               |
| **Compliance** | Expired Permits, Compliance Enforcement by Date, Compliance by Application Status                                                                                                               |
| **Processing** | Due Date Payment, Due Date Reporting, Submitted Draft, New Apps Not Permitted, Renewals Not Permitted, Permit Due Email Not Sent                                                                |
| **Fleet**      | General Movement, Today's Movement, Expiring Vehicles, Movements by Date Range                                                                                                                  |
| **Search**     | By District, Jurisdiction & Date, Jurisdiction & Classification, New Permits by Date, Renewals by Date, Sekondi & Date, Expired by Sector, Permits Expiring in N Days, Sekondi by Sector & Date |
| **Reports**    | General Permits Report, Project Status Summary, Applications Received Within Dates, File Return Status                                                                                          |
| **Waste**      | By Consignment Date, By Inspection Date, Search by Company                                                                                                                                      |
| **Documents**  | Environmental Reports by Sent Date                                                                                                                                                              |

**Features:**

- Click a query in the sidebar to run it
- Parameter prompts for queries that need input (date ranges, numbers, text)
- Results in a sortable, searchable table with record count and execution time
- Export results to Excel

### 4. Forms

5 guided data entry forms:

| Form                        | Icon | Target Table | Sections                                                                                                                                                            |
| --------------------------- | ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Permit Application Form** | 📋   | PERMIT       | File Info, Establishment Info, Contact, Application Details, Permit Details, Processing Fees, Permit Fees, Status, Compliance, Reports & Submissions, File Movement |
| **Vehicle Movement Form**   | 🚗   | MOVEMENT     | Vehicle Info, Insurance, Road Worthy, Maintenance, Trip Details, Approval                                                                                           |
| **Waste Inspection Form**   | ♻️   | WASTE        | Company Details, Inspection, Waste Categories                                                                                                                       |
| **Stores Inventory Form**   | 📦   | Stores       | Item Details, Quantity & Value, Remarks                                                                                                                             |
| **Document Filing Form**    | 📄   | tbl_keyword  | Document Details, Review Tracking                                                                                                                                   |

Forms include field validation, custom dropdown options, and success notifications.

### 5. Reports

8 analytical reports with charts and data tables:

| Report                        | Icon | Description                                                                       |
| ----------------------------- | ---- | --------------------------------------------------------------------------------- |
| **Permit Status Report**      | 📊   | Permits grouped by application status and classification — counts and percentages |
| **Quarterly Permits Report**  | 📅   | Permits issued per quarter for a given year (parameterized)                       |
| **Compliance Report**         | ⚖️   | Compliance enforcement overview — status breakdown                                |
| **Financial Summary**         | 💰   | Total processing fees, permit fees, revenue, paid/unpaid breakdowns               |
| **Expiration Report**         | ⏰   | Expired, expiring (90 days), valid, and no-date permits                           |
| **Fleet Status Report**       | 🚗   | Vehicle licence, insurance, and road worthy status summaries                      |
| **Permits by District**       | 🗺️   | Geographic distribution of permits by district                                    |
| **Permits by Classification** | 📂   | Industry sector breakdown of all permits                                          |

Reports include visual charts (bar, pie, donut) and can be exported to Excel.

### 6. Scan Log

Track document scanning progress:

- Add entries with file number, company, sector, location, district, jurisdiction
- Track last/current folio numbers and documents scanned count
- Mark scan status (In Progress, Complete, etc.)
- Record which employee performed each scan
- Search & filter by company, file number, district, status, date range
- Export scan log to Excel

### 7. Permit Filter & Export

Advanced multi-criteria permit search:

- **20+ filter criteria** — file number, company name, classification, district, jurisdiction, application status, compliance, permit issued (yes/no), date ranges, fees, location, officer, and more
- Combine multiple filters simultaneously
- Preview results before exporting
- Download filtered results as formatted Excel (.xlsx)
- Choose which columns to include in the export

### 8. Data Enrichment

Bulk-update existing records from uploaded Excel/CSV files:

1. Upload a file (drag-and-drop or browse)
2. Select which column to match on (e.g., File Number, Company Name)
3. Map uploaded file columns to database columns
4. Preview which records will be updated with before/after values
5. Apply enrichment to update matched records in bulk

### 9. Records Entries

Quarterly records management with a file-explorer-style interface:

**Categories:**

| Category               | Icon | Description                               |
| ---------------------- | ---- | ----------------------------------------- |
| Applications Received  | 📥   | Track all received permit applications    |
| Permitted Applications | ✅   | Track all approved/permitted applications |
| Monitoring Records     | 📊   | Track environmental monitoring activities |

**Tree Navigation (Sidebar):**

```
📥 Applications Received (450)
  ▸ 2024 (350)
    Q1 (Jan–Mar) [115]
    Q2 (Apr–Jun) [98]
    Q3 (Jul–Sep) [137]
    Q4 (Oct–Dec) [0]
  ▸ 2023 (100)
  + Add Year
✅ Permitted Applications (312)
  ▸ 2024 ...
📊 Monitoring Records (890)
  ▸ 2024 ...
```

**Master-Detail Split View:**

- **Left panel** — scrollable table of records (company name, date, sector, status)
- **Right panel** — detailed inspector showing all fields organized by section (Identification, Operational, Geospatial, Financial, Permit, Timeline, Monitoring, Compliance, Admin)
- **80 fields per record** — company info, contacts, GPS coordinates, permit details, financial data, processing timeline, compliance info

**Features:**

- Add/Edit/Delete individual records
- Auto-calculated financial fields (total = processing + permit fee, balance = total - paid)
- Search within current quarter
- Forward-fill indicator for auto-imported fields
- Export current quarter as CSV
- Drag-and-drop Excel/CSV import

**Excel Import Wizard:**

1. Upload an Excel file (button or drag-and-drop)
2. Auto-detects category, year, quarter from filename and sheet names
3. Preview shows sheets with row counts and data sample
4. Adjust detection if needed, then import
5. Forward-fill logic fills repeated values (e.g., group names, officers)

### 10. Records Analytics

Visual analytics dashboard for the Records module:

- **Summary Stats** — total entries, per-category counts
- **Filter Controls** — filter by year and sector
- **Fulfillment Funnel** — applications received → permitted (conversion rate)
- **Status Distribution** — horizontal bar chart of records by status
- **Sector Distribution** — doughnut chart of records by industry sector
- **Revenue by MMDA** — stacked bar chart of processing vs. permit fees by district assembly
- **Quarterly Volume** — line chart of entry trends across quarters for all categories

### 11. Activity Log

Complete audit trail (admin only):

- Every action logged: login, create, update, delete for all record types
- **Field-level change diffs** — for updates, shows exactly which fields changed with old → new values
- **Revert changes** — click any update entry to undo it
- Search & filter by username, action type, date range
- Paginated browsing with configurable page size
- Admin can delete individual log entries

### 12. User Management

Manage application users (admin only):

- Create, edit, delete user accounts
- Set roles: **admin** (full access) or **user** (restricted)
- Cannot delete your own account

**Granular Permissions:**

| Permission Type       | Controls                                             |
| --------------------- | ---------------------------------------------------- |
| **Table Permissions** | can_view, can_create, can_edit, can_delete per table |
| **Page Access**       | Which navigation views the user can see              |
| **Query Access**      | Which saved queries the user can run                 |
| **Report Access**     | Which reports the user can generate                  |
| **Form Access**       | Which data entry forms the user can use              |

Set via right-click → Permissions on any user in the user list.

### 13. Settings

**Profile Tab:**

- View username, full name, role

**Change Password Tab:**

- Update password (requires current password)

**Admin Tab** (admin only):

- **Access Gate** — enable/disable 6-digit PIN, set or auto-generate PIN
- **QR Code** — generate QR code for the app's network URL
- **Network Info** — view all LAN IP addresses
- **Backup Management** — manual backup, schedule, Google Drive connection, restore
- **Records Admin** — view per-category/year/quarter stats, bulk delete records
- **Shared Documents Folder** — configure path for digitized files browsing
- **Database Management** — upload Access file for import, clear all data
- **In-App Updates** — upload and manage update installers

---

## Database Tables

The application uses 20 SQLite tables:

| #   | Table                     | Purpose                                                               |
| --- | ------------------------- | --------------------------------------------------------------------- |
| 1   | `app_users`               | User accounts (username, password hash, role)                         |
| 2   | `PERMIT`                  | Environmental permit applications (~70 columns)                       |
| 3   | `MOVEMENT`                | Vehicle fleet movement records (24 columns)                           |
| 4   | `WASTE`                   | Waste inspection records with 12 waste categories (18 columns)        |
| 5   | `Stores`                  | Stores inventory — items, quantities, prices (10 columns)             |
| 6   | `tbl_keyword`             | Document filing index — codes, projects, classifications (12 columns) |
| 7   | `activity_log`            | Full audit trail of all user actions                                  |
| 8   | `user_permissions`        | Per-table CRUD permissions for each user                              |
| 9   | `file_attachments`        | Uploaded file metadata (linked to records)                            |
| 10  | `feature_permissions`     | Per-feature access control (pages, queries, reports, forms)           |
| 11  | `backup_config`           | Backup configuration key-value store                                  |
| 12  | `backup_history`          | Log of all backup operations                                          |
| 13  | `document_links`          | Links between DB records and shared network documents                 |
| 14  | `employees`               | Employee directory (names, positions, departments)                    |
| 15  | `scan_log`                | Document scanning progress tracking                                   |
| 16  | `custom_dropdown_options` | Admin-defined dropdown choices for table fields                       |
| 17  | `custom_fields`           | Admin-added custom columns on tables                                  |
| 18  | `field_renames`           | Admin-customized display labels for columns                           |
| 19  | `records_years`           | Year entries for each records category                                |
| 20  | `records_entries`         | Quarterly records (80 columns per entry)                              |

---

## Authentication & Permissions

### Authentication

- Username/password login with bcrypt password hashing
- JWT tokens with 12-hour expiry, included as Bearer token in all API requests
- Rate limiting: 20 login attempts per 15 minutes per IP
- Optional Access Gate: 6-digit PIN required before the login screen

### Roles

- **Admin** — full access to everything including user management, activity log, settings
- **User** — access controlled by admin-assigned permissions (table-level CRUD + feature-level page/query/report/form visibility)

---

## Backup System

### Manual Backup

- Creates a ZIP containing the SQLite database and all uploaded attachments
- Download from backup history, restore from any backup

### Google Drive Integration

1. Create a Google Cloud project and enable the Drive API
2. Create OAuth 2.0 credentials with redirect URI: `http://localhost:3000/api/backup/google/callback`
3. Enter Client ID and Secret in Settings → Backup & Restore
4. Authorize via Google popup
5. Backups automatically uploaded to Drive

### Scheduled Backups

- Options: Daily, Weekly, or custom cron schedules
- Recommended: Daily at 2:00 AM
- Runs via node-cron in the background

### Restore

- From local backup file in the history list
- From uploaded backup ZIP file
- From Google Drive backup

> ⚠️ **Warning:** Restoring a backup **overwrites the current database**. Make sure you have a current backup before restoring an older one.

---

## Special Features

### Access Gate

Optional 6-digit PIN barrier shown before the login screen. Configurable in Settings by admin. Useful for shared computers or public kiosks.

### QR Code Network Access

Generate a QR code encoding the app's network URL. Scan with a mobile device to open the app in a browser instantly.

### mDNS/Bonjour Discovery

The app broadcasts itself on the local network via Bonjour/mDNS for auto-discovery by other devices.

### PWA Support

- Service Worker caches core assets for offline access
- Web App Manifest enables "Add to Home Screen" on mobile
- Responsive design with mobile sidebar overlay and hamburger menu

### File Attachments & Document Scanning

- Every record in any table can have files attached
- Three upload methods: drag-and-drop, file browse, shared folder browse
- Preview images inline and PDFs in-app
- Designed for offices scanning documents to shared network folders

### Digitized Files Browser

Browse a configured shared network folder of scanned/digitized documents. Link files to database records. Auto-match files to records by file number.

### MS Access Import

Import from `.accdb` or `.mdb` files with selective table/column preview and column mapping.

### System Tray (Electron)

Minimizing closes to system tray. Double-click tray icon to restore. Right-click for menu (Open, Open in Browser, Quit).

### In-App Updates

Admin can upload new installer files through Settings for distribution.

---

## Technology Stack

| Layer           | Technology                          | Details                                    |
| --------------- | ----------------------------------- | ------------------------------------------ |
| **Runtime**     | Node.js                             | Server-side JavaScript                     |
| **Desktop**     | Electron 33.x                       | Cross-platform desktop wrapper             |
| **Server**      | Express.js 4.21                     | REST API framework (164 routes)            |
| **Database**    | sql.js 1.10                         | SQLite compiled to JS (no native binaries) |
| **Auth**        | jsonwebtoken 9.x + bcryptjs 2.x     | JWT tokens + password hashing              |
| **Security**    | helmet 8.x + express-rate-limit 8.x | HTTP headers + brute-force protection      |
| **Excel**       | xlsx (SheetJS) 0.18                 | Read/write Excel files                     |
| **File Upload** | multer 2.x                          | Multipart file handling                    |
| **Access DB**   | mdb-reader 3.x                      | Read MS Access .accdb/.mdb files           |
| **PDF**         | pdfjs-dist 3.x                      | PDF file processing                        |
| **Backup**      | archiver 7.x + googleapis 171.x     | ZIP creation + Google Drive API            |
| **Scheduling**  | node-cron 4.x                       | Cron-based task scheduling                 |
| **QR Code**     | qrcode 1.x                          | QR code image generation                   |
| **Network**     | bonjour-service 1.x                 | mDNS/Bonjour service advertisement         |
| **Charts**      | Chart.js 4.4.1                      | Frontend chart rendering (CDN)             |
| **Fonts**       | Inter + JetBrains Mono              | Google Fonts (CSS import)                  |
| **Build**       | electron-builder 25.x               | NSIS installer packaging                   |

---

## Development

### Prerequisites

- Node.js 16+
- npm

### Running Locally

```bash
# Install dependencies
npm install

# Start Express server (browser mode)
npm start
# Open http://localhost:3000

# Start as Electron desktop app
npm run electron
```

### All Scripts

| Script          | Command                           | Purpose                  |
| --------------- | --------------------------------- | ------------------------ |
| `start`         | `node server.js`                  | Run Express server       |
| `electron`      | `electron .`                      | Run as Electron app      |
| `migrate`       | `node migrate.js`                 | Run database migrations  |
| `create-admin`  | `node create-admin.js`            | Create admin via CLI     |
| `dist`          | `electron-builder --win`          | Build Windows installer  |
| `dist:portable` | `electron-builder --win portable` | Build portable exe       |
| `pack`          | `electron-builder --dir`          | Build unpacked directory |

### Project Structure

```
├── electron-main.js       # Electron main process (window, tray, menu)
├── server.js              # Express API server (~6500 lines, 164 routes)
├── database.js            # Database schema & initialization (20 tables)
├── package.json           # Dependencies & build config
├── afterPack.js           # Post-build npm install hook
├── migrate.js             # Database migration script
├── create-admin.js        # CLI admin user creation
├── public/
│   ├── index.html         # SPA HTML shell (login + app layout)
│   ├── app.js             # Frontend SPA logic (~11,000 lines, 13 views)
│   ├── styles.css         # Complete stylesheet (dark/light theme)
│   ├── sw.js              # Service Worker for PWA caching
│   ├── manifest.json      # PWA Web App Manifest
│   └── epa logo.png       # Application logo/icon
├── build/
│   └── icon.ico           # Windows application icon
├── data/                  # SQLite database file (created at runtime)
├── uploads/               # File attachments (created at runtime)
└── backups/               # Backup ZIP files (created at runtime)
```

---

## Building

### Windows Installer

```bash
npm run dist
```

Produces `dist/EPA Database System Update 5.2.0.exe` (NSIS installer, x64).

### Portable Build

```bash
npm run dist:portable
```

### Directory Build (unpacked)

```bash
npm run pack
```

### Build Notes

- Installer: NSIS (non-one-click, allows directory selection)
- Desktop & Start Menu shortcuts created
- ASAR disabled (files not packed into archive)
- afterPack hook runs `npm install --production` in packed directory

---

## Troubleshooting

### Server won't start

```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill the process
taskkill /F /PID <PID_number>

# Reinstall dependencies
npm install

# Start again
node server.js
```

### Can't log in

- Use the credentials you configured during first-run setup
- If password forgotten, delete `data/epa.db` and restart — resets everything including user accounts

### User can't see certain pages

- Admin has restricted their access via permissions
- Go to Users → right-click user → Permissions → check the Pages tab

### Google Drive not connecting

- Ensure redirect URI matches exactly: `http://localhost:3000/api/backup/google/callback`
- Ensure Google Drive API is enabled in Google Cloud Console
- Try disconnecting and re-authorizing

### Attachments not uploading

- Ensure `files/` (or `uploads/`) directory exists and is writable
- Check user has Edit permission on the relevant table

### Import from Access failing

- Ensure `.accdb`/`.mdb` file is valid and not open in Access
- File must contain tables with matching column structures

### Data missing after restart

- Database loaded from `data/epa.db` on startup
- If file doesn't exist, a fresh database is created
- Always shut down properly (Ctrl+C) to ensure data is saved

---

## Version History

| Version    | Key Changes                                                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v5.2.0** | Records module (80-column entries), Records Analytics dashboard, Excel import wizard with auto-detection, data enrichment, scan log, permit filter & export, employee management, digitized file browser, in-app updates, custom fields, field renames, custom dropdown options |
| **v4.4.0** | Access gate (6-digit PIN), QR code network access, mDNS discovery, selective Access import with preview                                                                                                                                                                         |
| **v4.0**   | Comprehensive permission system, activity log field-level diffs, Google Drive backup, drag-and-drop attachments, shared document folder, file preview                                                                                                                           |
| **v3.4**   | Client-side search, permission enforcement, dropdown field options                                                                                                                                                                                                              |
| **v3.3**   | Reports system, forms view, enhanced activity log, file attachments                                                                                                                                                                                                             |
| **v3.2**   | Dashboard analytics, pre-built queries, context menus, data export                                                                                                                                                                                                              |
| **v1.0**   | Initial migration from Microsoft Access to web application                                                                                                                                                                                                                      |

---

_Built for the Environmental Protection Agency — Ghana_
