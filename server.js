// server.js — EPA Database Web System v4.0
const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
let MDBReader = null; // Loaded dynamically (ESM module)
const fs = require("fs");
const os = require("os");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const XLSX = require("xlsx");
const { google } = require("googleapis");
const cron = require("node-cron");
const archiver = require("archiver");
const QRCode = require("qrcode");
const { initDatabase, getDb, saveToDisk } = require("./database");

// Load mdb-reader dynamically (ESM-only package)
async function loadMdbReader() {
  if (!MDBReader) {
    const mod = await import("mdb-reader");
    MDBReader = mod.default;
  }
  return MDBReader;
}

// APP_ROOT can be overridden by Electron to point to writable userData folder
let APP_ROOT = process.env.EPA_APP_ROOT || __dirname;

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET =
  process.env.JWT_SECRET || "epa-secret-key-change-in-production-2026";

// ── Security middleware ──────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: {
    error: "Too many login attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Serve XLSX browser bundle for client-side Excel operations
app.get("/xlsx.full.min.js", (req, res) => {
  res.sendFile(path.join(__dirname, "node_modules", "xlsx", "dist", "xlsx.full.min.js"));
});

// ── File upload configuration (Access files) ─────────────────
const UPLOAD_DIR = path.join(APP_ROOT, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".accdb" || ext === ".mdb") {
      cb(null, true);
    } else {
      cb(new Error("Only .accdb and .mdb files are accepted"));
    }
  },
});

// ── File attachment upload configuration ─────────────────────
const FILES_DIR = path.join(APP_ROOT, "files");
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });
const fileUpload = multer({
  dest: FILES_DIR,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per file
});

const DATA_TABLES = ["PERMIT", "MOVEMENT", "WASTE", "Stores", "tbl_keyword"];

const ACCESS_TABLE_MAP = {
  PERMIT: "PERMIT",
  MOVEMENT: "MOVEMENT",
  WASTE: "WASTE",
  Stores: "Stores",
  tbl_keyword: "tbl_keyword",
  Permit: "PERMIT",
  Movement: "MOVEMENT",
  Waste: "WASTE",
  stores: "Stores",
  STORES: "Stores",
  tbl_Keyword: "tbl_keyword",
  TBL_KEYWORD: "tbl_keyword",
};

const PERMIT_MODAL_DROPDOWN_FIELDS = new Set([
  "ClassificationOfUndertaking",
  "FileLocation",
  "District",
  "Jurisdiction",
  "PermittedBy",
  "ApplicationStatusII",
  "ApplicationStatus",
  "Compliance",
  "FileReturned",
]);

const CANONICAL_APPLICATION_INFO_OPTIONS = [
  "New Application",
  "Renewal of Permit",
];

const PERMIT_FILE_LOCATION_OPTIONS = [
  "EMP 1",
  "EMP 2",
  "EMP 3",
  "EMP 4",
  "PER 1",
  "PER 2",
  "PER 3",
  "PER 4",
  "AER 1",
  "AER 2",
  "AER 3",
  "USED OIL 1",
  "USED OIL 2",
  "USED OIL 3",
  "USED OIL 4",
  "MANUFACTURING 1",
  "MANUFACTURING 2",
  "MANUFACTURING 3",
  "MANUFACTURING 4",
  "HOSPITALITY 1",
  "HOSPITALITY 2",
  "HOSPITALITY 3",
  "HOSPITALITY 4",
  "HOSPITALITY 5",
  "HOSPITALITY 6",
  "CHEM & PEST 1",
  "CHEM & PEST 2",
  "CHEM & PEST 3",
  "CHEM & PEST 4",
  "CHEM & PEST 5",
  "CHEM & PEST 6",
  "INFRASTRUCTURE 1",
  "INFRASTRUCTURE 2",
  "INFRASTRUCTURE 3",
  "INFRASTRUCTURE 4",
  "INFRASTRUCTURE 5",
  "INFRASTRUCTURE 6",
  "INFRASTRUCTURE 7",
  "INFRASTRUCTURE 8",
  "INFRASTRUCTURE 9",
  "INFRASTRUCTURE 10",
  "INFRASTRUCTURE 11",
  "INFRASTRUCTURE 12",
  "MINING 1",
  "MINING 2",
  "FUEL STATION 1",
  "FUEL STATION 2",
  "FUEL STATION 3",
  "FUEL STATION 4",
  "FUEL STATION 5",
  "FUEL STATION 6",
  "FUEL STATION 7",
  "FUEL STATION 8",
  "FUEL STATION 9",
  "GAS STATION 1",
  "GAS STATION 2",
  "GAS STATION 3",
  "FUEL & GAS STATION 1",
  "FUEL & GAS STATION 2",
  "FUEL & GAS STATION 3",
  "HOSPITALS & CLINICS 1",
  "HOSPITALS & CLINICS 2",
  "HOSPITALS & CLINICS 3",
  "HOSPITALS & CLINICS 4",
  "HOSPITALS & CLINICS 5",
  "HOSPITALS & CLINICS 6",
  "OIL & GAS 1",
  "OIL & GAS 2",
  "OIL & GAS 3",
  "OIL & GAS 4",
  "SSM 1",
  "SSM 2",
  "SSM 3",
  "SSM 4",
  "ENERGY 1",
  "ENERGY 2",
  "FORESTRY AGRIC 1",
  "FORESTRY AGRIC 2",
  "ADMIN 1",
  "ADMIN 2",
  "ADMIN 3",
  "ADMIN 4",
  "METRO & DISTRICT 1",
  "METRO & DISTRICT 2",
  "HEAD OFFICE 1",
  "HEADOFFICE 1",
  "HEADOFFICE 2",
  "HEADOFFICE 3",
  "HEADOFFICE 4",
  "DC 1",
  "DC 2",
  "DC 3",
  "DC 4",
  "DC 5",
  "DC 6",
  "DC 7",
  "DC 8",
  "DC 9",
  "DC 10",
  "DC 11",
  "DC 4 OR 11",
  "DC 12",
  "ELLEMBELLE 1",
  "ELLEMBELLE 2",
  "ELLEMBELLE 3",
  "ELLEMBELLE 4",
  "ELLEMBELLE 5",
  "TARKWA 1",
  "TARKWA 2",
  "TARKWA 3",
  "TARKWA 4",
  "GAS FILLING STATION 3",
  "CONFERENCE ROOM",
  "APO ROOM",
  "CONF. 2024",
  "DATA CENTRE",
  "RECORDS",
];

let accessPermitFileLocationCache = {
  cacheKey: "",
  values: null,
};

function sanitizeDropdownOptionValue(value) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (/^#+$/.test(normalized)) return "";
  if (/^#+.*$/.test(normalized)) return "";
  return normalized;
}

function getAccessFileCandidates() {
  return [
    path.join(APP_ROOT, "The Database.accdb"),
    path.join(__dirname, "The Database.accdb"),
    path.join(process.cwd(), "The Database.accdb"),
  ].filter((filePath, index, arr) => arr.indexOf(filePath) === index);
}

async function getAccessPermitFileLocations() {
  const accessFile = getAccessFileCandidates().find((filePath) =>
    fs.existsSync(filePath),
  );
  if (!accessFile) return [];

  const stat = fs.statSync(accessFile);
  const cacheKey = `${accessFile}:${stat.mtimeMs}:${stat.size}`;
  if (
    accessPermitFileLocationCache.values &&
    accessPermitFileLocationCache.cacheKey === cacheKey
  ) {
    return accessPermitFileLocationCache.values;
  }

  try {
    const buffer = fs.readFileSync(accessFile);
    await loadMdbReader();
    const reader = new MDBReader(buffer);
    const permitTableName = reader
      .getTableNames()
      .find((name) => ACCESS_TABLE_MAP[name] === "PERMIT");
    if (!permitTableName) return [];

    const rows = reader.getTable(permitTableName).getData();
    const values = mergeDistinctOptionValues(
      [],
      rows.map((row) => row.FileLocation),
    );
    accessPermitFileLocationCache = { cacheKey, values };
    return values;
  } catch {
    return [];
  }
}

function filterHiddenDropdownOptions(db, table, options) {
  const hiddenRows = db.all(
    "SELECT field_name, option_value FROM hidden_dropdown_options WHERE table_name = ?",
    [table],
  );
  if (!hiddenRows.length) return options;

  const hiddenByField = new Map();
  for (const row of hiddenRows) {
    if (!hiddenByField.has(row.field_name)) hiddenByField.set(row.field_name, []);
    hiddenByField.get(row.field_name).push(
      sanitizeDropdownOptionValue(row.option_value).toLowerCase(),
    );
  }

  for (const [field, list] of Object.entries(options)) {
    const hidden = hiddenByField.get(field) || [];
    options[field] = (list || []).filter(
      (value) => !hidden.includes(sanitizeDropdownOptionValue(value).toLowerCase()),
    );
  }
  return options;
}

function filterManagedDropdownFields(table, options) {
  if (table !== "PERMIT") return options;
  const filtered = {};
  for (const [field, values] of Object.entries(options)) {
    if (PERMIT_MODAL_DROPDOWN_FIELDS.has(field)) filtered[field] = values;
  }
  return filtered;
}

// ── Backup directory ─────────────────────────────────────────
const BACKUP_DIR = path.join(APP_ROOT, "backups");
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// ── Shared documents folder (configurable by admin) ──────────
let sharedDocsPath = "";
let cronJob = null; // for scheduled backups

// ── SSE clients for backup notifications ──
const sseClients = new Set();
function broadcastSSE(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch { sseClients.delete(res); }
  }
}

// ══════════════════════════════════════════════════════════════
//  Saved Queries — translated from Access
// ══════════════════════════════════════════════════════════════
const SAVED_QUERIES = {
  ACCOUNTS_STATUS: {
    name: "Accounts Status",
    description: "Permits with active financial status",
    category: "Financial",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE ApplicationStatus IN ('Processing Fee Invoice Issued','Paid Processing Fee','Permit Fee Invoice Issued','Paid Permit Fee','Permit Issued')`,
    params: [],
  },
  ALL_APPLICATIONS: {
    name: "All Applications",
    description: "All permits processed by or not by Sekondi Office",
    category: "General",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE Permitted_by_Sekondi_Office IN ('Yes','No')`,
    params: [],
  },
  EXPIRED_PERMITS: {
    name: "Expired Permits",
    description: "Permits past their expiration date",
    category: "Compliance",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE PermitExpirationDate IS NOT NULL AND PermitExpirationDate < date('now')`,
    params: [],
  },
  DUE_DATE_PAYMENT: {
    name: "Due Date for Payment",
    description: "Permits with payment due dates that have passed",
    category: "Financial",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE DueDateForPayment IS NOT NULL AND DueDateForPayment < date('now')`,
    params: [],
  },
  DUE_DATE_REPORTING: {
    name: "Due Date for Reporting",
    description: "Permits with reporting due dates that have passed",
    category: "Compliance",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE DueDateForReporting IS NOT NULL AND DueDateForReporting < date('now')`,
    params: [],
  },
  EXPIRING_VEHICLES: {
    name: "Expiring Vehicles",
    description: "Vehicles with expired licences, road worthy, or insurance",
    category: "Fleet",
    table: "MOVEMENT",
    sql: `SELECT * FROM MOVEMENT WHERE (ExpiryDate IS NOT NULL AND ExpiryDate < date('now')) OR (ExpiryDateOfRoadWealthy IS NOT NULL AND ExpiryDateOfRoadWealthy < date('now')) OR (ExpiryDateOfInsurance IS NOT NULL AND ExpiryDateOfInsurance < date('now'))`,
    params: [],
  },
  NEW_NOT_PERMITTED: {
    name: "New Applications Not Permitted",
    description: "New applications not yet issued a permit",
    category: "Processing",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE ApplicationStatusII = 'New Application' AND (DateOfIssueOfPermit IS NULL OR DateOfIssueOfPermit = '')`,
    params: [],
  },
  RENEWAL_NOT_PERMITTED: {
    name: "Renewals Not Permitted",
    description: "Renewal applications not yet issued a permit",
    category: "Processing",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE ApplicationStatusII = 'Renewal of Permit' AND (DateOfIssueOfPermit IS NULL OR DateOfIssueOfPermit = '')`,
    params: [],
  },
  SUBMITTED_DRAFT: {
    name: "Submitted Draft",
    description: 'Permits with "Submitted Draft" status',
    category: "Processing",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE ProjectStatus = 'Submitted Draft'`,
    params: [],
  },
  PAID_BOTH_NOT_ISSUED: {
    name: "Paid Both Fees - Not Issued",
    description: "Paid both fees but permit not yet issued",
    category: "Financial",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE (DateOfIssueOfPermit IS NULL OR DateOfIssueOfPermit = '') AND EnvironmentalManagementPlan = 'Paid both Processing & Permit Fee'`,
    params: [],
  },
  PERMIT_DUE_EMAIL: {
    name: "Permit Due - Email Not Sent",
    description: "Expired permits where notification email was not sent",
    category: "Compliance",
    table: "PERMIT",
    sql: `SELECT RegisteredNameOfUndertaking, ContactPerson, PermitNumber, PermitExpirationDate, Email, DateEmailSent FROM PERMIT WHERE (DateEmailSent IS NULL OR DateEmailSent = '') AND PermitExpirationDate IS NOT NULL AND PermitExpirationDate < date('now')`,
    params: [],
  },
  GENERAL_MOVEMENT: {
    name: "General Movement",
    description: "All vehicle movement records",
    category: "Fleet",
    table: "MOVEMENT",
    sql: `SELECT * FROM MOVEMENT`,
    params: [],
  },
  TODAYS_MOVEMENT: {
    name: "Today's Movement",
    description: "Vehicle movements departing today",
    category: "Fleet",
    table: "MOVEMENT",
    sql: `SELECT * FROM MOVEMENT WHERE DepartureDate = date('now')`,
    params: [],
  },
  SUMMARY_SHEET: {
    name: "Summary Sheet",
    description: "Permit count by Application Status (Sekondi office)",
    category: "Reports",
    table: "PERMIT",
    sql: `SELECT ApplicationStatus, COUNT(ClassificationOfUndertaking) AS Total FROM PERMIT WHERE Permitted_by_Sekondi_Office = 'Yes' GROUP BY ApplicationStatus ORDER BY Total DESC`,
    params: [],
    isAggregate: true,
  },
  PROJECT_STATUS: {
    name: "Project Status Summary",
    description: "Permit counts by Status and Classification",
    category: "Reports",
    table: "PERMIT",
    sql: `SELECT ApplicationStatus, ClassificationOfUndertaking, COUNT(*) AS Total FROM PERMIT GROUP BY ApplicationStatus, ClassificationOfUndertaking ORDER BY Total DESC`,
    params: [],
    isAggregate: true,
  },
  APP_RECEIVED_WITHIN: {
    name: "Applications Received Within Dates",
    description: "Permits received between two dates",
    category: "Search",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE DateOfReceiptOfApplication BETWEEN ? AND ?`,
    params: [
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
    ],
  },
  COMPLIANCE_ENFORCEMENT: {
    name: "Compliance Enforcement by Date",
    description: "Compliance enforcement records within a date range",
    category: "Compliance",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE Compliance = 'Compliance Enforcement' AND ComplianceDate BETWEEN ? AND ?`,
    params: [
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
    ],
  },
  COMPLIANCE_APP_STATUS: {
    name: "Compliance by Application Status",
    description: "Compliance Enforcement filtered by status",
    category: "Compliance",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE Compliance = 'Compliance Enforcement' AND ApplicationStatus = ?`,
    params: [
      {
        name: "status",
        label: "Application Status",
        type: "select",
        options: [
          "Application Received",
          "Processing Fee Invoice Issued",
          "Paid Processing Fee",
          "Application Under Review",
          "Additional Information Required",
          "Permit Fee Invoice Issued",
          "Paid Permit Fee",
          "Sent to Head Office",
          "Permit Issued",
        ],
      },
    ],
  },
  SEARCH_DISTRICT: {
    name: "Search by District",
    description: "Find permits by Sekondi status and district",
    category: "Search",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE Permitted_by_Sekondi_Office = ? AND District = ?`,
    params: [
      {
        name: "sekondi",
        label: "Permitted by Sekondi",
        type: "select",
        options: ["Yes", "No"],
      },
      { name: "district", label: "District", type: "text" },
    ],
  },
  SEARCH_JURISDICTION: {
    name: "Search by Jurisdiction & Date",
    description: "Permits by jurisdiction within a date range",
    category: "Search",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE Permitted_by_Sekondi_Office = 'Yes' AND Jurisdiction = ? AND DateOfIssueOfPermit BETWEEN ? AND ?`,
    params: [
      { name: "jurisdiction", label: "Jurisdiction", type: "text" },
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
    ],
  },
  SEARCH_JURISDICTION_CLASS: {
    name: "Jurisdiction & Classification",
    description: "Permits by jurisdiction and sector",
    category: "Search",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE Jurisdiction = ? AND ClassificationOfUndertaking = ?`,
    params: [
      { name: "jurisdiction", label: "Jurisdiction", type: "text" },
      { name: "classification", label: "Classification", type: "text" },
    ],
  },
  NEW_PERMITTED_DATE: {
    name: "New Permits by Date Range",
    description: "New applications permitted within a date range",
    category: "Processing",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE Permitted_by_Sekondi_Office = 'Yes' AND ApplicationStatusII = 'New Application' AND DateOfIssueOfPermit IS NOT NULL AND DateOfIssueOfPermit BETWEEN ? AND ?`,
    params: [
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
    ],
  },
  RENEWAL_PERMITTED_DATE: {
    name: "Renewals by Date Range",
    description: "Renewals permitted within a date range",
    category: "Processing",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE Permitted_by_Sekondi_Office = 'Yes' AND ApplicationStatusII = 'Renewal of Permit' AND DateOfIssueOfPermit IS NOT NULL AND DateOfIssueOfPermit BETWEEN ? AND ?`,
    params: [
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
    ],
  },
  PERMITS_SEKONDI_DATE: {
    name: "Permits by Sekondi & Date",
    description: "Permits filtered by Sekondi status and date range",
    category: "Search",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE Permitted_by_Sekondi_Office = ? AND DateOfIssueOfPermit BETWEEN ? AND ?`,
    params: [
      {
        name: "sekondi",
        label: "Permitted by Sekondi",
        type: "select",
        options: ["Yes", "No"],
      },
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
    ],
  },
  EXPIRE_BY_SECTOR: {
    name: "Expired by Sector",
    description: "Expired permits filtered by classification",
    category: "Compliance",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE ClassificationOfUndertaking = ? AND PermitExpirationDate IS NOT NULL AND PermitExpirationDate < date('now')`,
    params: [{ name: "sector", label: "Sector (e.g. Energy)", type: "text" }],
  },
  PERMIT_EXPIRE_DAYS: {
    name: "Permits Expiring in N Days",
    description: "Permits expiring within specified days",
    category: "Compliance",
    table: "PERMIT",
    sql: null,
    params: [{ name: "days", label: "Number of Days", type: "number" }],
  },
  MOVEMENTS_DATE_RANGE: {
    name: "Movements by Date Range",
    description: "Vehicle movements between two dates",
    category: "Fleet",
    table: "MOVEMENT",
    sql: `SELECT * FROM MOVEMENT WHERE DepartureDate BETWEEN ? AND ?`,
    params: [
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
    ],
  },
  WASTE_CONSIGNMENT: {
    name: "Waste by Consignment Date",
    description: "Waste records by consignment arrival date",
    category: "Waste",
    table: "WASTE",
    sql: `SELECT * FROM WASTE WHERE ConsigmentArrivalDate BETWEEN ? AND ?`,
    params: [
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
    ],
  },
  WASTE_INSPECTION: {
    name: "Waste by Inspection Date",
    description: "Waste records by inspection date",
    category: "Waste",
    table: "WASTE",
    sql: `SELECT * FROM WASTE WHERE DateOfInspection BETWEEN ? AND ?`,
    params: [
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
    ],
  },
  WASTE_COMPANY: {
    name: "Search Waste by Company",
    description: "Waste records for a company",
    category: "Waste",
    table: "WASTE",
    sql: `SELECT * FROM WASTE WHERE NameOfCompany LIKE '%' || ? || '%'`,
    params: [{ name: "company", label: "Company Name", type: "text" }],
  },
  KEYWORD_SENT: {
    name: "Environmental Reports by Sent Date",
    description: "Documents filtered by date sent",
    category: "Documents",
    table: "tbl_keyword",
    sql: `SELECT * FROM tbl_keyword WHERE DateSent BETWEEN ? AND ?`,
    params: [
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
    ],
  },
  GENERAL_PERMITS_RPT: {
    name: "General Permits Report",
    description: "Permits by jurisdiction and date range",
    category: "Reports",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE Jurisdiction = ? AND DateOfReceiptOfApplication BETWEEN ? AND ?`,
    params: [
      { name: "jurisdiction", label: "Jurisdiction", type: "text" },
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
    ],
  },
  FILE_RETURN: {
    name: "File Return Status",
    description: "Permits by file returned status",
    category: "General",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE FileReturned = ?`,
    params: [
      {
        name: "returned",
        label: "File Returned",
        type: "select",
        options: ["Yes", "No"],
      },
    ],
  },
  SEKONDI_SECTOR: {
    name: "Sekondi by Sector & Date",
    description: "Permits by Sekondi status, date, and classification",
    category: "Search",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE Permitted_by_Sekondi_Office = ? AND DateOfIssueOfPermit BETWEEN ? AND ? AND ClassificationOfUndertaking = ?`,
    params: [
      {
        name: "sekondi",
        label: "Permitted by Sekondi",
        type: "select",
        options: ["Yes", "No"],
      },
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" },
      { name: "classification", label: "Classification", type: "text" },
    ],
  },
  NOT_EXPIRED: {
    name: "Not Expired Permits",
    description: "Permits that have not yet expired",
    category: "Compliance",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE Permitted_by_Sekondi_Office = ? AND PermitExpirationDate IS NOT NULL AND PermitExpirationDate >= date('now')`,
    params: [
      {
        name: "sekondi",
        label: "Permitted by Sekondi",
        type: "select",
        options: ["Yes", "No"],
      },
    ],
  },
  ACTIVE_PERMITS: {
    name: "Active Permits",
    description: "All permits with a valid (non-expired) expiration date",
    category: "Compliance",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE PermitExpirationDate IS NOT NULL AND PermitExpirationDate >= date('now')`,
    params: [],
  },
  PERMITS_ISSUED: {
    name: "Permits Issued",
    description: "All permits that have been issued (have a Date of Issue)",
    category: "Processing",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE DateOfIssueOfPermit IS NOT NULL AND DateOfIssueOfPermit != ''`,
    params: [],
  },
  NEW_APPLICATIONS: {
    name: "New Applications",
    description: "All permits with Application Status 'New Application'",
    category: "Processing",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE ApplicationStatusII = 'New Application'`,
    params: [],
  },
  RENEWALS: {
    name: "Renewals",
    description: "All permits with Application Status 'Renewal of Permit'",
    category: "Processing",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE ApplicationStatusII = 'Renewal of Permit'`,
    params: [],
  },
  ALL_COMPLIANCE_ENFORCEMENT: {
    name: "Compliance Enforcements",
    description: "All compliance enforcement records",
    category: "Compliance",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE Compliance = 'Compliance Enforcement'`,
    params: [],
  },
  SEKONDI_PERMITS: {
    name: "Sekondi Office Permits",
    description: "All permits processed by Sekondi Office",
    category: "General",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE Permitted_by_Sekondi_Office = 'Yes'`,
    params: [],
  },
  PAID_PROCESSING_FEE: {
    name: "Paid Processing Fee",
    description: "All permits where the processing fee has been paid",
    category: "Financial",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE DateOfPaymentOfProcessingFee IS NOT NULL`,
    params: [],
  },
  PAID_PERMIT_FEE: {
    name: "Paid Permit Fee",
    description: "All permits where the permit fee has been paid",
    category: "Financial",
    table: "PERMIT",
    sql: `SELECT * FROM PERMIT WHERE DateOfPaymentOfPermitFee IS NOT NULL`,
    params: [],
  },
};

// ══════════════════════════════════════════════════════════════
//  Field dropdown options — extracted from Access database
//  Maps table.column to allowed select values
// ══════════════════════════════════════════════════════════════
const FIELD_OPTIONS = {
  PERMIT: {
    ClassificationOfUndertaking: [
      "Administration",
      "Agriculture",
      "Aquaculture",
      "Chemicals & Pesticides",
      "Energy",
      "Fuel & Gas Filling Station",
      "Fuel Filling Station",
      "Gas Filling Station",
      "Hospitality",
      "Hospitals & Clinics",
      "Infrastructure",
      "Manufacturing",
      "Metro and District Assemblies",
      "Mining",
      "Petroleum",
      "Small Scale Mining",
      "Used Oil & Scraps",
    ],
    ApplicationStatus: [
      "Application Received",
      "Permit Issued",
      "Application Under Review",
      "Additional Information Required",
      "Closed Application",
      "Permit Denied",
      "Awaiting Payment of Fees",
    ],
    ApplicationStatusII: ["New Application", "Renewal of Permit"],
    Screening: ["Done", "Not Done"],
    PermittedBy: ["Head Office", "Sekondi Office"],
    FileLocation: [...PERMIT_FILE_LOCATION_OPTIONS],
    Jurisdiction: ["Sekondi", "Ellembelle", "Port Office", "Shama"],
    District: [
      "Ahanta West",
      "Amenfi Central",
      "Amenfi East",
      "Amenfi West",
      "Bibiani Anwiaso Bekwai",
      "Bia East",
      "Bia West",
      "Bodi",
      "Cape Three Points",
      "Effia Kwesimintsim",
      "Ellembelle",
      "Essikado Ketan",
      "Jomoro",
      "Juaboso",
      "Mpohor",
      "Nzema East",
      "Prestea Huni Valley",
      "Sekondi Takoradi Metro",
      "Sefwi Akontombra",
      "Sefwi Wiawso",
      "Shama",
      "Suaman",
      "Tarkwa Nsuaem",
      "Wasa East",
      "Wassa Amenfi East",
      "Wassa Amenfi West",
    ],
    Compliance: ["Compliance Enforcement", "Voluntary Compliance"],
    FileReturned: ["Yes", "No"],
    PermitIssued: ["Yes", "No"],
    Permitted_by_Sekondi_Office: ["Yes", "No"],
    StatusOrComments: [
      "Awaiting processing fee payment receipt",
      "Awaiting TRC meeting",
      "Draft EIA submitted for review",
      "Permit has expired",
      "Permit issued and file returned",
      "Processing fee paid",
      "Under review at Head Office",
    ],
    Remarks: [
      "Valid",
      "Expired",
      "Permit Issued",
      "Renewed",
      "Closed",
      "Pending",
      "Under Review",
      "Revoked",
      "Suspended",
    ],
    ProjectStatus: ["Submitted Draft", "Under Review", "Approved", "Rejected"],
    EnvironmentalManagementPlan: [
      "Paid both Processing & Permit Fee",
      "Paid Processing Fee Only",
      "Paid Permit Fee Only",
      "Not Paid",
    ],
  },
  MOVEMENT: {
    ApprovedBy: [
      "Ernest Annoh-Affoh",
      "George Diawuoh",
      "Janet Bruce",
      "Shine Fiagome",
    ],
    RequestedBy: [
      "Albert Sackey",
      "Ampah",
      "Clement Agbo",
      "Edwina",
      "Emmanuel Brentuo",
      "Eric Kwesi Arthur",
      "Ernest Annoh-Affoh",
      "Francis Amoah",
      "George Diawuoh",
      "George Kwame Diawuoh",
      "Ivy Mensah",
      "Janet Bruce",
      "Joshua Amesimeku",
      "Kojo Amoah",
      "KS Appiah",
      "Monica Nartey",
      "Shine Fiagome",
    ],
    ClassOfLicence: ["A", "B", "C", "D", "E", "F"],
  },
  WASTE: {
    NameOfCompany: [
      "Chevron Liberia Ltd",
      "ENI Togo BV",
      "European Hydrocarbon Liberia Ltd",
      "Lukoil Overseas Sierra Leone BV",
      "Talisman Sierra Leone BV",
    ],
  },
  Stores: {
    Item_Condition_at_the_Time_of_Receipt: [
      "New",
      "Good",
      "Fair",
      "Damaged",
      "Broken",
    ],
  },
  tbl_keyword: {},
};

