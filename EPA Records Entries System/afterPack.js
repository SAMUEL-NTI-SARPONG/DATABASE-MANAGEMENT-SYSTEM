// afterPack hook for electron-builder
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

exports.default = async function (context) {
  const appDir = path.join(context.appOutDir, "resources", "app");
  console.log("afterPack: Running npm install --omit=dev in", appDir);
  const pkgPath = path.join(appDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.log("afterPack: No package.json found, skipping");
    return;
  }
  const nmDir = path.join(appDir, "node_modules");
  if (fs.existsSync(nmDir)) {
    fs.rmSync(nmDir, { recursive: true, force: true });
    console.log("afterPack: Removed incomplete node_modules");
  }
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
