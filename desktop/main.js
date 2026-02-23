/**
 * DesierAI Desktop – Main Process
 *
 * Creates a screen-share-safe overlay window that is INVISIBLE
 * to all screen capture software (Zoom, Meet, Teams, OBS, etc.)
 *
 * STEALTH features:
 * - setContentProtection(true) → invisible to screen capture
 * - app.dock.hide() → no dock icon, no app switcher entry
 * - "panel" level → doesn't grey out other windows' traffic lights
 */

const {
    app,
    BrowserWindow,
    globalShortcut,
    Tray,
    Menu,
    ipcMain,
    nativeImage,
    screen,
    shell
} = require("electron");
const path = require("path");

let overlayWindow = null;
let tray = null;
let isVisible = true;

// ── Create the invisible overlay window ──────────
function createOverlay() {
    const { width } = screen.getPrimaryDisplay().workAreaSize;

    overlayWindow = new BrowserWindow({
        width: 420,
        height: 560,
        x: width - 440,
        y: 80,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        movable: true,
        hasShadow: false,
        // These two together allow typing WITHOUT stealing app-level focus
        // Default: false to prevent focus-stealing on click (header/body)
        focusable: false,
        // We toggle this via IPC when inputs are clicked
        acceptFirstMouse: true,
        type: "panel", // macOS panel — doesn't deactivate other apps
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    overlayWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

    // ★ Invisible to screen capture ★
    overlayWindow.setContentProtection(true);

    // Prevent appearing in Mission Control / Exposé
    overlayWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
    });

    // "pop-up-menu" level keeps it on top without activating the app
    overlayWindow.setAlwaysOnTop(true, "pop-up-menu", 1);

    overlayWindow.on("closed", () => {
        overlayWindow = null;
    });
}

// ── System Tray ──────────────────────────────────
function createTray() {
    const icon = nativeImage.createFromPath(
        path.join(__dirname, "tray-icon.png")
    );
    const resized = icon.resize({ width: 16, height: 16 });

    tray = new Tray(resized);
    tray.setToolTip("DesierAI");

    const contextMenu = Menu.buildFromTemplate([
        {
            label: "Show / Hide  (⌘⇧D)",
            click: toggleOverlay,
        },
        { type: "separator" },
        {
            label: "Quit DesierAI",
            click: () => app.quit(),
        },
    ]);

    tray.setContextMenu(contextMenu);
    tray.on("click", toggleOverlay);
}

// ── Toggle overlay visibility ────────────────────
function toggleOverlay() {
    if (!overlayWindow) return;

    if (isVisible) {
        overlayWindow.hide();
    } else {
        overlayWindow.showInactive(); // Show WITHOUT activating/focusing
    }
    isVisible = !isVisible;
}

// ── App lifecycle ────────────────────────────────
app.whenReady().then(() => {
    // ★ STEALTH: Hide dock icon — no trace in dock or Cmd+Tab ★
    if (app.dock) app.dock.hide();

    createOverlay();
    // STEALTH: Top menu bar Tray icon is disabled for perfect invisibility
    // createTray();

    globalShortcut.register("CommandOrControl+Shift+D", toggleOverlay);
    globalShortcut.register("CommandOrControl+Shift+Q", () => app.quit()); // Secret quit button

    console.log("✅ DesierAI Desktop running (PERFECT stealth mode)");
    console.log("   Cmd+Shift+D to toggle overlay");
    console.log("   Cmd+Shift+Q to FULLY QUIT the app");
    console.log("   No tray icon • No dock icon • No app switcher entry");
    console.log("   Invisible to screen sharing");
});

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
    // Don't quit — keep in tray
});

// ── IPC handlers ─────────────────────────────────
ipcMain.handle("get-token", () => global.authToken || null);

ipcMain.handle("set-token", (_event, token) => {
    global.authToken = token;
    return true;
});

ipcMain.handle("set-focusable", (_event, focused) => {
    if (overlayWindow) {
        overlayWindow.setFocusable(focused);
    }
    return true;
});

ipcMain.handle("open-external", (_event, url) => {
    shell.openExternal(url);
    return true;
});