function mergeDistinctOptionValues(baseList, extraList) {
  const out = [...(Array.isArray(baseList) ? baseList : [])];
  for (const v of extraList || []) {
    const val = sanitizeDropdownOptionValue(v);
    if (!val) continue;
    if (!out.some((x) => x.toLowerCase() === val.toLowerCase())) out.push(val);
  }
  return out;
}

async function enrichPermitDropdownOptionsFromSources(db, options) {
  if (!options) return options;

  const enriched = JSON.parse(JSON.stringify(options));
  enriched.FileLocation = [...PERMIT_FILE_LOCATION_OPTIONS];
  enriched.ApplicationStatusII = [...CANONICAL_APPLICATION_INFO_OPTIONS];

  for (const field of Object.keys(enriched)) {
    enriched[field] = mergeDistinctOptionValues([], enriched[field]);
  }

  return filterHiddenDropdownOptions(db, "PERMIT", enriched);
}

// ══════════════════════════════════════════════════════════════
//  Form definitions — replicating Access forms
// ══════════════════════════════════════════════════════════════
const FORM_DEFINITIONS = {
  PERMIT_FORM: {
    name: "Permit Application Form",
    description: "EPA Environmental Permit Application",
    icon: "📋",
    table: "PERMIT",
    sections: [
      {
        title: "File Information",
        fields: ["FileNumber", "FileLocation", "OfficerWorkingOnFile"],
      },
      {
        title: "Establishment Information",
        fields: [
          "RegisteredNameOfUndertaking",
          "ClassificationOfUndertaking",
          "FacilityLocation",
          "District",
          "Jurisdiction",
          "Latitude",
          "Longitude",
        ],
      },
      {
        title: "Contact Information",
        fields: ["PermitHolder", "ContactPerson", "TelephoneNumber", "Email"],
      },
      {
        title: "Application Details",
        fields: [
          "DateOfReceiptOfApplication",
          "Screening_Date",
          "DateOfSiteVerification",
        ],
      },
      {
        title: "Permit Details",
        fields: [
          "PermitNumber",
          "DateOfIssueOfPermit",
          "PermitExpirationDate",
          "PermittedBy",
        ],
      },
      {
        title: "Processing Fees",
        fields: [
          "ProcessingFee",
          "DateOfIssueOfProcessingFee",
          "DateOfPaymentOfProcessingFee",
        ],
      },
      {
        title: "Permit Fees",
        fields: [
          "PermitFee",
          "DateOfIssueOfPermitFee",
          "DateOfPaymentOfPermitFee",
          "InvoiceNumber",
          "DateOfIssueOfInvioce",
        ],
      },
      {
        title: "Status",
        fields: ["ApplicationStatusII", "ApplicationStatus"],
      },
      {
        title: "Compliance",
        fields: [
          "Compliance",
          "ComplianceDate",
          "DateEnforcementLetterIssued",
          "ActualDateReported",
        ],
      },
      {
        title: "Reports & Submissions",
        fields: [
          "SubmissionOfAnnualEnvironmentalReport",
          "SubmissionOfQuartelyEnvironmentalMonitoringReport",
        ],
      },
      {
        title: "File Movement",
        fields: ["DateReturned", "FileReturned", "DateReceived"],
      },
    ],
  },
  MOVEMENT_FORM: {
    name: "Vehicle Movement Form",
    description: "Fleet vehicle movement tracking",
    icon: "🚗",
    table: "MOVEMENT",
    sections: [
      {
        title: "Vehicle Information",
        fields: [
          "Vehicle",
          "ClassOfLicence",
          "DateOfIssue",
          "ExpiryDate",
          "RenewalDate",
        ],
      },
      {
        title: "Insurance",
        fields: [
          "DateOfIssueOfInsurance",
          "ExpiryDateOfInsurance",
          "ActualInsuranceDate",
        ],
      },
      {
        title: "Road Worthy",
        fields: [
          "DateOfIssueOfRoadWealthy",
          "ExpiryDateOfRoadWealthy",
          "ActualRWDate",
        ],
      },
      {
        title: "Maintenance",
        fields: ["DateOfMaintenance", "NextDateOfMaintenance"],
      },
      {
        title: "Trip Details",
        fields: [
          "RequestedBy",
          "DateRequested",
          "Purpose",
          "Destination",
          "DepartureDate",
          "ArrivalDate",
          "DriverOfficersOnBoard",
        ],
      },
      {
        title: "Approval",
        fields: ["ApprovedBy", "DateApproved", "AttachedRequestForm"],
      },
    ],
  },
  WASTE_FORM: {
    name: "Waste Inspection Form",
    description: "Waste management and inspection",
    icon: "♻️",
    table: "WASTE",
    sections: [
      {
        title: "Company Details",
        fields: [
          "Code",
          "NameOfCompany",
          "ContactPerson",
          "TelephoneNumber",
          "LocationOfWaste",
        ],
      },
      {
        title: "Inspection",
        fields: ["DateOfInspection", "ConsigmentArrivalDate"],
      },
      {
        title: "Waste Categories",
        fields: [
          "GeneralWaste",
          "CardboardAndPaperWaste",
          "WoodenPellets",
          "SrapMetalWaste",
          "EmptyMetalDrums",
          "EmptyPlasticDrums",
          "ChemicalSacks",
          "UsedHoses",
          "ThreadProtectors",
          "ItemsContainminatedByOil",
          "ElectronicWaste",
          "WasteOil",
        ],
      },
    ],
  },
  STORES_FORM: {
    name: "Stores Inventory Form",
    description: "Store items and inventory",
    icon: "📦",
    table: "Stores",
    sections: [
      {
        title: "Item Details",
        fields: [
          "Description_of_Stores",
          "Classification",
          "Invoice_Waybill_No",
          "Stores_Received_From",
          "Date_Received",
        ],
      },
      {
        title: "Quantity & Value",
        fields: [
          "Quantity_Received_Purchase",
          "Unit_Price",
          "Total_Amount",
          "Item_Condition_at_the_Time_of_Receipt",
        ],
      },
      { title: "Remarks", fields: ["Remarks"] },
    ],
  },
  KEYWORD_FORM: {
    name: "Document Filing Form",
    description: "Environmental reports submission and tracking",
    icon: "📄",
    table: "tbl_keyword",
    sections: [
      {
        title: "Document Details",
        fields: [
          "Number",
          "Code",
          "Project",
          "NameOFDocument",
          "ClassificationOfDocument",
          "DocumentYear",
          "NumberOfCopies",
        ],
      },
      {
        title: "Review Tracking",
        fields: [
          "DateOfReceiptFromCompany",
          "ReviewingOfficer",
          "DateOfficerReceived",
          "DateOfficerReturned",
          "Attachment",
        ],
      },
    ],
  },
};

// ══════════════════════════════════════════════════════════════
//  Report definitions
// ══════════════════════════════════════════════════════════════
const REPORT_DEFINITIONS = {
  PERMIT_STATUS: {
    name: "Permit Status Report",
    description: "Summary of permits by application status",
    briefing:
      "This report provides a comprehensive breakdown of all environmental permits in the system, grouped by their current application status (e.g., Permit Issued, Processing Fee Invoice Issued, Paid Permit Fee, etc.) and cross-referenced with the classification of each undertaking. It helps management understand how many permits are at each stage of the approval pipeline, identify bottlenecks in processing, and track the overall workload distribution across different industry sectors. Use this report to monitor permit processing efficiency and ensure no applications are stalled.",
    icon: "📊",
    sql: `SELECT ApplicationStatus, COUNT(*) AS Total, ClassificationOfUndertaking FROM PERMIT WHERE ApplicationStatus IS NOT NULL GROUP BY ApplicationStatus, ClassificationOfUndertaking ORDER BY Total DESC`,
    detailSql: `SELECT FileNumber, RegisteredNameOfUndertaking AS Company, ClassificationOfUndertaking AS Sector, ApplicationStatus AS Status, District, PermitHolder, DateOfReceiptOfApplication AS Received, DateOfIssueOfPermit AS Issued, PermitExpirationDate AS Expires FROM PERMIT WHERE ApplicationStatus IS NOT NULL ORDER BY ApplicationStatus, RegisteredNameOfUndertaking`,
  },
  QUARTERLY: {
    name: "Quarterly Permits Report",
    description: "Permits issued by quarter",
    briefing:
      "This report shows the number of environmental permits issued by the Sekondi Office in each quarter (Q1 through Q4) for a specified year. It provides a seasonal view of permit issuance activity, helping management identify peak periods, plan staffing and resources accordingly, and track year-over-year performance. The data is filtered to only include permits processed by the Sekondi Office, making it ideal for regional performance reviews and annual planning.",
    icon: "📅",
    params: [
      {
        name: "year",
        label: "Year",
        type: "number",
        default: new Date().getFullYear(),
      },
    ],
    sql: null,
  },
  COMPLIANCE: {
    name: "Compliance Report",
    description: "Compliance enforcement overview",
    briefing:
      "This report identifies all permits currently flagged for compliance enforcement action. It groups these permits by their application status to show how many enforcement cases exist at each processing stage. This is critical for the EPA's regulatory function — it helps compliance officers prioritize enforcement actions, track the status of ongoing enforcement cases, and report to management on the agency's regulatory activity. A high count indicates areas needing increased monitoring or follow-up.",
    icon: "⚖️",
    sql: `SELECT Compliance, ApplicationStatus, COUNT(*) AS Total FROM PERMIT WHERE Compliance = 'Compliance Enforcement' GROUP BY ApplicationStatus ORDER BY Total DESC`,
    detailSql: `SELECT FileNumber, RegisteredNameOfUndertaking AS Company, ApplicationStatus AS Status, Compliance, ComplianceDate, District, PermitHolder, DateOfIssueOfPermit AS Issued, PermitExpirationDate AS Expires FROM PERMIT WHERE Compliance = 'Compliance Enforcement' ORDER BY ComplianceDate DESC`,
  },
  FINANCIAL: {
    name: "Financial Summary",
    description: "Fees overview",
    briefing:
      "This report provides a complete financial overview of the EPA's permit fee collection. It shows the total number of permits, cumulative processing fees collected, total permit fees collected, and the grand total revenue. It also tracks how many applicants have paid their processing fees, how many have paid their permit fees, and how many permits have actually been issued. This report is essential for financial reporting, budget planning, revenue tracking, and identifying outstanding payments that need follow-up.",
    icon: "💰",
    sql: `SELECT COUNT(*) AS TotalPermits, SUM(CASE WHEN ProcessingFee > 0 THEN ProcessingFee ELSE 0 END) AS TotalProcessingFees, SUM(CASE WHEN PermitFee > 0 THEN PermitFee ELSE 0 END) AS TotalPermitFees, SUM(CASE WHEN TotalAmount > 0 THEN TotalAmount ELSE 0 END) AS GrandTotal, SUM(CASE WHEN DateOfPaymentOfProcessingFee IS NOT NULL THEN 1 ELSE 0 END) AS PaidProcessingFee, SUM(CASE WHEN DateOfPaymentOfPermitFee IS NOT NULL THEN 1 ELSE 0 END) AS PaidPermitFee, SUM(CASE WHEN DateOfIssueOfPermit IS NOT NULL THEN 1 ELSE 0 END) AS PermitsIssued FROM PERMIT`,
    detailSql: `SELECT FileNumber, RegisteredNameOfUndertaking AS Company, ProcessingFee, DateOfPaymentOfProcessingFee AS ProcessingFeePaid, PermitFee, DateOfPaymentOfPermitFee AS PermitFeePaid, PenaltyFee, TotalAmount, ApplicationStatus AS Status FROM PERMIT WHERE ProcessingFee > 0 OR PermitFee > 0 OR TotalAmount > 0 ORDER BY TotalAmount DESC`,
  },
  EXPIRATION: {
    name: "Expiration Report",
    description: "Expired, expiring, and valid permits",
    briefing:
      "This report provides a critical snapshot of permit validity across the entire database. It categorizes all permits into four groups: Expired (past their expiration date), Expiring Soon (within the next 90 days), Valid (more than 90 days until expiry), and No Date (permits without an expiration date on file). This is one of the most important operational reports — it alerts staff to permits needing immediate renewal attention, helps prevent lapses in environmental compliance, and identifies data quality issues where expiration dates are missing.",
    icon: "⏰",
    sql: `SELECT SUM(CASE WHEN PermitExpirationDate IS NOT NULL AND PermitExpirationDate < date('now') THEN 1 ELSE 0 END) AS Expired, SUM(CASE WHEN PermitExpirationDate IS NOT NULL AND PermitExpirationDate >= date('now') AND PermitExpirationDate <= date('now','+90 days') THEN 1 ELSE 0 END) AS ExpiringSoon, SUM(CASE WHEN PermitExpirationDate IS NOT NULL AND PermitExpirationDate > date('now','+90 days') THEN 1 ELSE 0 END) AS Valid, SUM(CASE WHEN PermitExpirationDate IS NULL OR PermitExpirationDate = '' THEN 1 ELSE 0 END) AS NoDate FROM PERMIT`,
    detailSql: `SELECT FileNumber, RegisteredNameOfUndertaking AS Company, PermitNumber, DateOfIssueOfPermit AS Issued, PermitExpirationDate AS Expires, District, ApplicationStatus AS Status, CASE WHEN PermitExpirationDate IS NULL OR PermitExpirationDate = '' THEN 'No Date' WHEN PermitExpirationDate < date('now') THEN 'EXPIRED' WHEN PermitExpirationDate <= date('now','+90 days') THEN 'Expiring Soon' ELSE 'Valid' END AS ExpiryStatus FROM PERMIT ORDER BY PermitExpirationDate ASC`,
  },
  FLEET: {
    name: "Fleet Status Report",
    description: "Vehicle fleet overview",
    briefing:
      "This report provides a comprehensive status check of all EPA fleet vehicles. For each vehicle, it shows the current status of three critical documents: Driving Licence, Insurance, and Road Worthy certificate — indicating whether each is Valid, Expired, or not on file (N/A). Fleet managers can use this report to identify vehicles that cannot legally operate, plan renewals before documents expire, and maintain full fleet compliance. Any vehicle showing 'EXPIRED' status requires immediate attention.",
    icon: "🚗",
    sql: `SELECT Vehicle, ExpiryDate AS LicenceExpiry, ExpiryDateOfInsurance AS InsuranceExpiry, ExpiryDateOfRoadWealthy AS RoadWorthyExpiry, CASE WHEN ExpiryDate IS NOT NULL AND ExpiryDate < date('now') THEN 'EXPIRED' WHEN ExpiryDate IS NOT NULL THEN 'Valid' ELSE 'N/A' END AS LicenceStatus, CASE WHEN ExpiryDateOfInsurance IS NOT NULL AND ExpiryDateOfInsurance < date('now') THEN 'EXPIRED' WHEN ExpiryDateOfInsurance IS NOT NULL THEN 'Valid' ELSE 'N/A' END AS InsuranceStatus, CASE WHEN ExpiryDateOfRoadWealthy IS NOT NULL AND ExpiryDateOfRoadWealthy < date('now') THEN 'EXPIRED' WHEN ExpiryDateOfRoadWealthy IS NOT NULL THEN 'Valid' ELSE 'N/A' END AS RoadWorthyStatus FROM MOVEMENT ORDER BY Vehicle`,
  },
  DISTRICT: {
    name: "Permits by District",
    description: "Count by district",
    briefing:
      "This report shows the geographic distribution of environmental permits across all districts in the EPA's jurisdiction. Each district is listed with its total number of permits, sorted from highest to lowest. This helps regional planners understand where the highest concentration of regulated facilities exists, allocate inspection resources proportionally, and identify underserved districts that may need outreach. It is particularly useful for annual planning, resource allocation meetings, and regional performance comparisons.",
    icon: "🗺️",
    sql: `SELECT District, COUNT(*) AS Total FROM PERMIT WHERE District IS NOT NULL AND District != '' GROUP BY District ORDER BY Total DESC`,
    detailSql: `SELECT FileNumber, RegisteredNameOfUndertaking AS Company, District, ClassificationOfUndertaking AS Sector, ApplicationStatus AS Status, PermitHolder, DateOfIssueOfPermit AS Issued FROM PERMIT WHERE District IS NOT NULL AND District != '' ORDER BY District, RegisteredNameOfUndertaking`,
  },
  CLASSIFICATION: {
    name: "Permits by Classification",
    description: "Count by sector",
    briefing:
      "This report breaks down all environmental permits by the industry classification or sector of each undertaking (e.g., Mining, Manufacturing, Hospitality, Health, Services, etc.). It shows how many permits exist in each sector, sorted from the most to the least common. This is essential for understanding the EPA's regulatory landscape — which industries dominate the permit portfolio, where environmental risks may be concentrated, and which sectors are growing or declining in permit applications over time.",
    icon: "📂",
    sql: `SELECT ClassificationOfUndertaking AS Classification, COUNT(*) AS Total FROM PERMIT WHERE ClassificationOfUndertaking IS NOT NULL AND ClassificationOfUndertaking != '' GROUP BY ClassificationOfUndertaking ORDER BY Total DESC`,
    detailSql: `SELECT FileNumber, RegisteredNameOfUndertaking AS Company, ClassificationOfUndertaking AS Sector, District, ApplicationStatus AS Status, PermitHolder, DateOfIssueOfPermit AS Issued, PermitExpirationDate AS Expires FROM PERMIT WHERE ClassificationOfUndertaking IS NOT NULL AND ClassificationOfUndertaking != '' ORDER BY ClassificationOfUndertaking, RegisteredNameOfUndertaking`,
  },
};

// ══════════════════════════════════════════════════════════════
//  Activity Logging
// ══════════════════════════════════════════════════════════════
function logActivity(
  req,
  action,
  targetType = "",
  targetName = "",
  targetId = null,
  details = "",
  oldValues = "",
  newValues = "",
) {
  try {
    const db = getDb();
    const ip = req.ip || req.connection?.remoteAddress || "";
    const username = req.user?.username || "system";
    const fullName = req.user?.fullName || "";
    const userId = req.user?.id || null;
    db.run(
      `INSERT INTO activity_log (user_id, username, full_name, action, target_type, target_name, target_id, details, old_values, new_values, ip_address) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        userId,
        username,
        fullName,
        action,
        targetType,
        targetName,
        targetId,
        details,
        oldValues,
        newValues,
        ip,
      ],
    );
  } catch (e) {
    /* don't let logging errors break the app */
  }
}

// ══════════════════════════════════════════════════════════════
//  Auth middleware
// ══════════════════════════════════════════════════════════════
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ error: "Not authenticated" });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Admin access required" });
  next();
}

// Feature permission middleware: checks feature_permissions table for non-admin users
function checkFeaturePerm(category, keyFn) {
  return (req, res, next) => {
    if (req.user.role === "admin") return next();
    const db = getDb();
    const key = typeof keyFn === "function" ? keyFn(req) : keyFn;
    const row = db.get(
      "SELECT is_allowed FROM feature_permissions WHERE user_id = ? AND feature_category = ? AND feature_key = ?",
      [req.user.id, category, key],
    );
    if (!row || !row.is_allowed) {
      return res
        .status(403)
        .json({ error: "You do not have permission to access this feature" });
    }
    next();
  };
}

// Permission-aware middleware: allows action if user is admin OR has explicit permission
function checkPerm(permType) {
  return (req, res, next) => {
    if (req.user.role === "admin") return next();
    const db = getDb();
    const table = req.params.table;
    // Check table-specific permission first, then wildcard '*'
    let perm = db.get(
      `SELECT * FROM user_permissions WHERE user_id = ? AND table_name = ? AND record_id IS NULL`,
      [req.user.id, table],
    );
    if (!perm)
      perm = db.get(
        `SELECT * FROM user_permissions WHERE user_id = ? AND table_name = '*' AND record_id IS NULL`,
        [req.user.id],
      );
    if (!perm)
      return res.status(403).json({ error: `No permission for ${table}` });
    if (!perm[permType])
      return res.status(403).json({
        error: `You do not have ${permType.replace("can_", "")} permission for ${table}`,
      });
    next();
  };
}

// ══════════════════════════════════════════════════════════════
//  Access Gate — optional code barrier before login page
// ══════════════════════════════════════════════════════════════
function getLanIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal)
        ips.push({ name, address: net.address });
    }
  }
  return ips;
}

// Check if access gate is enabled
app.get("/api/access-gate", (req, res) => {
  const db = getDb();
  const config = getBackupConfig(db);
  const code = config.access_code || "";
  res.json({ required: code.length > 0 });
});

// Verify access code
app.post("/api/access-gate/verify", (req, res) => {
  const db = getDb();
  const config = getBackupConfig(db);
  const code = config.access_code || "";
  if (!code) return res.json({ verified: true });
  const { code: submitted } = req.body;
  if (!submitted)
    return res.status(400).json({ error: "Access code required" });
  if (submitted.toString().trim() === code.trim()) {
    // Issue a gate token valid for 24h
    const gateToken = jwt.sign({ gate: true }, JWT_SECRET, {
      expiresIn: "24h",
    });
    res.json({ verified: true, gateToken });
  } else {
    res.status(401).json({ error: "Invalid access code" });
  }
});

// Validate an existing gate token
app.post("/api/access-gate/validate", (req, res) => {
  const { gateToken } = req.body;
  if (!gateToken) return res.json({ valid: false });
  try {
    const decoded = jwt.verify(gateToken, JWT_SECRET);
    res.json({ valid: decoded.gate === true });
  } catch {
    res.json({ valid: false });
  }
});

// Admin: get/set access code
app.get("/api/admin/access-code", auth, adminOnly, (req, res) => {
  const db = getDb();
  const config = getBackupConfig(db);
  res.json({ code: config.access_code || "", enabled: !!config.access_code });
});

app.post("/api/admin/access-code", auth, adminOnly, (req, res) => {
  const db = getDb();
  const { code } = req.body;
  setBackupConfig(db, "access_code", code || "");
  saveToDisk();
  if (code) {
    res.json({ message: `Access code set: ${code}`, enabled: true });
  } else {
    res.json({
      message:
        "Access code disabled — anyone on the network can see the login page",
      enabled: false,
    });
  }
});

app.post("/api/admin/access-code/generate", auth, adminOnly, (req, res) => {
  const db = getDb();
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
  setBackupConfig(db, "access_code", code);
  saveToDisk();
  res.json({ code, message: "New 6-digit access code generated" });
});

// Admin: network info + QR code
app.get("/api/admin/network-info", auth, adminOnly, (req, res) => {
  const ips = getLanIPs();
  const hostname = os.hostname();
  res.json({
    hostname,
    port: PORT,
    ips,
    urls: ips.map((ip) => `http://${ip.address}:${PORT}`),
    hostnameUrl: `http://${hostname}:${PORT}`,
  });
});

app.get("/api/admin/qrcode", auth, adminOnly, async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "URL required" });
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: { dark: "#e6edf3", light: "#0d1117" },
    });
    res.json({ qr: dataUrl, url });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

// ══════════════════════════════════════════════════════════════
//  First-run setup (no auth required — only works when no users exist)
// ══════════════════════════════════════════════════════════════
app.get("/api/setup/check", (req, res) => {
  const db = getDb();
  const userCount = db.get("SELECT COUNT(*) as count FROM app_users");
  res.json({ needsSetup: !userCount || userCount.count === 0 });
});

