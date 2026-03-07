// create-admin.js — Create the initial admin user
// Run: node create-admin.js [username] [password] [fullName]

const bcrypt = require("bcryptjs");
const { initDatabase, getDb, saveToDisk } = require("./database");

async function main() {
  const username = process.argv[2] || "admin";
  const password = process.argv[3] || "admin123";
  const fullName = process.argv[4] || "Administrator";

  await initDatabase();
  const db = getDb();

  const hash = bcrypt.hashSync(password, 12);

  // Check if user exists
  const existing = db.get("SELECT id FROM app_users WHERE username = ?", [
    username,
  ]);
  if (existing) {
    db.run(
      "UPDATE app_users SET password_hash = ?, full_name = ?, role = ? WHERE username = ?",
      [hash, fullName, "admin", username],
    );
    console.log(`Admin user "${username}" updated.`);
  } else {
    db.run(
      "INSERT INTO app_users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
      [username, hash, fullName, "admin"],
    );
    console.log(`Admin user "${username}" created.`);
  }

  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);

  saveToDisk();
  console.log("\nYou can now start the server with: npm start");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
