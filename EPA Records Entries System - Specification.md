# EPA Records Entries System — Complete Build Specification

> **Purpose:** This document provides a complete, detailed specification for building a standalone **EPA Records Entries System** Electron desktop application. It includes the backend API, database schema, frontend UI components, CSS styling, and user flows. An AI agent should be able to build the entire application from this specification alone.

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Backend API](#5-backend-api)
6. [Frontend Architecture](#6-frontend-architecture)
7. [UI Design System](#7-ui-design-system)
8. [Records Entries Page](#8-records-entries-page)
9. [Records Analytics Page](#9-records-analytics-page)
10. [Authentication & Permissions](#10-authentication--permissions)
11. [Excel Import System](#11-excel-import-system)
12. [Settings & Administration](#12-settings--administration)
13. [Electron Configuration](#13-electron-configuration)
14. [Build & Packaging](#14-build--packaging)

---

## 1. Application Overview

**Name:** EPA Records Entries System  
**Purpose:** Standalone desktop application for managing EPA quarterly records entries (Applications Received, Permitted Applications, Monitoring Records) and viewing analytics dashboards.  
**Target OS:** Windows (x64)  
**Port:** 3001 (to avoid conflict with main EPA app on 3000)  
**Data Directory:** `epa-records-data` in user's AppData

### Key Features

- Hierarchical tree navigation: Categories → Years → Quarters
- Master-detail split-panel view for records
- Add/Edit/Delete records with auto-calculated financial fields
- Excel file import with auto-detection of category, year, quarter
- Forward-fill logic for repeated data in imported spreadsheets
- Analytics dashboards with Chart.js visualizations (funnel, doughnut, bar, line charts)
- JWT authentication with role-based permissions
- Activity logging for all changes
- Dark/Light theme toggle (VS Code-inspired dark theme default)

### Pages (Activity Bar Navigation)

| Button            | View Key           | Description                               |
| ----------------- | ------------------ | ----------------------------------------- |
| Dashboard         | `dashboard`        | Welcome screen with summary stats         |
| Records           | `records`          | Records entries management (main feature) |
| Records Analytics | `recordsAnalytics` | Charts & analytics dashboards             |
| Users             | `users`            | User management (admin only)              |
| Settings          | `settings`         | Profile, password, admin settings         |

---

## 2. Technology Stack

| Component         | Technology                                   | Version   |
| ----------------- | -------------------------------------------- | --------- |
| Runtime           | Node.js                                      | 16+       |
| Desktop Framework | Electron                                     | 33.x      |
| Web Framework     | Express.js                                   | 4.21.x    |
| Database          | sql.js (SQLite in-memory, persisted to disk) | 1.10.x    |
| Auth              | jsonwebtoken + bcryptjs                      | 9.x / 2.x |
| Excel I/O         | xlsx (SheetJS)                               | 0.18.x    |
| File Upload       | multer                                       | 2.x       |
| Charts            | Chart.js (CDN)                               | 4.4.1     |
| Fonts             | Inter + JetBrains Mono (Google Fonts CDN)    | —         |
| Security          | helmet + express-rate-limit                  | 8.x / 8.x |
| Build             | electron-builder (NSIS)                      | 25.x      |

---

## 3. Project Structure

```
EPA Records Entries System/
├── electron-main.js          # Electron main process
├── server.js                 # Express API server
├── database.js               # Database initialization & schema
├── package.json              # Dependencies & build config
├── afterPack.js              # Post-build npm install hook
├── public/
│   ├── index.html            # Single-page application shell
│   ├── app.js                # Complete frontend SPA logic
│   └── styles.css            # Full CSS stylesheet
└── epa-records-data/         # Created at runtime
    ├── data/epa-records.db   # SQLite database file
    ├── uploads/excel/        # Temporary Excel upload storage
    └── backups/              # Database backups
```

---

## 4. Database Schema

### 4.1 `app_users` Table

```sql
CREATE TABLE IF NOT EXISTS app_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT DEFAULT '',
    role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
```

### 4.2 `activity_log` Table

```sql
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    full_name TEXT DEFAULT '',
    action TEXT,
    target_type TEXT DEFAULT '',
    target_name TEXT DEFAULT '',
    target_id INTEGER,
    details TEXT DEFAULT '',
    old_values TEXT DEFAULT '',
    new_values TEXT DEFAULT '',
    ip_address TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(username);
```

### 4.3 `user_permissions` Table

```sql
CREATE TABLE IF NOT EXISTS user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    table_name TEXT DEFAULT '*',
    record_id INTEGER,
    can_view INTEGER DEFAULT 1,
    can_create INTEGER DEFAULT 0,
    can_edit INTEGER DEFAULT 0,
    can_delete INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES app_users(id)
);
```

### 4.4 `feature_permissions` Table

```sql
CREATE TABLE IF NOT EXISTS feature_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    feature_category TEXT NOT NULL,
    feature_key TEXT NOT NULL,
    is_allowed INTEGER DEFAULT 1,
    UNIQUE(user_id, feature_category, feature_key),
    FOREIGN KEY (user_id) REFERENCES app_users(id)
);
```

### 4.5 `records_years` Table

```sql
CREATE TABLE IF NOT EXISTS records_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    year INTEGER NOT NULL,
    created_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(category, year)
);
```

### 4.6 `records_entries` Table (80 columns)

```sql
CREATE TABLE IF NOT EXISTS records_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    year INTEGER NOT NULL,
    quarter INTEGER NOT NULL CHECK(quarter IN (1,2,3,4)),
    company_name TEXT,
    client_id TEXT,
    contact_person TEXT,
    telephone TEXT,
    email TEXT,
    sector TEXT,
    type_of_activity TEXT,
    facility_location TEXT,
    district TEXT,
    mmda TEXT,
    jurisdiction TEXT,
    latitude TEXT,
    longitude TEXT,
    file_number TEXT,
    permit_number TEXT,
    permit_holder TEXT,
    permit_issue_date TEXT,
    permit_expiry_date TEXT,
    permit_renewal_date TEXT,
    processing_fee REAL,
    date_of_processing_fee TEXT,
    date_of_payment_processing TEXT,
    permit_fee REAL,
    date_of_permit_fee TEXT,
    date_of_payment_permit TEXT,
    invoice_number TEXT,
    date_of_invoice TEXT,
    amount_to_pay REAL,
    amount_paid REAL,
    balance REAL,
    date_of_payment TEXT,
    total_amount REAL,
    date_of_receipt TEXT,
    date_of_screening TEXT,
    date_of_draft_receipt TEXT,
    date_of_revised_receipt TEXT,
    date_review_sent TEXT,
    date_of_emp_submission TEXT,
    date_of_trc TEXT,
    date_sent_head_office TEXT,
    date_received_head_office TEXT,
    tentative_date TEXT,
    group_name TEXT,
    coordinating_officer TEXT,
    monitoring_status TEXT,
    compliance_status TEXT,
    compliance_date TEXT,
    environmental_report TEXT,
    due_date_reporting TEXT,
    reporting_days TEXT,
    officer_on_file TEXT,
    application_status TEXT,
    status TEXT DEFAULT 'Pending',
    remarks TEXT,
    is_forward_filled TEXT DEFAULT '',
    processing_period TEXT,
    effective_date TEXT,
    invoice_number_processing TEXT,
    invoice_number_permit TEXT,
    processing_paid REAL,
    permit_paid REAL,
    nsps TEXT,
    additional_officers TEXT,
    administrative_penalty REAL,
    created_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_records_entries_cat ON records_entries(category, year, quarter);
CREATE INDEX IF NOT EXISTS idx_records_entries_company ON records_entries(company_name);
```

---

## 5. Backend API

### 5.1 Authentication

#### `POST /api/login`

Rate-limited (5 attempts per 15 minutes per IP).

```json
// Request
{ "username": "admin", "password": "admin123" }
// Response
{
  "token": "eyJhbG...",
  "user": { "id": 1, "username": "admin", "role": "admin", "fullName": "Administrator" }
}
```

Token: JWT with 12-hour expiry. All subsequent API calls require `Authorization: Bearer <token>` header.

#### `GET /api/me` — Get current user profile

#### `POST /api/change-password`

```json
{ "currentPassword": "old", "newPassword": "new" }
```

#### `GET /api/setup/check` — Returns `{ needsSetup: true }` if no users exist

#### `POST /api/setup/init` — Creates first admin account (only works when no users exist)

```json
{ "username": "admin", "password": "pass", "fullName": "Administrator" }
```

### 5.2 User Management (Admin Only)

| Method   | Path             | Description                      |
| -------- | ---------------- | -------------------------------- |
| `GET`    | `/api/users`     | List all users                   |
| `POST`   | `/api/users`     | Create user                      |
| `PUT`    | `/api/users/:id` | Update user                      |
| `DELETE` | `/api/users/:id` | Delete user (cannot delete self) |

#### `GET /api/users/:id/permissions` — Get table permissions

#### `PUT /api/users/:id/permissions` — Set table permissions

```json
{
  "permissions": [
    {
      "table_name": "*",
      "can_view": 1,
      "can_create": 1,
      "can_edit": 1,
      "can_delete": 0
    }
  ]
}
```

#### `GET /api/users/:id/features` — Get feature permissions

#### `PUT /api/users/:id/features` — Set feature permissions

```json
{
  "features": [
    { "category": "page", "key": "records", "allowed": 1 },
    { "category": "page", "key": "recordsAnalytics", "allowed": 1 }
  ]
}
```

### 5.3 Records Years

#### `GET /api/records/years/:category`

Returns years for a category with entry counts per quarter.

- Valid categories: `applications_received`, `permitted_applications`, `monitoring_records`

```json
{
  "years": [
    {
      "id": 1,
      "category": "applications_received",
      "year": 2024,
      "created_by": "admin",
      "created_at": "..."
    }
  ],
  "counts": { "2024": { "1": 115, "2": 98, "3": 210, "4": 0 } }
}
```

#### `POST /api/records/years`

```json
{ "category": "applications_received", "year": 2025 }
```

#### `DELETE /api/records/years/:category/:year` (Admin only)

Fails if entries exist. Returns `{ "ok": true }`.

### 5.4 Records Entries CRUD

#### `GET /api/records/entries/:category/:year/:quarter`

Optional query: `?search=keyword` (searches company_name, sector, file_number, permit_number, district, status)

```json
{ "rows": [...], "total": 150 }
```

#### `GET /api/records/entry/:id`

Returns single record object.

#### `POST /api/records/entries`

```json
{
  "category": "applications_received",
  "year": 2024,
  "quarter": 1,
  "company_name": "ABC Ltd",
  "sector": "Manufacturing",
  "status": "Pending",
  "...other fields..."
}
```

- Validates category is in allowed list
- Filters body fields against valid columns from PRAGMA
- Empty strings converted to NULL
- Auto-sets `created_by` to authenticated user
- Auto-creates year in `records_years` if not exists
- Returns created record

#### `PUT /api/records/entry/:id`

Same body format as POST (partial updates allowed). Auto-sets `updated_at`.

#### `DELETE /api/records/entry/:id`

Returns `{ "ok": true }`.

### 5.5 Bulk Import

#### `POST /api/records/import/:category/:year/:quarter`

```json
{
  "rows": [
    { "company_name": "A", "sector": "Energy", "...": "..." },
    { "company_name": "B", "sector": "Mining", "...": "..." }
  ],
  "ffillCols": ["tentative_date", "group_name", "coordinating_officer"]
}
```

**Forward-Fill Logic:** For columns in `ffillCols`, if a row has an empty value, use the last non-empty value from a previous row. Mark forward-filled rows with column names in `is_forward_filled`.

Returns `{ "ok": true, "inserted": 150 }`.

### 5.6 Excel Import

#### `POST /api/records/excel-parse` (multipart, field: `file`)

Accepts .xlsx/.xls files. Returns parsed preview:

```json
{
  "filename": "Monitoring_2024.xlsx",
  "detectedCategory": "monitoring_records",
  "detectedYear": 2024,
  "sheets": [
    {
      "sheetName": "Q1",
      "detectedQuarter": 1,
      "rowCount": 245,
      "columnsFound": ["company_name", "sector", "..."],
      "preview": [
        /* first 10 rows */
      ],
      "allRows": [
        /* all parsed rows */
      ]
    }
  ]
}
```

**Auto-detection rules:**

- Category from filename: `MONITORING` → `monitoring_records`, `PERMITTED` → `permitted_applications`, `APPLICATION|RECEIVED` → `applications_received`
- Year: First 4-digit number in filename
- Quarter from sheet name: `Q1|1ST|FIRST` → 1, `Q2|2ND|SECOND` → 2, etc.

**Header mapping:** Normalizes Excel column headers to database column names. Over 80 mappings including:

- `"company name"` → `company_name`
- `"date of receipt"` → `date_of_receipt`
- `"gps coordinates"` → parsed into `latitude`/`longitude`
- `"processing fee"` → `processing_fee`
- etc.

#### `POST /api/records/excel-import`

```json
{
  "category": "monitoring_records",
  "year": 2024,
  "sheets": [
    { "sheetName": "Q1", "quarter": 1, "rows": [...] },
    { "sheetName": "Q2", "quarter": 2, "rows": [...] }
  ],
  "ffillCols": ["tentative_date", "group_name", "coordinating_officer"]
}
```

Returns `{ "ok": true, "totalInserted": 425, "sheetResults": [...] }`.

#### `POST /api/records/excel-scan`

Scans the app root directory for .xlsx files, auto-detects metadata, and batch-imports all found files.

### 5.7 Analytics

#### `GET /api/records/analytics`

Optional query params: `?year=2024&sector=Manufacturing`

```json
{
  "categoryTotals": [{ "category": "applications_received", "cnt": 450 }, ...],
  "statusDistribution": [{ "status": "Pending", "cnt": 200 }, ...],
  "sectorDistribution": [{ "sector": "Manufacturing", "cnt": 245 }, ...],
  "revenueByMmda": [{ "mmda": "Accra", "proc_fees": 45000, "perm_fees": 67000, "total": 112000 }, ...],
  "quarterlyVolume": [{ "year": 2024, "quarter": 1, "category": "applications_received", "cnt": 115 }, ...],
  "funnel": { "received": 800, "permitted": 650 },
  "years": [2024, 2023, 2022],
  "sectors": ["Energy", "Manufacturing", ...]
}
```

### 5.8 Admin Records Management

#### `GET /api/records/admin/stats`

```json
{
  "stats": [
    {
      "category": "...",
      "year": 2024,
      "quarter": 1,
      "cnt": 245,
      "first_import": "...",
      "last_import": "..."
    }
  ],
  "total": 1850
}
```

#### `POST /api/records/admin/bulk-delete`

```json
{ "category": "applications_received", "year": 2024, "quarter": 1 }
```

#### `POST /api/records/admin/delete-selected`

```json
{ "ids": [1, 5, 12, 87] }
```

### 5.9 Activity Log

#### `GET /api/activity` (Admin only)

Query: `?page=1&limit=50&search=keyword&user=admin`

```json
{
  "rows": [{ "id": 1, "username": "admin", "action": "create_record_entry", "target_type": "applications_received", "target_name": "...", "created_at": "...", "..." }],
  "total": 500, "page": 1, "limit": 50, "pages": 10,
  "users": ["admin", "user1"]
}
```

---

## 6. Frontend Architecture

### 6.1 Single-Page Application Structure

The app is a single HTML page (`index.html`) with all UI rendered dynamically by `app.js`. Navigation is handled by an activity bar (left sidebar) that triggers view switching.

### 6.2 Global State Object

```javascript
const state = {
  token: null,
  user: null,
  currentView: "dashboard",
  theme: localStorage.getItem("epa_rec_theme") || "dark",
  // Records module
  recCategory: null, // 'applications_received' | 'permitted_applications' | 'monitoring_records'
  recYear: null, // e.g., 2024
  recQuarter: null, // 1-4
  recEntries: [], // current quarter's records
  recSelectedId: null, // selected record ID for inspector
  recTreeData: {}, // cached tree structure { category: { years, counts } }
};
```

### 6.3 View Router

```javascript
const VIEW_HANDLERS = {
  dashboard: renderDashboardView,
  records: renderRecordsView,
  recordsAnalytics: renderRecordsAnalyticsView,
  users: renderUsersView,
  settings: renderSettingsView,
  activity: renderActivityView,
};

function switchView(viewName) {
  state.currentView = viewName;
  // Update activity bar active state
  document.querySelectorAll(".activity-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
  // Update sidebar title
  const titles = {
    dashboard: "DASHBOARD",
    records: "RECORDS",
    recordsAnalytics: "ANALYTICS",
    users: "USERS",
    settings: "SETTINGS",
    activity: "ACTIVITY LOG",
  };
  document.getElementById("sidebar-title").textContent =
    titles[viewName] || viewName.toUpperCase();
  // Call view handler
  const handler = VIEW_HANDLERS[viewName];
  if (handler) handler();
}
```

### 6.4 API Helper

```javascript
async function api(url, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers["Authorization"] = "Bearer " + state.token;
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}
```

### 6.5 Utility Functions

```javascript
function escHtml(s) {
  /* Escape HTML entities */
}
function formatDate(s) {
  /* Format ISO date to readable string */
}
function formatTimeAgo(dateStr) {
  /* "2 hours ago" style */
}
function toast(message, type) {
  /* Show toast notification: success/error/info */
}
```

---

## 7. UI Design System

### 7.1 Theme Variables (CSS Custom Properties)

```css
:root {
  /* Dark Theme (default) */
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #1c2128;
  --bg-elevated: #21262d;
  --bg-hover: rgba(255, 255, 255, 0.04);
  --bg-active: rgba(255, 255, 255, 0.08);
  --text-primary: #c9d1d9;
  --text-white: #e6edf3;
  --text-bright: #f0f6fc;
  --text-muted: #8b949e;
  --text-dim: #6e7681;
  --border: #30363d;
  --accent: #58a6ff;
  --green: #4ec9b0;
  --green-bg: rgba(78, 201, 176, 0.12);
  --red: #f85149;
  --red-bg: rgba(248, 81, 73, 0.12);
  --yellow: #e3b341;
  --yellow-bg: rgba(227, 179, 65, 0.12);
  --blue: #58a6ff;
  --blue-bg: rgba(88, 166, 255, 0.12);
  --purple: #bc8cff;
  --purple-bg: rgba(188, 140, 255, 0.12);
  --orange: #f0883e;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 999px;
  --transition: 0.15s ease;
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f6f8fa;
  --bg-tertiary: #eef1f5;
  --bg-elevated: #e1e4e8;
  --bg-hover: rgba(0, 0, 0, 0.04);
  --bg-active: rgba(0, 0, 0, 0.08);
  --text-primary: #24292f;
  --text-white: #1f2328;
  --text-bright: #0d1117;
  --text-muted: #57606a;
  --text-dim: #6e7781;
  --border: #d0d7de;
  --accent: #0969da;
  --green: #1a7f37;
  --red: #cf222e;
  --yellow: #9a6700;
}
```

### 7.2 Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ [Activity Bar] │ [Sidebar]    │ [Main Content Area]     │
│  44px wide     │  260px wide  │  flex: 1                │
│                │              │  ┌─[Tab Bar]──────────┐ │
│  Dashboard     │  Tree nav    │  │ 📂 Records Entries │ │
│  Records       │  or          │  ├───────────────────┤  │
│  Analytics     │  sidebar     │  │                   │  │
│  Users         │  items       │  │  [Content]        │  │
│  Settings      │              │  │                   │  │
│                │              │  └───────────────────┘  │
├────────────────┴──────────────┴─────────────────────────┤
│ [Status Bar] - User info, theme toggle, version         │
└─────────────────────────────────────────────────────────┘
```

### 7.3 Font Stack

```css
body {
  font-family:
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  font-size: 13px;
}
/* Import from Google Fonts: */
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap");
```

### 7.4 Common Button Styles

```css
.btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition);
}
.btn:hover {
  background: var(--bg-elevated);
}
.btn-primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.btn-primary:hover {
  opacity: 0.9;
}
.btn-sm {
  padding: 5px 12px;
  font-size: 12px;
}
.btn-xs {
  padding: 3px 8px;
  font-size: 11px;
  border-radius: 4px;
}
.btn-danger {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
```

### 7.5 Modal System

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}
.modal {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.modal-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
}
```

### 7.6 Toast Notifications

```css
.toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.toast {
  padding: 12px 20px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  animation: slideIn 0.3s ease;
}
.toast-success {
  background: #1a7f37;
}
.toast-error {
  background: #cf222e;
}
.toast-info {
  background: var(--accent);
}
```

---

## 8. Records Entries Page

### 8.1 Sidebar — Tree Navigation

The sidebar shows a file-explorer-style tree:

```
📋 Applications Received (450)
  ▸ 2024 (350)
    Q1 (Jan–Mar) [115]
    Q2 (Apr–Jun) [98]
    Q3 (Jul–Sep) [137]
    Q4 (Oct–Dec) [0]
  ▸ 2023 (100)
  + Add Year
✅ Permitted Applications (312)
  ▸ 2024 (200)
  + Add Year
📊 Monitoring Records (890)
  ▸ 2024 (600)
  + Add Year
```

**Tree node CSS classes:**

- `.rec-tree` — Container
- `.rec-tree-node` — Each clickable level (category/year/quarter)
- `.rec-tree-root` — Category-level node (bold)
- `.rec-tree-arrow` — Expand/collapse indicator (`▸` / `▾`)
- `.rec-tree-icon` — Emoji icon
- `.rec-tree-label` — Text label
- `.rec-tree-badge` — Count badge (pill-shaped)
- `.rec-tree-children` — Nested container (padding-left: 12px)
- `.rec-tree-year` — Year node (padding-left: 20px)
- `.rec-tree-quarter` — Quarter node (padding-left: 40px)
- `.rec-tree-active` — Currently selected quarter (blue highlight, left border)
- `.rec-tree-add` — "+ Add Year" button
- `.rec-tree-empty` — "No years yet" text

**Constants:**

```javascript
const REC_CATEGORIES = [
  { key: "applications_received", label: "Applications Received", icon: "📋" },
  {
    key: "permitted_applications",
    label: "Permitted Applications",
    icon: "✅",
  },
  { key: "monitoring_records", label: "Monitoring Records", icon: "📊" },
];

const REC_QUARTER_LABELS = {
  1: "Q1 (Jan–Mar)",
  2: "Q2 (Apr–Jun)",
  3: "Q3 (Jul–Sep)",
  4: "Q4 (Oct–Dec)",
};
```

### 8.2 Content Area — Workspace Layout

When a quarter is selected, the content area shows:

```
┌──────────────────────────────────────────────────────────┐
│ Breadcrumbs: Records Entries › Applications Received ›   │
│              2024 › Q1 (Jan–Mar)                         │
├──────────────────────────────────────────────────────────┤
│ Toolbar: [🔍 Search...] 115 results  [CSV] [+ New Entry]│
├──────────────────────────────────────────────────────────┤
│ Master Table (flex:1)     │ Inspector Panel (420px)      │
│ ┌────────────────────────┐│ ┌──────────────────────────┐ │
│ │ #  Company  Date  Sec. ││ │ Company Name             │ │
│ │ 1  ABC Ltd  01/24 Mfg  ││ │ ──────────── [Edit][Del] │ │
│ │ 2  XYZ Inc  01/24 Enrg ││ │ Status: ●Pending         │ │
│ │ 3  ...                 ││ │ Created: 2024-01-15      │ │
│ │                        ││ │                          │ │
│ │                        ││ │ ─ Identification ─       │ │
│ │                        ││ │ Client ID: CLI-001       │ │
│ │                        ││ │ Contact: John Doe        │ │
│ │                        ││ │ Phone: +233-xxx          │ │
│ │                        ││ │                          │ │
│ │                        ││ │ ─ Financial ─            │ │
│ │                        ││ │ Proc Fee: GHS 500.00     │ │
│ │                        ││ │ Permit Fee: GHS 1,200.00 │ │
│ │                        ││ │ Total: GHS 1,700.00      │ │
│ └────────────────────────┘│ └──────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 8.3 Master Table Columns

| #   | Column          | CSS Class          | Width  |
| --- | --------------- | ------------------ | ------ |
| 1   | Row Number      | `.rec-cell-mono`   | 40px   |
| 2   | Company Name    | `.rec-cell-name`   | flex:2 |
| 3   | Date of Receipt | `.rec-cell-date`   | 100px  |
| 4   | Sector          | `.rec-cell-sector` | 150px  |
| 5   | Status          | `.rec-status-chip` | 120px  |

**Status chip colors:**

- `Pending` → `.rec-status-pending` (yellow)
- `Permit Issued` / `Completed` → `.rec-status-permitted` (green)
- `Expired` → `.rec-status-expired` (red)
- `Renewal` → `.rec-status-renewal` (blue)

### 8.4 Inspector Panel — Detail View

Shows all non-empty fields organized by section:

**Field Sections (REC_FIELD_SECTIONS):**

1. **Identification** — company_name, client_id, contact_person, telephone, email
2. **Operational** — sector, type_of_activity, facility_location, district, mmda, jurisdiction
3. **Geospatial** — latitude, longitude
4. **Financial** — processing_fee, permit_fee, amount_to_pay, amount_paid, balance, total_amount, processing_paid, permit_paid, administrative_penalty (currency type, prefix "GHS")
5. **Permit** — file_number, permit_number, permit_holder, permit_issue_date, permit_expiry_date, permit_renewal_date, status, application_status
6. **Timeline** — date_of_receipt, date_of_screening, date_of_draft_receipt, date_of_revised_receipt, date_review_sent, date_of_emp_submission, date_of_trc, date_sent_head_office, date_received_head_office, date_of_invoice, date_of_payment, processing_period, effective_date
7. **Monitoring** — tentative_date, group_name, coordinating_officer, additional_officers, nsps, monitoring_status
8. **Compliance** — compliance_status, compliance_date, environmental_report, due_date_reporting, reporting_days, officer_on_file
9. **Admin** — remarks, invoice_number, invoice_number_processing, invoice_number_permit, is_forward_filled

Forward-filled values show a purple "auto-filled" tag: `.rec-ff-tag`

### 8.5 Inspector Panel — Add/Edit Form

Switches the inspector to form mode. Fields grouped by the same sections as above.

**Input types per field:**

- `text` — Standard text input
- `email` — Email with validation
- `date` — HTML date picker
- `currency` — Prefixed with "GHS" badge, monospace font, numeric
- `textarea` — Multi-line (min-height: 60px, resizable)
- `status` — Dropdown with options: Pending, Processing, Permit Issued, Expired, Renewal, Completed
- `suggest` — Text input with datalist autocomplete (e.g., sector suggestions from analytics data)

**Auto-calculations on change:**

- `total_amount = parseFloat(processing_fee || 0) + parseFloat(permit_fee || 0)`
- `balance = parseFloat(total_amount || 0) - parseFloat(amount_paid || 0)`

**Form CSS classes:**

- `.rec-form-header`, `.rec-form-title`, `.rec-form-context`
- `.rec-form`, `.rec-form-section-title`
- `.rec-form-group`, `.rec-form-label`, `.rec-required`
- `.rec-form-input`, `.rec-form-textarea`
- `.rec-currency-wrap`, `.rec-currency-prefix`, `.rec-form-currency`
- `.rec-form-actions`

### 8.6 Empty State (No Records)

When a quarter has no records, shows a drop zone:

```
┌─────────────────────────────────┐
│      📂                        │
│   No records yet               │
│   Click "+ New Entry" or drag   │
│   a CSV/Excel file here         │
└─────────────────────────────────┘
```

- CSS: `.rec-empty-zone`, `.rec-drop-active` (highlighted when file dragged over)
- Supports drag-and-drop of .csv and .xlsx files

### 8.7 Records CSS Classes (All `.rec-` prefixed)

See Section 7 for full styles + these records-specific classes:

- **Tree:** `.rec-tree`, `.rec-tree-node`, `.rec-tree-root`, `.rec-tree-arrow`, `.rec-tree-icon`, `.rec-tree-label`, `.rec-tree-badge`, `.rec-tree-children`, `.rec-tree-year`, `.rec-tree-quarter`, `.rec-tree-active`, `.rec-tree-add`, `.rec-tree-add-icon`, `.rec-tree-empty`
- **Breadcrumbs:** `.rec-breadcrumbs`, `.rec-bc-item`, `.rec-bc-sep`, `.rec-bc-current`
- **Toolbar:** `.rec-toolbar`, `.rec-toolbar-left`, `.rec-toolbar-right`, `.rec-search-box`, `.rec-result-count`
- **Layout:** `.rec-master-detail`, `.rec-master`, `.rec-master-dimmed`, `.rec-inspector`
- **Table:** `.rec-table`, `.rec-row`, `.rec-row-selected`, `.rec-row-new`, `.rec-cell-mono`, `.rec-cell-name`, `.rec-cell-date`, `.rec-cell-sector`, `.rec-table-empty`
- **Status:** `.rec-status-chip`, `.rec-status-permitted`, `.rec-status-pending`, `.rec-status-expired`, `.rec-status-renewal`
- **Empty:** `.rec-empty-zone`, `.rec-drop-active`, `.rec-empty-icon`, `.rec-empty-title`, `.rec-empty-sub`
- **Inspector:** `.rec-inspector-empty`, `.rec-inspector-empty-icon`, `.rec-inspector-empty-text`, `.rec-insp-header`, `.rec-insp-title`, `.rec-insp-actions`, `.rec-btn-danger`, `.rec-insp-meta`, `.rec-insp-fields`, `.rec-insp-section`, `.rec-insp-section-title`, `.rec-insp-field`, `.rec-insp-label`, `.rec-insp-value`, `.rec-insp-ghost`, `.rec-ff-tag`
- **Form:** `.rec-form-header`, `.rec-form-title`, `.rec-form-context`, `.rec-form`, `.rec-form-section-title`, `.rec-form-group`, `.rec-form-label`, `.rec-required`, `.rec-form-input`, `.rec-form-textarea`, `.rec-currency-wrap`, `.rec-currency-prefix`, `.rec-form-currency`, `.rec-form-actions`
- **Welcome:** `.rec-welcome`, `.rec-welcome-icon`, `.rec-welcome h2`, `.rec-welcome p`

---

## 9. Records Analytics Page

### 9.1 Sidebar

Simple sidebar with two links:

1. "📊 Analytics Overview" (active)
2. "📂 Records Explorer" (switches to records view)

### 9.2 Content Layout

```
┌──────────────────────────────────────────────────────────┐
│  📊 Records Analytics                                    │
│  ┌─ Mini Stats ──────────────────────────────────────┐   │
│  │ Total: 1,652  │ Apps: 450  │ Perm: 312  │ Mon: 890│   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  Filters: [Year ▼ All Years]  [Sector ▼ All Sectors]     │
│                                                          │
│  ┌─ Key Metrics (4 cards) ──────────────────────────┐   │
│  │  📋 Applications  │  ✅ Permitted  │ 📊 Monitoring │  │
│  │     450           │     312        │     890       │   │
│  │  [█████████████]  │  [████████]    │ [████████████]│   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Fulfillment Funnel ─────────────────────────────┐   │
│  │  Applications Received  [██████████████████] 800   │  │
│  │  Permitted              [████████████] 650 (81%)   │  │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Status Distribution ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐   │
│  │  Pending     [██████████████] 200                │    │
│  │  Processing  [██████████] 150                    │    │
│  │  Issued      [████████████████████████████] 950  │    │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Charts (side by side) ──────────────────────────┐   │
│  │  Sector Distribution     │  Revenue by MMDA       │  │
│  │  [Doughnut Chart]        │  [Stacked Bar Chart]   │  │
│  ├──────────────────────────┤                        │  │
│  │  Quarterly Volume        │                        │  │
│  │  [Line Chart]            │                        │  │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 9.3 Chart Configurations

**Sector Distribution (Doughnut):**

```javascript
new Chart(ctx, {
  type: "doughnut",
  data: {
    labels: sectors,
    datasets: [{ data: counts, backgroundColor: colorPalette }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        labels: { color: "var(--text-primary)", font: { size: 11 } },
      },
    },
  },
});
```

**Revenue by MMDA (Stacked Bar):**

```javascript
new Chart(ctx, {
  type: "bar",
  data: {
    labels: mmdaNames,
    datasets: [
      { label: "Processing Fees", data: procFees, backgroundColor: "#3b82f6" },
      { label: "Permit Fees", data: permFees, backgroundColor: "#10b981" },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { stacked: true },
      y: { stacked: true, ticks: { color: "var(--text-muted)" } },
    },
    plugins: { legend: { labels: { color: "var(--text-primary)" } } },
  },
});
```

**Quarterly Volume (Line):**

```javascript
new Chart(ctx, {
  type: 'line',
  data: {
    labels: quarterLabels, // "2024 Q1", "2024 Q2", ...
    datasets: [
      { label: 'Applications Received', data: [...], borderColor: '#3b82f6', fill: false },
      { label: 'Permitted', data: [...], borderColor: '#10b981', fill: false },
      { label: 'Monitoring', data: [...], borderColor: '#f97316', fill: false }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true } }
  }
});
```

### 9.4 Analytics CSS Classes

- `.rec-analytics-wrap` — Main wrapper (overflow-x: hidden)
- `.rec-an-filters-bar` — Filter dropdowns row
- `.rec-an-select` — Filter dropdown styling
- `.rec-an-funnel` — Funnel visualization container
- `.rec-an-funnel-bar` — Individual funnel bar
- `.rec-an-status-list` — Status distribution list
- `.rec-an-status-row` — Single status row
- `.rec-an-bar-track` — Background bar track
- `.rec-an-bar-fill` — Colored fill bar
- `.rec-an-bar-val` — Value label (monospace)
- `.rec-an-chart-wrap` — Chart container (height: 260px)
- `.rec-an-chart-wrap--wide` — Wide variant (height: 220px)

---

## 10. Authentication & Permissions

### 10.1 First-Run Setup

On first launch (no users in database), the app shows a setup screen asking the user to create an admin account.

### 10.2 Login Flow

1. App checks `GET /api/setup/check` — if `needsSetup: true`, show setup form
2. User submits credentials → `POST /api/login` → receives JWT token
3. Token stored in `state.token` and `localStorage`
4. All API calls include `Authorization: Bearer <token>` header
5. Token expires after 12 hours → redirect to login

### 10.3 Permission Model

- **Admin** — Full access to everything
- **User** — Access controlled by `feature_permissions` table
  - Page access: Which navigation buttons are visible
  - Feature access: Which specific features within pages are available

---

## 11. Excel Import System

### 11.1 Import Wizard Flow

1. User clicks "📥 Import Excel" button in toolbar (or drags file)
2. File uploaded via `POST /api/records/excel-parse`
3. Wizard modal opens showing:
   - Filename
   - Auto-detected category (dropdown to change)
   - Auto-detected year (number input to change)
   - List of sheets with checkboxes, detected quarters, row/column counts
   - Data preview table (first 5 rows, first 8 columns)
   - Total rows summary
4. User clicks "📥 Import N Records"
5. `POST /api/records/excel-import` called
6. Success toast, tree refreshed

### 11.2 Excel Wizard CSS Classes

- `.excel-wizard-filename` — File name display
- `.excel-wizard-row` — Horizontal row of fields
- `.excel-wizard-field` — Label + input group
- `.excel-wizard-select`, `.excel-wizard-input` — Styled form controls
- `.excel-wizard-section-title` — Section dividers
- `.excel-sheets-list` — Sheet list container
- `.excel-sheet-row` — Single sheet row
- `.excel-sheet-check` — Checkbox + name
- `.excel-sheet-name` — Sheet name text
- `.excel-quarter-sel` — Quarter dropdown per sheet
- `.excel-row-count`, `.excel-col-count` — Row/column counts
- `.excel-preview-table-wrap`, `.excel-preview-table` — Preview data table
- `.excel-wizard-summary` — Total rows summary box
- `.excel-no-preview` — "No data to preview" placeholder

### 11.3 Header Mapping (80+ mappings)

Excel column headers are normalized (lowercase, remove special chars) and mapped:

- `"company name"`, `"name of company"`, `"company"` → `company_name`
- `"sector"`, `"type of undertaking"`, `"classification"` → `sector`
- `"date of receipt"`, `"receipt date"`, `"date received"` → `date_of_receipt`
- `"processing fee"`, `"proc. fee"` → `processing_fee`
- `"permit fee"`, `"perm. fee"` → `permit_fee`
- `"gps"`, `"gps coordinates"` → parsed into `latitude` / `longitude`
- `"file number"`, `"file no"`, `"file no."` → `file_number`
- `"permit number"`, `"permit no"` → `permit_number`
- `"district"` → `district`
- `"location"`, `"facility location"` → `facility_location`
- `"mmda"` → `mmda`
- `"status"`, `"permit status"` → `status`
- ... and many more

---

## 12. Settings & Administration

### 12.1 Settings Sub-Pages

- **Profile** — View username, full name, role (read-only)
- **Change Password** — Current + new password form
- **Records Admin** (admin only) — Bulk data management for records_entries

### 12.2 Records Admin Panel

Shows per-category/year/quarter stats with delete buttons.

- CSS: `.rec-admin-header`, `.rec-admin-stat-card`, `.rec-admin-stat-val`, `.rec-admin-stat-label`, `.rec-admin-actions`, `.rec-admin-category`, `.rec-admin-cat-header`, `.rec-admin-cat-title`, `.rec-admin-cat-count`, `.rec-admin-empty`, `.rec-admin-table`, `.rec-admin-error`

---

## 13. Electron Configuration

### 13.1 Main Process (`electron-main.js`)

```javascript
const { app, BrowserWindow } = require("electron");
const path = require("path");

const APP_DIR = path.join(app.getPath("userData"), "epa-records-data");
process.env.EPA_APP_ROOT = APP_DIR;

let mainWindow;

app.whenReady().then(async () => {
  const { start } = require("./server");
  await start();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "EPA Records Entries System",
    icon: path.join(__dirname, "public", "epa logo.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadURL("http://localhost:3001");
});

app.on("window-all-closed", () => app.quit());
```

### 13.2 Port

Server runs on port **3001** (not 3000, to avoid conflict with main app).

---

## 14. Build & Packaging

### 14.1 package.json Build Config

```json
{
  "name": "epa-records-entries-system",
  "version": "1.0.0",
  "main": "electron-main.js",
  "build": {
    "appId": "com.epa.records",
    "productName": "EPA Records Entries System",
    "directories": { "output": "dist" },
    "files": [
      "electron-main.js",
      "server.js",
      "database.js",
      "afterPack.js",
      "package.json",
      "public/**/*",
      "node_modules/**/*"
    ],
    "win": {
      "target": "nsis",
      "icon": "public/epa logo.png"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": true,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "public/epa logo.png",
      "uninstallerIcon": "public/epa logo.png",
      "installerHeaderIcon": "public/epa logo.png",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "EPA Records Entries System"
    },
    "afterPack": "./afterPack.js"
  },
  "scripts": {
    "start": "electron .",
    "dev": "node server.js",
    "build": "electron-builder --win"
  }
}
```

### 14.2 afterPack.js

Runs `npm install --production` in the packed app directory to ensure `node_modules` are present.

### 14.3 Build Command

```bash
npm run build
```

Output: `dist/EPA Records Entries System Setup 1.0.0.exe`

---

## Activity Bar SVG Icons

### Records Entries Icon

```html
<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
  <path
    d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 10H6v-2h12v2zm0-4H6v-2h12v2z"
  />
</svg>
```

### Records Analytics Icon

```html
<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
  <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
  <path d="M21 18H3v2h18v-2z" opacity=".5" />
</svg>
```

### Dashboard Icon

```html
<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
  <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
</svg>
```

### Users Icon

```html
<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
  <path
    d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
  />
</svg>
```

### Settings Icon

```html
<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
  <path
    d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"
  />
</svg>
```

---

_End of Specification_
