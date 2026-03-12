// electron-main.js — EPA Records Entries System Electron Wrapper
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

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const APP_DIR = path.join(app.getPath("userData"), "epa-records-data");
if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });
process.env.EPA_APP_ROOT = APP_DIR;

const destDataDir = path.join(APP_DIR, "data");
if (!fs.existsSync(destDataDir)) fs.mkdirSync(destDataDir, { recursive: true });

let mainWindow = null;
let tray = null;
const PORT = 3001;
process.env.PORT = PORT;

function getIconPath() {
  const icoPath = path.join(__dirname, "build", "icon.ico");
  if (fs.existsSync(icoPath)) return icoPath;
  const pngPath = path.join(__dirname, "public", "epa logo.png");
  if (fs.existsSync(pngPath)) return pngPath;
  return null;
}

function createWindow() {
  const iconPath = getIconPath();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "EPA Records Entries System",
    icon: iconPath || undefined,
    backgroundColor: "#0d1117",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  const menuTemplate = [
    {
      label: "File",
      submenu: [
        {
          label: "Open in Browser",
          click: () => shell.openExternal(`http://localhost:${PORT}`),
        },
        { type: "separator" },
        { label: "Open Data Folder", click: () => shell.openPath(APP_DIR) },
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
          label: "About",
          click: () => {
            let version = "1.0";
            try {
              const pkg = JSON.parse(
                fs.readFileSync(path.join(__dirname, "package.json"), "utf8"),
              );
              version = pkg.version || version;
            } catch (e) {}
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About EPA Records Entries System",
              message: `EPA Records Entries System v${version}`,
              detail:
                "Environmental Protection Agency\nRecords Entries Management System\n\n© 2026 EPA Ghana",
              buttons: ["OK"],
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

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
    tray.setToolTip("EPA Records Entries System");
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Open EPA Records",
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
      } else createWindow();
    });
  } catch (e) {
    console.error("Tray creation failed:", e.message);
  }
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    const server = require("./server");
    await server.start();
    createWindow();
    createTray();
  } catch (err) {
    console.error("Failed to start:", err);
    dialog.showErrorBox("Startup Error", err.message);
    app.quit();
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
  try {
    require("./database").saveToDisk();
  } catch (e) {}
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Keep running in tray
  }
});
