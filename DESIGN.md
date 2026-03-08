# EPA Database System — Application Design & Visual Language

> A comprehensive guide to the look, feel, and design patterns of the EPA Database Management System. Use this as a reference to build applications with a similar visual identity.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Overall Layout](#overall-layout)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Spacing & Radius](#spacing--radius)
6. [Component Library](#component-library)
7. [Page-by-Page Breakdown](#page-by-page-breakdown)
8. [Interaction Patterns](#interaction-patterns)
9. [Responsive Behavior](#responsive-behavior)
10. [Theming](#theming)

---

## Design Philosophy

The application follows a **VS Code–inspired IDE aesthetic** — a professional, information-dense interface designed for data-heavy workflows. Key principles:

- **Dark-first design** with a toggleable light theme
- **High information density** without feeling cluttered — every pixel is purposeful
- **Layered elevation** — backgrounds get progressively lighter to indicate depth
- **Consistent micro-interactions** — 0.2s ease transitions on all interactive elements
- **Context-first navigation** — a narrow icon sidebar (activity bar) drives the view, with a dynamic secondary sidebar for sub-navigation
- **Card-based data presentation** — records are rendered as compact, scannable cards rather than spreadsheet rows
- **Modal-driven detail views** — clicking a card opens a rich, two-column modal with sections, inline editing, and document management

---

## Overall Layout

The app uses a **three-panel layout** inspired by VS Code:

```
┌──────────────────────────────────────────────────────────────────┐
│ [Activity Bar] │ [Sidebar]        │ [Main Content Area]         │
│ 48px wide      │ 260px wide       │ Remaining width             │
│ Icon buttons   │ Context-specific │ Dynamic content             │
│ vertically     │ navigation       │ (cards, tables, forms,      │
│ stacked        │ and filters      │  dashboards, modals)        │
│                │                  │                             │
│ ─── top ───    │                  │  ┌────────────────────────┐ │
│ 📊 Dashboard   │                  │  │ Tab Bar (optional)     │ │
│ 📋 Tables      │                  │  ├────────────────────────┤ │
│ 🔎 Queries     │                  │  │                        │ │
│ 📝 Forms       │                  │  │  Content Area          │ │
│ 📈 Reports     │                  │  │  (scrollable)          │ │
│ 📋 Scan Log    │                  │  │                        │ │
│ 🔍 Filter      │                  │  │                        │ │
│                │                  │  │                        │ │
│ ─── bot ───    │                  │  └────────────────────────┘ │
│ ⚙️ Settings    │                  │                             │
│                │                  │  ┌────────────────────────┐ │
│                │                  │  │ Status Bar (bottom)    │ │
│                │                  │  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Activity Bar (Left Strip)

- **Width**: 48px fixed
- **Background**: `var(--bg-primary)` — the darkest layer (`#1e1e1e`)
- **Buttons**: 40×40px icon buttons, centered, `border-radius: 8px`
- **Active state**: Left 2px accent-colored border, background `var(--bg-active)`
- **Hover**: Background `var(--bg-hover)`, smooth 0.2s transition
- **Divided into top group** (main navigation) and **bottom group** (settings)
- **Icons**: Unicode emoji characters (📊📋🔎📝📈⚙️) — not icon fonts or SVGs

### Sidebar

- **Width**: 260px fixed (collapsible on mobile)
- **Background**: `var(--bg-secondary)` — one step lighter (`#252526`)
- **Header**: 42px height, bold title, optional mobile close button
- **Content**: Dynamic — renders navigation items, table lists, or filter controls
- **Nav items**: Full-width buttons with emoji prefix, `padding: 8px 16px`, rounded `6px`
- **Active nav item**: `var(--accent)` background at 15% opacity, white text

### Main Content Area

- **Background**: `var(--bg-primary)` — base layer
- **Padding**: Typically `20px`, max-width `1400px` for content containers
- **Tab bar**: Sits at the top, optional per-view, `32px` height

### Status Bar

- **Height**: 24px
- **Background**: `var(--accent)` (`#0078d4`) — the signature blue strip
- **Position**: Fixed at bottom, full width
- **Content**: User name + role badge on left; theme toggle, version, sign out on right
- **Font**: 11px, white text

---

## Color System

### Dark Theme (Default)

| Token            | Hex       | Usage                                        |
| ---------------- | --------- | -------------------------------------------- |
| `--bg-primary`   | `#1e1e1e` | Base background — activity bar, main content |
| `--bg-secondary` | `#252526` | Sidebar, modals, dropdowns                   |
| `--bg-tertiary`  | `#2d2d2d` | Cards, input backgrounds, hover states       |
| `--bg-elevated`  | `#333333` | Elevated cards, tooltips                     |
| `--bg-hover`     | `#3a3a3a` | Hover state backgrounds                      |
| `--bg-active`    | `#404040` | Active/pressed state                         |
| `--bg-card`      | `#2a2a2a` | Data cards, filter groups                    |
| `--border`       | `#404040` | Primary borders                              |
| `--text-primary` | `#cccccc` | Body text                                    |
| `--text-bright`  | `#e0e0e0` | Emphasized text                              |
| `--text-white`   | `#ffffff` | Headings, strong emphasis                    |
| `--text-dim`     | `#808080` | Secondary text                               |
| `--text-muted`   | `#6a6a6a` | Disabled/placeholder text                    |
| `--accent`       | `#0078d4` | Primary action color (Microsoft Blue)        |

### Semantic Colors

Each semantic color has a solid variant and a `*-bg` variant at ~12% opacity for backgrounds:

| Color  | Solid     | Background               | Usage                                |
| ------ | --------- | ------------------------ | ------------------------------------ |
| Green  | `#4ec9b0` | `rgba(78,201,176,0.12)`  | Success, valid status, active badges |
| Blue   | `#569cd6` | `rgba(86,156,214,0.12)`  | Information, links, renewal tags     |
| Orange | `#ce9178` | `rgba(206,145,120,0.12)` | Warnings, pending states             |
| Yellow | `#dcdcaa` | `rgba(220,220,170,0.12)` | Caution, expiring soon               |
| Red    | `#f14c4c` | `rgba(241,76,76,0.12)`   | Error, danger, expired, delete       |
| Purple | `#c586c0` | `rgba(197,134,192,0.12)` | Special states, roles                |
| Teal   | `#4fc1ff` | `rgba(79,193,255,0.12)`  | Accent variant, count badges         |

### Light Theme

The light theme inverts all values — light backgrounds (`#f5f5f5` → `#ffffff`), dark text (`#333333` → `#000000`), slightly adjusted semantic colors for readability on white. Toggled via `[data-theme="light"]` CSS selector on `<html>`.

---

## Typography

### Font Stack

- **Primary**: `Inter` — weights 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold), 800 (extra-bold)
- **Monospace**: `JetBrains Mono` — weights 400, 500 — used for data values, code, and the login version badge
- **Fallback**: `system-ui, -apple-system, sans-serif`

### Type Scale

| Element           | Size      | Weight  | Color                          |
| ----------------- | --------- | ------- | ------------------------------ |
| Page titles       | 18px      | 700     | `--text-white`                 |
| Section headers   | 13px      | 600     | `--text-white`                 |
| Card titles       | 14px–16px | 600     | `--text-white`                 |
| Body text         | 13px      | 400     | `--text-primary`               |
| Labels            | 11px      | 500     | `--text-muted`                 |
| Small text/badges | 10px–11px | 500–600 | Varies                         |
| Data card fields  | 12px      | 400–500 | `--text-dim` / `--text-bright` |

### Letter Spacing

- Section titles: `0.3px` tracking
- Badge text: `0.5px` tracking
- Navigation items: Default (0)

---

## Spacing & Radius

### Border Radius Tokens

| Token           | Value  | Usage                                 |
| --------------- | ------ | ------------------------------------- |
| `--radius-sm`   | `6px`  | Buttons, input fields, small cards    |
| `--radius-md`   | `8px`  | Cards, dropdowns, context menus       |
| `--radius-lg`   | `12px` | Modals, large containers, sections    |
| `--radius-xl`   | `16px` | Dashboard welcome banner, large cards |
| `--radius-pill` | `50px` | Badge pills, status tags, role badges |

### Shadow System

| Token         | Value                         | Usage                    |
| ------------- | ----------------------------- | ------------------------ |
| `--shadow-sm` | `0 2px 6px rgba(0,0,0,0.3)`   | Subtle elevation (cards) |
| `--shadow-md` | `0 4px 16px rgba(0,0,0,0.4)`  | Dropdowns, popovers      |
| `--shadow-lg` | `0 8px 32px rgba(0,0,0,0.5)`  | Modals                   |
| `--shadow-xl` | `0 12px 48px rgba(0,0,0,0.6)` | Overlay panels           |

### Common Spacing

- **Container padding**: 20px
- **Card padding**: 14px–16px
- **Grid gaps**: 10px–16px
- **Section margins**: 12px–24px

---

## Component Library

### Buttons

```css
.btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
```

**Variants**:

- `.btn-primary`: `background: var(--accent)`, white text, blue hover glow
- `.btn-sm`: `padding: 4px 10px`, `font-size: 12px`
- `.btn-danger`: Red border and text on hover

### Tags / Badges

Small pill-shaped status indicators:

```css
.tag {
  padding: 2px 8px;
  border-radius: 50px;
  font-size: 11px;
  font-weight: 500;
}
```

**Color variants**: `.tag-green`, `.tag-blue`, `.tag-orange`, `.tag-yellow`, `.tag-red`, `.tag-purple` — each uses the semantic color + semi-transparent background.

### Data Cards

Records are displayed as cards in a responsive CSS Grid:

```css
.data-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
.data-card:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 12px rgba(0, 120, 212, 0.08);
}
```

**Structure**:

```
┌─────────────────────────────────────────┐
│ [Card Title]              [#ID] [📎 2] │  ← Header: title + ID + attachment count
│─────────────────────────────────────────│
│ Sector: Mining                         │  ← Field rows: label + value
│ Location: Tarkwa                       │
│ District: Tarkwa Nsuaem                │
│ File Number: EPA/WR/001                │
│ Permit Number: EP-2024-001            │
│ Date of Expiry: 2025-12-31            │
│─────────────────────────────────────────│
│ [🟢 Valid] [📋 Permit Issued]          │  ← Status badges at bottom
└─────────────────────────────────────────┘
```

Card grid: `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))` with `16px` gap.

### Modals

Modals use a **centered overlay** design with slide-up animation:

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal {
  width: 720px;
  max-width: 90vw;
  max-height: 85vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.2s ease;
}
```

**Permit/Keyword Modals** use a premium two-column layout:

- Header: gradient background, emoji icon, title, subtitle, three-dots "⋮" menu
- Body: Two-column CSS grid (`1fr 1fr`) of "PM cards" — each card is a section with right-click to edit
- Footer: Single "Close" button (Edit/Delete moved to context menus)

### Toasts

Notification toasts appear top-right with auto-dismiss:

```css
.toast {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  min-width: 250px;
  backdrop-filter: blur(8px);
  animation: slideIn 0.2s ease;
}
```

Variants: `.toast-success` (green), `.toast-error` (red), `.toast-info` (blue), `.toast-warning` (yellow).

### Context Menus (Right-Click)

Custom right-click menus replace the browser default in several contexts:

```css
.att-ctx-menu {
  /* Also: .pm-ctx-menu for record sections */
  position: fixed;
  z-index: 99999;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  min-width: 160px;
  padding: 4px 0;
}
```

Menu items: `padding: 8px 14px`, emoji + text label, hover background highlight. Danger items use red text with red-bg hover.

### File Attachment Items

Attachments use a card-style layout with thumbnail previews:

```css
.att-item-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}
```

- **Thumbnail**: 44×44px rounded square showing a preview of PDFs/images
- **Info**: File name (12px, semibold) + metadata line (uploader, date, size — 11px muted)
- **Actions**: Right-click context menu (Preview, Download, Open in New Tab, Copy Name, Delete)
- **Sort**: Newest files appear first (server returns `ORDER BY created_at DESC`)

### Input Fields

```css
input,
select,
textarea {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  padding: 8px 10px;
  transition: border-color 0.2s;
}
input:focus,
select:focus,
textarea:focus {
  border-color: var(--accent);
  outline: none;
}
```

---

## Page-by-Page Breakdown

### Login Screen

- **Full-page** gradient background (`135deg`, deep navy to dark blue)
- **Centered card**: `400px` wide, glass-morphism effect (`backdrop-filter: blur(12px)`), rounded `16px`
- **Logo**: 48px emoji or image, centered above the form
- **Title**: 20px bold, white
- **Inputs**: Full-width, dark background, 12px rounded
- **Submit button**: Full-width, accent blue, hover glow effect
- **Version badge**: Bottom of card, monospace font, 10px

### Dashboard

- **Welcome banner**: Full-width gradient card (blue → green at 12% opacity), user name + date/time + daily quote
- **Key metrics**: 4-column grid of metric cards — each has an emoji icon, large count-up number (700-weight, 28px), label, and a thin colored progress bar at the bottom
- **Secondary stats**: Row of pill-shaped stat badges showing totals and averages
- **Charts**: 2-column grid of Chart.js canvas charts (monthly trends as line/bar, status distribution as doughnut)
- **Activity feed**: Recent changes list, each with timestamp, action type badge, and description

### Table Data View

- **Sidebar**: Lists all 5 data tables with emoji icons and record counts in brackets
- **Content**: Header with table name + count, action buttons (New Record, Export, Clear)
- **Search bar**: Full-width, icon-prefixed, instant client-side filtering
- **Card grid**: Responsive auto-fill grid of data cards, each showing 5–6 key fields
- **Pagination**: Bottom bar with Previous/Next buttons and "Page X of Y" indicator

### Record Modal (Permit / Environmental Reports)

- **Header**: 20px gradient, large title with emoji, subtitle showing ID
- **Three-dots menu (⋮)**: Top-right, dropdown with "Delete Record" and "Export Record"
- **Body**: Two-column grid of section cards
- **Section cards**: Each card has:
  - Title bar (13px semibold, accent color)
  - Key-value field pairs (label 11px muted, value 13px bright)
  - Right-click → "Edit" → converts to inline form with Save/Cancel
- **Documents section**: Full-width card showing uploaded files with thumbnail previews and linked digitized documents

### Permit Filter

- **Header**: Title + action buttons (Search, Export, Clear)
- **Filter chips**: Row of pill-shaped active filter indicators with ✕ remove
- **4 grouped filter panels**: Each is a bordered card with section title and auto-fill grid of filter fields
  - Search & Identity (text inputs)
  - Classification & Area (dropdowns + text)
  - Status & Processing (dropdowns)
  - Date Ranges (date pickers)
- **Results table**: Responsive table with sortable columns, color-coded Remarks badges, and view buttons

### Settings

- **Tab navigation**: Horizontal pills/tabs for User Management, Permissions, Backup, Data Management, etc.
- **Content**: Forms and tables specific to each settings tab
- **User management**: Table with role badges, edit/delete buttons
- **Permissions**: Grid of permission cards with toggle switches

---

## Interaction Patterns

### Right-Click Editing (Record Modals)

1. Right-click any section card → context menu appears with "✏️ Edit" option
2. Section enters **edit mode**: blue border + shadow glow, fields become input elements
3. Save/Cancel buttons appear at the bottom of the section
4. Only the clicked section is editable — all others remain read-only
5. Documents section: right-click → "Enable Edit Mode" → upload zone appears + delete buttons

### Right-Click on Attachments

1. Right-click any file in the attachment list → context menu
2. Options: Preview, Download, Open in New Tab, Copy File Name, Delete (if permitted)
3. Double-click a file → opens preview modal

### Three-Dots Menu (⋮)

Located in modal headers for destructive/export actions:

- Delete Record (with confirmation modal)
- Export Record (downloads as .xlsx)

### Toast Notifications

- Appear top-right, auto-dismiss after 4 seconds
- Color-coded by type (success/error/info/warning)
- Multiple toasts stack vertically

### Confirmation Modals

Dangerous actions (delete, clear data, revert) use a dedicated confirmation modal:

- Warning icon, descriptive text, red "Confirm" button
- Cannot proceed without explicit click

---

## Responsive Behavior

### Breakpoints

- **Desktop** (>1024px): Full three-panel layout
- **Tablet** (768px–1024px): Sidebar overlay, 2-column card grid
- **Mobile** (<768px): Activity bar bottom-docked, sidebar drawer, single-column cards

### Mobile Adaptations

- Activity bar moves to **bottom** of screen as a horizontal icon strip
- Sidebar becomes a **slide-in drawer** with overlay backdrop
- Modal width: 95vw, height: 90vh
- Card grid: single column
- Tab bar: horizontally scrollable

---

## Theming

### Switching Themes

A moon/sun toggle in the status bar switches between dark and light themes by setting `data-theme="light"` on the `<html>` element. Preference is persisted in localStorage.

### Creating Custom Themes

Override the CSS custom properties in `:root` (dark) or `[data-theme="light"]`. All components reference these tokens — change the tokens, change the entire app.

### Key Theme Tokens to Override

```css
:root {
  /* Backgrounds (4 elevation layers) */
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-tertiary: #2d2d2d;
  --bg-elevated: #333333;

  /* Accent (primary action color) */
  --accent: #0078d4;

  /* Text (4 levels of emphasis) */
  --text-primary: #cccccc;
  --text-bright: #e0e0e0;
  --text-white: #ffffff;
  --text-muted: #6a6a6a;
}
```

---

## Summary

The EPA Database System presents a **dark, professional, IDE-like interface** optimized for administrative data management. Its visual identity is built on:

- VS Code's three-panel layout with an icon activity bar
- A 4-layer background elevation system for visual depth
- Inter font family for clear, modern typography
- Microsoft Blue (`#0078d4`) as the primary accent
- Card-based data presentation with hover border highlights
- Right-click context menus for non-destructive action discovery
- Modal-driven detail views with inline section editing
- Consistent 6px–12px border radius across all elements
- 0.2s ease transitions for all interactive states

Every component follows these patterns, creating a cohesive, professional feel suitable for government and enterprise data management applications.
