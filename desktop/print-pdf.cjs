// Chromium PDF renderer.
//
// Two entry points:
//   * The Electron main process requires this file and calls printHtmlFile()
//     for the local PDF bridge used by the Python exporters.
//   * For manual testing it can be run as a CLI:
//       electron print-pdf.cjs <input.html> <output.pdf>

const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");

/** Render a local HTML file to a PDF Buffer. Requires app.whenReady(). */
async function printHtmlFile(htmlPath) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  try {
    await win.loadFile(htmlPath);
    // Give fonts/images one frame to settle before printing.
    await new Promise((resolve) => setTimeout(resolve, 250));
    return await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    win.destroy();
  }
}

/** Render an HTML string via a temporary file. */
async function printHtmlString(html) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "inteflow-pdf-"));
  const input = path.join(profile, "export.html");
  fs.writeFileSync(input, html, "utf-8");
  try {
    return await printHtmlFile(input);
  } finally {
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}

module.exports = { printHtmlFile, printHtmlString };

if (require.main === module) {
  const [htmlPath, pdfPath] = process.argv.slice(-2);
  if (!htmlPath || !pdfPath || !fs.existsSync(htmlPath)) {
    console.error("usage: print-pdf.cjs <input.html> <output.pdf>");
    app.exit(1);
  } else {
    app.whenReady().then(async () => {
      if (app.dock) app.dock.hide();
      try {
        const pdf = await printHtmlFile(htmlPath);
        fs.writeFileSync(pdfPath, pdf);
        app.exit(0);
      } catch (error) {
        console.error(`[print-pdf] ${error}`);
        app.exit(1);
      }
    });
  }
}
