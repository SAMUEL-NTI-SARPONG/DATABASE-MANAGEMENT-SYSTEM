# EPA Database Management System v4.0

A web-based Environmental Protection Agency (EPA) database management application migrated from Microsoft Access. Built with Node.js, Express, and a single-page application (SPA) frontend. Multiple users can access it simultaneously over your office network.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Default Login](#default-login)
3. [Features Overview](#features-overview)
4. [Permission System](#permission-system)
5. [Activity Log & Change Tracking](#activity-log--change-tracking)
6. [File Attachments & Document Scanning](#file-attachments--document-scanning)
7. [Google Drive Backup](#google-drive-backup)
8. [Data Management](#data-management)
9. [Technical Architecture](#technical-architecture)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- **Node.js** v16 or later — Download from [nodejs.org](https://nodejs.org)
- **npm** (comes with Node.js)

### Installation

```bash
# Navigate to the project folder
cd "C:\Users\Samuel\OneDrive\Desktop\TRY EPA"

# Install dependencies
npm install

# Start the server
node server.js
```

The app will be available at **http://localhost:3000**

### Accessing from Other Computers on Your Network

1. Find your computer's IP address: Open Command Prompt and type `ipconfig`
2. Look for your **IPv4 Address** (e.g., `192.168.1.100`)
3. Other computers on the same network can access the app at: `http://192.168.1.100:3000`
4. You may need to allow Node.js through Windows Firewall the first time

---

## Default Login

| Field    | Value      |
| -------- | ---------- |
| Username | `admin`    |
| Password | `admin123` |

> **Important:** Change the admin password immediately after first login via Settings → Change Password.

---

## Features Overview

### Dashboard

- **Key Metrics** — Total permits, active/expired/expiring permits, movements, waste records, documents
- **Processing & Compliance** — New applications, renewals, compliance enforcements, fee tracking
- **Charts** — Application status distribution, sector classification, district overview
- **Recent Activity** — Latest system actions
- **Attention Required** — Expired permits and expiring soon lists
- Dashboard widgets can be individually shown/hidden per user via permissions

### Data Tables

Five main data tables:

| Table           | Description                               |
| --------------- | ----------------------------------------- |
| **PERMIT**      | Environmental permit records (70+ fields) |
| **MOVEMENT**    | Vehicle movement tracking                 |
| **WASTE**       | Waste management records                  |
| **Stores**      | Equipment/stores inventory                |
| **tbl_keyword** | Environmental reports submission           |

Each table supports:

- Card-based and detail view
- Search and filter
- Create, edit, delete records (permission-based)
- File attachments per record
- Export to Excel, CSV, or JSON
- Context menu (right-click) for quick actions

### Queries

Pre-built queries for common data lookups:

- Active permits, expired permits, expiring soon
- Permits by status, district, sector
- New applications, renewals
- Compliance & enforcement records
- Fee payment tracking
- And many more...

### Reports

Detailed analytical reports with summary statistics and detailed record listings:

- Permit Status Report
- District Report
- Sector Report
- Expiry Report
- And more...

### Forms

Data entry forms organized by table:

- Permit Registration Form
- Vehicle Movement Form
- Waste Record Form
- Stores Record Form
- Environmental Reports Submission Form

---

## Permission System

The v4.0 permission system is comprehensive and granular. **Every feature requires explicit admin permission.**

### How It Works

1. **Admin creates a user** → Default permissions are set (all pages accessible by default)
2. **Admin configures permissions** → Go to Users → right-click a user → Permissions
3. **Permissions are enforced** → Unauthorized pages/features are completely hidden from the user's view (they don't see "access denied" messages — the pages simply don't appear)

### Permission Categories

The admin permission page has 6 tabs:

| Tab           | Controls                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------- |
| **Pages**     | Which main navigation pages the user can see (Dashboard, Tables, Queries, Forms, Reports)     |
| **Tables**    | View, Create, Edit, Delete permissions per table                                              |
| **Queries**   | Which specific queries the user can run                                                       |
| **Reports**   | Which reports the user can generate                                                           |
| **Forms**     | Which data entry forms the user can access                                                    |
| **Dashboard** | Which dashboard sections are visible (metrics, charts, activity, expired list, expiring list) |

### Key Behaviors

- **Pages without permission are hidden** — The navigation button is completely removed, not just disabled
- **Admin users always have full access** — Permission checks are bypassed for admins
- **Queries/Reports/Forms are filtered** — Only permitted items appear in the sidebar
- **Table-level CRUD** — You can allow a user to view a table but not edit or delete records
- **Wildcard table permission** — The "All Tables" row sets defaults; individual table rows override

### Setting Permissions

1. Go to the **Users** page
2. Right-click on a user → click **🔐 Permissions**
3. Use the tabbed interface to toggle features on/off
4. Use **Enable All** / **Disable All** buttons for quick bulk changes
5. Click **💾 Save All Permissions** to save everything at once

---

## Activity Log & Change Tracking

### What Gets Tracked

- Record creation (CREATE_RECORD)
- Record updates (UPDATE_RECORD) — **shows exact field-level changes**
- Record deletion (DELETE_RECORD)
- Login events
- Attachment uploads and deletions
- Data import operations

### Change Diff Display (New in v4.0)

When a record is updated, the activity log now shows **only the fields that actually changed**, with a before/after comparison:

```
Field Name:  Old Value  →  New Value
```

For example:

```
Status:       Pending    →  Approved
Expiry Date:  2024-01-01 →  2025-01-01
```

This replaces the previous behavior of showing the entire record contents. Only modified fields are displayed with the old value crossed out and the new value highlighted in green, making it instantly clear what changed.

### Activity Log Features

- Filter by action type (CREATE, UPDATE, DELETE, LOGIN, etc.)
- Pagination for large histories
- Admin can **revert** changes (undo updates)
- Admin can **delete** log entries

---

## File Attachments & Document Scanning

### Overview

Every record in any table can have files attached to it. The system supports a streamlined workflow for office document scanning.

### Uploading Files

Three ways to attach files:

1. **Drag & Drop** — Drag files directly onto the attachment drop zone in any record
2. **Browse Files** — Click "Browse Files" to select files from your computer
3. **Shared Folder** — Click "📂 Shared Folder" to browse a configured network folder

### Document Scanning Workflow

This is designed for offices that scan documents to a shared network folder:

1. **Configure the shared folder** (one-time setup):
   - Go to **Settings → Document Folder**
   - Enter the path to your shared scan folder (e.g., `\\SERVER\Scans` or `C:\SharedDocs`)
   - Click **Save Path**

2. **Scan documents** from your office scanner/copier to the shared folder as usual

3. **Attach to a record:**
   - Open a record in the EPA app
   - Expand the **📎 Attachments** section
   - Click **📂 Shared Folder**
   - Browse folders to find the scanned file
   - Click the file to attach it — it's automatically copied into the app's secure storage

### File Preview

- **Images** (jpg, png, gif, bmp, webp) — Displayed inline in a preview modal
- **PDFs** — Embedded in an iframe for in-app viewing
- Click the 👁️ button on any supported attachment to preview without downloading

### Attachment Permissions

- **Admin users** can upload and delete any attachment
- **Users with Edit permission** on a table can upload attachments to records in that table
- Users can delete files they uploaded themselves

---

## Google Drive Backup

### Overview

Automatic and manual backups to Google Drive, similar to how WhatsApp backs up chats. Backups include the entire database and all attached files in a single ZIP file.

### Setting Up Google Drive

#### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **Select a Project** → **New Project**
3. Name it something like "EPA Backup" and click **Create**

#### Step 2: Enable the Google Drive API

1. In your project, go to **APIs & Services → Library**
2. Search for "Google Drive API"
3. Click on it and click **Enable**

#### Step 3: Create OAuth Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth 2.0 Client ID**
3. If prompted, configure the consent screen first (choose "External", fill in app name and email)
4. Application type: **Web Application**
5. Under "Authorized redirect URIs", add: `http://localhost:3000/api/backup/google/callback`
6. Click **Create**
7. Copy the **Client ID** and **Client Secret** — you'll need these

#### Step 4: Configure in the EPA App

1. Go to **Settings → Backup & Restore**
2. Enter the Client ID and Client Secret in the fields provided
3. Click **Save & Connect**
4. A Google authorization popup will open — sign in and grant permission
5. After authorization, the status will show **"✅ Google Drive Connected"**

### Backup Schedule

Set automatic backups in **Settings → Backup & Restore → Backup Schedule**:

| Option                  | Description                                  |
| ----------------------- | -------------------------------------------- |
| **No automatic backup** | Only manual backups                          |
| **Daily**               | Runs every day at the specified time         |
| **Weekly**              | Runs on a specific day at the specified time |

Recommended: **Daily at 2:00 AM** (when no one is using the system)

### Manual Backup

Click **🔄 Create Backup Now** in Settings → Backup & Restore. The backup:

1. Creates a ZIP file containing the SQLite database and all attachment files
2. Saves the ZIP locally in the `backups/` folder
3. Uploads the ZIP to Google Drive (if connected)

### Restoring from Backup

Three ways to restore:

| Method                 | How                                                        |
| ---------------------- | ---------------------------------------------------------- |
| **From local backup**  | Click **🔄 Restore** on any backup in the history list     |
| **From Google Drive**  | Click **🔄 Restore** on a cloud backup entry               |
| **Upload backup file** | Go to "Restore from Backup" section and upload a .zip file |

> ⚠️ **Warning:** Restoring a backup **overwrites the current database**. This action cannot be undone. Make sure you have a current backup before restoring an older one.

---

## Data Management

### Import from Access Database

1. Go to **Settings → Data Management**
2. Click **📁 Choose Access File** and select a `.accdb` or `.mdb` file
3. Preview the data — select which tables and columns to import
4. Click **Import Selected** — data will be merged into existing tables

### Clear All Data

1. Go to **Settings → Data Management**
2. Type exactly `CLEAR ALL DATA` in the confirmation field
3. Click **🗑️ Clear All Data**
4. This deletes all records from data tables but **preserves** user accounts, activity logs, and settings

### Export

From any table view or query/report results:

- **📊 Excel** (.xlsx) — Recommended for spreadsheet work
- **📄 CSV** (.csv) — For data interchange
- **📋 JSON** (.json) — For technical/API use

---

## Technical Architecture

### Technology Stack

| Component         | Technology                                              |
| ----------------- | ------------------------------------------------------- |
| Backend           | Node.js + Express                                       |
| Database          | SQLite (via sql.js — runs in memory, persisted to disk) |
| Frontend          | Vanilla JavaScript SPA (no framework)                   |
| Authentication    | JWT (JSON Web Tokens, 12h expiry)                       |
| Password Security | bcrypt hashing                                          |
| File Storage      | Local filesystem (`files/` directory)                   |
| Backup            | archiver (ZIP compression) + Google Drive API           |
| Scheduled Tasks   | node-cron                                               |
| Security          | Helmet (HTTP headers) + rate limiting                   |

### Project Structure

```
TRY EPA/
├── server.js          # Express API server (all endpoints)
├── database.js        # Database initialization and schema
├── package.json       # Dependencies and scripts
├── README.md          # This documentation file
├── data/
│   └── epa.db         # SQLite database file (auto-created)
├── files/             # Uploaded file attachments (auto-created)
├── backups/           # Local backup ZIP files (auto-created)
└── public/
    ├── index.html     # HTML shell (login screen + app layout)
    ├── app.js         # Frontend SPA application logic
    ├── styles.css     # All CSS styles (dark theme)
    └── epa logo.png   # EPA logo image
```

### Database Tables

| Table                 | Purpose                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `app_users`           | User accounts with hashed passwords and roles                          |
| `user_permissions`    | Table-level CRUD permissions (view/create/edit/delete)                 |
| `feature_permissions` | Feature-level access control (pages, queries, reports, forms, widgets) |
| `activity_log`        | Full audit trail with old/new value diffs                              |
| `file_attachments`    | Attachment metadata (files stored in `files/` folder)                  |
| `backup_config`       | Key-value configuration store (Google credentials, schedule)           |
| `backup_history`      | Record of all backups created                                          |
| `PERMIT`              | Permit data (~70 columns)                                              |
| `MOVEMENT`            | Vehicle movement data (24 columns)                                     |
| `WASTE`               | Waste management data (18 columns)                                     |
| `Stores`              | Equipment/stores data (10 columns)                                     |
| `tbl_keyword`         | Environmental reports submission data (12 columns)                     |

---

## Troubleshooting

### Server won't start

```bash
# Check if port 3000 is already in use
netstat -ano | findstr :3000

# Kill the process using port 3000
taskkill /F /PID <PID_number>

# Reinstall dependencies if needed
npm install

# Start again
node server.js
```

### Can't log in

- Default credentials: `admin` / `admin123`
- If you changed the password and forgot it, delete the `data/epa.db` file and restart the server — this resets everything including user accounts

### User can't see certain pages

- This is likely intentional — the admin has restricted their access
- Admin should go to Users → right-click the user → Permissions → check the Pages tab

### Google Drive not connecting

- Ensure the redirect URI in Google Cloud Console matches **exactly**: `http://localhost:3000/api/backup/google/callback`
- Make sure the Google Drive API is **enabled** in your Google Cloud project
- Try disconnecting (Settings → Backup & Restore → Disconnect) and re-authorizing
- If the popup was blocked by the browser, allow popups for localhost

### Attachments not uploading

- Ensure the `files/` directory exists and is writable
- Check that the user has **Edit** permission on the relevant table
- Maximum file size depends on server memory

### Shared folder not showing files

- Ensure the path in Settings → Document Folder is correct and accessible from the server computer
- The server process must have read access to the shared folder
- For network paths (`\\SERVER\Share`), ensure the server computer is on the same network

### Import from Access failing

- Ensure the `.accdb` or `.mdb` file is valid and not corrupted
- Close Microsoft Access if it has the file open
- The file should contain tables with matching names to import correctly

### Data seems missing after restart

- The database is loaded into memory on startup from `data/epa.db`
- If `data/epa.db` doesn't exist, a fresh database is created
- Always properly shut down the server (Ctrl+C) to ensure data is saved

---

## Version History

| Version  | Key Changes                                                                                                                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v4.0** | Comprehensive permission system (6-tab admin UI), activity log field-level diffs, Google Drive automatic backup, drag-and-drop file attachments, shared document folder browsing, file preview |
| **v3.4** | Client-side search bars, permission enforcement fixes, dropdown field options from Access                                                                                                      |
| **v3.3** | Reports system, forms view, enhanced activity log, file attachments                                                                                                                            |
| **v3.2** | Dashboard analytics, pre-built queries, context menus, data export                                                                                                                             |
| **v1.0** | Initial migration from Microsoft Access to web application                                                                                                                                     |

---

_Built for the Environmental Protection Agency — Ghana_
