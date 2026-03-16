// database.js — SQLite database setup using sql.js (pure JavaScript, no native compilation needed)
const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");

// Use APP_ROOT env var if set (Electron), otherwise use __dirname
const APP_ROOT = process.env.EPA_APP_ROOT || __dirname;
const DATA_DIR = path.join(APP_ROOT, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "epa.db");

let db = null;
let saveTimer = null;

// ── Save database to disk (debounced) ────────────────────────
function saveToDisk() {
  if (!db) return;
  const data = db._db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToDisk, 500);
}

// ── Wrapper for consistent API ───────────────────────────────
class DBWrapper {
  constructor(sqlDb) {
    this._db = sqlDb;
  }

  exec(sql) {
    this._db.run(sql);
    scheduleSave();
  }

  run(sql, params = []) {
    this._db.run(sql, params);
    scheduleSave();
    const lastId = this._db.exec("SELECT last_insert_rowid() AS id");
    const changes = this._db.exec("SELECT changes() AS c");
    return {
      lastInsertRowid: lastId.length > 0 ? lastId[0].values[0][0] : 0,
      changes: changes.length > 0 ? changes[0].values[0][0] : 0,
    };
  }

  get(sql, params = []) {
    const stmt = this._db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(sql, params = []) {
    const stmt = this._db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  pragma(sql) {
    try {
      this._db.run(`PRAGMA ${sql}`);
    } catch (e) {
      /* ignore */
    }
  }

  close() {
    saveToDisk();
    this._db.close();
  }
}

// ── Initialize database ──────────────────────────────────────
async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new DBWrapper(new SQL.Database(fileBuffer));
    console.log("Loaded existing database from", DB_PATH);
  } else {
    db = new DBWrapper(new SQL.Database());
    console.log("Created new database");
  }

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  db.exec(`CREATE TABLE IF NOT EXISTS PERMIT (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    FileNumber TEXT, NameofFile TEXT, RegisteredNameOfUndertaking TEXT,
    ClassificationOfUndertaking TEXT, CategoryOfFile TEXT, PermitHolder TEXT,
    PermitNumber TEXT, ContactPerson TEXT, TelephoneNumber TEXT, Email TEXT,
    FacilityLocation TEXT, District TEXT, Jurisdiction TEXT, Latitude TEXT,
    Longitude TEXT, FileLocation TEXT, DateOfReceiptOfApplication TEXT,
    Screening_Date TEXT, DateOfSiteVerification TEXT,
    DateOfReceiptOfDraft TEXT, DateOfReceiptOfRevised TEXT,
    DateReviewCommentWasSentToProponent TEXT, DateOfSubmissionOfEMP TEXT,
    DateOfTRC TEXT, DateSentToHeadOffice TEXT, DateReceivedFromHeadOffice TEXT,
    DateOfIssueOfPermit TEXT, PermitExpirationDate TEXT, PermitRenewalDate TEXT,
    PermitIssued TEXT, Permitted_by_Sekondi_Office TEXT, ProcessingFee REAL,
    DateOfIssueOfProcessingFee TEXT, DateOfPaymentOfProcessingFee TEXT,
    PermitFee REAL, DateOfIssueOfPermitFee TEXT, DateOfPaymentOfPermitFee TEXT,
    InvoiceNumber TEXT, DateOfIssueOfInvioce TEXT, AmountToPay REAL,
    FirstAmountPaid REAL, FirstBalanceToPay REAL, DateOfFirstPayment TEXT,
    SecondAmountPaid REAL, SecondBalanceToPay REAL, DateOfSecondPayment TEXT,
    FinalAmountPaid REAL, FinalBalance REAL, DateOfThirdPayment TEXT,
    TotalAmount REAL, DueDateForPayment TEXT,
    DateCompanyRequiresToPayPermitFee TEXT, DuePaymentDays TEXT,
    DaysAfterPayment TEXT, DaysAfterSecondPayment TEXT,
    DaysAfterFinalPayment TEXT, DaysSpentForPermitToBeProcessed TEXT,
    ApplicationStatus TEXT, ApplicationStatusII TEXT, Compliance TEXT,
    ComplianceDate TEXT, SubmissionOfAnnualEnvironmentalReport TEXT,
    SubmissionOfQuartelyEnvironmentalMonitoringReport TEXT,
    DueDateForReporting TEXT, DateCompanyRequiresToSubmitReviceReport TEXT,
    ReportingDays TEXT, DaysAfterReporting TEXT, DateReturned TEXT,
    FileReturned TEXT, DateReceived TEXT, DateEmailSent TEXT,
    DateEnforcementLetterIssued TEXT, ActualDateReported TEXT,
    Notification TEXT, DocumentAttached TEXT, OfficerWorkingOnFile TEXT,
    StatusOrComments TEXT, Remarks TEXT
  );`);

