// database.js — EPA Records Entries System Database (sql.js)
const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");

const APP_ROOT = process.env.EPA_APP_ROOT || __dirname;
const DATA_DIR = path.join(APP_ROOT, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "epa-records.db");

let db = null;
let saveTimer = null;

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

  try {
    db._db.run(
      `ALTER TABLE activity_log ADD COLUMN old_values TEXT DEFAULT ''`,
    );
  } catch (e) {}
  try {
    db._db.run(
      `ALTER TABLE activity_log ADD COLUMN new_values TEXT DEFAULT ''`,
    );
  } catch (e) {}

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(username);`,
  );

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

  db.exec(`CREATE TABLE IF NOT EXISTS records_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    year INTEGER NOT NULL,
    created_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(category, year)
  )`);

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
    } catch (e) {}
  }

  saveToDisk();
  return db;
}

module.exports = { initDatabase, getDb: () => db, saveToDisk };