app.post("/api/setup/init", (req, res) => {
  const db = getDb();
  const userCount = db.get("SELECT COUNT(*) as count FROM app_users");
  if (userCount && userCount.count > 0) {
    return res.status(400).json({
      error: "Setup already completed. An admin account already exists.",
    });
  }
  const { username, password, fullName } = req.body;
  if (!username || !password)
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  if (username.length < 3)
    return res
      .status(400)
      .json({ error: "Username must be at least 3 characters" });
  if (password.length < 4)
    return res
      .status(400)
      .json({ error: "Password must be at least 4 characters" });

  try {
    const hash = bcrypt.hashSync(password, 12);
    db.run(
      "INSERT INTO app_users (username, password_hash, full_name, role) VALUES (?,?,?,?)",
      [username, hash, fullName || "Administrator", "admin"],
    );
    saveToDisk();
    console.log(`First-run setup: Admin account "${username}" created.`);
    res.json({
      message: "Admin account created successfully. You can now log in.",
    });
  } catch (e) {
    if (e.message?.includes("UNIQUE"))
      return res.status(409).json({ error: "Username already exists" });
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  Auth routes
// ══════════════════════════════════════════════════════════════
app.post("/api/login", loginLimiter, (req, res) => {
  try {
    const db = getDb();
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });
    const user = db.get("SELECT * FROM app_users WHERE username = ?", [
      username,
    ]);
    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: "Invalid username or password" });
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
      },
      JWT_SECRET,
      { expiresIn: "12h" },
    );
    logActivity(
      {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
        },
        ip: req.ip,
      },
      "LOGIN",
      "auth",
      user.username,
    );
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/me", auth, (req, res) => {
  try {
    const db = getDb();
    const user = db.get(
      "SELECT id, username, full_name, role, created_at FROM app_users WHERE id = ?",
      [req.user.id],
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/change-password", auth, (req, res) => {
  try {
    const db = getDb();
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: "Both passwords required" });
    if (newPassword.length < 4)
      return res.status(400).json({ error: "Min 4 characters" });
    const user = db.get("SELECT * FROM app_users WHERE id = ?", [req.user.id]);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!bcrypt.compareSync(currentPassword, user.password_hash))
      return res.status(401).json({ error: "Current password is incorrect" });
    db.run("UPDATE app_users SET password_hash = ? WHERE id = ?", [
      bcrypt.hashSync(newPassword, 12),
      req.user.id,
    ]);
    saveToDisk();
    logActivity(req, "CHANGE_PASSWORD", "auth", req.user.username);
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── User management ──────────────────────────────────────────
app.get("/api/users", auth, adminOnly, (req, res) => {
  try {
    const db = getDb();
    res.json(
      db.all(
        "SELECT id, username, full_name, role, created_at FROM app_users ORDER BY id",
      ),
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users", auth, adminOnly, (req, res) => {
  const db = getDb();
  const { username, password, fullName, role } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });
  if (role && !["user", "admin"].includes(role))
    return res.status(400).json({ error: "Invalid role" });
  try {
    const result = db.run(
      "INSERT INTO app_users (username, password_hash, full_name, role) VALUES (?,?,?,?)",
      [username, bcrypt.hashSync(password, 12), fullName || "", role || "user"],
    );
    const newUserId = result.lastInsertRowid;
    // Create default wildcard permission (all allowed) for new non-admin users
    if ((role || "user") !== "admin") {
      db.run(
        `INSERT INTO user_permissions (user_id, table_name, record_id, can_view, can_create, can_edit, can_delete) VALUES (?,?,?,?,?,?,?)`,
        [newUserId, "*", null, 1, 0, 0, 0],
      );
      // Create default feature permissions — all pages allowed, admin can restrict later
      const defaultFeatures = [
        { cat: "page", key: "dashboard" },
        { cat: "page", key: "tables" },
        { cat: "page", key: "queries" },
        { cat: "page", key: "forms" },
        { cat: "page", key: "reports" },
        // { cat: "page", key: "records" },
        // { cat: "page", key: "recordsAnalytics" },
      ];
      for (const f of defaultFeatures) {
        db.run(
          `INSERT OR IGNORE INTO feature_permissions (user_id, feature_category, feature_key, is_allowed) VALUES (?,?,?,?)`,
          [newUserId, f.cat, f.key, 1],
        );
      }
    }
    logActivity(req, "CREATE_USER", "user", username, newUserId);
    saveToDisk();
    res.json({
      id: newUserId,
      username,
      fullName: fullName || "",
      role: role || "user",
    });
  } catch (e) {
    if (e.message?.includes("UNIQUE"))
      return res.status(409).json({ error: "Username already exists" });
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/users/:id", auth, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const { fullName, role, password } = req.body;
    const id = parseInt(req.params.id);
    const user = db.get("SELECT * FROM app_users WHERE id = ?", [id]);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (fullName !== undefined)
      db.run("UPDATE app_users SET full_name = ? WHERE id = ?", [fullName, id]);
    if (role && ["user", "admin"].includes(role))
      db.run("UPDATE app_users SET role = ? WHERE id = ?", [role, id]);
    if (password)
      db.run("UPDATE app_users SET password_hash = ? WHERE id = ?", [
        bcrypt.hashSync(password, 12),
        id,
      ]);
    saveToDisk();
    logActivity(req, "UPDATE_USER", "user", user.username, id);
    res.json({ message: "User updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/users/:id", auth, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    if (id === req.user.id)
      return res.status(400).json({ error: "Cannot delete yourself" });
    const user = db.get("SELECT username FROM app_users WHERE id = ?", [id]);
    if (!user) return res.status(404).json({ error: "User not found" });
    db.run("DELETE FROM app_users WHERE id = ?", [id]);
    saveToDisk();
    logActivity(req, "DELETE_USER", "user", user.username, id);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  Employee / Officer management
// ══════════════════════════════════════════════════════════════
// List all employees (active only by default, ?all=1 for all)
app.get("/api/employees", auth, (req, res) => {
  try {
    const db = getDb();
    const showAll = req.query.all === "1";
    const rows = db.all(
      `SELECT * FROM employees ${showAll ? "" : "WHERE active = 1"} ORDER BY full_name ASC`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new employee
app.post("/api/employees", auth, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const { full_name, position, department } = req.body;
    if (!full_name || !full_name.trim())
      return res.status(400).json({ error: "Full name is required" });
    const existing = db.get(
      "SELECT id FROM employees WHERE full_name = ? COLLATE NOCASE",
      [full_name.trim()],
    );
    if (existing)
      return res.status(409).json({ error: "Employee already exists" });
    db.run(
      "INSERT INTO employees (full_name, position, department) VALUES (?, ?, ?)",
      [full_name.trim(), (position || "").trim(), (department || "").trim()],
    );
    saveToDisk();
    logActivity(req, "ADD_EMPLOYEE", "employees", full_name.trim());
    res.json({ message: "Employee added", full_name: full_name.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an employee
app.put("/api/employees/:id", auth, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const { full_name, position, department, active } = req.body;
    if (!full_name || !full_name.trim())
      return res.status(400).json({ error: "Full name is required" });
    const emp = db.get("SELECT id FROM employees WHERE id = ?", [
      req.params.id,
    ]);
    if (!emp) return res.status(404).json({ error: "Employee not found" });
    db.run(
      "UPDATE employees SET full_name = ?, position = ?, department = ?, active = ? WHERE id = ?",
      [
        full_name.trim(),
        (position || "").trim(),
        (department || "").trim(),
        active !== undefined ? (active ? 1 : 0) : 1,
        req.params.id,
      ],
    );
    saveToDisk();
    logActivity(
      req,
      "UPDATE_EMPLOYEE",
      "employees",
      full_name.trim(),
      req.params.id,
    );
    res.json({ message: "Employee updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an employee
app.delete("/api/employees/:id", auth, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const emp = db.get("SELECT full_name FROM employees WHERE id = ?", [
      req.params.id,
    ]);
    if (!emp) return res.status(404).json({ error: "Employee not found" });
    db.run("DELETE FROM employees WHERE id = ?", [req.params.id]);
    saveToDisk();
    logActivity(
      req,
      "DELETE_EMPLOYEE",
      "employees",
      emp.full_name,
      req.params.id,
    );
    res.json({ message: "Employee deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk delete employees
app.post("/api/employees/bulk-delete", auth, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: "No IDs provided" });
    const placeholders = ids.map(() => "?").join(",");
    db.run(`DELETE FROM employees WHERE id IN (${placeholders})`, ids);
    saveToDisk();
    logActivity(
      req,
      "BULK_DELETE_EMPLOYEES",
      "employees",
      `${ids.length} employees`,
    );
    res.json({ message: `${ids.length} employee(s) deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk update employee status (activate/deactivate)
app.post("/api/employees/bulk-update", auth, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const { ids, active } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: "No IDs provided" });
    const placeholders = ids.map(() => "?").join(",");
    db.run(`UPDATE employees SET active = ? WHERE id IN (${placeholders})`, [
      active ? 1 : 0,
      ...ids,
    ]);
    saveToDisk();
    logActivity(
      req,
      "BULK_UPDATE_EMPLOYEES",
      "employees",
      `${ids.length} employees ${active ? "activated" : "deactivated"}`,
    );
    res.json({ message: `${ids.length} employee(s) updated` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk import employees from a text/CSV file upload
const employeeUpload = multer({ dest: path.join(APP_ROOT, "uploads") });
app.post(
  "/api/employees/import",
  auth,
  adminOnly,
  employeeUpload.single("file"),
  (req, res) => {
    const db = getDb();
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      const raw = fs
        .readFileSync(req.file.path, "utf-8")
        .replace(/^\uFEFF/, ""); // strip BOM
      // Support CSV, TXT, one-name-per-line, or semi-colon/comma separated
      const names = raw
        .split(/[\r\n,;]+/)
        .map((n) => n.replace(/^\d+[\.\)\-\s]+/, "").trim()) // strip leading numbers like "1. " or "1) "
        .filter((n) => n.length > 1);
      let added = 0;
      let skipped = 0;
      for (const name of names) {
        const existing = db.get(
          "SELECT id FROM employees WHERE full_name = ? COLLATE NOCASE",
          [name],
        );
        if (existing) {
          skipped++;
        } else {
          db.run("INSERT INTO employees (full_name) VALUES (?)", [name]);
          added++;
        }
      }
      saveToDisk();
      fs.unlinkSync(req.file.path);
      logActivity(
        req,
        "IMPORT_EMPLOYEES",
        "employees",
        `${added} imported, ${skipped} skipped`,
      );
      res.json({
        message: `${added} employees imported, ${skipped} duplicates skipped`,
        added,
        skipped,
      });
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path))
        fs.unlinkSync(req.file.path);
      res.status(500).json({ error: err.message });
    }
  },
);

// ══════════════════════════════════════════════════════════════
//  SCAN LOG — CRUD endpoints
// ══════════════════════════════════════════════════════════════
// List all scan log entries (with filtering support)
app.get("/api/scan-log", auth, (req, res) => {
  const db = getDb();
  try {
    let where = [];
    let params = [];
    if (req.query.company) {
      where.push("company_name LIKE ?");
      params.push(`%${req.query.company}%`);
    }
    if (req.query.district) {
      where.push("district = ?");
      params.push(req.query.district);
    }
    if (req.query.jurisdiction) {
      where.push("jurisdiction = ?");
      params.push(req.query.jurisdiction);
    }
    if (req.query.status) {
      where.push("scan_status = ?");
      params.push(req.query.status);
    }
    if (req.query.from) {
      where.push("scan_date >= ?");
      params.push(req.query.from);
    }
    if (req.query.to) {
      where.push("scan_date <= ?");
      params.push(req.query.to);
    }
    const whereClause = where.length > 0 ? " WHERE " + where.join(" AND ") : "";
    const rows = db.all(
      `SELECT * FROM scan_log${whereClause} ORDER BY scan_date DESC, id DESC`,
      params,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single scan log entry
app.get("/api/scan-log/:id", auth, (req, res) => {
  const db = getDb();
  try {
    const row = db.get("SELECT * FROM scan_log WHERE id = ?", [req.params.id]);
    if (!row)
      return res.status(404).json({ error: "Scan log entry not found" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create scan log entry
app.post("/api/scan-log", auth, (req, res) => {
  const db = getDb();
  const {
    scan_date,
    file_number,
    company_name,
    undertaking,
    specific_sector,
    sector,
    location,
    district,
    jurisdiction,
    scan_status,
    last_folio,
    current_folio,
    notes,
  } = req.body;
  const documents_scanned = Math.max(
    0,
    (parseInt(current_folio) || 0) - (parseInt(last_folio) || 0),
  );
  try {
    const result = db.run(
      `INSERT INTO scan_log (scan_date, file_number, company_name, undertaking, specific_sector, sector, location, district, jurisdiction, scan_status, last_folio, current_folio, documents_scanned, scanned_by, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        scan_date || new Date().toISOString().slice(0, 10),
        file_number || "",
        company_name || "",
        undertaking || "",
        specific_sector || "",
        sector || "",
        location || "",
        district || "",
        jurisdiction || "",
        scan_status || "New",
        parseInt(last_folio) || 0,
        parseInt(current_folio) || 0,
        documents_scanned,
        req.user.fullName || req.user.username,
        notes || "",
      ],
    );
    saveToDisk();
    logActivity(
      req,
      "CREATE",
      "scan_log",
      `Scan log entry #${result.lastInsertRowid} — ${company_name || "Untitled"}`,
    );
    res.json({ id: result.lastInsertRowid, documents_scanned });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update scan log entry
app.put("/api/scan-log/:id", auth, (req, res) => {
  const db = getDb();
  const {
    scan_date,
    file_number,
    company_name,
    undertaking,
    specific_sector,
    sector,
    location,
    district,
    jurisdiction,
    scan_status,
    last_folio,
    current_folio,
    notes,
  } = req.body;
  const documents_scanned = Math.max(
    0,
    (parseInt(current_folio) || 0) - (parseInt(last_folio) || 0),
  );
  try {
    db.run(
      `UPDATE scan_log SET scan_date=?, file_number=?, company_name=?, undertaking=?, specific_sector=?, sector=?, location=?, district=?, jurisdiction=?, scan_status=?, last_folio=?, current_folio=?, documents_scanned=?, notes=? WHERE id=?`,
      [
        scan_date || "",
        file_number || "",
        company_name || "",
        undertaking || "",
        specific_sector || "",
        sector || "",
        location || "",
        district || "",
        jurisdiction || "",
        scan_status || "New",
        parseInt(last_folio) || 0,
        parseInt(current_folio) || 0,
        documents_scanned,
        notes || "",
        req.params.id,
      ],
    );
    saveToDisk();
    logActivity(
      req,
      "UPDATE",
      "scan_log",
      `Scan log entry #${req.params.id} — ${company_name || "Untitled"}`,
    );
    res.json({ success: true, documents_scanned });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete scan log entry
app.delete("/api/scan-log/:id", auth, (req, res) => {
  const db = getDb();
  try {
    const row = db.get("SELECT company_name FROM scan_log WHERE id = ?", [
      req.params.id,
    ]);
    db.run("DELETE FROM scan_log WHERE id = ?", [req.params.id]);
    saveToDisk();
    logActivity(
      req,
      "DELETE",
      "scan_log",
      `Scan log entry #${req.params.id} — ${row?.company_name || "Unknown"}`,
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk import scan log entries
app.post("/api/scan-log/bulk-import", auth, adminOnly, (req, res) => {
  const db = getDb();
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries) || !entries.length) return res.status(400).json({ error: "No entries provided" });
    const validCols = ['scan_date','file_number','company_name','undertaking','specific_sector','sector','location','district','jurisdiction','scan_status','last_folio','current_folio','scanned_by','notes'];
    let imported = 0;
    for (const entry of entries) {
      const cols = [];
      const vals = [];
      validCols.forEach(c => {
        if (entry[c] !== undefined && entry[c] !== '') {
          cols.push(c);
          vals.push(String(entry[c]));
        }
      });
      if (!cols.length) continue;
      // Calculate documents_scanned
      const lastF = parseInt(entry.last_folio) || 0;
      const currF = parseInt(entry.current_folio) || 0;
      cols.push('documents_scanned');
      vals.push(String(Math.max(0, currF - lastF)));
      cols.push('scanned_by');
      vals.push(entry.scanned_by || req.user.fullName || req.user.username);
      db.run(`INSERT INTO scan_log (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, vals);
      imported++;
    }
    saveToDisk();
    logActivity(req, "IMPORT", "scan_log", `Bulk imported ${imported} scan log entries`);
    res.json({ imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export scan log to Excel
app.get("/api/scan-log-export", auth, (req, res) => {
  const db = getDb();
  try {
    let where = [];
    let params = [];
    if (req.query.company) {
      where.push("company_name LIKE ?");
      params.push(`%${req.query.company}%`);
    }
    if (req.query.district) {
      where.push("district = ?");
      params.push(req.query.district);
    }
    if (req.query.jurisdiction) {
      where.push("jurisdiction = ?");
      params.push(req.query.jurisdiction);
    }
    if (req.query.status) {
      where.push("scan_status = ?");
      params.push(req.query.status);
    }
    if (req.query.from) {
      where.push("scan_date >= ?");
      params.push(req.query.from);
    }
    if (req.query.to) {
      where.push("scan_date <= ?");
      params.push(req.query.to);
    }
    const whereClause = where.length > 0 ? " WHERE " + where.join(" AND ") : "";
    const rows = db.all(
      `SELECT scan_date, file_number, company_name, undertaking, specific_sector, sector, location, district, jurisdiction, scan_status, last_folio, current_folio, documents_scanned, scanned_by, notes FROM scan_log${whereClause} ORDER BY scan_date DESC`,
      params,
    );
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        Date: r.scan_date,
        "File Number": r.file_number,
        "Company Name": r.company_name,
        Undertaking: r.undertaking,
        "Specific Sector": r.specific_sector,
        Sector: r.sector,
        Location: r.location,
        District: r.district,
        Jurisdiction: r.jurisdiction,
        Status: r.scan_status,
        "Last Folio": r.last_folio,
        "Current Folio": r.current_folio,
        "Documents Scanned": r.documents_scanned,
        "Scanned By": r.scanned_by,
        Notes: r.notes,
      })),
    );
    XLSX.utils.book_append_sheet(wb, ws, "Scan Log");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="scan_log_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  PERMIT FILTER & EXPORT
// ══════════════════════════════════════════════════════════════
app.post("/api/permit-filter", auth, (req, res) => {
  const db = getDb();
  const filters = req.body;
  try {
    let where = [];
    let params = [];
    if (filters.name) {
      where.push("RegisteredNameOfUndertaking LIKE ?");
      params.push(`%${filters.name}%`);
    }
    if (filters.fileNumber) {
      where.push("FileNumber LIKE ?");
      params.push(`%${filters.fileNumber}%`);
    }
    if (filters.permitNumber) {
      where.push("PermitNumber LIKE ?");
      params.push(`%${filters.permitNumber}%`);
    }
    if (filters.officer) {
      where.push("OfficerWorkingOnFile LIKE ?");
      params.push(`%${filters.officer}%`);
    }
    if (filters.undertaking) {
      where.push("ClassificationOfUndertaking = ?");
      params.push(filters.undertaking);
    }
    if (filters.sector) {
      where.push("ClassificationOfUndertaking = ?");
      params.push(filters.sector);
    }
    if (filters.district) {
      where.push("District = ?");
      params.push(filters.district);
    }
    if (filters.jurisdiction) {
      where.push("Jurisdiction = ?");
      params.push(filters.jurisdiction);
    }
    if (filters.location) {
      where.push("FacilityLocation LIKE ?");
      params.push(`%${filters.location}%`);
    }
    if (filters.fileLocation) {
      where.push("FileLocation = ?");
      params.push(filters.fileLocation);
    }
    if (filters.permitStatus) {
      where.push("ApplicationStatus = ?");
      params.push(filters.permitStatus);
    }
    if (filters.appType) {
      where.push("ApplicationStatusII = ?");
      params.push(filters.appType);
    }
    if (filters.screening) {
      where.push("Screening_Date IS NOT NULL AND Screening_Date != ''");
      if (filters.screening === "Not Done") {
        where.pop();
        where.push("(Screening_Date IS NULL OR Screening_Date = '')");
      }
    }
    if (filters.permittedBy) {
      where.push("Permitted_by_Sekondi_Office = ? OR 1=1");
      // Map to actual column - PermittedBy is stored conceptually
      where.pop();
      if (filters.permittedBy === "Head Office") {
        where.push(
          "(Permitted_by_Sekondi_Office = 'No' OR Permitted_by_Sekondi_Office IS NULL OR Permitted_by_Sekondi_Office = '')",
        );
      } else {
        where.push("Permitted_by_Sekondi_Office = 'Yes'");
      }
    }
    if (filters.permitIssued) {
      where.push("PermitIssued = ?");
      params.push(filters.permitIssued);
    }
    if (filters.remarks) {
      where.push("Remarks = ?");
      params.push(filters.remarks);
    }
    if (filters.statusComments) {
      where.push("StatusOrComments = ?");
      params.push(filters.statusComments);
    }
    if (filters.issueDateFrom) {
      where.push("DateOfIssueOfPermit >= ?");
      params.push(filters.issueDateFrom);
    }
    if (filters.issueDateTo) {
      where.push("DateOfIssueOfPermit <= ?");
      params.push(filters.issueDateTo);
    }
    if (filters.expiryDateFrom) {
      where.push("PermitExpirationDate >= ?");
      params.push(filters.expiryDateFrom);
    }
    if (filters.expiryDateTo) {
      where.push("PermitExpirationDate <= ?");
      params.push(filters.expiryDateTo);
    }
    if (filters.category) {
      where.push("CategoryOfFile = ?");
      params.push(filters.category);
    }
    const whereClause = where.length > 0 ? " WHERE " + where.join(" AND ") : "";
    const rows = db.all(
      `SELECT id, RegisteredNameOfUndertaking, Latitude, Longitude, ClassificationOfUndertaking, FacilityLocation, CategoryOfFile, PermitHolder, ContactPerson, TelephoneNumber, PermitNumber, DateOfIssueOfPermit, PermitExpirationDate, ApplicationStatus, ApplicationStatusII, District, Jurisdiction, Remarks, OfficerWorkingOnFile, FileNumber, FileLocation, StatusOrComments FROM PERMIT${whereClause} ORDER BY RegisteredNameOfUndertaking`,
      params,
    );
    res.json({ count: rows.length, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/permit-export", auth, (req, res) => {
  const db = getDb();
  const filters = req.body;
  try {
    let where = [];
    let params = [];
    if (filters.name) {
      where.push("RegisteredNameOfUndertaking LIKE ?");
      params.push(`%${filters.name}%`);
    }
    if (filters.fileNumber) {
      where.push("FileNumber LIKE ?");
      params.push(`%${filters.fileNumber}%`);
    }
    if (filters.permitNumber) {
      where.push("PermitNumber LIKE ?");
      params.push(`%${filters.permitNumber}%`);
    }
    if (filters.officer) {
      where.push("OfficerWorkingOnFile LIKE ?");
      params.push(`%${filters.officer}%`);
    }
    if (filters.undertaking) {
      where.push("ClassificationOfUndertaking = ?");
      params.push(filters.undertaking);
    }
    if (filters.sector) {
      where.push("ClassificationOfUndertaking = ?");
      params.push(filters.sector);
    }
    if (filters.district) {
      where.push("District = ?");
      params.push(filters.district);
    }
    if (filters.jurisdiction) {
      where.push("Jurisdiction = ?");
      params.push(filters.jurisdiction);
    }
    if (filters.location) {
      where.push("FacilityLocation LIKE ?");
      params.push(`%${filters.location}%`);
    }
    if (filters.fileLocation) {
      where.push("FileLocation = ?");
      params.push(filters.fileLocation);
    }
    if (filters.permitStatus) {
      where.push("ApplicationStatus = ?");
      params.push(filters.permitStatus);
    }
    if (filters.appType) {
      where.push("ApplicationStatusII = ?");
      params.push(filters.appType);
    }
    if (filters.screening) {
      if (filters.screening === "Not Done") {
        where.push("(Screening_Date IS NULL OR Screening_Date = '')");
      } else {
        where.push("Screening_Date IS NOT NULL AND Screening_Date != ''");
      }
    }
    if (filters.permittedBy) {
      if (filters.permittedBy === "Head Office") {
        where.push(
          "(Permitted_by_Sekondi_Office = 'No' OR Permitted_by_Sekondi_Office IS NULL OR Permitted_by_Sekondi_Office = '')",
        );
      } else {
        where.push("Permitted_by_Sekondi_Office = 'Yes'");
      }
    }
    if (filters.permitIssued) {
      where.push("PermitIssued = ?");
      params.push(filters.permitIssued);
    }
    if (filters.remarks) {
      where.push("Remarks = ?");
      params.push(filters.remarks);
    }
    if (filters.statusComments) {
      where.push("StatusOrComments = ?");
      params.push(filters.statusComments);
    }
    if (filters.issueDateFrom) {
      where.push("DateOfIssueOfPermit >= ?");
      params.push(filters.issueDateFrom);
    }
    if (filters.issueDateTo) {
      where.push("DateOfIssueOfPermit <= ?");
      params.push(filters.issueDateTo);
    }
    if (filters.expiryDateFrom) {
      where.push("PermitExpirationDate >= ?");
      params.push(filters.expiryDateFrom);
    }
    if (filters.expiryDateTo) {
      where.push("PermitExpirationDate <= ?");
      params.push(filters.expiryDateTo);
    }
    if (filters.category) {
      where.push("CategoryOfFile = ?");
      params.push(filters.category);
    }
    const whereClause = where.length > 0 ? " WHERE " + where.join(" AND ") : "";
    const rows = db.all(
      `SELECT RegisteredNameOfUndertaking, FileNumber, Latitude, Longitude, ClassificationOfUndertaking, FacilityLocation, CategoryOfFile, PermitHolder, ContactPerson, TelephoneNumber, PermitNumber, DateOfIssueOfPermit, PermitExpirationDate, ApplicationStatus, ApplicationStatusII, District, Jurisdiction, FileLocation, Remarks, StatusOrComments, OfficerWorkingOnFile FROM PERMIT${whereClause} ORDER BY RegisteredNameOfUndertaking`,
      params,
    );
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        "File Number": r.FileNumber || "",
        Name: r.RegisteredNameOfUndertaking || "",
        Latitude: r.Latitude || "",
        Longitude: r.Longitude || "",
        Sector: r.ClassificationOfUndertaking || "",
        Location: r.FacilityLocation || "",
        District: r.District || "",
        Jurisdiction: r.Jurisdiction || "",
        Category: r.CategoryOfFile || "",
        "Permit Holder": r.PermitHolder || "",
        "Contact Person": r.ContactPerson || "",
        Telephone: r.TelephoneNumber || "",
        "Permit Number": r.PermitNumber || "",
        "Issue Date": r.DateOfIssueOfPermit || "",
        "Expiry Date": r.PermitExpirationDate || "",
        "Application Status": r.ApplicationStatus || "",
        "Application Type": r.ApplicationStatusII || "",
        "File Location": r.FileLocation || "",
        Remarks: r.Remarks || "",
        "Status / Comments": r.StatusOrComments || "",
        Officer: r.OfficerWorkingOnFile || "",
      })),
    );
    XLSX.utils.book_append_sheet(wb, ws, "Permits");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="permit_export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  Data CRUD
// ══════════════════════════════════════════════════════════════
// Helper: check if user can view a given table
function canViewTable(db, userId, role, table) {
  if (role === "admin") return true;
  // Check table-specific permission first
  let perm = db.get(
    `SELECT can_view FROM user_permissions WHERE user_id = ? AND table_name = ? AND record_id IS NULL`,
    [userId, table],
  );
  if (perm) return !!perm.can_view;
  // Fall back to wildcard
  perm = db.get(
    `SELECT can_view FROM user_permissions WHERE user_id = ? AND table_name = '*' AND record_id IS NULL`,
    [userId],
  );
  if (perm) return !!perm.can_view;
  // No permissions at all — default deny for non-admin
  return false;
}

app.get("/api/tables", auth, (req, res) => {
  try {
    const db = getDb();
    const counts = {};
    const allowedTables = [];
    for (const t of DATA_TABLES) {
      if (canViewTable(db, req.user.id, req.user.role, t)) {
        const r = db.get(`SELECT COUNT(*) AS c FROM "${t}"`);
        counts[t] = r?.c || 0;
        allowedTables.push(t);
      }
    }
    res.json({ tables: allowedTables, counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tables/:table/columns", auth, (req, res) => {
  try {
    const db = getDb();
    const table = req.params.table;
    if (!DATA_TABLES.includes(table))
      return res.status(404).json({ error: "Table not found" });
    res.json(
      db.all(`PRAGMA table_info("${table}")`).filter((c) => c.name !== "id"),
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Field dropdown options for forms
app.get("/api/field-options/:table", auth, async (req, res) => {
  try {
    const db = getDb();
    const table = req.params.table;
    let options = { ...(FIELD_OPTIONS[table] || {}) };

    if (table === "PERMIT") {
      options = await enrichPermitDropdownOptionsFromSources(db, options);
    }

    // Dynamically inject employee names for OfficerWorkingOnFile
    if (table === "PERMIT") {
      const employees = db
        .all(
          "SELECT full_name FROM employees WHERE active = 1 ORDER BY full_name ASC",
        )
        .map((r) => r.full_name);
      if (employees.length > 0) {
        options.OfficerWorkingOnFile = employees;
      }
    }
    // Also inject for MOVEMENT ApprovedBy and RequestedBy if employees exist
    if (table === "MOVEMENT") {
      const employees = db
        .all(
          "SELECT full_name FROM employees WHERE active = 1 ORDER BY full_name ASC",
        )
        .map((r) => r.full_name);
      if (employees.length > 0) {
        options.ApprovedBy = employees;
        options.RequestedBy = employees;
      }
    }

    // Merge admin-managed custom dropdown options from DB
    const customOpts = db.all(
      "SELECT field_name, option_value FROM custom_dropdown_options WHERE table_name = ? ORDER BY sort_order ASC, option_value ASC",
      [table],
    );
    for (const co of customOpts) {
      if (table === "PERMIT" && co.field_name === "ApplicationStatusII") {
        continue;
      }
      if (!options[co.field_name]) options[co.field_name] = [];
      const cleanValue = sanitizeDropdownOptionValue(co.option_value);
      if (!cleanValue) continue;
      if (!options[co.field_name].includes(cleanValue)) {
        options[co.field_name].push(cleanValue);
      }
    }

    options = filterHiddenDropdownOptions(db, table, options);

    res.json(options);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/data/:table", auth, (req, res) => {
  try {
    const db = getDb();
    const table = req.params.table;
    if (!DATA_TABLES.includes(table))
      return res.status(404).json({ error: "Table not found" });
    if (!canViewTable(db, req.user.id, req.user.role, table))
      return res
        .status(403)
        .json({ error: "You do not have permission to view this table" });
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const sortCol = req.query.sort || "id";
    const sortDir = req.query.dir === "asc" ? "ASC" : "DESC";
    const validCols = db
      .all(`PRAGMA table_info("${table}")`)
      .map((c) => c.name);
    const safeSort = validCols.includes(sortCol) ? sortCol : "id";
    let whereClause = "",
      params = [];
    if (search) {
      const textCols = validCols.filter((c) => c !== "id");
      whereClause = `WHERE ${textCols.map((c) => `CAST("${c}" AS TEXT) LIKE ?`).join(" OR ")}`;
      params = textCols.map(() => `%${search}%`);
    }
    const totalRow = db.get(
      `SELECT COUNT(*) AS c FROM "${table}" ${whereClause}`,
      params,
    );
    const rows = db.all(
      `SELECT * FROM "${table}" ${whereClause} ORDER BY "${safeSort}" ${sortDir} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    // Enrich rows with attachment counts
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => "?").join(",");
      const attCounts = db.all(
        `SELECT record_id, COUNT(*) AS cnt FROM file_attachments WHERE table_name = ? AND record_id IN (${placeholders}) GROUP BY record_id`,
        [table, ...ids],
      );
      const countMap = {};
      attCounts.forEach((a) => {
        countMap[a.record_id] = a.cnt;
      });
      rows.forEach((r) => {
        r._attachmentCount = countMap[r.id] || 0;
      });
    }
    res.json({
      rows,
      total: totalRow?.c || 0,
      page,
      limit,
      pages: Math.ceil((totalRow?.c || 0) / limit) || 1,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/data/:table/:id", auth, (req, res) => {
  try {
    const db = getDb();
    const table = req.params.table;
    if (!DATA_TABLES.includes(table))
      return res.status(404).json({ error: "Table not found" });
    if (!canViewTable(db, req.user.id, req.user.role, table))
      return res
        .status(403)
        .json({ error: "You do not have permission to view this table" });
    const row = db.get(`SELECT * FROM "${table}" WHERE id = ?`, [
      parseInt(req.params.id),
    ]);
    if (!row) return res.status(404).json({ error: "Record not found" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/data/:table", auth, checkPerm("can_create"), (req, res) => {
  const db = getDb();
  const table = req.params.table;
  if (!DATA_TABLES.includes(table))
    return res.status(404).json({ error: "Table not found" });
  const validCols = db
    .all(`PRAGMA table_info("${table}")`)
    .map((c) => c.name)
    .filter((c) => c !== "id");
  const cols = Object.keys(req.body).filter((c) => validCols.includes(c));
  if (!cols.length) return res.status(400).json({ error: "No valid columns" });
  const values = cols.map((c) => (req.body[c] === "" ? null : req.body[c]));
  try {
    const result = db.run(
      `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
      values,
    );
    const row = db.get(`SELECT * FROM "${table}" WHERE id = ?`, [
      result.lastInsertRowid,
    ]);
    logActivity(
      req,
      "CREATE_RECORD",
      table,
      `ID ${result.lastInsertRowid}`,
      result.lastInsertRowid,
      "",
      "",
      JSON.stringify(row),
    );
    saveToDisk();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/data/:table/:id", auth, checkPerm("can_edit"), (req, res) => {
  const db = getDb();
  const table = req.params.table;
  if (!DATA_TABLES.includes(table))
    return res.status(404).json({ error: "Table not found" });
  const id = parseInt(req.params.id);
  // Capture old values
  const oldRow = db.get(`SELECT * FROM "${table}" WHERE id = ?`, [id]);
  const validCols = db
    .all(`PRAGMA table_info("${table}")`)
    .map((c) => c.name)
    .filter((c) => c !== "id");
  const cols = Object.keys(req.body).filter((c) => validCols.includes(c));
  if (!cols.length) return res.status(400).json({ error: "No valid columns" });
  const values = cols.map((c) => (req.body[c] === "" ? null : req.body[c]));
  values.push(id);
  try {
    db.run(
      `UPDATE "${table}" SET ${cols.map((c) => `"${c}" = ?`).join(", ")} WHERE id = ?`,
      values,
    );
    const row = db.get(`SELECT * FROM "${table}" WHERE id = ?`, [id]);
    // Compute diff — only store changed fields
    const changedNew = {};
    const changedOld = {};
    if (oldRow) {
      for (const col of cols) {
        const oldVal = oldRow[col];
        const newVal = row[col];
        if (String(oldVal ?? "") !== String(newVal ?? "")) {
          changedOld[col] = oldVal;
          changedNew[col] = newVal;
        }
      }
    }
    const changedKeys = Object.keys(changedNew);
    logActivity(
      req,
      "UPDATE_RECORD",
      table,
      `ID ${id}`,
      id,
      changedKeys.length > 0
        ? `Changed: ${changedKeys.join(", ")}`
        : "No changes",
      JSON.stringify(changedOld),
      JSON.stringify(changedNew),
    );
    saveToDisk();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete(
  "/api/data/:table/:id",
  auth,
  checkPerm("can_delete"),
  (req, res) => {
    const db = getDb();
    const table = req.params.table;
    if (!DATA_TABLES.includes(table))
      return res.status(404).json({ error: "Table not found" });
    const id = parseInt(req.params.id);
    // Capture old values before delete
    const oldRow = db.get(`SELECT * FROM "${table}" WHERE id = ?`, [id]);
    db.run(`DELETE FROM "${table}" WHERE id = ?`, [id]);
    logActivity(
      req,
      "DELETE_RECORD",
      table,
      `ID ${id}`,
      id,
      "",
      JSON.stringify(oldRow || {}),
      "",
    );
    saveToDisk();
    res.json({ message: "Record deleted" });
  },
);

// ── Bulk Delete ──────────────────────────────────────────────
app.post(
  "/api/data/:table/bulk-delete",
  auth,
  checkPerm("can_delete"),
  (req, res) => {
    const db = getDb();
    const table = req.params.table;
    if (!DATA_TABLES.includes(table))
      return res.status(404).json({ error: "Table not found" });
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: "No record IDs provided" });
    try {
      let deleted = 0;
      for (const id of ids) {
        const oldRow = db.get(`SELECT * FROM "${table}" WHERE id = ?`, [id]);
        if (oldRow) {
          db.run(`DELETE FROM "${table}" WHERE id = ?`, [id]);
          logActivity(
            req,
            "DELETE_RECORD",
            table,
            `ID ${id}`,
            id,
            "bulk delete",
            JSON.stringify(oldRow),
            "",
          );
          deleted++;
        }
      }
      saveToDisk();
      res.json({ message: `${deleted} records deleted`, deleted });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// ══════════════════════════════════════════════════════════════
//  Dashboard
// ══════════════════════════════════════════════════════════════
app.get("/api/dashboard", auth, (req, res) => {
  try {
    const db = getDb();
    const stats = {};
    for (const t of DATA_TABLES) {
      const r = db.get(`SELECT COUNT(*) AS c FROM "${t}"`);
      stats[t] = r?.c || 0;
    }
    stats.users = db.get("SELECT COUNT(*) AS c FROM app_users")?.c || 0;
    stats.expiredPermits =
      db.get(
        `SELECT COUNT(*) AS c FROM PERMIT WHERE PermitExpirationDate IS NOT NULL AND PermitExpirationDate < date('now')`,
      )?.c || 0;
    stats.expiringSoon =
      db.get(
        `SELECT COUNT(*) AS c FROM PERMIT WHERE PermitExpirationDate IS NOT NULL AND PermitExpirationDate >= date('now') AND PermitExpirationDate <= date('now','+90 days')`,
      )?.c || 0;
    stats.activePermits =
      db.get(
        `SELECT COUNT(*) AS c FROM PERMIT WHERE PermitExpirationDate IS NOT NULL AND PermitExpirationDate >= date('now')`,
      )?.c || 0;
    stats.newApplications =
      db.get(
        `SELECT COUNT(*) AS c FROM PERMIT WHERE ApplicationStatusII = 'New Application'`,
      )?.c || 0;
    stats.renewals =
      db.get(
        `SELECT COUNT(*) AS c FROM PERMIT WHERE ApplicationStatusII = 'Renewal of Permit'`,
      )?.c || 0;
    stats.permitsIssued =
      db.get(
        `SELECT COUNT(*) AS c FROM PERMIT WHERE DateOfIssueOfPermit IS NOT NULL AND DateOfIssueOfPermit != ''`,
      )?.c || 0;
    stats.complianceEnforcement =
      db.get(
        `SELECT COUNT(*) AS c FROM PERMIT WHERE Compliance = 'Compliance Enforcement'`,
      )?.c || 0;
    stats.paidProcessingFee =
      db.get(
        `SELECT COUNT(*) AS c FROM PERMIT WHERE DateOfPaymentOfProcessingFee IS NOT NULL`,
      )?.c || 0;
    stats.paidPermitFee =
      db.get(
        `SELECT COUNT(*) AS c FROM PERMIT WHERE DateOfPaymentOfPermitFee IS NOT NULL`,
      )?.c || 0;
    stats.sekondiPermits =
      db.get(
        `SELECT COUNT(*) AS c FROM PERMIT WHERE Permitted_by_Sekondi_Office = 'Yes'`,
      )?.c || 0;
    stats.statusBreakdown = db.all(
      `SELECT ApplicationStatus AS status, COUNT(*) AS count FROM PERMIT WHERE ApplicationStatus IS NOT NULL AND ApplicationStatus != '' GROUP BY ApplicationStatus ORDER BY count DESC LIMIT 50`,
    );
    stats.classificationBreakdown = db.all(
      `SELECT ClassificationOfUndertaking AS classification, COUNT(*) AS count FROM PERMIT WHERE ClassificationOfUndertaking IS NOT NULL AND ClassificationOfUndertaking != '' GROUP BY ClassificationOfUndertaking ORDER BY count DESC LIMIT 50`,
    );
    stats.districtBreakdown = db.all(
      `SELECT District AS district, COUNT(*) AS count FROM PERMIT WHERE District IS NOT NULL AND District != '' GROUP BY District ORDER BY count DESC LIMIT 50`,
    );
    stats.recentActivity =
      db.get(
        `SELECT COUNT(*) AS c FROM activity_log WHERE created_at >= datetime('now','-24 hours','localtime')`,
      )?.c || 0;
    stats.recentActivityList = db.all(
      `SELECT username, action, target_type, target_name, created_at FROM activity_log ORDER BY created_at DESC LIMIT 30`,
    );
    stats.expiredPermitsList = db.all(
      `SELECT id, RegisteredNameOfUndertaking, PermitNumber, PermitExpirationDate, District, ClassificationOfUndertaking FROM PERMIT WHERE PermitExpirationDate IS NOT NULL AND PermitExpirationDate < date('now') ORDER BY PermitExpirationDate DESC LIMIT 50`,
    );
    stats.expiringSoonList = db.all(
      `SELECT id, RegisteredNameOfUndertaking, PermitNumber, PermitExpirationDate, District FROM PERMIT WHERE PermitExpirationDate IS NOT NULL AND PermitExpirationDate >= date('now') AND PermitExpirationDate <= date('now','+90 days') ORDER BY PermitExpirationDate ASC LIMIT 50`,
    );
    // Monthly permit issuance trend (last 12 months)
    stats.monthlyTrend = db.all(
      `SELECT strftime('%Y-%m', DateOfIssueOfPermit) AS month, COUNT(*) AS count
       FROM PERMIT
       WHERE DateOfIssueOfPermit IS NOT NULL AND DateOfIssueOfPermit != ''
         AND DateOfIssueOfPermit >= date('now','-12 months')
       GROUP BY month ORDER BY month ASC`,
    );
    // Permit validity breakdown for donut chart
    stats.permitValidity = {
      active: stats.activePermits,
      expired: stats.expiredPermits,
      expiringSoon: stats.expiringSoon,
      noDate:
        db.get(
          `SELECT COUNT(*) AS c FROM PERMIT WHERE PermitExpirationDate IS NULL OR PermitExpirationDate = ''`,
        )?.c || 0,
    };
    // Top 10 districts
    stats.topDistricts = db.all(
      `SELECT District AS name, COUNT(*) AS count FROM PERMIT WHERE District IS NOT NULL AND District != '' GROUP BY District ORDER BY count DESC LIMIT 10`,
    );
    // Store totals
    stats.totalRevenue =
      db.get(
        `SELECT SUM(CASE WHEN TotalAmount > 0 THEN TotalAmount ELSE 0 END) AS total FROM PERMIT`,
      )?.total || 0;
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Historical dashboard data — scoped by year
app.get("/api/dashboard/historical", auth, (req, res) => {
  try {
    const db = getDb();
    const year = String(parseInt(req.query.year) || new Date().getFullYear());
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const stats = {};
    stats.year = parseInt(year);

    // Permits issued in that year
    stats.permitsIssued = db.get(
      `SELECT COUNT(*) AS c FROM PERMIT WHERE DateOfIssueOfPermit >= ? AND DateOfIssueOfPermit <= ?`,
      [startDate, endDate]
    )?.c || 0;

    // New applications in that year
    stats.newApplications = db.get(
      `SELECT COUNT(*) AS c FROM PERMIT WHERE ApplicationStatusII = 'New Application' AND DateOfReceiptOfApplication >= ? AND DateOfReceiptOfApplication <= ?`,
      [startDate, endDate]
    )?.c || 0;

    // Renewals in that year
    stats.renewals = db.get(
      `SELECT COUNT(*) AS c FROM PERMIT WHERE ApplicationStatusII = 'Renewal of Permit' AND DateOfReceiptOfApplication >= ? AND DateOfReceiptOfApplication <= ?`,
      [startDate, endDate]
    )?.c || 0;

    // Permits that expired in that year
    stats.expiredInYear = db.get(
      `SELECT COUNT(*) AS c FROM PERMIT WHERE PermitExpirationDate >= ? AND PermitExpirationDate <= ?`,
      [startDate, endDate]
    )?.c || 0;

    // Monthly trend for that year
    stats.monthlyTrend = db.all(
      `SELECT strftime('%Y-%m', DateOfIssueOfPermit) AS month, COUNT(*) AS count
       FROM PERMIT
       WHERE DateOfIssueOfPermit IS NOT NULL AND DateOfIssueOfPermit != ''
         AND DateOfIssueOfPermit >= ? AND DateOfIssueOfPermit <= ?
       GROUP BY month ORDER BY month ASC`,
      [startDate, endDate]
    );

    // District breakdown for that year
    stats.districtBreakdown = db.all(
      `SELECT District AS name, COUNT(*) AS count FROM PERMIT
       WHERE District IS NOT NULL AND District != ''
         AND DateOfIssueOfPermit >= ? AND DateOfIssueOfPermit <= ?
       GROUP BY District ORDER BY count DESC LIMIT 10`,
      [startDate, endDate]
    );

    // Classification breakdown for that year
    stats.classificationBreakdown = db.all(
      `SELECT ClassificationOfUndertaking AS classification, COUNT(*) AS count FROM PERMIT
       WHERE ClassificationOfUndertaking IS NOT NULL AND ClassificationOfUndertaking != ''
         AND DateOfIssueOfPermit >= ? AND DateOfIssueOfPermit <= ?
       GROUP BY ClassificationOfUndertaking ORDER BY count DESC LIMIT 10`,
      [startDate, endDate]
    );

    // Available years for the year selector
    stats.availableYears = db.all(
      `SELECT DISTINCT strftime('%Y', DateOfIssueOfPermit) AS yr FROM PERMIT
       WHERE DateOfIssueOfPermit IS NOT NULL AND DateOfIssueOfPermit != ''
       ORDER BY yr DESC`
    ).map(r => parseInt(r.yr)).filter(y => !isNaN(y));

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  Queries
// ══════════════════════════════════════════════════════════════
app.get("/api/queries", auth, (req, res) => {
  res.json(
    Object.entries(SAVED_QUERIES).map(([key, q]) => ({
      key,
      name: q.name,
      description: q.description,
      category: q.category,
      table: q.table,
      params: q.params,
      isAggregate: q.isAggregate || false,
    })),
  );
});

app.post(
  "/api/queries/:key/run",
  auth,
  checkFeaturePerm("query", (req) => req.params.key),
  (req, res) => {
    const db = getDb();
    const query = SAVED_QUERIES[req.params.key];
    if (!query) return res.status(404).json({ error: "Query not found" });
    let sql = query.sql,
      paramValues = [];
    if (req.params.key === "PERMIT_EXPIRE_DAYS") {
      const days = parseInt(req.body.days) || 60;
      sql = `SELECT * FROM PERMIT WHERE PermitExpirationDate IS NOT NULL AND PermitExpirationDate >= date('now') AND PermitExpirationDate <= date('now','+${days} days')`;
    } else if (query.params.length > 0) {
      paramValues = query.params.map((p) => req.body[p.name] || "");
    }
    try {
      const rows = db.all(sql, paramValues);
      logActivity(req, "RUN_QUERY", "query", query.name);
      res.json({ rows, total: rows.length, queryName: query.name });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// ══════════════════════════════════════════════════════════════
//  Forms
// ══════════════════════════════════════════════════════════════
app.get("/api/forms", auth, (req, res) => {
  res.json(
    Object.entries(FORM_DEFINITIONS).map(([key, f]) => ({
      key,
      name: f.name,
      description: f.description,
      icon: f.icon,
      table: f.table,
      sections: f.sections,
    })),
  );
});

app.get("/api/forms/:key", auth, (req, res) => {
  const form = FORM_DEFINITIONS[req.params.key];
  if (!form) return res.status(404).json({ error: "Form not found" });
  const db = getDb();
  const cols = db
    .all(`PRAGMA table_info("${form.table}")`)
    .filter((c) => c.name !== "id");
  res.json({ ...form, columns: cols });
});

// ══════════════════════════════════════════════════════════════
//  Reports
// ══════════════════════════════════════════════════════════════
app.get("/api/reports", auth, (req, res) => {
  res.json(
    Object.entries(REPORT_DEFINITIONS).map(([key, r]) => ({
      key,
      name: r.name,
      description: r.description,
      briefing: r.briefing || "",
      icon: r.icon,
      params: r.params || [],
    })),
  );
});

app.post(
  "/api/reports/:key/run",
  auth,
  checkFeaturePerm("report", (req) => req.params.key),
  (req, res) => {
    const db = getDb();
    const report = REPORT_DEFINITIONS[req.params.key];
    if (!report) return res.status(404).json({ error: "Report not found" });
    let sql = report.sql;
    if (req.params.key === "QUARTERLY") {
      const year = parseInt(req.body.year) || new Date().getFullYear();
      sql = `SELECT 'Q1 (Jan-Mar)' AS Quarter, COUNT(*) AS Total FROM PERMIT WHERE Permitted_by_Sekondi_Office='Yes' AND DateOfIssueOfPermit>='${year}-01-01' AND DateOfIssueOfPermit<='${year}-03-31' UNION ALL SELECT 'Q2 (Apr-Jun)',COUNT(*) FROM PERMIT WHERE Permitted_by_Sekondi_Office='Yes' AND DateOfIssueOfPermit>='${year}-04-01' AND DateOfIssueOfPermit<='${year}-06-30' UNION ALL SELECT 'Q3 (Jul-Sep)',COUNT(*) FROM PERMIT WHERE Permitted_by_Sekondi_Office='Yes' AND DateOfIssueOfPermit>='${year}-07-01' AND DateOfIssueOfPermit<='${year}-09-30' UNION ALL SELECT 'Q4 (Oct-Dec)',COUNT(*) FROM PERMIT WHERE Permitted_by_Sekondi_Office='Yes' AND DateOfIssueOfPermit>='${year}-10-01' AND DateOfIssueOfPermit<='${year}-12-31'`;
    }
    try {
      const rows = db.all(sql, []);
      let detailRows = [];
      if (report.detailSql) {
        try { detailRows = db.all(report.detailSql, []); } catch {}
      }
      logActivity(req, "RUN_REPORT", "report", report.name);
      res.json({ rows, detailRows, total: rows.length, detailTotal: detailRows.length, reportName: report.name });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// ══════════════════════════════════════════════════════════════
//  Activity Log
// ══════════════════════════════════════════════════════════════
app.get("/api/activity", auth, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const userFilter = req.query.user || "";
    let where = [],
      params = [];
    if (search) {
      where.push(
        `(action LIKE ? OR target_type LIKE ? OR target_name LIKE ? OR details LIKE ? OR username LIKE ?)`,
      );
      params.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
      );
    }
    if (userFilter) {
      where.push(`username = ?`);
      params.push(userFilter);
    }
    const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total =
      db.get(`SELECT COUNT(*) AS c FROM activity_log ${wc}`, params)?.c || 0;
    const rows = db.all(
      `SELECT * FROM activity_log ${wc} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    const users = db.all(
      `SELECT DISTINCT username FROM activity_log ORDER BY username`,
    );
    res.json({
      rows,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
      users: users.map((u) => u.username),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  Macros & Modules
// ══════════════════════════════════════════════════════════════
app.get("/api/macros", auth, (req, res) => {
  res.json({
    macros: [
      {
        name: "AutoExec",
        description: "Runs on database startup — opens main login form",
        type: "macro",
        originalAction: 'OpenForm "LOGIN SCREEN"',
        webEquivalent: "Auto-login via JWT token persistence",
      },
      {
        name: "Switchboard Manager",
        description: "Navigation macro for the main menu system",
        type: "macro",
        originalAction: 'RunMacro "Switchboard Manager"',
        webEquivalent: "Sidebar navigation with activity bar",
      },
      {
        name: "Close Form",
        description: "Closes current form and returns to main menu",
        type: "macro",
        originalAction: "Close acForm",
        webEquivalent: "View switching via sidebar",
      },
      {
        name: "Print Report",
        description: "Opens print dialog for current report",
        type: "macro",
        originalAction: "OpenReport, acViewPreview",
        webEquivalent: "Export to CSV / Browser print (Ctrl+P)",
      },
      {
        name: "Refresh Data",
        description: "Refreshes all data in the current form",
        type: "macro",
        originalAction: "Requery",
        webEquivalent: "Auto-refresh on data changes via API",
      },
    ],
    modules: [
      {
        name: "Navigation Module",
        description:
          "VBA code for the Switchboard navigation — handles form opening and transitions",
        type: "module",
        lines: 45,
        webEquivalent: "SPA routing in app.js",
      },
      {
        name: "Login Module",
        description:
          "VBA code for user authentication — validates against the User table",
        type: "module",
        lines: 30,
        webEquivalent: "JWT authentication in server.js",
      },
      {
        name: "Report Module",
        description:
          "VBA code for report generation — date filtering, query parameters",
        type: "module",
        lines: 85,
        webEquivalent: "Reports API endpoints with parameterized queries",
      },
      {
        name: "File List Module",
        description:
          "VBA code for filing form — environmental reports and file tracking",
        type: "module",
        lines: 55,
        webEquivalent: "Document Filing form and tbl_keyword CRUD",
      },
      {
        name: "Utility Functions",
        description:
          "Shared VBA functions — date formatting, validation, error handling",
        type: "module",
        lines: 120,
        webEquivalent: "JavaScript utilities in app.js",
      },
    ],
  });
});

// ══════════════════════════════════════════════════════════════
//  Admin: Data Management (Clear & Upload)
// ══════════════════════════════════════════════════════════════

// Clear all data from data tables (keeps users & activity log)
app.post("/api/admin/clear-data", auth, adminOnly, (req, res) => {
  const db = getDb();
  const { confirmText } = req.body;
  if (confirmText !== "CLEAR ALL DATA") {
    return res.status(400).json({ error: "Type 'CLEAR ALL DATA' to confirm" });
  }
  try {
    const counts = {};
    for (const table of DATA_TABLES) {
      const count = db.get(`SELECT COUNT(*) AS c FROM "${table}"`)?.c || 0;
      db.run(`DELETE FROM "${table}"`);
      counts[table] = count;
    }
    logActivity(
      req,
      "CLEAR_DATA",
      "admin",
      "All Tables",
      null,
      JSON.stringify(counts),
    );
    saveToDisk();
    res.json({
      message: "All data cleared successfully",
      deletedCounts: counts,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Upload Access file and extract data
app.post(
  "/api/admin/upload-access",
  auth,
  adminOnly,
  upload.single("accessFile"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const filePath = req.file.path;
    try {
      // Read the Access file
      const buffer = fs.readFileSync(filePath);
      await loadMdbReader();
      const reader = new MDBReader(buffer);
      const accessTableNames = reader.getTableNames();
      const db = getDb();

      // Map Access table names to our schema tables
      const TABLE_MAP = {
        PERMIT: "PERMIT",
        MOVEMENT: "MOVEMENT",
        WASTE: "WASTE",
        Stores: "Stores",
        tbl_keyword: "tbl_keyword",
        // Common variations
        Permit: "PERMIT",
        Movement: "MOVEMENT",
        Waste: "WASTE",
        stores: "Stores",
        STORES: "Stores",
        tbl_Keyword: "tbl_keyword",
        TBL_KEYWORD: "tbl_keyword",
      };

      const imported = {};
      const errors = [];

      for (const accessTable of accessTableNames) {
        const targetTable = TABLE_MAP[accessTable];
        if (!targetTable) continue;

        try {
          const validCols = db
            .all(`PRAGMA table_info("${targetTable}")`)
            .map((c) => c.name)
            .filter((c) => c !== "id");
          const data = reader.getTable(accessTable).getData();
          if (!data || data.length === 0) {
            imported[targetTable] = 0;
            continue;
          }

          let count = 0;
          for (const row of data) {
            const accessKeys = Object.keys(row);
            const colMap = {};
            for (const vCol of validCols) {
              const match = accessKeys.find(
                (k) => k.toLowerCase() === vCol.toLowerCase(),
              );
              if (match && row[match] !== null && row[match] !== undefined) {
                colMap[vCol] = row[match];
              }
            }

            const cols = Object.keys(colMap);
            if (cols.length === 0) continue;

            const values = cols.map((c) => {
              let val = colMap[c];
              if (val instanceof Date) {
                val = val.toISOString().split("T")[0];
              }
              return val === "" ? null : val;
            });

            try {
              db.run(
                `INSERT INTO "${targetTable}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
                values,
              );
              count++;
            } catch (insertErr) {
              // Skip individual row errors
            }
          }
          imported[targetTable] = count;
        } catch (tableErr) {
          errors.push(`${accessTable}: ${tableErr.message}`);
        }
      }

      try {
        fs.unlinkSync(filePath);
      } catch (e) {}

      logActivity(
        req,
        "UPLOAD_ACCESS",
        "admin",
        req.file.originalname,
        null,
        JSON.stringify(imported),
      );
      saveToDisk();

      res.json({
        message: "Access file imported successfully",
        imported,
        errors: errors.length > 0 ? errors : undefined,
        tablesFound: accessTableNames.filter((t) => TABLE_MAP[t]),
      });
    } catch (e) {
      try {
        fs.unlinkSync(filePath);
      } catch (ex) {}
      res
        .status(500)
        .json({ error: `Failed to read Access file: ${e.message}` });
    }
  },
);

// ══════════════════════════════════════════════════════════════
//  Distinct values
// ══════════════════════════════════════════════════════════════
app.get("/api/distinct/:table/:column", auth, (req, res) => {
  const db = getDb();
  const { table, column } = req.params;
  if (!DATA_TABLES.includes(table))
    return res.status(404).json({ error: "Table not found" });
  const validCols = db.all(`PRAGMA table_info("${table}")`).map((c) => c.name);
  if (!validCols.includes(column))
    return res.status(400).json({ error: "Invalid column" });
  try {
    const rows = db.all(
      `SELECT DISTINCT "${column}" FROM "${table}" WHERE "${column}" IS NOT NULL AND "${column}" != '' ORDER BY "${column}"`,
    );
    res.json(rows.map((r) => r[column]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  CSV / Excel Export
// ══════════════════════════════════════════════════════════════
app.get("/api/export/:table", auth, (req, res) => {
  const db = getDb();
  const table = req.params.table;
  if (!DATA_TABLES.includes(table))
    return res.status(404).json({ error: "Table not found" });
  const format = req.query.format || "csv";
  try {
    const rows = db.all(`SELECT * FROM "${table}" ORDER BY id`);
    if (format === "xlsx") {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, table);
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${table}_export.xlsx"`,
      );
      res.send(buf);
    } else {
      const ws = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${table}_export.csv"`,
      );
      res.send(csv);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Export query / report results
app.post("/api/export-results", auth, (req, res) => {
  const { rows, name, format } = req.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: "No data to export" });
  try {
    const ws = XLSX.utils.json_to_sheet(rows);
    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, (name || "Export").slice(0, 31));
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${name || "export"}.xlsx"`,
      );
      res.send(buf);
    } else {
      const csv = XLSX.utils.sheet_to_csv(ws);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${name || "export"}.csv"`,
      );
      res.send(csv);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  Activity Log — Enhanced (revert + delete)
// ══════════════════════════════════════════════════════════════
app.post("/api/activity/:id/revert", auth, adminOnly, (req, res) => {
  const db = getDb();
  const logId = parseInt(req.params.id);
  const entry = db.get("SELECT * FROM activity_log WHERE id = ?", [logId]);
  if (!entry) return res.status(404).json({ error: "Activity log not found" });

  const { action, target_type, target_id, old_values, new_values } = entry;
  if (!target_type || !DATA_TABLES.includes(target_type))
    return res
      .status(400)
      .json({ error: "Cannot revert this action — table not recognized" });

  try {
    if (action === "DELETE_RECORD" && old_values) {
      // Re-insert the deleted record
      const data = JSON.parse(old_values);
      delete data.id;
      const cols = Object.keys(data);
      if (cols.length === 0)
        return res.status(400).json({ error: "No data to restore" });
      const vals = cols.map((c) => data[c]);
      db.run(
        `INSERT INTO "${target_type}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
        vals,
      );
      logActivity(
        req,
        "REVERT_DELETE",
        target_type,
        `Restored from log #${logId}`,
        null,
        `Reverted delete of ID ${target_id}`,
      );
    } else if (action === "UPDATE_RECORD" && old_values) {
      // Restore old values
      const data = JSON.parse(old_values);
      const id = data.id || target_id;
      delete data.id;
      const cols = Object.keys(data);
      if (cols.length === 0)
        return res.status(400).json({ error: "No data to restore" });
      const vals = cols.map((c) => data[c]);
      vals.push(id);
      db.run(
        `UPDATE "${target_type}" SET ${cols.map((c) => `"${c}" = ?`).join(", ")} WHERE id = ?`,
        vals,
      );
      logActivity(
        req,
        "REVERT_UPDATE",
        target_type,
        `ID ${id}`,
        id,
        `Reverted to state before log #${logId}`,
      );
    } else if (action === "CREATE_RECORD" && target_id) {
      // Delete the created record
      db.run(`DELETE FROM "${target_type}" WHERE id = ?`, [target_id]);
      logActivity(
        req,
        "REVERT_CREATE",
        target_type,
        `ID ${target_id}`,
        target_id,
        `Reverted creation from log #${logId}`,
      );
    } else {
      return res
        .status(400)
        .json({ error: "Cannot revert this action type or missing data" });
    }
    saveToDisk();
    res.json({ message: "Action reverted successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/activity/:id", auth, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    db.run("DELETE FROM activity_log WHERE id = ?", [id]);
    saveToDisk();
    res.json({ message: "Log entry deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  Permissions CRUD
// ══════════════════════════════════════════════════════════════
app.get("/api/permissions/me", auth, (req, res) => {
  try {
    const db = getDb();
    const rows = db.all("SELECT * FROM user_permissions WHERE user_id = ?", [
      req.user.id,
    ]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/permissions", auth, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const rows = db.all(
      `SELECT p.*, u.username, u.full_name FROM user_permissions p JOIN app_users u ON p.user_id = u.id ORDER BY u.username, p.table_name`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/permissions/user/:userId", auth, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const userId = parseInt(req.params.userId);
    const rows = db.all("SELECT * FROM user_permissions WHERE user_id = ?", [
      userId,
    ]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/permissions", auth, adminOnly, (req, res) => {
  const db = getDb();
  const {
    user_id,
    table_name,
    record_id,
    can_view,
    can_create,
    can_edit,
    can_delete,
  } = req.body;
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  try {
    const tn = table_name || "*";
    const rid = record_id || null;
    // Delete existing permission first (handles NULL record_id which SQLite UNIQUE can't match)
    if (rid === null) {
      db.run(
        `DELETE FROM user_permissions WHERE user_id = ? AND table_name = ? AND record_id IS NULL`,
        [user_id, tn],
      );
    } else {
      db.run(
        `DELETE FROM user_permissions WHERE user_id = ? AND table_name = ? AND record_id = ?`,
        [user_id, tn, rid],
      );
    }
    const result = db.run(
      `INSERT INTO user_permissions (user_id, table_name, record_id, can_view, can_create, can_edit, can_delete) VALUES (?,?,?,?,?,?,?)`,
      [
        user_id,
        tn,
        rid,
        can_view ?? 1,
        can_create ?? 1,
        can_edit ?? 1,
        can_delete ?? 1,
      ],
    );
    logActivity(
      req,
      "SET_PERMISSION",
      "permission",
      `User ${user_id} → ${tn}`,
      result.lastInsertRowid,
    );
    saveToDisk();
    res.json({ id: result.lastInsertRowid, message: "Permission saved" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/permissions/:id", auth, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    db.run("DELETE FROM user_permissions WHERE id = ?", [id]);
    saveToDisk();
    res.json({ message: "Permission deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  File Attachments
// ══════════════════════════════════════════════════════════════
app.get("/api/attachments/:table/:recordId", auth, (req, res) => {
  try {
    const db = getDb();
    const { table, recordId } = req.params;
    if (!DATA_TABLES.includes(table))
      return res.status(404).json({ error: "Table not found" });
    const rows = db.all(
      "SELECT * FROM file_attachments WHERE table_name = ? AND record_id = ? ORDER BY created_at DESC",
      [table, parseInt(recordId)],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/attachments/:table/:recordId",
  auth,
  fileUpload.array("files", 10),
  (req, res) => {
    const db = getDb();
    const { table, recordId } = req.params;
    if (!DATA_TABLES.includes(table))
      return res.status(404).json({ error: "Table not found" });
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "No files uploaded" });

    const saved = [];
    for (const file of req.files) {
      const result = db.run(
        `INSERT INTO file_attachments (table_name, record_id, filename, original_name, mime_type, file_size, uploaded_by) VALUES (?,?,?,?,?,?,?)`,
        [
          table,
          parseInt(recordId),
          file.filename,
          file.originalname,
          file.mimetype || "",
          file.size || 0,
          req.user?.username || "",
        ],
      );
      saved.push({
        id: result.lastInsertRowid,
        original_name: file.originalname,
        file_size: file.size,
      });
    }
    logActivity(
      req,
      "UPLOAD_FILE",
      table,
      `Record ${recordId}`,
      parseInt(recordId),
      `${saved.length} file(s)`,
    );
    saveToDisk();
    res.json({ message: `${saved.length} file(s) uploaded`, files: saved });
  },
);

app.get("/api/attachments/download/:id", auth, (req, res) => {
  try {
    const db = getDb();
    const att = db.get("SELECT * FROM file_attachments WHERE id = ?", [
      parseInt(req.params.id),
    ]);
    if (!att) return res.status(404).json({ error: "Attachment not found" });
    const filePath = path.join(FILES_DIR, att.filename);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: "File not found on disk" });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${att.original_name}"`,
    );
    if (att.mime_type) res.setHeader("Content-Type", att.mime_type);
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/attachments/:id", auth, adminOnly, (req, res) => {
  const db = getDb();
  const att = db.get("SELECT * FROM file_attachments WHERE id = ?", [
    parseInt(req.params.id),
  ]);
  if (!att) return res.status(404).json({ error: "Attachment not found" });
  // Delete file from disk
  try {
    fs.unlinkSync(path.join(FILES_DIR, att.filename));
  } catch (e) {}
  db.run("DELETE FROM file_attachments WHERE id = ?", [att.id]);
  logActivity(
    req,
    "DELETE_FILE",
    att.table_name,
    att.original_name,
    att.record_id,
  );
  res.json({ message: "Attachment deleted" });
});

// Allow users with edit permission to also delete their own uploads
app.delete("/api/attachments/:id/user", auth, (req, res) => {
  const db = getDb();
  const att = db.get("SELECT * FROM file_attachments WHERE id = ?", [
    parseInt(req.params.id),
  ]);
  if (!att) return res.status(404).json({ error: "Attachment not found" });
  if (att.uploaded_by !== req.user.username && req.user.role !== "admin") {
    return res
      .status(403)
      .json({ error: "You can only delete your own uploads" });
  }
  try {
    fs.unlinkSync(path.join(FILES_DIR, att.filename));
  } catch (e) {}
  db.run("DELETE FROM file_attachments WHERE id = ?", [att.id]);
  logActivity(
    req,
    "DELETE_FILE",
    att.table_name,
    att.original_name,
    att.record_id,
  );
  res.json({ message: "Attachment deleted" });
});

// ══════════════════════════════════════════════════════════════
//  Feature Permissions — controls access to pages, queries, reports, forms, dashboard widgets
// ══════════════════════════════════════════════════════════════
app.get("/api/feature-permissions/me", auth, (req, res) => {
  try {
    const db = getDb();
    if (req.user.role === "admin") {
      return res.json({ role: "admin", features: "all" });
    }
    const rows = db.all(
      "SELECT feature_category, feature_key, is_allowed FROM feature_permissions WHERE user_id = ?",
      [req.user.id],
    );
    const result = {};
    for (const r of rows) {
      if (!result[r.feature_category]) result[r.feature_category] = {};
      result[r.feature_category][r.feature_key] = !!r.is_allowed;
    }
    res.json({ role: req.user.role, features: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(
  "/api/feature-permissions/user/:userId",
  auth,
  adminOnly,
  (req, res) => {
    try {
      const db = getDb();
      const userId = parseInt(req.params.userId);
      const rows = db.all(
        "SELECT * FROM feature_permissions WHERE user_id = ?",
        [userId],
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.post("/api/feature-permissions/bulk", auth, adminOnly, (req, res) => {
  const db = getDb();
  // Accept both 'permissions' and 'features' field names from frontend
  const { user_id } = req.body;
  const permList = req.body.permissions || req.body.features;
  if (!user_id || !permList)
    return res.status(400).json({ error: "user_id and permissions required" });
  try {
    // Delete existing feature permissions for this user
    db.run("DELETE FROM feature_permissions WHERE user_id = ?", [user_id]);
    // Insert new permissions — accept both naming conventions
    for (const perm of permList) {
      const cat = perm.category || perm.feature_category;
      const key = perm.key || perm.feature_key;
      const allowed =
        perm.allowed !== undefined
          ? perm.allowed
          : perm.is_allowed !== undefined
            ? perm.is_allowed
            : 0;
      db.run(
        `INSERT INTO feature_permissions (user_id, feature_category, feature_key, is_allowed) VALUES (?,?,?,?)`,
        [user_id, cat, key, allowed ? 1 : 0],
      );
    }
    logActivity(
      req,
      "SET_FEATURE_PERMS",
      "permission",
      `User ${user_id}`,
      user_id,
      `${permList.length} features`,
    );
    saveToDisk();
    res.json({
      message: "Feature permissions saved",
      count: permList.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint to get all available features (for admin UI)
app.get("/api/feature-permissions/available", auth, adminOnly, (req, res) => {
  const queryList = Object.entries(SAVED_QUERIES).map(([key, q]) => ({
    key,
    name: q.name,
    category: q.category,
  }));
  const reportList = Object.entries(REPORT_DEFINITIONS).map(([key, r]) => ({
    key,
    name: r.name,
  }));
  const formList = Object.entries(FORM_DEFINITIONS).map(([key, f]) => ({
    key,
    name: f.name,
    table: f.table,
  }));
  res.json({
    pages: [
      { key: "dashboard", name: "Dashboard" },
      { key: "tables", name: "Data Tables" },
      { key: "queries", name: "Queries" },
      { key: "forms", name: "Forms" },
      { key: "reports", name: "Reports" },
      { key: "scanlog", name: "Scan Log" },
      { key: "permitfilter", name: "Permit Filter & Export" },
      { key: "enrichment", name: "Data Enrichment" },
      // { key: "records", name: "Records Entries" },
      // { key: "recordsAnalytics", name: "Records Analytics" },
    ],
    tables: DATA_TABLES.map((t) => ({ key: t, name: t })),
    queries: queryList,
    reports: reportList,
    forms: formList,
    dashboard_widgets: [
      { key: "metrics", name: "Key Metrics Cards" },
      { key: "charts", name: "Charts & Graphs" },
      { key: "recent_activity", name: "Recent Activity" },
      { key: "expired_permits", name: "Expired Permits List" },
      { key: "expiring_permits", name: "Expiring Soon List" },
    ],
  });
});

// ══════════════════════════════════════════════════════════════
//  Google Drive Backup System
// ══════════════════════════════════════════════════════════════
function getBackupConfig(db) {
  const rows = db.all("SELECT config_key, config_value FROM backup_config");
  const config = {};
  for (const r of rows) config[r.config_key] = r.config_value;
  return config;
}

function setBackupConfig(db, key, value) {
  const existing = db.get("SELECT id FROM backup_config WHERE config_key = ?", [
    key,
  ]);
  if (existing) {
    db.run(
      "UPDATE backup_config SET config_value = ?, updated_at = datetime('now','localtime') WHERE config_key = ?",
      [value, key],
    );
  } else {
    db.run(
      "INSERT INTO backup_config (config_key, config_value) VALUES (?,?)",
      [key, value],
    );
  }
}

function getOAuth2Client(config) {
  if (!config.google_client_id || !config.google_client_secret) return null;
  const redirectUri =
    config.google_redirect_uri ||
    `http://localhost:${PORT}/api/backup/google/callback`;
  const client = new google.auth.OAuth2(
    config.google_client_id,
    config.google_client_secret,
    redirectUri,
  );
  if (config.google_refresh_token) {
    client.setCredentials({
      refresh_token: config.google_refresh_token,
      access_token: config.google_access_token || undefined,
    });
  }
  return client;
}

// Save Google credentials
app.post("/api/backup/google/setup", auth, adminOnly, (req, res) => {
  const db = getDb();
  const { client_id, client_secret } = req.body;
  if (!client_id || !client_secret)
    return res
      .status(400)
      .json({ error: "Client ID and Client Secret required" });
  setBackupConfig(db, "google_client_id", client_id);
  setBackupConfig(db, "google_client_secret", client_secret);
  setBackupConfig(
    db,
    "google_redirect_uri",
    `http://localhost:${PORT}/api/backup/google/callback`,
  );
  saveToDisk();
  res.json({ message: "Google credentials saved" });
});

// Get auth URL
app.get("/api/backup/google/auth-url", auth, adminOnly, (req, res) => {
  const db = getDb();
  const config = getBackupConfig(db);
  const client = getOAuth2Client(config);
  if (!client)
    return res.status(400).json({ error: "Google credentials not configured" });
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
  });
  res.json({ url });
});

// OAuth callback
app.get("/api/backup/google/callback", async (req, res) => {
  const db = getDb();
  const config = getBackupConfig(db);
  const client = getOAuth2Client(config);
  if (!client) return res.status(400).send("Google not configured");
  try {
    const { tokens } = await client.getToken(req.query.code);
    setBackupConfig(
      db,
      "google_refresh_token",
      tokens.refresh_token || config.google_refresh_token || "",
    );
    setBackupConfig(db, "google_access_token", tokens.access_token || "");
    setBackupConfig(
      db,
      "google_token_expiry",
      tokens.expiry_date ? String(tokens.expiry_date) : "",
    );
    saveToDisk();
    res.send(`<html><body style="font-family:system-ui;background:#1e1e2e;color:#cdd6f4;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
      <div style="text-align:center"><h1>Google Drive Connected!</h1><p>You can close this window and return to the EPA app.</p></div></body></html>`);
  } catch (e) {
    res.status(500)
      .send(`<html><body style="font-family:system-ui;background:#1e1e2e;color:#cdd6f4;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
      <div style="text-align:center"><h1>Authorization Failed</h1><p>${e.message}</p></div></body></html>`);
  }
});

// ── SSE endpoint for backup notifications (all authenticated users) ──
app.get("/api/events", (req, res) => {
  // Accept token from query string for EventSource compatibility
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try { jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: "Invalid token" }); }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("event: connected\ndata: {}\n\n");
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

// Check Google Drive connection status
app.get("/api/backup/google/status", auth, adminOnly, (req, res) => {
  const db = getDb();
  const config = getBackupConfig(db);
  res.json({
    configured: !!(config.google_client_id && config.google_client_secret),
    connected: !!config.google_refresh_token,
    schedule: config.backup_schedule || "",
    lastBackup: config.last_backup || "",
    sharedDocsPath: config.shared_docs_path || "",
  });
});

// Disconnect Google Drive
app.post("/api/backup/google/disconnect", auth, adminOnly, (req, res) => {
  const db = getDb();
  setBackupConfig(db, "google_refresh_token", "");
  setBackupConfig(db, "google_access_token", "");
  setBackupConfig(db, "google_token_expiry", "");
  saveToDisk();
  res.json({ message: "Google Drive disconnected" });
});

// Create backup
app.post("/api/backup/create", auth, adminOnly, async (req, res) => {
  try {
    broadcastSSE("backup-start", { message: "System backup in progress..." });
    const db = getDb();
    saveToDisk(); // Ensure latest data is on disk
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const backupName = `EPA_Backup_${timestamp}`;
    const zipPath = path.join(BACKUP_DIR, `${backupName}.zip`);

    // Create zip archive with database and files
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    await new Promise((resolve, reject) => {
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);
      // Add database file
      const dbPath = path.join(APP_ROOT, "data", "epa.db");
      if (fs.existsSync(dbPath)) archive.file(dbPath, { name: "epa.db" });
      // Add attached files
      if (fs.existsSync(FILES_DIR)) {
        archive.directory(FILES_DIR, "files");
      }
      // Add PERMIT data as Excel
      try {
        const permits = db.all("SELECT * FROM PERMIT ORDER BY id");
        if (permits.length) {
          const ws = XLSX.utils.json_to_sheet(permits);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Permits");
          const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
          archive.append(buf, { name: "permits_data.xlsx" });
        }
      } catch {}
      // Add scan_log data as Excel
      try {
        const scanLogs = db.all("SELECT * FROM scan_log ORDER BY id");
        if (scanLogs.length) {
          const ws2 = XLSX.utils.json_to_sheet(scanLogs);
          const wb2 = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb2, ws2, "Scan Log");
          const buf2 = XLSX.write(wb2, { type: "buffer", bookType: "xlsx" });
          archive.append(buf2, { name: "scan_log_data.xlsx" });
        }
      } catch {}
      archive.finalize();
    });

    const stats = fs.statSync(zipPath);
    let googleFileId = "";
    let storageLocation = "local";

    // Upload to Google Drive if connected
    const config = getBackupConfig(db);
    if (config.google_refresh_token) {
      try {
        const client = getOAuth2Client(config);
        const drive = google.drive({ version: "v3", auth: client });

        // Create backup folder if it doesn't exist
        let folderId = config.backup_folder_id;
        if (!folderId) {
          const folderRes = await drive.files.create({
            requestBody: {
              name: "EPA Database Backups",
              mimeType: "application/vnd.google-apps.folder",
            },
            fields: "id",
          });
          folderId = folderRes.data.id;
          setBackupConfig(db, "backup_folder_id", folderId);
        }

        const fileRes = await drive.files.create({
          requestBody: {
            name: `${backupName}.zip`,
            parents: [folderId],
          },
          media: {
            mimeType: "application/zip",
            body: fs.createReadStream(zipPath),
          },
          fields: "id,size",
        });
        googleFileId = fileRes.data.id;
        storageLocation = "both";
      } catch (driveErr) {
        console.error("Google Drive upload failed:", driveErr.message);
        // Continue — local backup still succeeds
      }
    }

    // Record in history
    db.run(
      `INSERT INTO backup_history (filename, file_size, backup_type, storage_location, google_drive_file_id, status) VALUES (?,?,?,?,?,?)`,
      [
        `${backupName}.zip`,
        stats.size,
        req.body.type || "manual",
        storageLocation,
        googleFileId,
        "completed",
      ],
    );
    setBackupConfig(db, "last_backup", new Date().toISOString());
    saveToDisk();

    logActivity(
      req,
      "CREATE_BACKUP",
      "backup",
      backupName,
      null,
      `${(stats.size / 1024 / 1024).toFixed(2)} MB, ${storageLocation}`,
    );
    res.json({
      message: "Backup created successfully",
      filename: `${backupName}.zip`,
      size: stats.size,
      storage: storageLocation,
      googleFileId,
    });
    broadcastSSE("backup-end", { success: true, message: "Backup completed successfully" });
  } catch (e) {
    broadcastSSE("backup-end", { success: false, message: "Backup failed: " + e.message });
    res.status(500).json({ error: e.message });
  }
});

// List backups
app.get("/api/backup/list", auth, adminOnly, async (req, res) => {
  const db = getDb();
  const history = db.all(
    "SELECT * FROM backup_history ORDER BY created_at DESC LIMIT 50",
  );

  // Also list local backup files
  const localFiles = [];
  if (fs.existsSync(BACKUP_DIR)) {
    for (const f of fs.readdirSync(BACKUP_DIR)) {
      if (f.endsWith(".zip")) {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        localFiles.push({
          filename: f,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        });
      }
    }
  }

  // Check Google Drive for additional backups
  let driveFiles = [];
  const config = getBackupConfig(db);
  if (config.google_refresh_token && config.backup_folder_id) {
    try {
      const client = getOAuth2Client(config);
      const drive = google.drive({ version: "v3", auth: client });
      const listRes = await drive.files.list({
        q: `'${config.backup_folder_id}' in parents and trashed = false`,
        fields: "files(id,name,size,createdTime)",
        orderBy: "createdTime desc",
        pageSize: 50,
      });
      driveFiles = (listRes.data.files || []).map((f) => ({
        id: f.id,
        name: f.name,
        size: parseInt(f.size || 0),
        created: f.createdTime,
      }));
    } catch (e) {
      /* ignore drive errors */
    }
  }

  res.json({ history, localFiles, driveFiles });
});

// Download local backup
app.get("/api/backup/download/:filename", auth, adminOnly, (req, res) => {
  const filename = req.params.filename;
  if (
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const filePath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "Backup file not found" });
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "application/zip");
  res.sendFile(filePath);
});

// Restore from local backup
app.post("/api/backup/restore/:filename", auth, adminOnly, (req, res) => {
  const filename = req.params.filename;
  if (
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const zipPath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(zipPath))
    return res.status(404).json({ error: "Backup file not found" });

  try {
    // Extract zip to temp directory
    // Use child_process to extract zip
    const { execSync } = require("child_process");
    const tempDir = path.join(BACKUP_DIR, "_restore_temp");
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
    fs.mkdirSync(tempDir, { recursive: true });

    // Use PowerShell to extract zip (Windows)
    execSync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`,
      { timeout: 60000 },
    );

    const restoredDb = path.join(tempDir, "epa.db");
    if (!fs.existsSync(restoredDb)) {
      fs.rmSync(tempDir, { recursive: true });
      return res.status(400).json({ error: "Backup does not contain epa.db" });
    }

    // Replace current database
    const dbPath = path.join(APP_ROOT, "data", "epa.db");
    fs.copyFileSync(restoredDb, dbPath);

    // Restore files if present
    const restoredFiles = path.join(tempDir, "files");
    if (fs.existsSync(restoredFiles)) {
      const entries = fs.readdirSync(restoredFiles);
      for (const entry of entries) {
        fs.copyFileSync(
          path.join(restoredFiles, entry),
          path.join(FILES_DIR, entry),
        );
      }
    }

    // Clean up temp
    fs.rmSync(tempDir, { recursive: true });

    logActivity(req, "RESTORE_BACKUP", "backup", filename);

    res.json({
      message:
        "Backup restored successfully. The server needs to restart to load the restored database.",
      needsRestart: true,
    });
  } catch (e) {
    res.status(500).json({ error: `Restore failed: ${e.message}` });
  }
});

// Restore from Google Drive
app.post(
  "/api/backup/restore-drive/:fileId",
  auth,
  adminOnly,
  async (req, res) => {
    const db = getDb();
    const config = getBackupConfig(db);
    if (!config.google_refresh_token)
      return res.status(400).json({ error: "Google Drive not connected" });

    try {
      const client = getOAuth2Client(config);
      const drive = google.drive({ version: "v3", auth: client });

      // Download file from Drive
      const tempZip = path.join(BACKUP_DIR, "_drive_restore.zip");
      const destStream = fs.createWriteStream(tempZip);
      const driveRes = await drive.files.get(
        { fileId: req.params.fileId, alt: "media" },
        { responseType: "stream" },
      );

      await new Promise((resolve, reject) => {
        driveRes.data.pipe(destStream);
        destStream.on("finish", resolve);
        destStream.on("error", reject);
      });

      // Now extract and restore
      const { execSync } = require("child_process");
      const tempDir = path.join(BACKUP_DIR, "_restore_temp");
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
      fs.mkdirSync(tempDir, { recursive: true });

      execSync(
        `powershell -Command "Expand-Archive -Path '${tempZip}' -DestinationPath '${tempDir}' -Force"`,
        { timeout: 60000 },
      );

      const restoredDb = path.join(tempDir, "epa.db");
      if (!fs.existsSync(restoredDb)) {
        fs.rmSync(tempDir, { recursive: true });
        try {
          fs.unlinkSync(tempZip);
        } catch (e) {}
        return res
          .status(400)
          .json({ error: "Backup does not contain epa.db" });
      }

      const dbPath = path.join(APP_ROOT, "data", "epa.db");
      fs.copyFileSync(restoredDb, dbPath);

      const restoredFiles = path.join(tempDir, "files");
      if (fs.existsSync(restoredFiles)) {
        const entries = fs.readdirSync(restoredFiles);
        for (const entry of entries) {
          fs.copyFileSync(
            path.join(restoredFiles, entry),
            path.join(FILES_DIR, entry),
          );
        }
      }

      fs.rmSync(tempDir, { recursive: true });
      try {
        fs.unlinkSync(tempZip);
      } catch (e) {}

      logActivity(
        req,
        "RESTORE_BACKUP",
        "backup",
        `Google Drive: ${req.params.fileId}`,
      );
      res.json({
        message: "Backup restored from Google Drive. Server needs to restart.",
        needsRestart: true,
      });
    } catch (e) {
      res.status(500).json({ error: `Drive restore failed: ${e.message}` });
    }
  },
);

// Upload backup file for restore
app.post(
  "/api/backup/upload-restore",
  auth,
  adminOnly,
  fileUpload.single("backupFile"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (ext !== ".zip") {
        fs.unlinkSync(req.file.path);
        return res
          .status(400)
          .json({ error: "Only .zip backup files are accepted" });
      }
      // Move to backups directory
      const destPath = path.join(BACKUP_DIR, req.file.originalname);
      fs.renameSync(req.file.path, destPath);
      res.json({
        message: "Backup file uploaded",
        filename: req.file.originalname,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// Set backup schedule
app.post("/api/backup/schedule", auth, adminOnly, (req, res) => {
  const db = getDb();
  const { schedule } = req.body; // "daily:14:00" or "weekly:Mon:14:00" or "" to disable
  setBackupConfig(db, "backup_schedule", schedule || "");
  saveToDisk();
  setupBackupCron(db);
  res.json({
    message: schedule
      ? `Backup schedule set: ${schedule}`
      : "Scheduled backup disabled",
  });
});

app.get("/api/backup/schedule", auth, adminOnly, (req, res) => {
  const db = getDb();
  const config = getBackupConfig(db);
  res.json({ schedule: config.backup_schedule || "" });
});

// Setup cron job for scheduled backups
function setupBackupCron(db) {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
  const config = getBackupConfig(db);
  const schedule = config.backup_schedule || "";
  if (!schedule) return;

  let cronExpr;
  if (schedule.startsWith("daily:")) {
    const [, time] = schedule.split(":");
    const [hour, minute] = (time || "0:0").includes(":")
      ? schedule.slice(6).split(":")
      : [time, "0"];
    cronExpr = `${minute || 0} ${hour || 0} * * *`;
  } else if (schedule.startsWith("weekly:")) {
    const parts = schedule.slice(7).split(":");
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = dayMap[parts[0]] ?? 1;
    cronExpr = `${parts[2] || 0} ${parts[1] || 0} * * ${day}`;
  } else {
    return;
  }

  if (!cron.validate(cronExpr)) return;

  cronJob = cron.schedule(cronExpr, async () => {
    console.log("[Backup] Running scheduled backup...");
    broadcastSSE("backup-start", { message: "Scheduled backup in progress..." });
    try {
      saveToDisk();
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const backupName = `EPA_Backup_${timestamp}`;
      const zipPath = path.join(BACKUP_DIR, `${backupName}.zip`);

      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      await new Promise((resolve, reject) => {
        output.on("close", resolve);
        archive.on("error", reject);
        archive.pipe(output);
        const dbPath = path.join(APP_ROOT, "data", "epa.db");
        if (fs.existsSync(dbPath)) archive.file(dbPath, { name: "epa.db" });
        if (fs.existsSync(FILES_DIR)) archive.directory(FILES_DIR, "files");
        // Add PERMIT data as Excel
        try {
          const permits = db.all("SELECT * FROM PERMIT ORDER BY id");
          if (permits.length) {
            const ws = XLSX.utils.json_to_sheet(permits);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Permits");
            const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
            archive.append(buf, { name: "permits_data.xlsx" });
          }
        } catch {}
        // Add scan_log data as Excel
        try {
          const scanLogs = db.all("SELECT * FROM scan_log ORDER BY id");
          if (scanLogs.length) {
            const ws2 = XLSX.utils.json_to_sheet(scanLogs);
            const wb2 = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb2, ws2, "Scan Log");
            const buf2 = XLSX.write(wb2, { type: "buffer", bookType: "xlsx" });
            archive.append(buf2, { name: "scan_log_data.xlsx" });
          }
        } catch {}
        archive.finalize();
      });

      const stats = fs.statSync(zipPath);
      let googleFileId = "";
      let storageLocation = "local";

      const currentConfig = getBackupConfig(db);
      if (currentConfig.google_refresh_token) {
        try {
          const client = getOAuth2Client(currentConfig);
          const drive = google.drive({ version: "v3", auth: client });
          let folderId = currentConfig.backup_folder_id;
          if (!folderId) {
            const folderRes = await drive.files.create({
              requestBody: {
                name: "EPA Database Backups",
                mimeType: "application/vnd.google-apps.folder",
              },
              fields: "id",
            });
            folderId = folderRes.data.id;
            setBackupConfig(db, "backup_folder_id", folderId);
          }
          const fileRes = await drive.files.create({
            requestBody: { name: `${backupName}.zip`, parents: [folderId] },
            media: {
              mimeType: "application/zip",
              body: fs.createReadStream(zipPath),
            },
            fields: "id",
          });
          googleFileId = fileRes.data.id;
          storageLocation = "both";
        } catch (e) {
          console.error("[Backup] Drive upload failed:", e.message);
        }
      }

      db.run(
        `INSERT INTO backup_history (filename, file_size, backup_type, storage_location, google_drive_file_id, status) VALUES (?,?,?,?,?,?)`,
        [
          `${backupName}.zip`,
          stats.size,
          "scheduled",
          storageLocation,
          googleFileId,
          "completed",
        ],
      );
      setBackupConfig(db, "last_backup", new Date().toISOString());
      saveToDisk();
      console.log(
        `[Backup] Completed: ${backupName}.zip (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
      );
      broadcastSSE("backup-end", { success: true, message: "Scheduled backup completed successfully" });
    } catch (e) {
      console.error("[Backup] Failed:", e.message);
      broadcastSSE("backup-end", { success: false, message: "Scheduled backup failed" });
    }
  });
  console.log(`[Backup] Scheduled: ${schedule} (cron: ${cronExpr})`);
}

// ══════════════════════════════════════════════════════════════
//  Shared Documents — Browse and attach files from a server folder
// ══════════════════════════════════════════════════════════════
app.get("/api/documents/config", auth, adminOnly, (req, res) => {
  const db = getDb();
  const config = getBackupConfig(db);
  res.json({ path: config.shared_docs_path || "" });
});

app.post("/api/documents/config", auth, adminOnly, (req, res) => {
  const db = getDb();
  const { path: docPath } = req.body;
  if (docPath && !fs.existsSync(docPath)) {
    return res.status(400).json({ error: "Path does not exist on the server" });
  }
  setBackupConfig(db, "shared_docs_path", docPath || "");
  sharedDocsPath = docPath || "";
  saveToDisk();
  res.json({
    message: docPath
      ? `Shared documents path set: ${docPath}`
      : "Shared documents path cleared",
  });
});

app.get("/api/documents/browse", auth, (req, res) => {
  const db = getDb();
  const config = getBackupConfig(db);
  const basePath = config.shared_docs_path;
  if (!basePath)
    return res
      .status(400)
      .json({ error: "Shared documents path not configured" });

  const subPath = req.query.path || "";
  // Prevent directory traversal
  const fullPath = path.resolve(basePath, subPath);
  if (!fullPath.startsWith(path.resolve(basePath))) {
    return res.status(403).json({ error: "Access denied" });
  }

  if (!fs.existsSync(fullPath))
    return res.status(404).json({ error: "Path not found" });

  try {
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const items = entries
      .map((e) => {
        const itemPath = path.join(fullPath, e.name);
        const stat = fs.statSync(itemPath);
        return {
          name: e.name,
          isDirectory: e.isDirectory(),
          size: stat.size,
          modified: stat.mtime.toISOString(),
          relativePath: path.relative(basePath, itemPath).replace(/\\/g, "/"),
        };
      })
      .filter((e) => !e.name.startsWith(".")); // Hide hidden files

    res.json({
      items,
      currentPath: subPath || "/",
      parentPath: subPath ? path.dirname(subPath).replace(/\\/g, "/") : null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Attach a file from the shared documents folder to a record
app.post("/api/documents/attach", auth, (req, res) => {
  const db = getDb();
  const config = getBackupConfig(db);
  const basePath = config.shared_docs_path;
  if (!basePath)
    return res
      .status(400)
      .json({ error: "Shared documents path not configured" });

  const { relativePath, table, recordId } = req.body;
  if (!relativePath || !table || !recordId)
    return res.status(400).json({ error: "Missing required fields" });
  if (!DATA_TABLES.includes(table))
    return res.status(404).json({ error: "Table not found" });

  const sourcePath = path.resolve(basePath, relativePath);
  if (!sourcePath.startsWith(path.resolve(basePath))) {
    return res.status(403).json({ error: "Access denied" });
  }
  if (!fs.existsSync(sourcePath) || fs.statSync(sourcePath).isDirectory()) {
    return res.status(404).json({ error: "File not found" });
  }

  try {
    // Copy file to the files directory
    const ext = path.extname(sourcePath);
    const destName = `shared_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const destPath = path.join(FILES_DIR, destName);
    fs.copyFileSync(sourcePath, destPath);

    const stat = fs.statSync(destPath);
    const originalName = path.basename(sourcePath);
    const mime =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".png"
            ? "image/png"
            : "application/octet-stream";

    const result = db.run(
      `INSERT INTO file_attachments (table_name, record_id, filename, original_name, mime_type, file_size, uploaded_by) VALUES (?,?,?,?,?,?,?)`,
      [
        table,
        parseInt(recordId),
        destName,
        originalName,
        mime,
        stat.size,
        req.user?.username || "",
      ],
    );

    logActivity(
      req,
      "UPLOAD_FILE",
      table,
      `Record ${recordId}`,
      parseInt(recordId),
      `From shared: ${originalName}`,
    );
    saveToDisk();
    res.json({
      id: result.lastInsertRowid,
      original_name: originalName,
      file_size: stat.size,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve attachment inline (for preview)
app.get("/api/attachments/preview/:id", auth, (req, res) => {
  try {
    const db = getDb();
    const att = db.get("SELECT * FROM file_attachments WHERE id = ?", [
      parseInt(req.params.id),
    ]);
    if (!att) return res.status(404).json({ error: "Attachment not found" });
    const filePath = path.join(FILES_DIR, att.filename);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: "File not found on disk" });
    // Set content type for inline display
    if (att.mime_type) res.setHeader("Content-Type", att.mime_type);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${att.original_name}"`,
    );
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  Selective Import Preview
// ══════════════════════════════════════════════════════════════
app.post(
  "/api/admin/preview-access",
  auth,
  adminOnly,
  upload.single("accessFile"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const filePath = req.file.path;
    try {
      const buffer = fs.readFileSync(filePath);
      await loadMdbReader();
      const reader = new MDBReader(buffer);
      const accessTableNames = reader.getTableNames();
      const db = getDb();

      const TABLE_MAP = {
        PERMIT: "PERMIT",
        MOVEMENT: "MOVEMENT",
        WASTE: "WASTE",
        Stores: "Stores",
        tbl_keyword: "tbl_keyword",
        Permit: "PERMIT",
        Movement: "MOVEMENT",
        Waste: "WASTE",
        stores: "Stores",
        STORES: "Stores",
        tbl_Keyword: "tbl_keyword",
        TBL_KEYWORD: "tbl_keyword",
      };

      const preview = [];
      for (const accessTable of accessTableNames) {
        const targetTable = TABLE_MAP[accessTable];
        if (!targetTable) continue;
        try {
          const data = reader.getTable(accessTable).getData();
          const accessCols = data.length > 0 ? Object.keys(data[0]) : [];
          const validCols = db
            .all(`PRAGMA table_info("${targetTable}")`)
            .map((c) => c.name)
            .filter((c) => c !== "id");
          // Find matching columns
          const matchedCols = validCols.filter((vc) =>
            accessCols.some((ac) => ac.toLowerCase() === vc.toLowerCase()),
          );
          preview.push({
            accessName: accessTable,
            targetTable,
            rowCount: data.length,
            columns: matchedCols,
            allAccessColumns: accessCols,
            sampleRows: data.slice(0, 3),
          });
        } catch (e) {
          preview.push({
            accessName: accessTable,
            targetTable,
            rowCount: 0,
            columns: [],
            error: e.message,
          });
        }
      }
      // Keep the uploaded file temporarily for the import step (store path in name)
      res.json({
        preview,
        tempFile: req.file.filename,
        originalName: req.file.originalname,
      });
    } catch (e) {
      try {
        fs.unlinkSync(filePath);
      } catch (ex) {}
      res
        .status(500)
        .json({ error: `Failed to read Access file: ${e.message}` });
    }
  },
);

app.post("/api/admin/import-selected", auth, adminOnly, async (req, res) => {
  const db = getDb();
  const { tempFile, selections } = req.body;
  // selections: [{ targetTable, columns: [col1, col2,...] }, ...]
  if (!tempFile || !selections || !Array.isArray(selections))
    return res.status(400).json({ error: "Missing tempFile or selections" });

  const filePath = path.join(UPLOAD_DIR, tempFile);
  if (!fs.existsSync(filePath))
    return res.status(400).json({
      error: "Preview file expired or not found. Please upload again.",
    });

  try {
    const buffer = fs.readFileSync(filePath);
    await loadMdbReader();
    const reader = new MDBReader(buffer);

    const TABLE_MAP = {
      PERMIT: "PERMIT",
      MOVEMENT: "MOVEMENT",
      WASTE: "WASTE",
      Stores: "Stores",
      tbl_keyword: "tbl_keyword",
      Permit: "PERMIT",
      Movement: "MOVEMENT",
      Waste: "WASTE",
      stores: "Stores",
      STORES: "Stores",
      tbl_Keyword: "tbl_keyword",
      TBL_KEYWORD: "tbl_keyword",
    };

    const imported = {};
    const errors = [];

    for (const sel of selections) {
      const { targetTable, columns } = sel;
      if (
        !DATA_TABLES.includes(targetTable) ||
        !columns ||
        columns.length === 0
      )
        continue;

      // Find the Access table name that maps to this target
      const accessTableName = Object.keys(TABLE_MAP).find(
        (k) =>
          TABLE_MAP[k] === targetTable &&
          reader.getTableNames().some((t) => t === k),
      );
      if (!accessTableName) {
        errors.push(`${targetTable}: not found in Access file`);
        continue;
      }

      try {
        const data = reader.getTable(accessTableName).getData();
        const validCols = db
          .all(`PRAGMA table_info("${targetTable}")`)
          .map((c) => c.name)
          .filter((c) => c !== "id");
        const selectedCols = columns.filter((c) => validCols.includes(c));
        if (selectedCols.length === 0) continue;

        let count = 0;
        for (const row of data) {
          const accessKeys = Object.keys(row);
          const colMap = {};
          for (const vCol of selectedCols) {
            const match = accessKeys.find(
              (k) => k.toLowerCase() === vCol.toLowerCase(),
            );
            if (match && row[match] !== null && row[match] !== undefined) {
              let val = row[match];
              if (val instanceof Date) val = val.toISOString().split("T")[0];
              colMap[vCol] = val === "" ? null : val;
            }
          }
          const cols = Object.keys(colMap);
          if (cols.length === 0) continue;
          try {
            db.run(
              `INSERT INTO "${targetTable}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
              cols.map((c) => colMap[c]),
            );
            count++;
          } catch (e) {
            /* skip row errors */
          }
        }
        imported[targetTable] = count;
      } catch (e) {
        errors.push(`${targetTable}: ${e.message}`);
      }
    }

    try {
      fs.unlinkSync(filePath);
    } catch (e) {}
    logActivity(
      req,
      "SELECTIVE_IMPORT",
      "admin",
      "Selected tables",
      null,
      JSON.stringify(imported),
    );
    saveToDisk();
    res.json({
      message: "Selective import complete",
      imported,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    try {
      fs.unlinkSync(filePath);
    } catch (ex) {}
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  SOFTWARE UPDATES
// ══════════════════════════════════════════════════════════════
const UPDATE_DIR = path.join(APP_ROOT, "updates");
if (!fs.existsSync(UPDATE_DIR)) fs.mkdirSync(UPDATE_DIR, { recursive: true });

const updateUpload = multer({
  storage: multer.diskStorage({
    destination: UPDATE_DIR,
    filename: (req, file, cb) => cb(null, file.originalname),
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (req, file, cb) => {
    if (/\.(exe|msi|zip)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Only .exe, .msi, or .zip files are allowed"));
  },
});

// Get current app version
app.get("/api/update/version", auth, (req, res) => {
  try {
    const pkgPath = path.join(__dirname, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    res.json({ version: pkg.version, name: pkg.productName || pkg.name });
  } catch (e) {
    res.json({ version: "unknown" });
  }
});

// List available update files
app.get("/api/update/available", auth, adminOnly, (req, res) => {
  try {
    const files = fs
      .readdirSync(UPDATE_DIR)
      .filter((f) => /\.(exe|msi|zip)$/i.test(f))
      .map((f) => {
        const stat = fs.statSync(path.join(UPDATE_DIR, f));
        return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));
    res.json({ files, updateDir: UPDATE_DIR });
  } catch (e) {
    res.json({ files: [], updateDir: UPDATE_DIR });
  }
});

// Upload an update file
app.post(
  "/api/update/upload",
  auth,
  adminOnly,
  updateUpload.single("updateFile"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.json({
      message: `Update file uploaded: ${req.file.originalname}`,
      file: req.file.originalname,
      size: req.file.size,
    });
  },
);

// Delete an update file
app.delete("/api/update/:filename", auth, adminOnly, (req, res) => {
  const filePath = path.join(UPDATE_DIR, path.basename(req.params.filename));
  if (!filePath.startsWith(path.resolve(UPDATE_DIR)))
    return res.status(403).json({ error: "Access denied" });
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "File not found" });
  fs.unlinkSync(filePath);
  res.json({ message: "Update file deleted" });
});

// ══════════════════════════════════════════════════════════════
//  DIGITIZED FILES — Smart document linking
// ══════════════════════════════════════════════════════════════

// Browse digitized files root (same as shared docs path)
app.get("/api/digitized/browse", auth, (req, res) => {
  const db = getDb();
  const config = getBackupConfig(db);
  const basePath = config.shared_docs_path;
  if (!basePath)
    return res.status(400).json({
      error:
        "Digitized files folder not configured. Ask your admin to set it in Settings → Document Folder.",
    });

  const subPath = req.query.path || "";
  const fullPath = path.resolve(basePath, subPath);
  if (!fullPath.startsWith(path.resolve(basePath)))
    return res.status(403).json({ error: "Access denied" });
  if (!fs.existsSync(fullPath))
    return res.status(404).json({ error: "Path not found" });

  try {
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const items = entries
      .filter((e) => !e.name.startsWith("."))
      .map((e) => {
        const itemPath = path.join(fullPath, e.name);
        const stat = fs.statSync(itemPath);
        return {
          name: e.name,
          isDirectory: e.isDirectory(),
          size: stat.size,
          modified: stat.mtime.toISOString(),
          relativePath: path.relative(basePath, itemPath).replace(/\\/g, "/"),
        };
      });
    // Sort: folders first, then alphabetically
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    res.json({
      items,
      currentPath: subPath || "",
      parentPath: subPath ? path.dirname(subPath).replace(/\\/g, "/") : null,
      basePath,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Smart match — find the best matching folder for a permit record
app.get("/api/digitized/match", auth, (req, res) => {
  const db = getDb();
  const config = getBackupConfig(db);
  const basePath = config.shared_docs_path;
  if (!basePath)
    return res
      .status(400)
      .json({ error: "Digitized files folder not configured" });

  const { company, location, classification } = req.query;
  if (!company) return res.status(400).json({ error: "Company name required" });

  const companyLower = company.toLowerCase().trim();
  const locationLower = (location || "").toLowerCase().trim();
  const classLower = (classification || "").toLowerCase().trim();

  try {
    // Search strategy:
    // 1. If classification exists, look inside that folder first
    // 2. Search all folders for "COMPANY @ LOCATION" pattern
    // 3. Fuzzy match on company name alone

    let matchedPath = null;
    let matchedScore = 0;
    let matchedFolderName = null;

    function searchInDir(dirPath, depth) {
      if (depth > 2 || !fs.existsSync(dirPath)) return;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const folderLower = entry.name.toLowerCase();
        let score = 0;

        // Check if folder matches "COMPANY @ LOCATION" pattern
        if (folderLower.includes("@")) {
          const [folderCompany, folderLocation] = folderLower
            .split("@")
            .map((s) => s.trim());
          // Company name match
          if (folderCompany === companyLower) score = 100;
          else if (
            folderCompany.includes(companyLower) ||
            companyLower.includes(folderCompany)
          )
            score = 70;
          else {
            // Word-level matching
            const companyWords = companyLower
              .split(/\s+/)
              .filter((w) => w.length > 2);
            const folderWords = folderCompany
              .split(/\s+/)
              .filter((w) => w.length > 2);
            const matchedWords = companyWords.filter((w) =>
              folderWords.some((fw) => fw.includes(w) || w.includes(fw)),
            );
            if (matchedWords.length > 0)
              score = Math.min(
                60,
                (matchedWords.length / companyWords.length) * 60,
              );
          }
          // Location bonus
          if (locationLower && folderLocation) {
            if (folderLocation === locationLower) score += 20;
            else if (
              folderLocation.includes(locationLower) ||
              locationLower.includes(folderLocation)
            )
              score += 10;
          }
        } else {
          // Non-@ folder — check if it's a classification/undertaking folder or company folder
          if (folderLower === companyLower) score = 80;
          else if (
            folderLower.includes(companyLower) ||
            companyLower.includes(folderLower)
          )
            score = 50;
        }

        if (score > matchedScore) {
          matchedScore = score;
          matchedPath = path
            .relative(basePath, path.join(dirPath, entry.name))
            .replace(/\\/g, "/");
          matchedFolderName = entry.name;
        }

        // Recurse into classification/undertaking type folders
        if (depth === 0) {
          searchInDir(path.join(dirPath, entry.name), depth + 1);
        }
      }
    }

    // If classification provided, search that folder first
    if (classLower) {
      const topEntries = fs.readdirSync(basePath, { withFileTypes: true });
      for (const entry of topEntries) {
        if (!entry.isDirectory()) continue;
        const folderLower = entry.name.toLowerCase();
        if (
          folderLower.includes(classLower) ||
          classLower.includes(folderLower)
        ) {
          searchInDir(path.join(basePath, entry.name), 1);
        }
      }
    }

    // Then search everything
    searchInDir(basePath, 0);

    if (matchedPath && matchedScore >= 40) {
      // Get files in the matched folder
      const matchedFullPath = path.join(basePath, matchedPath);
      const files = fs
        .readdirSync(matchedFullPath, { withFileTypes: true })
        .filter((e) => !e.name.startsWith("."))
        .map((e) => {
          const stat = fs.statSync(path.join(matchedFullPath, e.name));
          return {
            name: e.name,
            isDirectory: e.isDirectory(),
            size: stat.size,
            modified: stat.mtime.toISOString(),
            relativePath: path
              .relative(basePath, path.join(matchedFullPath, e.name))
              .replace(/\\/g, "/"),
          };
        });
      files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      res.json({
        matched: true,
        folderName: matchedFolderName,
        folderPath: matchedPath,
        score: matchedScore,
        files,
      });
    } else {
      res.json({ matched: false, score: matchedScore });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create a new company folder in the digitized files structure
app.post("/api/digitized/create-folder", auth, (req, res) => {
  const db = getDb();
  const config = getBackupConfig(db);
  const basePath = config.shared_docs_path;
  if (!basePath)
    return res
      .status(400)
      .json({ error: "Digitized files folder not configured" });

  const { parentPath, folderName } = req.body;
  if (!folderName)
    return res.status(400).json({ error: "Folder name required" });

  // Sanitize folder name
  const safeName = folderName.replace(/[<>:"/\\|?*]/g, "_").trim();
  if (!safeName) return res.status(400).json({ error: "Invalid folder name" });

  const parentDir = parentPath ? path.resolve(basePath, parentPath) : basePath;
  if (!parentDir.startsWith(path.resolve(basePath)))
    return res.status(403).json({ error: "Access denied" });

  const newDir = path.join(parentDir, safeName);
  if (fs.existsSync(newDir))
    return res.status(400).json({ error: "Folder already exists" });

  try {
    fs.mkdirSync(newDir, { recursive: true });
    res.json({
      message: `Folder created: ${safeName}`,
      relativePath: path.relative(basePath, newDir).replace(/\\/g, "/"),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Link a digitized file reference to a permit (stored in DB, file stays in place)
app.post("/api/digitized/link", auth, (req, res) => {
  const db = getDb();
  const { table, recordId, relativePath, fileName } = req.body;
  if (!table || !recordId || !relativePath)
    return res.status(400).json({ error: "Missing required fields" });
  if (!DATA_TABLES.includes(table))
    return res.status(404).json({ error: "Table not found" });

  try {
    db.run(
      `INSERT INTO document_links (table_name, record_id, relative_path, file_name, linked_by) VALUES (?, ?, ?, ?, ?)`,
      [
        table,
        recordId,
        relativePath,
        fileName || path.basename(relativePath),
        req.user.username,
      ],
    );
    saveToDisk();
    res.json({ message: "Document linked successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get linked documents for a record
app.get("/api/digitized/links/:table/:recordId", auth, (req, res) => {
  const db = getDb();
  try {
    const links = db.all(
      `SELECT * FROM document_links WHERE table_name = ? AND record_id = ? ORDER BY created_at DESC`,
      [req.params.table, req.params.recordId],
    );
    res.json(links);
  } catch (e) {
    res.json([]);
  }
});

// Remove a document link
app.delete("/api/digitized/link/:id", auth, (req, res) => {
  const db = getDb();
  try {
    db.run(`DELETE FROM document_links WHERE id = ?`, [req.params.id]);
    saveToDisk();
    res.json({ message: "Link removed" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve a digitized file for preview/download (from the shared folder, not copied)
app.get("/api/digitized/file", auth, (req, res) => {
  const db = getDb();
  const config = getBackupConfig(db);
  const basePath = config.shared_docs_path;
  if (!basePath)
    return res
      .status(400)
      .json({ error: "Digitized files folder not configured" });

  const relativePath = req.query.path;
  if (!relativePath) return res.status(400).json({ error: "Path required" });

  const fullPath = path.resolve(basePath, relativePath);
  if (!fullPath.startsWith(path.resolve(basePath)))
    return res.status(403).json({ error: "Access denied" });
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory())
    return res.status(404).json({ error: "File not found" });

  const ext = path.extname(fullPath).toLowerCase();
  const mimeMap = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".webp": "image/webp",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
  };

  const download = req.query.download === "1";
  if (download) {
    res.download(fullPath);
  } else {
    res.setHeader("Content-Type", mimeMap[ext] || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${path.basename(fullPath)}"`,
    );
    fs.createReadStream(fullPath).pipe(res);
  }
});

// ==============================================================
//  DATA ENRICHMENT � Upload Excel, match DB columns, export
// ==============================================================

// Multer instance for enrichment Excel uploads
const enrichUpload = multer({
  dest: path.join(APP_ROOT, "uploads"),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".xlsx", ".xls", ".csv"].includes(ext)) cb(null, true);
    else cb(new Error("Only .xlsx, .xls, and .csv files are accepted"));
  },
});

/** Upload an Excel/CSV file -> return parsed rows + headers */
app.post(
  "/api/enrichment/upload",
  auth,
  checkFeaturePerm("page", () => "enrichment"),
  enrichUpload.single("file"),
  (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const wb = XLSX.readFile(req.file.path);
      const sheetNames = wb.SheetNames;
      const ws = wb.Sheets[sheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
      if (rows.length === 0)
        return res
          .status(400)
          .json({ error: "The uploaded file has no data rows" });
      const headers = Object.keys(rows[0]);
      res.json({
        headers,
        preview: rows.slice(0, 200),
        totalRows: rows.length,
        allRows: rows,
        sheetNames,
      });
    } catch (e) {
      try {
        if (req.file) fs.unlinkSync(req.file.path);
      } catch (_) {}
      res.status(500).json({ error: "Failed to parse file: " + e.message });
    }
  },
);

/** Get enrichable database columns per table */
app.get(
  "/api/enrichment/db-columns",
  auth,
  checkFeaturePerm("page", () => "enrichment"),
  (req, res) => {
    try {
      const db = getDb();
      const result = {};
      for (const table of DATA_TABLES) {
        const cols = db
          .all(`PRAGMA table_info("${table}")`)
          .filter((c) => c.name !== "id")
          .map((c) => c.name);
        result[table] = cols;
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

/** Process enrichment: match uploaded data against DB and add columns */
app.post(
  "/api/enrichment/process",
  auth,
  checkFeaturePerm("page", () => "enrichment"),
  (req, res) => {
    try {
      const { uploadedRows, matchConfig, columnsToAdd } = req.body;

      if (
        !uploadedRows ||
        !Array.isArray(uploadedRows) ||
        uploadedRows.length === 0
      )
        return res.status(400).json({ error: "No uploaded data provided" });
      if (
        !matchConfig ||
        !matchConfig.uploadColumn ||
        !matchConfig.dbTable ||
        !matchConfig.dbColumn
      )
        return res
          .status(400)
          .json({ error: "Match configuration is incomplete" });
      if (
        !columnsToAdd ||
        !Array.isArray(columnsToAdd) ||
        columnsToAdd.length === 0
      )
        return res.status(400).json({ error: "No columns selected to add" });
      if (!DATA_TABLES.includes(matchConfig.dbTable))
        return res.status(400).json({ error: "Invalid database table" });

      const db = getDb();
      const { uploadColumn, dbTable, dbColumn } = matchConfig;

      const tableColNames = db
        .all(`PRAGMA table_info("${dbTable}")`)
        .map((c) => c.name);
      if (!tableColNames.includes(dbColumn))
        return res
          .status(400)
          .json({ error: `Column "${dbColumn}" not found in ${dbTable}` });
      for (const col of columnsToAdd) {
        if (!tableColNames.includes(col))
          return res
            .status(400)
            .json({ error: `Column "${col}" not found in ${dbTable}` });
      }

      // Build lookup map: normalized match value -> DB row
      const selectCols = [
        dbColumn,
        ...columnsToAdd.filter((c) => c !== dbColumn),
      ]
        .map((c) => `"${c}"`)
        .join(", ");
      const dbRows = db.all(`SELECT ${selectCols} FROM "${dbTable}"`);
      const lookup = new Map();
      for (const row of dbRows) {
        const key = String(row[dbColumn] || "")
          .trim()
          .toLowerCase();
        if (key && !lookup.has(key)) lookup.set(key, row);
      }

      // Enrich each uploaded row
      let matchedCount = 0;
      let unmatchedCount = 0;
      const enrichedRows = uploadedRows.map((uploadedRow) => {
        const enriched = { ...uploadedRow };
        const matchVal = String(uploadedRow[uploadColumn] || "")
          .trim()
          .toLowerCase();
        const dbMatch = lookup.get(matchVal);
        if (dbMatch) {
          matchedCount++;
          for (const col of columnsToAdd) {
            enriched[col] = dbMatch[col] !== undefined ? dbMatch[col] : "";
          }
        } else {
          unmatchedCount++;
          for (const col of columnsToAdd) {
            enriched[col] = "";
          }
        }
        return enriched;
      });

      logActivity(
        req,
        "data_enrichment",
        dbTable,
        `Enriched ${uploadedRows.length} rows, matched ${matchedCount}`,
        null,
        `Added columns: ${columnsToAdd.join(", ")}`,
      );

      res.json({
        enrichedRows,
        stats: {
          total: uploadedRows.length,
          matched: matchedCount,
          unmatched: unmatchedCount,
          columnsAdded: columnsToAdd,
        },
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

/** Export enriched data as Excel */
app.post(
  "/api/enrichment/export",
  auth,
  checkFeaturePerm("page", () => "enrichment"),
  (req, res) => {
    try {
      const { rows, filename } = req.body;
      if (!rows || !Array.isArray(rows) || rows.length === 0)
        return res.status(400).json({ error: "No data to export" });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Enriched Data");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename || "enriched_data"}.xlsx"`,
      );
      res.send(buf);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// ── SPA fallback ─────────────────────────────────────────────

// --------------------------------------------------------------
//  DROPDOWN MANAGEMENT � Admin manages dropdown option values
// --------------------------------------------------------------

/** Get all dropdown definitions for a table (hardcoded + custom) */
app.get("/api/dropdown-options/:table", auth, async (req, res) => {
  try {
    const db = getDb();
    const table = req.params.table;
    if (!DATA_TABLES.includes(table))
      return res.status(400).json({ error: "Invalid table" });

    // Start with hardcoded defaults
    let defaults = JSON.parse(JSON.stringify(FIELD_OPTIONS[table] || {}));
    if (table === "PERMIT") {
      defaults = await enrichPermitDropdownOptionsFromSources(db, defaults);
    }

    // Overlay custom options
    const customs = db.all(
      "SELECT field_name, option_value, sort_order FROM custom_dropdown_options WHERE table_name = ? ORDER BY sort_order ASC, option_value ASC",
      [table],
    );
    for (const c of customs) {
      if (table === "PERMIT" && c.field_name === "ApplicationStatusII") {
        continue;
      }
      if (!defaults[c.field_name]) defaults[c.field_name] = [];
      const cleanValue = sanitizeDropdownOptionValue(c.option_value);
      if (!cleanValue) continue;
      if (!defaults[c.field_name].includes(cleanValue)) {
        defaults[c.field_name].push(cleanValue);
      }
    }

    // Also include custom fields that have type "dropdown"
    const customDropdownFields = db.all(
      "SELECT field_name FROM custom_fields WHERE table_name = ? AND field_type = 'dropdown'",
      [table],
    );
    for (const cf of customDropdownFields) {
      if (!defaults[cf.field_name]) defaults[cf.field_name] = [];
    }

    defaults = filterHiddenDropdownOptions(db, table, defaults);
    defaults = filterManagedDropdownFields(table, defaults);

    res.json(defaults);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Add option to a dropdown */
app.post("/api/dropdown-options/:table/:field", auth, (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Admin only" });
    const db = getDb();
    const { table, field } = req.params;
    const cleanValue = sanitizeDropdownOptionValue(req.body.value);
    if (!cleanValue)
      return res.status(400).json({ error: "Value is required" });
    if (!DATA_TABLES.includes(table))
      return res.status(400).json({ error: "Invalid table" });
    if (
      table === "PERMIT" &&
      !Object.prototype.hasOwnProperty.call(
        filterManagedDropdownFields(table, { [field]: [] }),
        field,
      )
    ) {
      return res.status(400).json({
        error: "This field is not managed from Dropdown Menus",
      });
    }
    if (
      table === "PERMIT" &&
      field === "ApplicationStatusII" &&
      !CANONICAL_APPLICATION_INFO_OPTIONS.some(
        (option) => option.toLowerCase() === cleanValue.toLowerCase(),
      )
    ) {
      return res.status(400).json({
        error:
          'Application Info only allows "New Application" and "Renewal of Permit".',
      });
    }

    db.run(
      "DELETE FROM hidden_dropdown_options WHERE table_name = ? AND field_name = ? AND option_value = ?",
      [table, field, cleanValue],
    );

    const maxOrder =
      db.get(
        "SELECT MAX(sort_order) AS m FROM custom_dropdown_options WHERE table_name = ? AND field_name = ?",
        [table, field],
      )?.m || 0;

    db.run(
      "INSERT OR IGNORE INTO custom_dropdown_options (table_name, field_name, option_value, sort_order) VALUES (?, ?, ?, ?)",
      [table, field, cleanValue, maxOrder + 1],
    );
    saveToDisk();
    logActivity(req, "add_dropdown_option", table, field + ": " + cleanValue);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Remove option from a dropdown */
app.delete("/api/dropdown-options/:table/:field/:value", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Admin only" });
    const db = getDb();
    const { table, field, value } = req.params;
    const decodedValue = sanitizeDropdownOptionValue(decodeURIComponent(value));
    if (!decodedValue)
      return res.status(400).json({ error: "Invalid option value" });
    if (
      table === "PERMIT" &&
      !Object.prototype.hasOwnProperty.call(
        filterManagedDropdownFields(table, { [field]: [] }),
        field,
      )
    ) {
      return res.status(400).json({
        error: "This field is not managed from Dropdown Menus",
      });
    }
    if (table === "PERMIT" && field === "ApplicationStatusII") {
      return res.status(400).json({
        error:
          'Application Info is locked to "New Application" and "Renewal of Permit".',
      });
    }

    let builtInOptions = mergeDistinctOptionValues(
      [],
      (FIELD_OPTIONS[table] || {})[field] || [],
    );
    const isBuiltIn = builtInOptions.some(
      (option) => option.toLowerCase() === decodedValue.toLowerCase(),
    );
    if (isBuiltIn) {
      db.run(
        "INSERT OR IGNORE INTO hidden_dropdown_options (table_name, field_name, option_value) VALUES (?, ?, ?)",
        [table, field, decodedValue],
      );
    }
    db.run(
      "DELETE FROM custom_dropdown_options WHERE table_name = ? AND field_name = ? AND option_value = ?",
      [table, field, decodedValue],
    );
    saveToDisk();
    logActivity(
      req,
      "remove_dropdown_option",
      table,
      field + ": " + decodedValue,
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Reorder dropdown options */
app.put("/api/dropdown-options/:table/:field/reorder", auth, (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Admin only" });
    const db = getDb();
    const { table, field } = req.params;
    const { values } = req.body;
    if (!Array.isArray(values))
      return res.status(400).json({ error: "values array required" });
    values.forEach((v, i) => {
      db.run(
        "UPDATE custom_dropdown_options SET sort_order = ? WHERE table_name = ? AND field_name = ? AND option_value = ?",
        [i, table, field, v],
      );
    });
    saveToDisk();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --------------------------------------------------------------
//  CUSTOM FIELDS � Admin adds new columns to tables
// --------------------------------------------------------------

/** List custom fields for a table */
app.get("/api/custom-fields/:table", auth, (req, res) => {
  try {
    const db = getDb();
    const table = req.params.table;
    if (!DATA_TABLES.includes(table))
      return res.status(400).json({ error: "Invalid table" });
    const fields = db.all(
      "SELECT * FROM custom_fields WHERE table_name = ? ORDER BY sort_order ASC",
      [table],
    );
    res.json(fields);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Add a custom field (column) to a table */
app.post("/api/custom-fields/:table", auth, (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Admin only" });
    const db = getDb();
    const table = req.params.table;
    if (!DATA_TABLES.includes(table))
      return res.status(400).json({ error: "Invalid table" });

    const { fieldName, displayName, fieldType, dropdownOptions } = req.body;
    if (!fieldName || !fieldName.trim())
      return res.status(400).json({ error: "Field name is required" });

    // Sanitize field name: PascalCase, no spaces/special chars
    const safeName = fieldName
      .trim()
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!safeName) return res.status(400).json({ error: "Invalid field name" });

    // Check if column already exists
    const existingCols = db
      .all(`PRAGMA table_info("${table}")`)
      .map((c) => c.name.toLowerCase());
    if (existingCols.includes(safeName.toLowerCase())) {
      return res
        .status(400)
        .json({ error: "A column with this name already exists" });
    }

    // Add column to actual table
    const sqlType =
      fieldType === "number" ? "REAL DEFAULT 0" : "TEXT DEFAULT ''";
    db.run(`ALTER TABLE "${table}" ADD COLUMN "${safeName}" ${sqlType}`);

    // Record in custom_fields metadata
    db.run(
      "INSERT INTO custom_fields (table_name, field_name, display_name, field_type, created_by) VALUES (?, ?, ?, ?, ?)",
      [
        table,
        safeName,
        displayName || safeName,
        fieldType || "text",
        req.user.username,
      ],
    );

    // If it's a dropdown type, add initial options
    if (fieldType === "dropdown" && Array.isArray(dropdownOptions)) {
      dropdownOptions.forEach((opt, i) => {
        if (opt && opt.trim()) {
          db.run(
            "INSERT OR IGNORE INTO custom_dropdown_options (table_name, field_name, option_value, sort_order) VALUES (?, ?, ?, ?)",
            [table, safeName, opt.trim(), i],
          );
        }
      });
    }

    saveToDisk();
    logActivity(
      req,
      "add_custom_field",
      table,
      safeName + " (" + (fieldType || "text") + ")",
    );
    res.json({ ok: true, fieldName: safeName });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Delete a custom field (only custom-added ones) */
app.delete("/api/custom-fields/:table/:field", auth, (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Admin only" });
    const db = getDb();
    const { table, field } = req.params;

    // Verify it's a custom field
    const cf = db.get(
      "SELECT id FROM custom_fields WHERE table_name = ? AND field_name = ?",
      [table, field],
    );
    if (!cf)
      return res
        .status(400)
        .json({ error: "Only custom-added fields can be removed" });

    // SQLite doesn't support DROP COLUMN in older versions, but sql.js supports SQLite 3.35+
    // which does support ALTER TABLE DROP COLUMN
    try {
      db.run(`ALTER TABLE "${table}" DROP COLUMN "${field}"`);
    } catch (dropErr) {
      // Fallback: just remove metadata, column stays but is hidden
      console.log(
        "Note: Could not DROP COLUMN, hiding field instead:",
        dropErr.message,
      );
    }

    db.run(
      "DELETE FROM custom_fields WHERE table_name = ? AND field_name = ?",
      [table, field],
    );
    db.run(
      "DELETE FROM custom_dropdown_options WHERE table_name = ? AND field_name = ?",
      [table, field],
    );
    saveToDisk();
    logActivity(req, "remove_custom_field", table, field);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --------------------------------------------------------------
//  FIELD RENAMING � Admin renames display labels for columns
// --------------------------------------------------------------

/** Get all field renames for a table */
app.get("/api/field-renames/:table", auth, (req, res) => {
  try {
    const db = getDb();
    const renames = db.all(
      "SELECT original_name, display_name FROM field_renames WHERE table_name = ?",
      [req.params.table],
    );
    const map = {};
    renames.forEach((r) => {
      map[r.original_name] = r.display_name;
    });
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Get all field renames across all tables */
app.get("/api/field-renames", auth, (req, res) => {
  try {
    const db = getDb();
    const renames = db.all(
      "SELECT table_name, original_name, display_name FROM field_renames",
    );
    const map = {};
    renames.forEach((r) => {
      if (!map[r.table_name]) map[r.table_name] = {};
      map[r.table_name][r.original_name] = r.display_name;
    });
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Set a field rename (or remove it by passing empty displayName) */
app.put("/api/field-renames/:table/:field", auth, (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Admin only" });
    const db = getDb();
    const { table, field } = req.params;
    const { displayName } = req.body;

    if (!displayName || !displayName.trim()) {
      // Remove rename
      db.run(
        "DELETE FROM field_renames WHERE table_name = ? AND original_name = ?",
        [table, field],
      );
    } else {
      db.run(
        `INSERT INTO field_renames (table_name, original_name, display_name, updated_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(table_name, original_name) DO UPDATE SET display_name = ?, updated_by = ?, updated_at = datetime('now','localtime')`,
        [
          table,
          field,
          displayName.trim(),
          req.user.username,
          displayName.trim(),
          req.user.username,
        ],
      );
    }
    saveToDisk();
    logActivity(
      req,
      "rename_field",
      table,
      field + " ? " + (displayName || "(reset)"),
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Bulk set field renames */
app.put("/api/field-renames/:table", auth, (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Admin only" });
    const db = getDb();
    const table = req.params.table;
    const { renames } = req.body; // { originalName: displayName, ... }
    if (!renames || typeof renames !== "object")
      return res.status(400).json({ error: "renames object required" });

    for (const [orig, disp] of Object.entries(renames)) {
      if (!disp || !disp.trim()) {
        db.run(
          "DELETE FROM field_renames WHERE table_name = ? AND original_name = ?",
          [table, orig],
        );
      } else {
        db.run(
          `INSERT INTO field_renames (table_name, original_name, display_name, updated_by)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(table_name, original_name) DO UPDATE SET display_name = ?, updated_by = ?, updated_at = datetime('now','localtime')`,
          [
            table,
            orig,
            disp.trim(),
            req.user.username,
            disp.trim(),
            req.user.username,
          ],
        );
      }
    }
    saveToDisk();
    logActivity(
      req,
      "bulk_rename_fields",
      table,
      Object.keys(renames).length + " fields",
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  RECORDS MANAGEMENT — hierarchical category/year/quarter
// ══════════════════════════════════════════════════════════════
const RECORD_CATEGORIES = [
  "applications_received",
  "permitted_applications",
  "monitoring_records",
];

/** List years for a category */
app.get("/api/records/years/:category", auth, (req, res) => {
  try {
    const db = getDb();
    const cat = req.params.category;
    if (!RECORD_CATEGORIES.includes(cat))
      return res.status(400).json({ error: "Invalid category" });
    const years = db.all(
      "SELECT * FROM records_years WHERE category = ? ORDER BY year DESC",
      [cat],
    );
    // Get entry counts per year/quarter
    const counts = db.all(
      `SELECT year, quarter, COUNT(*) as cnt FROM records_entries
       WHERE category = ? GROUP BY year, quarter`,
      [cat],
    );
    const countMap = {};
    counts.forEach((c) => {
      if (!countMap[c.year]) countMap[c.year] = {};
      countMap[c.year][c.quarter] = c.cnt;
    });
    res.json({ years, counts: countMap });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Add a new year to a category */
app.post("/api/records/years", auth, (req, res) => {
  try {
    const db = getDb();
    const { category, year } = req.body;
    if (!RECORD_CATEGORIES.includes(category))
      return res.status(400).json({ error: "Invalid category" });
    const y = parseInt(year);
    if (!y || y < 2000 || y > 2100)
      return res.status(400).json({ error: "Invalid year" });
    const existing = db.get(
      "SELECT id FROM records_years WHERE category = ? AND year = ?",
      [category, y],
    );
    if (existing)
      return res
        .status(400)
        .json({ error: "Year already exists for this category" });
    const result = db.run(
      "INSERT INTO records_years (category, year, created_by) VALUES (?, ?, ?)",
      [category, y, req.user.username],
    );
    saveToDisk();
    logActivity(req, "add_record_year", category, String(y));
    res.json({ id: result.lastInsertRowid, category, year: y });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Delete a year (admin only, only if no entries) */
app.delete("/api/records/years/:category/:year", auth, (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Admin only" });
    const db = getDb();
    const cat = req.params.category;
    const y = parseInt(req.params.year);
    const count = db.get(
      "SELECT COUNT(*) as c FROM records_entries WHERE category = ? AND year = ?",
      [cat, y],
    );
    if (count && count.c > 0)
      return res.status(400).json({
        error: `Cannot delete year with ${count.c} entries. Remove entries first.`,
      });
    db.run("DELETE FROM records_years WHERE category = ? AND year = ?", [
      cat,
      y,
    ]);
    saveToDisk();
    logActivity(req, "delete_record_year", cat, String(y));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** List entries for a category/year/quarter */
app.get("/api/records/entries/:category/:year/:quarter", auth, (req, res) => {
  try {
    const db = getDb();
    const cat = req.params.category;
    const y = parseInt(req.params.year);
    const q = parseInt(req.params.quarter);
    if (!RECORD_CATEGORIES.includes(cat))
      return res.status(400).json({ error: "Invalid category" });
    const search = req.query.search || "";
    let whereExtra = "";
    let params = [cat, y, q];
    if (search) {
      whereExtra = ` AND (company_name LIKE ? OR sector LIKE ? OR file_number LIKE ? OR permit_number LIKE ? OR district LIKE ? OR status LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }
    const rows = db.all(
      `SELECT * FROM records_entries WHERE category = ? AND year = ? AND quarter = ?${whereExtra} ORDER BY id DESC`,
      params,
    );
    res.json({ rows, total: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Get single entry */
app.get("/api/records/entry/:id", auth, (req, res) => {
  try {
    const db = getDb();
    const row = db.get("SELECT * FROM records_entries WHERE id = ?", [
      parseInt(req.params.id),
    ]);
    if (!row) return res.status(404).json({ error: "Entry not found" });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Create new entry */
app.post("/api/records/entries", auth, (req, res) => {
  try {
    const db = getDb();
    const { category, year, quarter, ...fields } = req.body;
    if (!RECORD_CATEGORIES.includes(category))
      return res.status(400).json({ error: "Invalid category" });
    const validCols = db
      .all('PRAGMA table_info("records_entries")')
      .map((c) => c.name)
      .filter((c) => !["id", "created_at", "updated_at"].includes(c));
    const data = { category, year: parseInt(year), quarter: parseInt(quarter) };
    for (const [k, v] of Object.entries(fields)) {
      if (validCols.includes(k)) data[k] = v === "" ? null : v;
    }
    if (!data.created_by) data.created_by = req.user.username;
    const cols = Object.keys(data);
    const vals = cols.map((c) => data[c]);
    const result = db.run(
      `INSERT INTO records_entries (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
      vals,
    );
    // Ensure the year exists in records_years
    db.run(
      "INSERT OR IGNORE INTO records_years (category, year, created_by) VALUES (?, ?, ?)",
      [category, data.year, req.user.username],
    );
    const row = db.get("SELECT * FROM records_entries WHERE id = ?", [
      result.lastInsertRowid,
    ]);
    saveToDisk();
    logActivity(
      req,
      "create_record_entry",
      category,
      `${year} Q${quarter} - ${fields.company_name || "Entry"}`,
      result.lastInsertRowid,
    );
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Update entry */
app.put("/api/records/entry/:id", auth, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const oldRow = db.get("SELECT * FROM records_entries WHERE id = ?", [id]);
    if (!oldRow) return res.status(404).json({ error: "Entry not found" });
    const validCols = db
      .all('PRAGMA table_info("records_entries")')
      .map((c) => c.name)
      .filter((c) => !["id", "created_at"].includes(c));
    const cols = Object.keys(req.body).filter((c) => validCols.includes(c));
    if (!cols.length) return res.status(400).json({ error: "No valid fields" });
    const vals = cols.map((c) => (req.body[c] === "" ? null : req.body[c]));
    vals.push(id);
    db.run(
      `UPDATE records_entries SET ${cols.map((c) => `"${c}" = ?`).join(", ")}, updated_at = datetime('now','localtime') WHERE id = ?`,
      vals,
    );
    const row = db.get("SELECT * FROM records_entries WHERE id = ?", [id]);
    saveToDisk();
    logActivity(req, "update_record_entry", oldRow.category, `ID ${id}`, id);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Delete entry */
app.delete("/api/records/entry/:id", auth, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const oldRow = db.get("SELECT * FROM records_entries WHERE id = ?", [id]);
    if (!oldRow) return res.status(404).json({ error: "Entry not found" });
    db.run("DELETE FROM records_entries WHERE id = ?", [id]);
    saveToDisk();
    logActivity(
      req,
      "delete_record_entry",
      oldRow.category,
      `${oldRow.year} Q${oldRow.quarter} - ${oldRow.company_name || "Entry"}`,
      id,
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Bulk import entries (CSV with forward-fill) */
app.post("/api/records/import/:category/:year/:quarter", auth, (req, res) => {
  try {
    const db = getDb();
    const cat = req.params.category;
    const y = parseInt(req.params.year);
    const q = parseInt(req.params.quarter);
    if (!RECORD_CATEGORIES.includes(cat))
      return res.status(400).json({ error: "Invalid category" });
    const { rows: importRows, ffillCols } = req.body;
    if (!Array.isArray(importRows) || importRows.length === 0)
      return res.status(400).json({ error: "No data rows" });
    // Forward-fill logic
    const ffCols = ffillCols || [
      "tentative_date",
      "group_name",
      "coordinating_officer",
    ];
    const lastVals = {};
    const processedRows = importRows.map((row) => {
      const processed = { ...row };
      for (const col of ffCols) {
        if (!processed[col] || processed[col].toString().trim() === "") {
          if (lastVals[col]) {
            processed[col] = lastVals[col];
            processed.is_forward_filled =
              (processed.is_forward_filled || "") + col + ",";
          }
        } else {
          lastVals[col] = processed[col];
        }
      }
      return processed;
    });
    const validCols = db
      .all('PRAGMA table_info("records_entries")')
      .map((c) => c.name)
      .filter((c) => !["id", "created_at", "updated_at"].includes(c));
    let inserted = 0;
    for (const row of processedRows) {
      const data = {
        category: cat,
        year: y,
        quarter: q,
        created_by: req.user.username,
      };
      for (const [k, v] of Object.entries(row)) {
        if (validCols.includes(k)) data[k] = v === "" ? null : v;
      }
      const cols = Object.keys(data);
      const vals = cols.map((c) => data[c]);
      db.run(
        `INSERT INTO records_entries (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
        vals,
      );
      inserted++;
    }
    db.run(
      "INSERT OR IGNORE INTO records_years (category, year, created_by) VALUES (?, ?, ?)",
      [cat, y, req.user.username],
    );
    saveToDisk();
    logActivity(
      req,
      "bulk_import_records",
      cat,
      `${y} Q${q}: ${inserted} entries`,
    );
    res.json({ ok: true, inserted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Records analytics — aggregated data across all categories */
app.get("/api/records/analytics", auth, (req, res) => {
  try {
    const db = getDb();
    const yearFilter = req.query.year ? parseInt(req.query.year) : null;
    const sectorFilter = req.query.sector || null;
    let whereClause = [];
    let params = [];
    if (yearFilter) {
      whereClause.push("year = ?");
      params.push(yearFilter);
    }
    if (sectorFilter) {
      whereClause.push("sector = ?");
      params.push(sectorFilter);
    }
    const where =
      whereClause.length > 0 ? "WHERE " + whereClause.join(" AND ") : "";
    // Category totals
    const catTotals = db.all(
      `SELECT category, COUNT(*) as cnt FROM records_entries ${where} GROUP BY category`,
      params,
    );
    // Status distribution
    const statusDist = db.all(
      `SELECT status, COUNT(*) as cnt FROM records_entries ${where} GROUP BY status`,
      params,
    );
    // Sector distribution
    const sectorDist = db.all(
      `SELECT sector, COUNT(*) as cnt FROM records_entries ${where} GROUP BY sector ORDER BY cnt DESC LIMIT 15`,
      params,
    );
    // Revenue by MMDA
    const revByMmda = db.all(
      `SELECT mmda, SUM(COALESCE(processing_fee,0)) as proc_fees, SUM(COALESCE(permit_fee,0)) as perm_fees, SUM(COALESCE(total_amount,0)) as total
       FROM records_entries ${where} GROUP BY mmda HAVING mmda IS NOT NULL AND mmda != '' ORDER BY total DESC LIMIT 15`,
      params,
    );
    // Quarterly volume
    const quarterlyVol = db.all(
      `SELECT year, quarter, category, COUNT(*) as cnt FROM records_entries ${where} GROUP BY year, quarter, category ORDER BY year, quarter`,
      params,
    );
    // All years for filters
    const years = db.all(
      "SELECT DISTINCT year FROM records_entries ORDER BY year DESC",
    );
    const sectors = db.all(
      "SELECT DISTINCT sector FROM records_entries WHERE sector IS NOT NULL AND sector != '' ORDER BY sector",
    );
    // Funnel: received → permitted
    const funnelReceived = db.get(
      `SELECT COUNT(*) as cnt FROM records_entries WHERE category = 'applications_received' ${yearFilter ? "AND year = ?" : ""}`,
      yearFilter ? [yearFilter] : [],
    );
    const funnelPermitted = db.get(
      `SELECT COUNT(*) as cnt FROM records_entries WHERE category = 'permitted_applications' ${yearFilter ? "AND year = ?" : ""}`,
      yearFilter ? [yearFilter] : [],
    );
    res.json({
      categoryTotals: catTotals,
      statusDistribution: statusDist,
      sectorDistribution: sectorDist,
      revenueByMmda: revByMmda,
      quarterlyVolume: quarterlyVol,
      funnel: {
        received: funnelReceived?.cnt || 0,
        permitted: funnelPermitted?.cnt || 0,
      },
      years: years.map((y) => y.year),
      sectors: sectors.map((s) => s.sector),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  RECORDS ENTRIES — Excel Backup / Export
// ══════════════════════════════════════════════════════════════

/** Export all records entries as an Excel workbook (one sheet per category) */
app.get("/api/records/backup-excel", auth, (req, res) => {
  try {
    const db = getDb();
    const wb = XLSX.utils.book_new();

    const categories = [
      { key: "applications_received", label: "Applications Received" },
      { key: "permitted_applications", label: "Permitted Applications" },
      { key: "monitoring_records", label: "Monitoring Records" },
    ];

    let totalRows = 0;
    for (const cat of categories) {
      const rows = db.all(
        "SELECT * FROM records_entries WHERE category = ? ORDER BY year, quarter, id",
        [cat.key],
      );
      totalRows += rows.length;
      // Remove internal fields from export
      const cleaned = rows.map((r) => {
        const { created_at, updated_at, ...rest } = r;
        return rest;
      });
      const ws = XLSX.utils.json_to_sheet(cleaned.length > 0 ? cleaned : [{}]);
      XLSX.utils.book_append_sheet(wb, ws, cat.label);
    }

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const filename = `Records_Backup_${timestamp}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    logActivity(
      req,
      "EXPORT_RECORDS_BACKUP",
      "records_entries",
      null,
      null,
      `${totalRows} records exported to Excel`,
    );

    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  EXCEL IMPORT — robust extraction from EPA spreadsheets
// ══════════════════════════════════════════════════════════════

const excelUpload = multer({
  dest: path.join(APP_ROOT, "uploads", "excel"),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".xlsx" || ext === ".xls") cb(null, true);
    else cb(new Error("Only Excel files (.xlsx, .xls) are accepted"));
  },
});

const excelUploadDir = path.join(APP_ROOT, "uploads", "excel");
if (!fs.existsSync(excelUploadDir))
  fs.mkdirSync(excelUploadDir, { recursive: true });

// Temp storage for parsed Excel data (avoids sending huge payloads to browser)
const excelTempDir = path.join(APP_ROOT, "uploads", "excel", "temp");
if (!fs.existsSync(excelTempDir))
  fs.mkdirSync(excelTempDir, { recursive: true });

// Clean up temp files older than 2 hours on startup and every 30 minutes
function cleanExcelTempFiles() {
  try {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    if (!fs.existsSync(excelTempDir)) return;
    for (const f of fs.readdirSync(excelTempDir)) {
      const fp = path.join(excelTempDir, f);
      try {
        const stat = fs.statSync(fp);
        if (stat.mtimeMs < cutoff) fs.unlinkSync(fp);
      } catch (_) {}
    }
  } catch (_) {}
}
cleanExcelTempFiles();
setInterval(cleanExcelTempFiles, 30 * 60 * 1000);

// ── Helper: normalise an Excel header string into a canonical key ──
function normalizeHeader(h) {
  if (h === null || h === undefined) return "";
  return String(h).replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

// ── Helper: comprehensive header-to-column mapping ───────────
const EXCEL_HEADER_MAP = {
  // Identification
  "NAME OF COMPANY": "company_name",
  NAME: "company_name",
  "NAME OF FACILITY": "company_name",
  "CLIENT ID": "client_id",
  CONTACT: "telephone",
  "CONTACT NUMBER": "telephone",

  // Operational
  SECTOR: "sector",
  "TYPE OF ACTIVITY (UNDERTAKING)": "type_of_activity",
  "TYPE OF UNDERTAKING": "type_of_activity",
  LOCATION: "facility_location",
  "LOCATION OF COMPANY": "facility_location",
  DISTRICT: "district",
  MMDA: "mmda",

  // Geospatial
  LATITUDE: "latitude",
  LONGITUDE: "longitude",
  "GPS CORDINATES": "_gps_combined",
  "GPS COORDINATES": "_gps_combined",

  // Financial
  "PROCESSING FEE": "processing_fee",
  "PROCESSING FEE AMOUNT INVOICED GHS": "processing_fee",
  "PERMIT FEE": "permit_fee",
  "PERMIT FEE AMOUNT INVOICED GHS": "permit_fee",
  "TOTAL AMOUNT INVOICED GHS": "amount_to_pay",
  "PROCESSING PAID GHS": "processing_paid",
  "PERMIT PAID GHS": "permit_paid",
  "TOTAL AMOUNT PAID GHS": "amount_paid",
  "TOTAL AMOUNT": "total_amount",
  "ADMINISTRATIVE PENALTY": "administrative_penalty",
  "INVOICE NUMBER PROCESSING": "invoice_number_processing",
  "INVOICE NUMBER PERMIT": "invoice_number_permit",

  // Permit
  "PERMIT NUMBER": "permit_number",
  "PERMIT STATUS": "status",
  "PERMIT STATUS- NEW/ RENEWAL": "application_status",
  "STATUS OF APPLICATION": "application_status",
  "PERMIT ISSUE DATE": "permit_issue_date",
  "PERMIT EXPIRY DATE": "permit_expiry_date",
  "EXPIRY DATE": "permit_expiry_date",
  "DATE OF ISSUE": "permit_issue_date",
  "EFFECTIVE DATE": "effective_date",

  // Timeline
  "DATE OF RECEIPT": "date_of_receipt",
  DATE: "date_of_receipt",
  "DATE ISSUED": "date_of_invoice",
  "PROCESSING PERIOD": "processing_period",

  // Monitoring
  "TENTATIVE DATE": "tentative_date",
  GROUP: "group_name",
  "COORDINATING OFFICER": "coordinating_officer",
  "ADDITIONAL OFFICERS": "additional_officers",
  NSPS: "nsps",
};

// ── Helper: convert Excel serial date to ISO date string ─────
function excelDateToISO(serial) {
  if (serial === null || serial === undefined || serial === "") return "";
  if (typeof serial === "string") {
    // Already a date string — return as-is if parseable
    const d = new Date(serial);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return serial;
  }
  if (typeof serial !== "number" || serial < 1) return String(serial);
  // Excel serial date: days since 1900-01-01 (with the 1900 leap-year bug)
  const epoch = new Date(1899, 11, 30); // Dec 30, 1899
  const d = new Date(epoch.getTime() + serial * 86400000);
  if (isNaN(d.getTime())) return String(serial);
  return d.toISOString().slice(0, 10);
}

// ── Date-type columns (to auto-convert Excel serial numbers) ─
const DATE_COLUMNS = new Set([
  "date_of_receipt",
  "date_of_invoice",
  "permit_issue_date",
  "permit_expiry_date",
  "permit_renewal_date",
  "date_of_processing_fee",
  "date_of_payment_processing",
  "date_of_permit_fee",
  "date_of_payment_permit",
  "date_of_payment",
  "date_of_screening",
  "date_of_draft_receipt",
  "date_of_revised_receipt",
  "date_review_sent",
  "date_of_emp_submission",
  "date_of_trc",
  "date_sent_head_office",
  "date_received_head_office",
  "tentative_date",
  "compliance_date",
  "due_date_reporting",
  "effective_date",
]);

// ── Helper: detect the header row in a sheet ─────────────────
function detectHeaderRow(sheet) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const maxScan = Math.min(range.e.r, 5); // scan first 6 rows
  let bestRow = 0,
    bestScore = 0;
  for (let r = range.s.r; r <= maxScan; r++) {
    let score = 0;
    let nonEmpty = 0;
    for (let c = range.s.c; c <= Math.min(range.e.c, 25); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const v = normalizeHeader(cell.v).toUpperCase();
      nonEmpty++;
      if (EXCEL_HEADER_MAP[v]) score += 3;
      else if (/^S\/?N$/i.test(v) || /^NO$/i.test(v)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  return bestRow;
}

// ── Helper: parse one sheet into an array of mapped row objects ─
function parseSheet(sheet, sheetName) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const headerRow = detectHeaderRow(sheet);
  const merges = sheet["!merges"] || [];

  // Build a merge lookup: for any cell in a merge region, resolve to the top-left value
  function getMergeValue(r, c) {
    for (const m of merges) {
      if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) {
        // This cell is part of a merged region — return the value from the top-left cell
        const topLeft = sheet[XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c })];
        return topLeft || null;
      }
    }
    return undefined; // not in any merge region
  }

  // Read headers
  const colMap = {}; // colIndex → db column name
  const headerNames = {};
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (!cell) continue;
    const raw = normalizeHeader(cell.v).toUpperCase();
    if (/^S\/?N$/i.test(raw) || /^NO$/i.test(raw)) continue; // skip serial number columns
    const mapped = EXCEL_HEADER_MAP[raw];
    if (mapped) {
      colMap[c] = mapped;
      headerNames[c] = raw;
    }
  }

  if (Object.keys(colMap).length === 0) return [];

  // Determine which columns are "substantive" (not just numbers/dates)
  const substantiveCols = new Set(
    Object.values(colMap).filter(
      (c) =>
        !DATE_COLUMNS.has(c) &&
        ![
          "latitude",
          "longitude",
          "processing_fee",
          "permit_fee",
          "amount_to_pay",
          "amount_paid",
          "balance",
          "total_amount",
          "processing_paid",
          "permit_paid",
          "administrative_penalty",
        ].includes(c),
    ),
  );

  // Read data rows — stop after 50 consecutive empty rows
  const rows = [];
  let consecutiveEmpty = 0;
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const row = {};
    let hasData = false;
    let substantiveFieldCount = 0;
    for (const [cStr, dbCol] of Object.entries(colMap)) {
      const c = parseInt(cStr);
      let cell = sheet[XLSX.utils.encode_cell({ r, c })];

      // If cell is empty, check if it's part of a merged region
      if (!cell) {
        const mergeVal = getMergeValue(r, c);
        if (mergeVal)
          cell = mergeVal; // use the merged cell's top-left value
        else if (mergeVal === null) continue; // merged region but top-left is also empty
      }
      if (!cell) continue;

      let val = cell.v;
      if (val === null || val === undefined) continue;

      // Convert Excel dates
      if (
        DATE_COLUMNS.has(dbCol) ||
        (cell.t === "n" &&
          typeof val === "number" &&
          val > 40000 &&
          val < 60000)
      ) {
        val = excelDateToISO(val);
      }

      // Handle combined GPS coordinates
      if (dbCol === "_gps_combined") {
        const gps = String(val)
          .split(",")
          .map((s) => s.trim());
        if (gps.length >= 2) {
          row["latitude"] = gps[0];
          row["longitude"] = gps[1];
          hasData = true;
          substantiveFieldCount++;
        }
        continue;
      }

      val = String(val).trim();
      if (val !== "") {
        row[dbCol] = val;
        hasData = true;
        if (substantiveCols.has(dbCol)) substantiveFieldCount++;
      }
    }

    // A row is valid if it has a company name, OR at least 2 substantive fields
    if (hasData && (row.company_name || substantiveFieldCount >= 2)) {
      rows.push(row);
      consecutiveEmpty = 0;
    } else {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 50) break; // end of real data
    }
  }
  return rows;
}

// ── Helper: detect category from filename ────────────────────
function detectCategory(filename) {
  const upper = filename.toUpperCase();
  if (upper.includes("MONITORING")) return "monitoring_records";
  if (upper.includes("PERMITTED")) return "permitted_applications";
  if (upper.includes("APPLICATION") || upper.includes("RECEIVED"))
    return "applications_received";
  return null;
}

// ── Helper: detect year from filename ────────────────────────
function detectYear(filename) {
  const m = filename.match(/20\d{2}/);
  return m ? parseInt(m[0]) : null;
}

// ── Helper: detect quarter from sheet name ───────────────────
function detectQuarter(sheetName) {
  const upper = sheetName.toUpperCase().replace("QUATER", "QUARTER");
  if (upper.includes("1ST") || upper.includes("FIRST") || upper.includes("Q1"))
    return 1;
  if (upper.includes("2ND") || upper.includes("SECOND") || upper.includes("Q2"))
    return 2;
  if (upper.includes("3RD") || upper.includes("THIRD") || upper.includes("Q3"))
    return 3;
  if (upper.includes("4TH") || upper.includes("FOURTH") || upper.includes("Q4"))
    return 4;
  return null;
}

/** Parse uploaded Excel file and return preview data */
app.post(
  "/api/records/excel-parse",
  auth,
  (req, res, next) => {
    excelUpload.single("file")(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE")
          return res.status(413).json({ error: "File exceeds 100 MB limit" });
        return res.status(400).json({ error: err.message || "Upload failed" });
      }
      next();
    });
  },
  (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const filePath = req.file.path;
      const originalName = req.file.originalname;

      const workbook = XLSX.readFile(filePath, {
        cellDates: false,
        cellNF: false,
        cellText: false,
      });
      const detectedCategory = detectCategory(originalName);
      const detectedYear = detectYear(originalName);

      const sheets = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const detectedQuarter = detectQuarter(sheetName);
        const rows = parseSheet(sheet, sheetName);

        // Get column names found in this sheet
        const columnsFound = new Set();
        rows.forEach((r) => Object.keys(r).forEach((k) => columnsFound.add(k)));

        // Build column mapping info for display
        const headerRow = detectHeaderRow(sheet);
        const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
        const mappedHeaders = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
          if (!cell) continue;
          const raw = normalizeHeader(cell.v).toUpperCase();
          const mapped = EXCEL_HEADER_MAP[raw];
          if (mapped)
            mappedHeaders.push({ excel: normalizeHeader(cell.v), db: mapped });
        }

        sheets.push({
          sheetName,
          detectedQuarter,
          rowCount: rows.length,
          columnsFound: [...columnsFound],
          mappedHeaders,
          preview: rows.slice(0, 10), // first 10 rows for preview
          allRows: rows,
        });
      }

      // Store parsed data in temp file (avoids sending all rows to browser and back)
      const tempId =
        Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const tempPath = path.join(excelTempDir, tempId + ".json");
      const tempData = sheets.map((s) => ({
        sheetName: s.sheetName,
        allRows: s.allRows,
      }));
      fs.writeFileSync(tempPath, JSON.stringify(tempData));

      // Clean up uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        /* ignore */
      }

      // Return summary (no allRows) to keep response lightweight
      const responsesheets = sheets.map(({ allRows, ...rest }) => rest);

      res.json({
        filename: originalName,
        detectedCategory,
        detectedYear,
        tempId,
        sheets: responsesheets,
      });
    } catch (e) {
      // Clean up temp file on error
      if (req.file?.path)
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {}
      res.status(500).json({ error: e.message });
    }
  },
);

/** Fetch all rows from a temp Excel parse session for review/editing */
app.get("/api/records/excel-temp/:tempId", auth, (req, res) => {
  try {
    const safe = String(req.params.tempId).replace(/[^a-z0-9]/gi, "");
    const tempPath = path.join(excelTempDir, safe + ".json");
    if (!fs.existsSync(tempPath))
      return res
        .status(404)
        .json({ error: "Session expired. Please re-upload the Excel file." });
    const sheets = JSON.parse(fs.readFileSync(tempPath, "utf8"));
    res.json({ sheets });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Import parsed Excel data into the database */
app.post("/api/records/excel-import", auth, (req, res) => {
  try {
    const db = getDb();
    const { category, year, sheets: sheetConfig, ffillCols, tempId } = req.body;
    if (!RECORD_CATEGORIES.includes(category))
      return res.status(400).json({ error: "Invalid category" });
    if (!year || year < 2000 || year > 2100)
      return res.status(400).json({ error: "Invalid year" });
    if (!Array.isArray(sheetConfig) || sheetConfig.length === 0)
      return res.status(400).json({ error: "No sheets to import" });

    // Load parsed rows from temp file
    let storedSheets = null;
    if (tempId) {
      const safe = String(tempId).replace(/[^a-z0-9]/gi, "");
      const tempPath = path.join(excelTempDir, safe + ".json");
      if (!fs.existsSync(tempPath))
        return res
          .status(400)
          .json({ error: "Session expired. Please re-upload the Excel file." });
      storedSheets = JSON.parse(fs.readFileSync(tempPath, "utf8"));
    }

    const validCols = db
      .all('PRAGMA table_info("records_entries")')
      .map((c) => c.name)
      .filter((c) => !["id", "created_at", "updated_at"].includes(c));

    const ffCols = ffillCols || [
      "tentative_date",
      "group_name",
      "coordinating_officer",
    ];
    let totalInserted = 0;
    const sheetResults = [];

    for (const sheetData of sheetConfig) {
      const quarter = sheetData.quarter;
      if (!quarter || quarter < 1 || quarter > 4) {
        sheetResults.push({
          sheetName: sheetData.sheetName,
          error: "Invalid quarter",
          inserted: 0,
        });
        continue;
      }

      // Get rows from temp file or from request body
      let importRows = sheetData.rows || [];
      if (storedSheets) {
        const stored = storedSheets.find(
          (s) => s.sheetName === sheetData.sheetName,
        );
        if (stored) importRows = stored.allRows || [];
      }

      if (importRows.length === 0) {
        sheetResults.push({
          sheetName: sheetData.sheetName,
          error: "No data rows",
          inserted: 0,
        });
        continue;
      }

      // Forward-fill logic
      const lastVals = {};
      const processedRows = importRows.map((row) => {
        const processed = { ...row };
        for (const col of ffCols) {
          if (!processed[col] || String(processed[col]).trim() === "") {
            if (lastVals[col]) {
              processed[col] = lastVals[col];
              processed.is_forward_filled =
                (processed.is_forward_filled || "") + col + ",";
            }
          } else {
            lastVals[col] = processed[col];
          }
        }
        return processed;
      });

      let inserted = 0;
      for (const row of processedRows) {
        const data = { category, year, quarter, created_by: req.user.username };
        for (const [k, v] of Object.entries(row)) {
          if (validCols.includes(k)) data[k] = v === "" ? null : v;
        }
        const cols = Object.keys(data);
        const vals = cols.map((c) => data[c]);
        db.run(
          `INSERT INTO records_entries (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
          vals,
        );
        inserted++;
      }

      totalInserted += inserted;
      sheetResults.push({ sheetName: sheetData.sheetName, quarter, inserted });
    }

    // Ensure year exists in records_years
    db.run(
      "INSERT OR IGNORE INTO records_years (category, year, created_by) VALUES (?, ?, ?)",
      [category, year, req.user.username],
    );
    saveToDisk();

    // Clean up temp file after successful import
    if (tempId) {
      const safe = String(tempId).replace(/[^a-z0-9]/gi, "");
      const tempPath = path.join(excelTempDir, safe + ".json");
      try {
        fs.unlinkSync(tempPath);
      } catch (_) {}
    }

    logActivity(
      req,
      "excel_import_records",
      category,
      `${year}: ${totalInserted} entries from Excel`,
    );
    res.json({ ok: true, totalInserted, sheetResults });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Scan workspace for Excel files and auto-import them */
app.post("/api/records/excel-scan", auth, (req, res) => {
  try {
    const xlsxFiles = fs
      .readdirSync(APP_ROOT)
      .filter((f) => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$"));

    const results = [];
    for (const filename of xlsxFiles) {
      const fullPath = path.join(APP_ROOT, filename);
      const cat = detectCategory(filename);
      const year = detectYear(filename);
      if (!cat || !year) {
        results.push({
          filename,
          error: "Could not detect category or year",
          inserted: 0,
        });
        continue;
      }

      const workbook = XLSX.readFile(fullPath, {
        cellDates: false,
        cellNF: false,
        cellText: false,
      });
      let fileInserted = 0;
      const sheetResults = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const quarter = detectQuarter(sheetName);
        if (!quarter) {
          sheetResults.push({
            sheetName,
            error: "Could not detect quarter",
            inserted: 0,
          });
          continue;
        }

        const rows = parseSheet(sheet, sheetName);
        if (rows.length === 0) {
          sheetResults.push({ sheetName, quarter, inserted: 0 });
          continue;
        }

        const db = getDb();
        const validCols = db
          .all('PRAGMA table_info("records_entries")')
          .map((c) => c.name)
          .filter((c) => !["id", "created_at", "updated_at"].includes(c));

        // Forward-fill for monitoring data
        const ffCols = ["tentative_date", "group_name", "coordinating_officer"];
        const lastVals = {};
        const processedRows = rows.map((row) => {
          const processed = { ...row };
          for (const col of ffCols) {
            if (!processed[col] || String(processed[col]).trim() === "") {
              if (lastVals[col]) {
                processed[col] = lastVals[col];
                processed.is_forward_filled =
                  (processed.is_forward_filled || "") + col + ",";
              }
            } else {
              lastVals[col] = processed[col];
            }
          }
          return processed;
        });

        let inserted = 0;
        for (const row of processedRows) {
          const data = {
            category: cat,
            year,
            quarter,
            created_by: req.user.username,
          };
          for (const [k, v] of Object.entries(row)) {
            if (validCols.includes(k)) data[k] = v === "" ? null : v;
          }
          const cols = Object.keys(data);
          const vals = cols.map((c) => data[c]);
          db.run(
            `INSERT INTO records_entries (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
            vals,
          );
          inserted++;
        }

        fileInserted += inserted;
        sheetResults.push({ sheetName, quarter, inserted });
      }

      // Ensure year exists
      const db = getDb();
      db.run(
        "INSERT OR IGNORE INTO records_years (category, year, created_by) VALUES (?, ?, ?)",
        [cat, year, req.user.username],
      );

      results.push({
        filename,
        category: cat,
        year,
        totalInserted: fileInserted,
        sheets: sheetResults,
      });
    }

    saveToDisk();
    const grandTotal = results.reduce((s, r) => s + (r.totalInserted || 0), 0);
    logActivity(
      req,
      "excel_scan_import",
      "records",
      `${xlsxFiles.length} files, ${grandTotal} entries`,
    );
    res.json({ ok: true, files: results, grandTotal });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Admin: Get record count stats per category/year/quarter */
app.get("/api/records/admin/stats", auth, (req, res) => {
  try {
    const db = getDb();
    const stats = db.all(`
      SELECT category, year, quarter, COUNT(*) as cnt,
        MIN(created_at) as first_import, MAX(created_at) as last_import
      FROM records_entries
      GROUP BY category, year, quarter
      ORDER BY category, year, quarter
    `);
    const total = db.get("SELECT COUNT(*) as cnt FROM records_entries");
    res.json({ stats, total: total?.cnt || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Admin: Bulk delete records by category/year/quarter */
app.post("/api/records/admin/bulk-delete", auth, (req, res) => {
  try {
    const db = getDb();
    const { category, year, quarter } = req.body;
    let where = [];
    let params = [];
    if (category) {
      where.push("category = ?");
      params.push(category);
    }
    if (year) {
      where.push("year = ?");
      params.push(parseInt(year));
    }
    if (quarter) {
      where.push("quarter = ?");
      params.push(parseInt(quarter));
    }
    if (where.length === 0)
      return res
        .status(400)
        .json({ error: "Must specify at least category, year, or quarter" });
    const count = db.get(
      `SELECT COUNT(*) as cnt FROM records_entries WHERE ${where.join(" AND ")}`,
      params,
    );
    db.run(`DELETE FROM records_entries WHERE ${where.join(" AND ")}`, params);
    saveToDisk();
    logActivity(
      req,
      "bulk_delete_records",
      category || "all",
      `${count?.cnt || 0} entries deleted`,
    );
    res.json({ ok: true, deleted: count?.cnt || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Admin: Delete selected record IDs */
app.post("/api/records/admin/delete-selected", auth, (req, res) => {
  try {
    const db = getDb();
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: "No IDs specified" });
    const placeholders = ids.map(() => "?").join(",");
    db.run(
      `DELETE FROM records_entries WHERE id IN (${placeholders})`,
      ids.map(Number),
    );
    saveToDisk();
    logActivity(
      req,
      "delete_selected_records",
      "records",
      `${ids.length} entries`,
    );
    res.json({ ok: true, deleted: ids.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start ────────────────────────────────────────────────────
async function start() {
  await initDatabase();
  // Ensure all existing non-admin users have default feature permissions
  try {
    const db = getDb();
    const users = db.all("SELECT id FROM app_users WHERE role != 'admin'");
    const defaultPages = [
      "dashboard",
      "tables",
      "queries",
      "forms",
      "reports",
      "scanlog",
      "permitfilter",
      "enrichment",
      // "records",
      // "recordsAnalytics",
    ];
    /* Seed every default page for every non-admin user.
       INSERT OR IGNORE keeps existing rows untouched. */
    for (const u of users) {
      for (const p of defaultPages) {
        db.run(
          `INSERT OR IGNORE INTO feature_permissions (user_id, feature_category, feature_key, is_allowed) VALUES (?,?,?,?)`,
          [u.id, "page", p, 1],
        );
      }
    }
    saveToDisk();
  } catch (e) {
    console.error("Feature perm migration:", e.message);
  }
  // Initialize backup schedule
  try {
    setupBackupCron(getDb());
  } catch (e) {
    console.error("Backup cron init failed:", e.message);
  }
  // Load shared docs path
  try {
    sharedDocsPath = getBackupConfig(getDb()).shared_docs_path || "";
  } catch (e) {}

  const server = app.listen(PORT, "0.0.0.0", () => {
    const ips = getLanIPs();
    const lanIP = ips.length > 0 ? ips[0].address : "localhost";
    const hostname = os.hostname();
    console.log(`\n  EPA Database System v4.4.0 running on port ${PORT}`);
    console.log(`  Local:    http://localhost:${PORT}`);
    console.log(`  Network:  http://${lanIP}:${PORT}`);
    console.log(`  Hostname: http://${hostname}:${PORT}\n`);

    // Start mDNS broadcasting
    try {
      const { Bonjour } = require("bonjour-service");
      const bonjour = new Bonjour();
      bonjour.publish({
        name: "EPA Database System",
        type: "http",
        port: parseInt(PORT),
        txt: { path: "/", version: "4.5.0", hostname },
      });
      console.log(
        '  mDNS:     Service advertised as "EPA Database System" on local network',
      );
      console.log(`  Clients can also use: http://${hostname}:${PORT}\n`);
    } catch (e) {
      console.log("  mDNS:     Not available (" + e.message + ")\n");
    }
  });
  return server;
}

// Export for Electron embedding
module.exports = { start, app };

// Auto-start only when run directly (not imported by Electron)
if (require.main === module) {
  process.on("SIGINT", () => {
    saveToDisk();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    saveToDisk();
    process.exit(0);
  });
  start().catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
  });
}