  db.exec(`CREATE TABLE IF NOT EXISTS MOVEMENT (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    Vehicle TEXT, ClassOfLicence TEXT, DateOfIssue TEXT, ExpiryDate TEXT,
    RenewalDate TEXT, DateOfIssueOfInsurance TEXT, ExpiryDateOfInsurance TEXT,
    ActualInsuranceDate TEXT, DateOfIssueOfRoadWealthy TEXT,
    ExpiryDateOfRoadWealthy TEXT, ActualRWDate TEXT, DateOfMaintenance TEXT,
    NextDateOfMaintenance TEXT, RequestedBy TEXT, DateRequested TEXT,
    Purpose TEXT, Destination TEXT, DepartureDate TEXT, ArrivalDate TEXT,
    DriverOfficersOnBoard TEXT, ApprovedBy TEXT, DateApproved TEXT,
    AttachedRequestForm TEXT, RecordCount INTEGER
  );`);

  db.exec(`CREATE TABLE IF NOT EXISTS WASTE (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    Code INTEGER, NameOfCompany TEXT, ContactPerson TEXT,
    TelephoneNumber TEXT, LocationOfWaste TEXT, DateOfInspection TEXT,
    ConsigmentArrivalDate TEXT, GeneralWaste INTEGER DEFAULT 0,
    CardboardAndPaperWaste INTEGER DEFAULT 0, WoodenPellets INTEGER DEFAULT 0,
    SrapMetalWaste INTEGER DEFAULT 0, EmptyMetalDrums INTEGER DEFAULT 0,
    EmptyPlasticDrums INTEGER DEFAULT 0, ChemicalSacks INTEGER DEFAULT 0,
    UsedHoses INTEGER DEFAULT 0, ThreadProtectors INTEGER DEFAULT 0,
    ItemsContainminatedByOil INTEGER DEFAULT 0, ElectronicWaste INTEGER DEFAULT 0,
    WasteOil INTEGER DEFAULT 0
  );`);

  db.exec(`CREATE TABLE IF NOT EXISTS Stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    Description_of_Stores TEXT, Classification TEXT, Invoice_Waybill_No TEXT,
    Stores_Received_From TEXT, Date_Received TEXT,
    Quantity_Received_Purchase INTEGER DEFAULT 0, Unit_Price REAL DEFAULT 0,
    Total_Amount REAL DEFAULT 0, Item_Condition_at_the_Time_of_Receipt TEXT,
    Remarks TEXT
  );`);

  db.exec(`CREATE TABLE IF NOT EXISTS tbl_keyword (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    Number INTEGER, Code TEXT, Project TEXT, NameOFDocument TEXT,
    ClassificationOfDocument TEXT, DocumentYear TEXT,
    NumberOfCopies INTEGER DEFAULT 0, DateOfReceiptFromCompany TEXT,
    ReviewingOfficer TEXT, DateOfficerReceived TEXT,
    DateOfficerReturned TEXT, Attachment TEXT
  );`);

  // Activity log table
  db.exec(`CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT NOT NULL,
    full_name TEXT DEFAULT '',
    action TEXT NOT NULL,
    target_type TEXT DEFAULT '',
    target_name TEXT DEFAULT '',
    target_id INTEGER,
    details TEXT DEFAULT '',
    old_values TEXT DEFAULT '',
    new_values TEXT DEFAULT '',
    ip_address TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );`);

