// Minimal preload: tell the web app it is running inside the desktop shell.
// No Node APIs are exposed to the page.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("inteflow", {
  desktop: true,
  platform: process.platform,
  electron: process.versions.electron,
  // Settings → Reset local data. The main process shows the confirmation,
  // wipes the app-data folder and restarts; it never exposes fs/ipc directly.
  resetData: () => ipcRenderer.invoke("inteflow:reset-data"),
});
