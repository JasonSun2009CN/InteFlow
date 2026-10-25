// InteFlow desktop shell (Electron).
//
// Responsibilities:
//   1. Start the bundled FastAPI backend on a free localhost port.
//   2. Wait until /api/health answers.
//   3. Show the existing React UI from the bundled frontend build.
//   4. Stop the backend when the app quits.
//
// Nothing in the web app is replaced: the window loads the same UI, the same
// API and all export/download paths still work (Chromium handles downloads).

const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell } = require("electron");
const { spawn, spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");

const isDev = !app.isPackaged;
const isSmoke = process.env.INTEFLOW_SMOKE === "1";
const REPO = path.join(__dirname, "..");

app.setName("InteFlow");
app.setPath("userData", path.join(app.getPath("appData"), "InteFlow"));

let mainWindow = null;
let backend = null;
let backendPort = null;
let logStream = null;
let pdfBridge = null;
let quitting = false;

function fatal(title, message) {
  const text = `[inteflow] ${title}: ${message}`;
  console.error(text);
  if (isSmoke) {
    app.exit(1);
    return;
  }
  dialog.showErrorBox(title, message);
  app.exit(1);
}

// --------------------------------------------------------------------------
// paths
// --------------------------------------------------------------------------

function resourcesDir() {
  return app.isPackaged ? process.resourcesPath : path.join(REPO, "desktop", "build");
}

function backendExecutable() {
  const name = process.platform === "win32" ? "inteflow-backend.exe" : "inteflow-backend";
  const packaged = path.join(resourcesDir(), "backend", name);
  if (app.isPackaged) return packaged;

  const local = path.join(REPO, "desktop", "backend-dist", "inteflow-backend", name);
  return fs.existsSync(local) ? local : null;
}

function webDir() {
  return app.isPackaged
    ? path.join(resourcesDir(), "web")
    : path.join(REPO, "frontend", "dist");
}

function mathjaxDir() {
  return app.isPackaged
    ? path.join(resourcesDir(), "mathjax")
    : path.join(REPO, "backend", "app", "export", "mathjax");
}

function tesseractBinary() {
  const suffix = process.platform === "win32" ? ".exe" : "";
  const candidates = [
    path.join(resourcesDir(), "tesseract", "bin", `tesseract${suffix}`),
    path.join(resourcesDir(), "tesseract", `tesseract${suffix}`),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function userDataDir() {
  return app.getPath("userData");
}

// --------------------------------------------------------------------------
// backend process
// --------------------------------------------------------------------------

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/**
 * Local HTTP endpoint the Python exporters call to turn HTML into PDF.
 *
 * Spawning a second copy of the Electron binary does not work in a packaged
 * app (it re-runs app.asar instead of the passed script), so rendering happens
 * in this process with a hidden BrowserWindow.
 */
function startPdfBridge() {
  const helperPath = app.isPackaged
    ? path.join(process.resourcesPath, "print-pdf.cjs")
    : path.join(__dirname, "print-pdf.cjs");
  const { printHtmlString } = require(helperPath);
  const token = crypto.randomBytes(16).toString("hex");
  let queue = Promise.resolve();

  const server = http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== `/render-pdf?token=${token}`) {
      res.writeHead(404);
      res.end();
      return;
    }
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const html = Buffer.concat(chunks).toString("utf8");
      const job = queue.then(() => printHtmlString(html));
      queue = job.catch(() => {});
      job
        .then((pdf) => {
          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Length": pdf.length,
          });
          res.end(pdf);
        })
        .catch((error) => {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end(String(error));
        });
    });
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      pdfBridge = server;
      const url = `http://127.0.0.1:${server.address().port}/render-pdf?token=${token}`;
      console.error(`[inteflow] pdf-bridge=${url}`);
      resolve(url);
    });
  });
}

function stopPdfBridge() {
  const server = pdfBridge;
  pdfBridge = null;
  if (server) server.close();
}

function openLog() {
  const dir = path.join(userDataDir(), "logs");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "backend.log");
  try {
    if (fs.statSync(file).size > 5 * 1024 * 1024) fs.renameSync(file, `${file}.1`);
  } catch {
    /* no log yet */
  }
  logStream = fs.createWriteStream(file, { flags: "a" });
  return file;
}