  // Add old_values/new_values columns if they don't exist (migration for existing DBs)
  try {
    db._db.run(
      `ALTER TABLE activity_log ADD COLUMN old_values TEXT DEFAULT ''`,
    );
  } catch (e) {
    /* column already exists */
  }
  try {
    db._db.run(
      `ALTER TABLE activity_log ADD COLUMN new_values TEXT DEFAULT ''`,
    );
  } catch (e) {
    /* column already exists */
  }

  // Create index for faster activity log queries
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(username);`,
  );

  // User permissions table — granular per-table and per-record permissions
  db.exec(`CREATE TABLE IF NOT EXISTS user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    table_name TEXT NOT NULL DEFAULT '*',
    record_id INTEGER DEFAULT NULL,
    can_view INTEGER DEFAULT 1,
    can_create INTEGER DEFAULT 1,
    can_edit INTEGER DEFAULT 1,
    can_delete INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(user_id, table_name, record_id)
  );`);

  // File attachments table — multiple files per record
  db.exec(`CREATE TABLE IF NOT EXISTS file_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT DEFAULT '',
    file_size INTEGER DEFAULT 0,
    uploaded_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_attachments_record ON file_attachments(table_name, record_id);`,
  );

  // Feature permissions — controls access to app pages, queries, reports, forms, dashboard widgets
  db.exec(`CREATE TABLE IF NOT EXISTS feature_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    feature_category TEXT NOT NULL,
    feature_key TEXT NOT NULL,
    is_allowed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(user_id, feature_category, feature_key)
  );`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_feature_perms_user ON feature_permissions(user_id);`,
  );

  // Backup configuration (key-value store)
  db.exec(`CREATE TABLE IF NOT EXISTS backup_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );`);

  // Backup history
  db.exec(`CREATE TABLE IF NOT EXISTS backup_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    backup_type TEXT DEFAULT 'manual',
    storage_location TEXT DEFAULT 'local',
    google_drive_file_id TEXT DEFAULT '',
    status TEXT DEFAULT 'completed',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );`);

  // Document links — links files from the digitized files folder to database records
  db.exec(`CREATE TABLE IF NOT EXISTS document_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    relative_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    linked_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_doc_links ON document_links (table_name, record_id);`,
  );

  // Employees / Officers list
  db.exec(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL UNIQUE,
    position TEXT DEFAULT '',
    department TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );`);

  // Scan Log — tracks document scanning activities
  db.exec(`CREATE TABLE IF NOT EXISTS scan_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_date TEXT DEFAULT (datetime('now','localtime')),
    file_number TEXT DEFAULT '',
    company_name TEXT DEFAULT '',
    undertaking TEXT DEFAULT '',
    specific_sector TEXT DEFAULT '',
    sector TEXT DEFAULT '',
    location TEXT DEFAULT '',
    district TEXT DEFAULT '',
    jurisdiction TEXT DEFAULT '',
    scan_status TEXT DEFAULT 'New',
    last_folio INTEGER DEFAULT 0,
    current_folio INTEGER DEFAULT 0,
    documents_scanned INTEGER DEFAULT 0,
    scanned_by TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_scan_log_date ON scan_log(scan_date);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_scan_log_company ON scan_log(company_name);`,
  );

  // Custom dropdown options — admin-managed dropdown values per table+field
  db.exec(`CREATE TABLE IF NOT EXISTS custom_dropdown_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    field_name TEXT NOT NULL,
    option_value TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(table_name, field_name, option_value)
  )`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_cdo_table_field ON custom_dropdown_options(table_name, field_name)`,
  );

  db.exec(`CREATE TABLE IF NOT EXISTS hidden_dropdown_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    field_name TEXT NOT NULL,
    option_value TEXT NOT NULL,
    hidden_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(table_name, field_name, option_value)
  )`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_hdo_table_field ON hidden_dropdown_options(table_name, field_name)`,
  );

  // Custom fields metadata — tracks user-added columns and their config
  db.exec(`CREATE TABLE IF NOT EXISTS custom_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    field_name TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    field_type TEXT NOT NULL DEFAULT 'text',
    sort_order INTEGER DEFAULT 999,
    created_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(table_name, field_name)
  )`);

  // Add Screening and PermittedBy columns to PERMIT (migration for existing DBs)
  try {
    db._db.run(
      `ALTER TABLE PERMIT ADD COLUMN Screening TEXT DEFAULT 'Not Done'`,
    );
  } catch (e) {
    /* already exists */
  }
  try {
    db._db.run(`ALTER TABLE PERMIT ADD COLUMN PermittedBy TEXT DEFAULT ''`);
  } catch (e) {
    /* already exists */
  }
  try {
    db._db.run(`ALTER TABLE PERMIT ADD COLUMN PenaltyFee REAL DEFAULT 0`);
  } catch (e) {
    /* already exists */
  }
  try {
    db._db.run(`ALTER TABLE PERMIT ADD COLUMN Address TEXT DEFAULT ''`);
  } catch (e) {
    /* already exists */
  }
  try {
    db._db.run(
      `ALTER TABLE PERMIT ADD COLUMN DateOfSiteVerification TEXT DEFAULT ''`,
    );
  } catch (e) {
    /* already exists */
  }

  // Normalize legacy permit application-info values to the canonical options.
  try {
    db._db.run(
      `UPDATE PERMIT SET ApplicationStatusII = 'New Application'
       WHERE lower(trim(ApplicationStatusII)) = 'new'`,
    );
    db._db.run(
      `UPDATE PERMIT SET ApplicationStatusII = 'Renewal of Permit'
       WHERE lower(trim(ApplicationStatusII)) IN ('renewal', 'existing')`,
    );
    db._db.run(
      `UPDATE PERMIT SET ApplicationStatusII = ''
       WHERE ApplicationStatusII IS NOT NULL
         AND trim(ApplicationStatusII) != ''
         AND trim(ApplicationStatusII) NOT IN ('New Application', 'Renewal of Permit')`,
    );
  } catch (e) {
    /* ignore normalization failures */
  }

  // Remove broken or obsolete custom dropdown options for PERMIT.
  try {
    db._db.run(
      `DELETE FROM custom_dropdown_options
       WHERE table_name = 'PERMIT'
         AND field_name = 'ApplicationStatusII'
         AND trim(option_value) NOT IN ('New Application', 'Renewal of Permit')`,
    );
    db._db.run(
      `DELETE FROM custom_dropdown_options
       WHERE option_value IS NULL
          OR trim(option_value) = ''
          OR trim(option_value) GLOB '########*'`,
    );
  } catch (e) {
    /* ignore cleanup failures */
  }

  // Field renames — tracks display label overrides for existing columns
  db.exec(`CREATE TABLE IF NOT EXISTS field_renames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    updated_by TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(table_name, original_name)
  )`);

  // ── Records Management Module ──────────────────────────────
  // Years registry per category
  db.exec(`CREATE TABLE IF NOT EXISTS records_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    year INTEGER NOT NULL,
    created_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(category, year)
  )`);

  // Records entries — all EPA spreadsheet fields, organised by category/year/quarter
  db.exec(`CREATE TABLE IF NOT EXISTS records_entries (
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
  )`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_records_entries_cat ON records_entries(category, year, quarter)`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_records_entries_company ON records_entries(company_name)`,
  );

  // Migration: add new columns for Excel import support
  const recMigrationCols = [
    ["processing_period", "TEXT"],
    ["effective_date", "TEXT"],
    ["invoice_number_processing", "TEXT"],
    ["invoice_number_permit", "TEXT"],
    ["processing_paid", "REAL"],
    ["permit_paid", "REAL"],
    ["nsps", "TEXT"],
    ["additional_officers", "TEXT"],
    ["administrative_penalty", "REAL"],
  ];
  for (const [col, type] of recMigrationCols) {
    try {
      db._db.run(`ALTER TABLE records_entries ADD COLUMN ${col} ${type}`);
    } catch (e) {
      /* already exists */
    }
  }

  saveToDisk();
  return db;
}

module.exports = { initDatabase, getDb: () => db, saveToDisk };
