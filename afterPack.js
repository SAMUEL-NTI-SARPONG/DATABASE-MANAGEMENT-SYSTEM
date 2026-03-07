// afterPack hook for electron-builder
// Ensures all production dependencies are properly installed in the packaged app
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

exports.default = async function (context) {
  const appDir = path.join(context.appOutDir, "resources", "app");
  console.log("afterPack: Running npm install --omit=dev in", appDir);

  // Ensure package.json exists in the app dir
  const pkgPath = path.join(appDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.log("afterPack: No package.json found, skipping");
    return;
  }

  // Remove the incomplete node_modules that electron-builder created
  const nmDir = path.join(appDir, "node_modules");
  if (fs.existsSync(nmDir)) {
    fs.rmSync(nmDir, { recursive: true, force: true });
    console.log("afterPack: Removed incomplete node_modules");
  }

  // Run a fresh npm install --omit=dev to get all production dependencies
  try {
    execSync("npm install --omit=dev --ignore-scripts", {
      cwd: appDir,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    });
    console.log("afterPack: Production dependencies installed successfully");
  } catch (err) {
    console.error("afterPack: Failed to install dependencies:", err.message);
    throw err;
  }
};