function backendEnv(port, logFile, pdfBridgeUrl) {
  const env = {
    ...process.env,
    INTEFLOW_PORT: String(port),
    // Keep /api/health in sync with the installer version that electron-builder
    // stamped into package.json (the CI tag step writes it).
    INTEFLOW_VERSION: app.getVersion(),
    INTEFLOW_DATA: path.join(userDataDir(), "data"),
    INTEFLOW_STATIC_DIR: webDir(),
    INTEFLOW_MATHJAX_DIR: mathjaxDir(),
    INTEFLOW_NODE: process.execPath,
    INTEFLOW_PDF_BRIDGE: pdfBridgeUrl,
    // Only inherited by the `node` child, where the Electron binary acts as
    // Node. Python itself ignores it.
    ELECTRON_RUN_AS_NODE: "1",
    PYTHONUNBUFFERED: "1",
    PYTHONIOENCODING: "utf-8",
    INTEFLOW_LOG: logFile,
  };

  const dictDir = path.join(userDataDir(), "dictionary");
  fs.mkdirSync(dictDir, { recursive: true });
  env.INTEFLOW_DICTIONARY = dictDir;

  const tesseract = tesseractBinary();
  if (tesseract) env.INTEFLOW_TESSERACT = tesseract;

  return env;
}

