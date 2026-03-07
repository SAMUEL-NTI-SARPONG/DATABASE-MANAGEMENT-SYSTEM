// migrate.js — Reads data from The Database.accdb (Access) and imports into SQLite
// Run: node migrate.js

const { execSync } = require("child_process");
const path = require("path");
const { initDatabase, getDb, saveToDisk } = require("./database");

const ACCESS_FILE = path.join(__dirname, "The Database.accdb");
const TABLES = ["PERMIT", "MOVEMENT", "WASTE", "Stores", "tbl_keyword"];

// Access column name -> SQLite column name (rename columns with special chars)
const COL_RENAMES = {
  "OfficerWorkingOnFile's": "OfficerWorkingOnFile",
};

function readAccessTable(tableName) {
  const fs = require("fs");
  const os = require("os");
  // Write PowerShell script to a temp file to avoid escaping issues
  const psScript = `
$conn = New-Object -ComObject ADODB.Connection
$conn.Open("Provider=Microsoft.ACE.OLEDB.12.0;Data Source='${ACCESS_FILE.replace(/'/g, "''")}'")
$rs = $conn.Execute("SELECT * FROM [${tableName}]")
$rows = @()
while (-not $rs.EOF) {
  $row = @{}
  for ($i = 0; $i -lt $rs.Fields.Count; $i++) {
    $fname = $rs.Fields.Item($i).Name
    $fval  = $rs.Fields.Item($i).Value
    if ($fval -is [System.DateTime]) { $fval = $fval.ToString("yyyy-MM-dd") }
    elseif ($fval -is [System.DBNull]) { $fval = $null }
    elseif ($fval -is [System.Byte[]]) { $fval = $null }
    elseif ($fval -is [string]) { $fval = $fval -replace '[\\x00-\\x1f]', ' ' }
    $row[$fname] = $fval
  }
  $rows += $row
  $rs.MoveNext()
}
$rs.Close()
$conn.Close()
$rows | ConvertTo-Json -Depth 3 -Compress
`;

  const tmpFile = path.join(os.tmpdir(), `epa_migrate_${tableName}.ps1`);
  try {
    fs.writeFileSync(tmpFile, psScript, "utf8");
    const result = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { maxBuffer: 50 * 1024 * 1024, encoding: "utf8", timeout: 180000 },
    );
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    if (!result || result.trim() === "" || result.trim() === "null") return [];
    const parsed = JSON.parse(result.trim());
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    console.error(
      `  Error reading ${tableName}: ${err.message.substring(0, 200)}`,
    );
    return [];
  }
}

// Read large tables in batches to avoid JSON memory/parsing issues
function readAccessTableBatched(tableName, batchSize) {
  const fs = require("fs");
  const os = require("os");
  const allRows = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // Use JSONL format (one JSON object per line) for robustness
    const psScript = `
$conn = New-Object -ComObject ADODB.Connection
$conn.Open("Provider=Microsoft.ACE.OLEDB.12.0;Data Source='${ACCESS_FILE.replace(/'/g, "''")}'")
$rs = New-Object -ComObject ADODB.Recordset
$rs.CursorLocation = 3
$rs.Open("SELECT * FROM [${tableName}]", $conn, 3, 1)
if ($rs.RecordCount -gt 0 -and ${offset} -gt 0) { $rs.Move(${offset}) }
$count = 0
while ((-not $rs.EOF) -and ($count -lt ${batchSize})) {
  $row = @{}
  for ($i = 0; $i -lt $rs.Fields.Count; $i++) {
    $fname = $rs.Fields.Item($i).Name
    $fval  = $rs.Fields.Item($i).Value
    if ($fval -is [System.DateTime]) { $fval = $fval.ToString("yyyy-MM-dd") }
    elseif ($fval -is [System.DBNull]) { $fval = $null }
    elseif ($fval -is [System.Byte[]]) { $fval = $null }
    elseif ($fval -is [string]) { $fval = $fval -replace '[\\x00-\\x1f]', ' ' -replace '\\\\', '/' }
    $row[$fname] = $fval
  }
  $line = ($row | ConvertTo-Json -Depth 1 -Compress)
  Write-Output $line
  $count++
  $rs.MoveNext()
}
$rs.Close()
$conn.Close()
`;

    const tmpFile = path.join(
      os.tmpdir(),
      `epa_migrate_${tableName}_${offset}.ps1`,
    );
    try {
      fs.writeFileSync(tmpFile, psScript, "utf8");
      const result = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
        { maxBuffer: 50 * 1024 * 1024, encoding: "utf8", timeout: 180000 },
      );
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
      if (!result || result.trim() === "") {
        hasMore = false;
        break;
      }
      // Parse each line individually (JSONL)
      const lines = result.trim().split("\n");
      let batchCount = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed);
          allRows.push(obj);
          batchCount++;
        } catch {
          // Skip bad row
        }
      }
      console.log(`    Batch at offset ${offset}: ${batchCount} rows`);
      // Use total lines (including bad ones) to decide if more rows exist
      if (lines.filter((l) => l.trim()).length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    } catch (err) {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
      console.error(
        `  Error reading batch at offset ${offset}: ${err.message.substring(0, 200)}`,
      );
      hasMore = false;
    }
  }

  return allRows;
}

function getColumnsForTable(db, tableName) {
  const info = db.all(`PRAGMA table_info("${tableName}")`, []);
  return info.filter((c) => c.name !== "id").map((c) => c.name);
}

function migrateTable(db, tableName) {
  console.log(`\nMigrating: ${tableName}`);
  // Use batched reading for large tables (>500 expected rows)
  const largeTables = ["PERMIT"];
  const rows = largeTables.includes(tableName)
    ? readAccessTableBatched(tableName, 200)
    : readAccessTable(tableName);
  console.log(`  Read ${rows.length} rows from Access`);
  if (rows.length === 0) return;

  const sqliteCols = getColumnsForTable(db, tableName);
  const placeholders = sqliteCols.map(() => "?").join(",");
  const insertSql = `INSERT INTO "${tableName}" (${sqliteCols.map((c) => '"' + c + '"').join(",")}) VALUES (${placeholders})`;

  let imported = 0;
  for (const row of rows) {
    const values = sqliteCols.map((col) => {
      let accessCol = col;
      for (const [from, to] of Object.entries(COL_RENAMES)) {
        if (to === col) accessCol = from;
      }
      let val = row[accessCol];
      if (val === undefined) {
        const key = Object.keys(row).find(
          (k) => k.toLowerCase() === accessCol.toLowerCase(),
        );
        val = key ? row[key] : null;
      }
      if (val === undefined || val === null) return null;
      return val;
    });
    try {
      db.run(insertSql, values);
      imported++;
    } catch (e) {
      /* skip bad row */
    }
  }

  console.log(`  Imported ${imported} rows into SQLite`);
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("=== EPA Database Migration: Access -> SQLite ===");
  console.log(`Access file: ${ACCESS_FILE}`);

  const db = await initDatabase();

  for (const table of TABLES) {
    migrateTable(db, table);
  }

  saveToDisk();
  console.log("\n=== Migration complete! Data is in data/epa.db ===");
  console.log('Next: run "node create-admin.js" then "npm start"');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
