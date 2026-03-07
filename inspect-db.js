const MdbReader = require("mdb-reader").default;
const fs = require("fs");

const buf = fs.readFileSync("The Database.accdb");
const db = new MdbReader(buf);

const tables = db.getTableNames();
const result = {};

for (const tableName of tables) {
  try {
    const table = db.getTable(tableName);
    const columns = table.getColumns();
    const data = table.getData();

    const tableInfo = {
      rowCount: data.length,
      columns: {},
    };

    for (const col of columns) {
      const colName = col.name;
      const distinctValues = [
        ...new Set(
          data
            .map((row) => row[colName])
            .filter((v) => v !== null && v !== undefined && v !== ""),
        ),
      ];

      const colInfo = {
        type: col.type,
        distinctCount: distinctValues.length,
      };

      if (distinctValues.length <= 50) {
        colInfo.distinctValues = distinctValues.sort((a, b) => {
          if (typeof a === "string" && typeof b === "string")
            return a.localeCompare(b);
          if (a < b) return -1;
          if (a > b) return 1;
          return 0;
        });
      }

      tableInfo.columns[colName] = colInfo;
    }

    result[tableName] = tableInfo;
  } catch (e) {
    result[tableName] = { error: e.message };
  }
}

// Print with no truncation
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
