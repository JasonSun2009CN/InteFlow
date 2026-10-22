// Minimal preload: tell the web app it is running inside the desktop shell.
// No Node APIs are exposed to the page.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("inteflow", {
  desktop: true,
  platform: process.platform,
  electron: process.versions.electron,
});
