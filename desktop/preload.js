/**
 * Preload – Secure IPC bridge between main & renderer
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desierAPI", {
    getToken: () => ipcRenderer.invoke("get-token"),
    setToken: (token) => ipcRenderer.invoke("set-token", token),
    setFocusable: (focused) => ipcRenderer.invoke("set-focusable", focused),
    openExternal: (url) => ipcRenderer.invoke("open-external", url)
});