async function startBackend(pdfBridgeUrl) {
  backendPort = await findFreePort();
  const logFile = openLog();
  const exe = backendExecutable();
  console.error(`[inteflow] backend=${exe || "dev-python"} port=${backendPort}`);

  const log = (line) => {
    if (logStream) logStream.write(line);
    if (isDev) process.stdout.write(line);
  };

  if (exe) {
    backend = spawn(exe, [], {
      cwd: path.dirname(exe),
      env: backendEnv(backendPort, logFile, pdfBridgeUrl),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } else if (isDev) {
    // Dev convenience: use the repository virtualenv instead of a frozen build.
    const py =
      process.platform === "win32"
        ? path.join(REPO, ".venv", "Scripts", "python.exe")
        : path.join(REPO, ".venv", "bin", "python");
    if (!fs.existsSync(py)) {
      throw new Error(
        "No backend binary and no .venv found. Run desktop/build_backend.py first.",
      );
    }
    backend = spawn(
      py,
      [
        "-m", "uvicorn", "app.main:app",
        "--app-dir", path.join(REPO, "backend"),
        "--host", "127.0.0.1",
        "--port", String(backendPort),
      ],
      {
        cwd: REPO,
        env: backendEnv(backendPort, logFile, pdfBridgeUrl),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
  } else {
    throw new Error("The bundled backend executable is missing.");
  }

  backend.stdout.on("data", (chunk) => log(chunk.toString()));
  backend.stderr.on("data", (chunk) => log(chunk.toString()));
  backend.on("error", (error) => {
    log(`\n[backend spawn error: ${error}]\n`);
    fatal("InteFlow backend failed to start", String(error));
  });
  backend.on("exit", (code, signal) => {
    log(`\n[backend exited code=${code} signal=${signal}]\n`);
    backend = null;
    if (!quitting) {
      fatal(
        "InteFlow backend stopped",
        `The local backend exited unexpectedly (code ${code ?? "?"}).\n\n` +
          `Log file:\n${logFile}`,
      );
    }
  });

  await waitForBackend(backendPort);
  return logFile;
}

async function waitForBackend(port, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  const url = `http://127.0.0.1:${port}/api/health`;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Backend did not become healthy at ${url}: ${lastError}`);
}

function stopBackend() {
  const child = backend;
  backend = null;
  if (!child || child.killed) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* already gone */
        }
      }, 3000).unref();
    }
  } catch {
    /* best effort */
  }
}

/** Stop the backend and wait until it is really gone (used before wiping data). */
function stopBackendAndWait(timeoutMs = 5000) {
  const child = backend;
  backend = null;
  if (!child || child.killed) return Promise.resolve();
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    // Give Windows a moment to release the backend's file handles before the
    // caller deletes the data folder.
    return new Promise((resolve) => setTimeout(resolve, 500));
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
      finish();
    }, timeoutMs);
    child.once("exit", finish);
    try {
      child.kill("SIGTERM");
    } catch {
      finish();
    }
  });
}

/**
 * Wipe user data and restart into a first-run state.
 *
 * The bundled app itself contains no user data; this only clears what this
 * machine accumulated under app.getPath("userData"). Dictionary source files
 * (.eudb) are deliberately kept: they are user-supplied reference material,
 * not app state, and the derived index lives in data/ and is rebuilt on demand.
 */
async function resetLocalData() {
  if (!mainWindow) return { ok: false, cancelled: true };
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Reset InteFlow data",
    message: "Remove all local data and restart InteFlow?",
    detail:
      "This deletes the database, imported documents, analyses, vocabulary, " +
      "exports, settings and window preferences. Dictionary source files in the " +
      "dictionary folder are kept. This cannot be undone.",
    buttons: ["Cancel", "Reset and restart"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (response !== 1) return { ok: false, cancelled: true };

  quitting = true;
  await stopBackendAndWait();

  // Theme / language / sidebar / layout preferences live in the Electron
  // profile, not in the Python data directory.
  try {
    if (session.defaultSession) {
      await session.defaultSession.clearStorageData();
      await session.defaultSession.clearCache();
    }
  } catch (error) {
    console.error(`[inteflow] could not clear web storage: ${error}`);
  }

  try {
    if (logStream) {
      logStream.end();
      logStream = null;
    }
  } catch {
    /* best effort */
  }

  for (const name of ["data", "logs"]) {
    try {
      fs.rmSync(path.join(userDataDir(), name), { recursive: true, force: true });
    } catch (error) {
      console.error(`[inteflow] could not remove ${name}: ${error}`);
    }
  }

  app.relaunch();
  app.exit(0);
  return { ok: true };
}

// --------------------------------------------------------------------------
// window / menu
// --------------------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    backgroundColor: "#f4f1e8",
    title: "InteFlow",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const url = process.env.INTEFLOW_DEV_URL || `http://127.0.0.1:${backendPort}`;
  console.error(`[inteflow] loading ${url}`);
  mainWindow.loadURL(url).catch((error) => {
    fatal("InteFlow failed to load", String(error));
  });

  mainWindow.once("ready-to-show", () => {
    if (!isSmoke) mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/i.test(target)) shell.openExternal(target);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-finish-load", async () => {
    if (!isSmoke) return;
    try {
      const info = await mainWindow.webContents.executeJavaScript(
        `({ title: document.title, rootChildren: document.querySelector('#root')?.childElementCount ?? -1, resetBridge: typeof window.inteflow?.resetData === 'function' })`,
      );
      console.log(`INTEFLOW_SMOKE_OK ${JSON.stringify(info)}`);
      quitting = true;
      stopBackend();
      stopPdfBridge();
      app.exit(0);
    } catch (error) {
      console.error(`INTEFLOW_SMOKE_FAIL ${error}`);
      app.exit(1);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const template = [
    ...(process.platform === "darwin"
      ? [{
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        }]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Open data folder",
          click: () => shell.openPath(path.join(userDataDir(), "data")),
        },
        {
          label: "Open dictionary folder",
          click: () => shell.openPath(path.join(userDataDir(), "dictionary")),
        },
        {
          label: "Show backend log",
          click: () => shell.showItemInFolder(path.join(userDataDir(), "logs", "backend.log")),
        },
        { type: "separator" },
        {
          label: "Reset local data…",
          click: () => void resetLocalData(),
        },
        { type: "separator" },
        { role: process.platform === "darwin" ? "close" : "quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Project on GitHub",
          click: () => shell.openExternal("https://github.com/JasonSun2009CN/InteFlow"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --------------------------------------------------------------------------
// lifecycle
// --------------------------------------------------------------------------

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  ipcMain.handle("inteflow:reset-data", async () => resetLocalData());

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      const bridgeUrl = await startPdfBridge();
      await startBackend(bridgeUrl);
      buildMenu();
      createWindow();
      if (isSmoke) {
        setTimeout(() => {
          console.error("INTEFLOW_SMOKE_FAIL timeout");
          app.exit(1);
        }, 120000).unref();
      }
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    } catch (error) {
      fatal("InteFlow could not start", String(error));
    }
  });

  app.on("window-all-closed", () => app.quit());

  app.on("before-quit", () => {
    quitting = true;
    stopBackend();
    stopPdfBridge();
  });
}
