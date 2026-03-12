// server.js — EPA Records Entries System Server
const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const fs = require("fs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const XLSX = require("xlsx");
const { initDatabase, getDb, saveToDisk } = require("./database");

let APP_ROOT = process.env.EPA_APP_ROOT || __dirname;

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "epa-records-secret-key-2026";

// ── Security middleware ──────────────────────────────────────
app.use(
  helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: "Too many login attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ── Excel upload configuration ───────────────────────────────
const excelUploadDir = path.join(APP_ROOT, "uploads", "excel");
if (!fs.existsSync(excelUploadDir))
  fs.mkdirSync(excelUploadDir, { recursive: true });

const excelUpload = multer({
  dest: excelUploadDir,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".xlsx" || ext === ".xls") cb(null, true);
    else cb(new Error("Only Excel files (.xlsx, .xls) are accepted"));
  },
});

// ── Activity Log ─────────────────────────────────────────────
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

// ── Auth middleware ──────────────────────────────────────────
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

// ══════════════════════════════════════════════════════════════
//  Feature permissions
// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
//  First-run setup
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
    return res
      .status(400)
      .json({
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
    if ((role || "user") !== "admin") {
      db.run(
        `INSERT INTO user_permissions (user_id, table_name, record_id, can_view, can_create, can_edit, can_delete) VALUES (?,?,?,?,?,?,?)`,
        [newUserId, "*", null, 1, 0, 0, 0],
      );
      const defaultFeatures = [
        { cat: "page", key: "dashboard" },
        { cat: "page", key: "records" },
        { cat: "page", key: "recordsAnalytics" },
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

// ── Feature permissions management ───────────────────────────
app.get("/api/users/:id/permissions", auth, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const tablePerm = db.all(
      "SELECT * FROM user_permissions WHERE user_id = ?",
      [id],
    );
    const featurePerm = db.all(
      "SELECT * FROM feature_permissions WHERE user_id = ?",
      [id],
    );
    res.json({ tablePermissions: tablePerm, featurePermissions: featurePerm });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/users/:id/permissions", auth, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const { tablePermissions, featurePermissions } = req.body;
    if (tablePermissions) {
      db.run("DELETE FROM user_permissions WHERE user_id = ?", [id]);
      for (const p of tablePermissions) {
        db.run(
          `INSERT INTO user_permissions (user_id, table_name, record_id, can_view, can_create, can_edit, can_delete) VALUES (?,?,?,?,?,?,?)`,
          [
            id,
            p.table_name || "*",
            p.record_id || null,
            p.can_view ? 1 : 0,
            p.can_create ? 1 : 0,
            p.can_edit ? 1 : 0,
            p.can_delete ? 1 : 0,
          ],
        );
      }
    }
    if (featurePermissions) {
      db.run("DELETE FROM feature_permissions WHERE user_id = ?", [id]);
      for (const p of featurePermissions) {
        db.run(
          `INSERT INTO feature_permissions (user_id, feature_category, feature_key, is_allowed) VALUES (?,?,?,?)`,
          [id, p.feature_category, p.feature_key, p.is_allowed ? 1 : 0],
        );
      }
    }
    saveToDisk();
    logActivity(req, "UPDATE_PERMISSIONS", "user", `User ID ${id}`, id);
    res.json({ message: "Permissions updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Current user permissions ─────────────────────────────────
app.get("/api/feature-permissions/me", auth, (req, res) => {
  const db = getDb();
  if (req.user.role === "admin")
    return res.json({ role: "admin", features: "all" });
  const rows = db.all(
    "SELECT feature_category, feature_key, is_allowed FROM feature_permissions WHERE user_id = ?",
    [req.user.id],
  );
  const features = {};
  rows.forEach((r) => {
    if (!features[r.feature_category]) features[r.feature_category] = {};
    features[r.feature_category][r.feature_key] = !!r.is_allowed;
  });
  res.json({ role: req.user.role, features });
});

app.get("/api/permissions/me", auth, (req, res) => {
  const db = getDb();
  if (req.user.role === "admin")
    return res.json([
      {
        table_name: "*",
        can_view: 1,
        can_create: 1,
        can_edit: 1,
        can_delete: 1,
      },
    ]);
  const rows = db.all("SELECT * FROM user_permissions WHERE user_id = ?", [
    req.user.id,
  ]);
  res.json(rows);
});

// ══════════════════════════════════════════════════════════════
//  Records Management
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
    const counts = db.all(
      `SELECT year, quarter, COUNT(*) as cnt FROM records_entries WHERE category = ? GROUP BY year, quarter`,
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
      return res
        .status(400)
        .json({
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
    const catTotals = db.all(
      `SELECT category, COUNT(*) as cnt FROM records_entries ${where} GROUP BY category`,
      params,
    );
    const statusDist = db.all(
      `SELECT status, COUNT(*) as cnt FROM records_entries ${where} GROUP BY status`,
      params,
    );
    const sectorDist = db.all(
      `SELECT sector, COUNT(*) as cnt FROM records_entries ${where} GROUP BY sector ORDER BY cnt DESC LIMIT 15`,
      params,
    );
    const revByMmda = db.all(
      `SELECT mmda, SUM(COALESCE(processing_fee,0)) as proc_fees, SUM(COALESCE(permit_fee,0)) as perm_fees, SUM(COALESCE(total_amount,0)) as total
       FROM records_entries ${where} GROUP BY mmda HAVING mmda IS NOT NULL AND mmda != '' ORDER BY total DESC LIMIT 15`,
      params,
    );
    const quarterlyVol = db.all(
      `SELECT year, quarter, category, COUNT(*) as cnt FROM records_entries ${where} GROUP BY year, quarter, category ORDER BY year, quarter`,
      params,
    );
    const years = db.all(
      "SELECT DISTINCT year FROM records_entries ORDER BY year DESC",
    );
    const sectors = db.all(
      "SELECT DISTINCT sector FROM records_entries WHERE sector IS NOT NULL AND sector != '' ORDER BY sector",
    );
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
//  EXCEL IMPORT
// ══════════════════════════════════════════════════════════════

function normalizeHeader(h) {
  if (h === null || h === undefined) return "";
  return String(h).replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

const EXCEL_HEADER_MAP = {
  "NAME OF COMPANY": "company_name",
  NAME: "company_name",
  "NAME OF FACILITY": "company_name",
  "CLIENT ID": "client_id",
  CONTACT: "telephone",
  "CONTACT NUMBER": "telephone",
  SECTOR: "sector",
  "TYPE OF ACTIVITY (UNDERTAKING)": "type_of_activity",
  "TYPE OF UNDERTAKING": "type_of_activity",
  LOCATION: "facility_location",
  "LOCATION OF COMPANY": "facility_location",
  DISTRICT: "district",
  MMDA: "mmda",
  LATITUDE: "latitude",
  LONGITUDE: "longitude",
  "GPS CORDINATES": "_gps_combined",
  "GPS COORDINATES": "_gps_combined",
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
  "PERMIT NUMBER": "permit_number",
  "PERMIT STATUS": "status",
  "PERMIT STATUS- NEW/ RENEWAL": "application_status",
  "STATUS OF APPLICATION": "application_status",
  "PERMIT ISSUE DATE": "permit_issue_date",
  "PERMIT EXPIRY DATE": "permit_expiry_date",
  "EXPIRY DATE": "permit_expiry_date",
  "DATE OF ISSUE": "permit_issue_date",
  "EFFECTIVE DATE": "effective_date",
  "DATE OF RECEIPT": "date_of_receipt",
  DATE: "date_of_receipt",
  "DATE ISSUED": "date_of_invoice",
  "PROCESSING PERIOD": "processing_period",
  "TENTATIVE DATE": "tentative_date",
  GROUP: "group_name",
  "COORDINATING OFFICER": "coordinating_officer",
  "ADDITIONAL OFFICERS": "additional_officers",
  NSPS: "nsps",
};

function excelDateToISO(serial) {
  if (serial === null || serial === undefined || serial === "") return "";
  if (typeof serial === "string") {
    const d = new Date(serial);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return serial;
  }
  if (typeof serial !== "number" || serial < 1) return String(serial);
  const epoch = new Date(1899, 11, 30);
  const d = new Date(epoch.getTime() + serial * 86400000);
  if (isNaN(d.getTime())) return String(serial);
  return d.toISOString().slice(0, 10);
}

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

function detectHeaderRow(sheet) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const maxScan = Math.min(range.e.r, 5);
  let bestRow = 0,
    bestScore = 0;
  for (let r = range.s.r; r <= maxScan; r++) {
    let score = 0,
      nonEmpty = 0;
    for (let c = range.s.c; c <= Math.min(range.e.c, 25); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const v = normalizeHeader(cell.v).toUpperCase();
      nonEmpty++;
      if (EXCEL_HEADER_MAP[v]) score += 3;
      else if (/^S\/?N$/i.test(v) || /^NO$/i.test(v)) score += 1;
    }
    if (score > bestScore || (score === bestScore && nonEmpty > 0)) {
      bestScore = score;
      bestRow = r;
    }
  }
  return bestRow;
}

function parseSheet(sheet, sheetName) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const headerRow = detectHeaderRow(sheet);
  const colMap = {};
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (!cell) continue;
    const raw = normalizeHeader(cell.v).toUpperCase();
    if (/^S\/?N$/i.test(raw) || /^NO$/i.test(raw)) continue;
    const mapped = EXCEL_HEADER_MAP[raw];
    if (mapped) colMap[c] = mapped;
  }
  if (Object.keys(colMap).length === 0) return [];
  const rows = [];
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const row = {};
    let hasData = false;
    for (const [cStr, dbCol] of Object.entries(colMap)) {
      const c = parseInt(cStr);
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      let val = cell.v;
      if (val === null || val === undefined) continue;
      if (
        DATE_COLUMNS.has(dbCol) ||
        (cell.t === "n" &&
          typeof val === "number" &&
          val > 40000 &&
          val < 60000)
      ) {
        val = excelDateToISO(val);
      }
      if (dbCol === "_gps_combined") {
        const gps = String(val)
          .split(",")
          .map((s) => s.trim());
        if (gps.length >= 2) {
          row["latitude"] = gps[0];
          row["longitude"] = gps[1];
          hasData = true;
        }
        continue;
      }
      val = String(val).trim();
      if (val !== "") {
        row[dbCol] = val;
        hasData = true;
      }
    }
    if (hasData) rows.push(row);
  }
  return rows;
}

function detectCategory(filename) {
  const upper = filename.toUpperCase();
  if (upper.includes("MONITORING")) return "monitoring_records";
  if (upper.includes("PERMITTED")) return "permitted_applications";
  if (upper.includes("APPLICATION") || upper.includes("RECEIVED"))
    return "applications_received";
  return null;
}

function detectYear(filename) {
  const m = filename.match(/20\d{2}/);
  return m ? parseInt(m[0]) : null;
}

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
  excelUpload.single("file"),
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
        const columnsFound = new Set();
        rows.forEach((r) => Object.keys(r).forEach((k) => columnsFound.add(k)));
        sheets.push({
          sheetName,
          detectedQuarter,
          rowCount: rows.length,
          columnsFound: [...columnsFound],
          preview: rows.slice(0, 10),
          allRows: rows,
        });
      }
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
      res.json({
        filename: originalName,
        detectedCategory,
        detectedYear,
        sheets,
      });
    } catch (e) {
      if (req.file?.path)
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {}
      res.status(500).json({ error: e.message });
    }
  },
);

/** Import parsed Excel data into the database */
app.post("/api/records/excel-import", auth, (req, res) => {
  try {
    const db = getDb();
    const { category, year, sheets, ffillCols } = req.body;
    if (!RECORD_CATEGORIES.includes(category))
      return res.status(400).json({ error: "Invalid category" });
    if (!year || year < 2000 || year > 2100)
      return res.status(400).json({ error: "Invalid year" });
    if (!Array.isArray(sheets) || sheets.length === 0)
      return res.status(400).json({ error: "No sheets to import" });
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
    for (const sheetData of sheets) {
      const quarter = sheetData.quarter;
      if (!quarter || quarter < 1 || quarter > 4) {
        sheetResults.push({
          sheetName: sheetData.sheetName,
          error: "Invalid quarter",
          inserted: 0,
        });
        continue;
      }
      const importRows = sheetData.rows || [];
      if (importRows.length === 0) {
        sheetResults.push({
          sheetName: sheetData.sheetName,
          error: "No data rows",
          inserted: 0,
        });
        continue;
      }
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
    db.run(
      "INSERT OR IGNORE INTO records_years (category, year, created_by) VALUES (?, ?, ?)",
      [category, year, req.user.username],
    );
    saveToDisk();
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
      FROM records_entries GROUP BY category, year, quarter ORDER BY category, year, quarter
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
    let where = [],
      params = [];
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
  try {
    const db = getDb();
    const users = db.all("SELECT id FROM app_users WHERE role != 'admin'");
    const defaultPages = ["dashboard", "records", "recordsAnalytics"];
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

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `\n  EPA Records Entries System v1.0.0 running on port ${PORT}`,
    );
    console.log(`  Local:    http://localhost:${PORT}\n`);
  });
  return server;
}

module.exports = { start, app };

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
