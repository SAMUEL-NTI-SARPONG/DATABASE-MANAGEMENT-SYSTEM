// electron-main.js — EPA Database System Electron Wrapper
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  dialog,
  shell,
  nativeImage,
} = require("electron");
const path = require("path");
const fs = require("fs");

// ── Ensure single instance ───────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// ── Paths ────────────────────────────────────────────────────
const APP_DIR = path.join(app.getPath("userData"), "epa-data");
if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });

// Set APP_ROOT so server.js stores data in the user's AppData folder
process.env.EPA_APP_ROOT = APP_DIR;

// Ensure data directory exists (database is created fresh by database.js if not present)
const destDataDir = path.join(APP_DIR, "data");
if (!fs.existsSync(destDataDir)) {
  fs.mkdirSync(destDataDir, { recursive: true });
}

let mainWindow = null;
let tray = null;
let serverInstance = null;
const PORT = 3000;

// ── Get app icon ─────────────────────────────────────────────
function getIconPath() {
  const icoPath = path.join(__dirname, "build", "icon.ico");
  if (fs.existsSync(icoPath)) return icoPath;
  const pngPath = path.join(__dirname, "public", "epa logo.png");
  if (fs.existsSync(pngPath)) return pngPath;
  return null;
}

// ── Create the main window ───────────────────────────────────
function createWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "EPA Database System",
    icon: iconPath || undefined,
    backgroundColor: "#0d1117",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Custom menu bar
  const menuTemplate = [
    {
      label: "File",
      submenu: [
        {
          label: "Open in Browser",
          click: () => shell.openExternal(`http://localhost:${PORT}`),
        },
        { type: "separator" },
        {
          label: "Open Data Folder",
          click: () => shell.openPath(APP_DIR),
        },
        { type: "separator" },
        { label: "Quit", accelerator: "CmdOrCtrl+Q", click: () => app.quit() },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow.reload(),
        },
        {
          label: "Toggle Full Screen",
          accelerator: "F11",
          click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()),
        },
        { type: "separator" },
        {
          label: "Zoom In",
          accelerator: "CmdOrCtrl+=",
          click: () =>
            mainWindow.webContents.setZoomLevel(
              mainWindow.webContents.getZoomLevel() + 0.5,
            ),
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          click: () =>
            mainWindow.webContents.setZoomLevel(
              mainWindow.webContents.getZoomLevel() - 0.5,
            ),
        },
        {
          label: "Reset Zoom",
          accelerator: "CmdOrCtrl+0",
          click: () => mainWindow.webContents.setZoomLevel(0),
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Check for Updates...",
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
              mainWindow.loadURL(`http://localhost:${PORT}/#update`);
            }
          },
        },
        { type: "separator" },
        {
          label: "About",
          click: () => {
            let version = "4.0";
            try {
              const pkg = JSON.parse(
                fs.readFileSync(path.join(__dirname, "package.json"), "utf8"),
              );
              version = pkg.version || version;
            } catch (e) {}
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About EPA Database System",
              message: `EPA Database System v${version}`,
              detail:
                "Environmental Protection Agency\nDatabase Management System\n\n© 2026 EPA Ghana\n\nClients can connect by opening this computer's IP address in their browser.",
              buttons: ["OK"],
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  // Minimize to tray on close
  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── System tray ──────────────────────────────────────────────
function createTray() {
  const iconPath = getIconPath();
  if (!iconPath) return;

  try {
    let trayIcon;
    if (iconPath.endsWith(".ico")) {
      trayIcon = nativeImage.createFromPath(iconPath);
    } else {
      trayIcon = nativeImage
        .createFromPath(iconPath)
        .resize({ width: 16, height: 16 });
    }

    tray = new Tray(trayIcon);
    tray.setToolTip("EPA Database System");

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Open EPA Database",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else createWindow();
        },
      },
      { type: "separator" },
      {
        label: "Open in Browser",
        click: () => shell.openExternal(`http://localhost:${PORT}`),
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);

    tray.on("double-click", () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    });
  } catch (e) {
    console.error("Tray creation failed:", e.message);
  }
}

// ── App lifecycle ────────────────────────────────────────────
app.on("ready", async () => {
  try {
    // Start Express server
    const { start } = require("./server");
    serverInstance = await start();
    console.log("EPA Server started on port", PORT);
  } catch (err) {
    console.error("Failed to start server:", err);
    dialog.showErrorBox(
      "Startup Error",
      `Failed to start the EPA server:\n${err.message}\n\nThe application will close.`,
    );
    app.quit();
    return;
  }

  createWindow();
  createTray();
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on("window-all-closed", () => {
  // Don't quit on macOS unless explicitly quitting
  if (process.platform !== "darwin") {
    // Keep running in tray
  }
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  // Save database before exit
  try {
    const { saveToDisk } = require("./database");
    saveToDisk();
  } catch (e) {
    console.error("Error saving database on quit:", e.message);
  }
  // Close the Express server
  if (serverInstance) {
    try {
      serverInstance.close();
    } catch (e) {}
  }
});
