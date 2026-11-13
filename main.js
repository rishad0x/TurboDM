import { app, BrowserWindow, ipcMain, dialog, shell, Notification, Tray, Menu, nativeImage, clipboard } from "electron";
import { join, dirname, basename, normalize } from "path";
import { fileURLToPath } from "url";
import os from "os";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { sanitizeFilename, validateSaveDirPath } from "./engine/taskValidation.js";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.platform === "win32") {
    app.setAppUserModelId("com.rishad.turbodm");
}

if (process.env.TURBODM_USER_DATA_DIR) {
    app.setPath("userData", process.env.TURBODM_USER_DATA_DIR);
}

process.env.TURBODM_BIN_DIR = app.isPackaged
    ? join(app.getPath("userData"), "bin")
    : join(__dirname, "bin");

let DownloadTask = null;
let TaskManager = null;
let CookieManager = null;
let ACCOUNT_ACCESS_NOTICE = "";
let SettingsStore = null;
let ytdlpHelper = null;

let mainWindow = null;
let taskManager = null;
let settingsStore = null;
let cookieManager = null;
let DownloadEngine = null;
let smartRouteMod = null;
let tray = null;
let isQuitting = false;
let trayNoticeShown = false;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on("second-instance", () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

const FALLBACK_SAVE_DIR = join(os.homedir(), "Downloads");
const storagePath = join(app.getPath("userData"), "tasks.json");
const settingsPath = join(app.getPath("userData"), "settings.json");
const cookiesDir = join(app.getPath("userData"), "cookie-profiles");

function getDefaultSaveDir() {
    try {
        const s = settingsStore?.getAll();
        if (s?.defaultSaveDir) return s.defaultSaveDir;
    } catch (_) {}
    return FALLBACK_SAVE_DIR;
}

function recordRecentSaveDir(dir) {
    try {
        settingsStore?.pushRecentSaveDir(normalize(String(dir)));
    } catch (_) {}
}

async function createWindow() {
    const isWindows = process.platform === "win32";
    const isMac = process.platform === "darwin";

    const appIconPath = (process.platform === "win32" && fs.existsSync(join(__dirname, "public", "icon.ico")))
        ? join(__dirname, "public", "icon.ico")
        : join(__dirname, "public", "icon.png");

            const reduceTransparency = settingsStore?.getAll()?.reduceTransparency === true;

    mainWindow = new BrowserWindow({
        width: 1160,
        height: 780,
        minWidth: 940,
        minHeight: 620,
        title: "TurboDM",
        icon: appIconPath,
        backgroundColor: "#00000000",
        backgroundMaterial: (isWindows && !reduceTransparency) ? "acrylic" : undefined,
        vibrancy: isMac ? "under-window" : undefined,
        frame: false,
        titleBarStyle: "hidden",
        titleBarOverlay: isWindows ? {
            color: "#00000000",
            symbolColor: "#f1f5f9",
            height: 38
        } : false,
        webPreferences: {
            preload: join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    mainWindow.loadFile(join(__dirname, "public", "index.html"));

    mainWindow.on("close", (e) => {
        const closeToTray = settingsStore?.getAll()?.closeToTray !== false;
        if (!isQuitting && closeToTray) {
            e.preventDefault();
            mainWindow.hide();
            if (process.platform === "win32" && !trayNoticeShown) {
                trayNoticeShown = true;
                if (Notification.isSupported()) {
                    new Notification({
                        title: "⚡ TurboDM Running in Background",
                        body: "TurboDM will continue active downloads in your system tray."
                    }).show();
                }
            }
        }
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

function createTray() {
    if (tray) return;

    const iconPath = join(__dirname, "public", "icon.png");
    let trayIcon = null;
    if (fs.existsSync(iconPath)) {
        trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    } else {
        trayIcon = nativeImage.createEmpty();
    }

    tray = new Tray(trayIcon);
    tray.setToolTip("TurboDM - Download Manager");

    const updateContextMenu = () => {
        const isAutoStart = app.getLoginItemSettings().openAtLogin;
        const contextMenu = Menu.buildFromTemplate([
            {
                label: "⚡ Show TurboDM",
                click: () => {
                    if (mainWindow) {
                        if (mainWindow.isMinimized()) mainWindow.restore();
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            {
                label: "➕ Add URL to Download…",
                click: () => {
                    if (mainWindow) {
                        if (mainWindow.isMinimized()) mainWindow.restore();
                        mainWindow.show();
                        mainWindow.focus();
                        mainWindow.webContents.send("action:open-add-modal");
                    }
                }
            },
            { type: "separator" },
            {
                label: "⏸️ Pause All Downloads",
                click: async () => {
                    if (taskManager) await taskManager.pauseAll();
                }
            },
            {
                label: "▶️ Resume All Downloads",
                click: async () => {
                    if (taskManager) await taskManager.resumeAll();
                }
            },
            { type: "separator" },
            {
                label: "🚀 Start TurboDM on System Boot",
                type: "checkbox",
                checked: isAutoStart,
                click: (menuItem) => {
                    app.setLoginItemSettings({
                        openAtLogin: menuItem.checked,
                        openAsHidden: true
                    });
                }
            },
            { type: "separator" },
            {
                label: "🚪 Exit TurboDM",
                click: () => {
                    isQuitting = true;
                    app.quit();
                }
            }
        ]);
        tray.setContextMenu(contextMenu);
    };

    updateContextMenu();

    tray.on("click", () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });

    tray.on("double-click", () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}


async function resolveCookieArgs(profileId) {
    if (!cookieManager) return { args: [], profile: null };
    if (profileId === "none") return { args: [], profile: null };
    if (!profileId) {
        const list = await cookieManager.listProfiles();
        if (!list.defaultProfileId && list.profiles.length === 1) {
            return cookieManager.resolveProfileArgs(list.profiles[0].id);
        }
    }
    return cookieManager.resolveProfileArgs(profileId ?? null);
}

function setupIPC() {
        ipcMain.handle("probe-url", async (_event, { url, cookieProfileId } = {}) => {
        try {
            if (!url) throw new Error("URL is required");
            const { args } = await resolveCookieArgs(cookieProfileId);
            return await DownloadTask.probeUrl(url, {}, args);
        } catch (err) {
            return {
                url,
                fileName: url?.split("/").filter(Boolean).pop() || "download.bin",
                totalSize: 0,
                supportsRange: true,
                error: err.message
            };
        }
    });

                    ipcMain.handle("route-url", async (_event, url) => {
        const noPopups = { cookie: false, quality: false };
        try {
            if (!url) return { engine: "http", reason: "no-url", popups: noPopups };
            const alwaysAsk = settingsStore ? settingsStore.getAll().alwaysAsk !== false : true;
            const result = await DownloadEngine.quickRoute(url);
            result.popups = smartRouteMod.popupsRequired({ engine: result.engine, alwaysAsk });
            return result;
        } catch (_) {
            return { engine: "http", reason: "error", popups: noPopups };
        }
    });

        ipcMain.handle("create-task", async (_event, data = {}) => {
        const task = await taskManager.createTask(data);
        return task.toJSON ? task.toJSON() : task;
    });

    ipcMain.handle("start-task", async (_event, id) => {
        try {
            return await taskManager.startTask(id);
        } catch (err) {
            console.error("Error starting task:", err);
            return null;
        }
    });

    ipcMain.handle("pause-task", async (_event, id) => {
        try {
            return await taskManager.pauseTask(id);
        } catch (err) {
            console.error("Error pausing task:", err);
            return null;
        }
    });

    ipcMain.handle("resume-task", async (_event, id) => {
        try {
            return await taskManager.resumeTask(id);
        } catch (err) {
            console.error("Error resuming task:", err);
            return null;
        }
    });

    ipcMain.handle("delete-task", async (_event, { id, deleteFile }) => {
        try {
            return await taskManager.deleteTask(id, deleteFile);
        } catch (err) {
            console.error("Error deleting task:", err);
            return { success: false };
        }
    });

    ipcMain.handle("get-all-tasks", () => {
        try {
            return taskManager.getAllTasks();
        } catch (err) {
            console.error("Error getting all tasks:", err);
            return [];
        }
    });

        ipcMain.handle("cookies:list", async () => {
        try {
            return { ok: true, ...(await cookieManager.listProfiles()) };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle("cookies:create-file", async (_event, { name, content }) => {
        try {
            return { ok: true, profile: await cookieManager.createFileProfile({ name, content }) };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle("cookies:create-browser", async (_event, { name, browserSpec }) => {
        try {
            return { ok: true, profile: await cookieManager.createBrowserProfile({ name, browserSpec }) };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle("cookies:import-file", async (_event, { name } = {}) => {
        try {
            const res = await dialog.showOpenDialog(mainWindow, {
                title: "Import cookies.txt",
                filters: [{ name: "Cookie files", extensions: ["txt"] }, { name: "All files", extensions: ["*"] }],
                properties: ["openFile"]
            });
            if (res.canceled || !res.filePaths.length) return { ok: false, canceled: true };
            const fallbackName = basename(res.filePaths[0]).replace(/\.[^.]+$/, "") || "Imported cookies";
            const profile = await cookieManager.importFileProfile({ name: name || fallbackName, sourcePath: res.filePaths[0] });
            return { ok: true, profile };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle("cookies:delete", async (_event, { id }) => {
        try {
            return { ok: true, ...(await cookieManager.deleteProfile(id)) };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle("cookies:rename", async (_event, { id, name }) => {
        try {
            return { ok: true, profile: await cookieManager.renameProfile(id, name) };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle("cookies:set-default", async (_event, { id }) => {
        try {
            return { ok: true, ...(await cookieManager.setDefaultProfile(id ?? null)) };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle("cookies:read", async (_event, { id }) => {
        try {
            return { ok: true, content: await cookieManager.readProfileContent(id) };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

        ipcMain.handle("settings:get", () => {
        return {
            settings: settingsStore.getAll(),
            cookiesNotice: ACCOUNT_ACCESS_NOTICE
        };
    });

    ipcMain.handle("settings:set", (_event, patch = {}) => {
        const updated = settingsStore.set(patch);
                if (taskManager) {
            taskManager.engine.maxConcurrent = updated.maxConcurrent;
            taskManager.defaultSaveDir = updated.defaultSaveDir || FALLBACK_SAVE_DIR;
        }
                        if (process.platform === "win32" && mainWindow && !mainWindow.isDestroyed() &&
            typeof mainWindow.setBackgroundMaterial === "function") {
            try {
                mainWindow.setBackgroundMaterial(updated.reduceTransparency ? "none" : "acrylic");
            } catch (_) {}
        }
        return updated;
    });

        ipcMain.handle("ytdlp:status", async () => {
        const info = await ytdlpHelper.getBinaryInfo();
        return { ...info, channel: settingsStore.getAll().ytdlpChannel, binDir: process.env.TURBODM_BIN_DIR };
    });

    ipcMain.handle("ytdlp:update", async () => {
        const channel = settingsStore.getAll().ytdlpChannel;
        return await ytdlpHelper.updateBinary(channel);
    });

    ipcMain.handle("bun:status", async () => {
        try {
            const { stdout } = await execFileAsync("bun", ["--version"]);
            return { available: true, version: stdout.trim() };
        } catch (err) {
            return { available: false, error: err.message };
        }
    });

    ipcMain.handle("bun:update", async () => {
        try {
            const { stdout, stderr } = await execFileAsync("bun", ["upgrade"]);
            const msg = (stdout || stderr || "Bun upgrade completed").trim();
            const { stdout: vOut } = await execFileAsync("bun", ["--version"]);
            return { success: true, message: msg, version: vOut.trim() };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

        ipcMain.handle("get-default-save-dir", () => {
        return getDefaultSaveDir();
    });

    ipcMain.handle("select-folder", async (_event, defaultPath) => {
        const res = await dialog.showOpenDialog(mainWindow, {
            title: "Select Download Destination Folder",
            defaultPath: defaultPath || getDefaultSaveDir(),
            properties: ["openDirectory", "createDirectory"]
        });
        if (res.canceled || !res.filePaths.length) return null;
        return res.filePaths[0];
    });

    function resolveActualFilePath(filePath) {
        if (!filePath) return null;
        if (fs.existsSync(filePath)) return filePath;

        const dir = dirname(filePath);
        if (!dir || !fs.existsSync(dir)) return null;

                const idMatch = /\[([a-zA-Z0-9_-]{6,15})\]/.exec(filePath);
        if (idMatch) {
            const id = idMatch[1];
            try {
                const files = fs.readdirSync(dir);
                const found = files.find(f => f.includes(`[${id}]`) && !f.endsWith(".part") && !f.endsWith(".ytdl"));
                if (found) return join(dir, found);
            } catch (_) {}
        }

                const base = basename(filePath).replace(/\.[^.]+$/, "");
        if (base && !base.includes("%(")) {
            try {
                const files = fs.readdirSync(dir);
                const found = files.find(f => f.startsWith(base) && !f.endsWith(".part") && !f.endsWith(".ytdl"));
                if (found) return join(dir, found);
            } catch (_) {}
        }

        return null;
    }

    ipcMain.handle("open-file", async (_event, filePath) => {
        const actual = resolveActualFilePath(filePath);
        if (actual && fs.existsSync(actual)) {
            await shell.openPath(actual);
            return { success: true, filePath: actual };
        }
        return { success: false, error: "File not found" };
    });

    ipcMain.handle("show-in-folder", async (_event, filePath) => {
        const actual = resolveActualFilePath(filePath);
        if (actual && fs.existsSync(actual)) {
            shell.showItemInFolder(actual);
            return { success: true, filePath: actual };
        }
        if (filePath) {
            const dir = dirname(filePath);
            if (fs.existsSync(dir)) {
                await shell.openPath(dir);
                return { success: true, dir };
            }
        }
        return { success: false, error: "Path not found" };
    });

    ipcMain.handle("open-external", async (_event, url) => {
        if (url) {
            await shell.openExternal(url);
            return { success: true };
        }
        return { success: false };
    });

    ipcMain.handle("clipboard:read-text", () => {
        try {
            return clipboard.readText();
        } catch (_) {
            return "";
        }
    });

        ipcMain.handle("window-minimize", () => {
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.handle("window-maximize", () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.handle("window-close", () => {
        if (mainWindow) {
            const closeToTray = settingsStore?.getAll()?.closeToTray !== false;
            if (closeToTray) {
                mainWindow.hide();
            } else {
                mainWindow.close();
            }
        }
    });

    ipcMain.handle("set-title-bar-overlay", (_event, options) => {
        if (mainWindow && typeof mainWindow.setTitleBarOverlay === "function" && options) {
            try {
                mainWindow.setTitleBarOverlay(options);
                return { success: true };
            } catch (_) {}
        }
        return { success: false };
    });
}

function bindTaskManagerEvents() {
    taskManager.on("taskState", (state) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("task-state", state);
        }
    });

    taskManager.on("segmentUpdate", (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("segment-update", data);
        }
    });

    taskManager.on("taskCompleted", (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("task-completed", data);
        }

                if (Notification.isSupported()) {
            new Notification({
                title: "⚡ Download Completed",
                body: `${data.fileName} (${((data.size || 0) / (1024 * 1024)).toFixed(1)} MB)`
            }).show();
        }
    });

    taskManager.on("taskError", (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("task-error", data);
        }
    });
}

function showMainWindow() {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
}

async function initEngine() {
        const engineMod = await import("./engine/downloadEngine.js");
    const taskMod = await import("./engine/taskManager.js");
    const cookieMod = await import("./engine/cookieManager.js");
    const settingsMod = await import("./engine/settings.js");
    smartRouteMod = await import("./engine/smartRoute.js");
    ytdlpHelper = await import("./engine/ytdlp.js");

    DownloadTask = engineMod.DownloadTask;
    DownloadEngine = engineMod.DownloadEngine;
    TaskManager = taskMod.TaskManager;
    CookieManager = cookieMod.CookieManager;
    ACCOUNT_ACCESS_NOTICE = cookieMod.ACCOUNT_ACCESS_NOTICE;
    SettingsStore = settingsMod.SettingsStore;

    settingsStore = new SettingsStore(settingsPath, { defaultSaveDir: FALLBACK_SAVE_DIR });
    await settingsStore.init();

    cookieManager = new CookieManager(cookiesDir);
    await cookieManager.init();

    const settings = settingsStore.getAll();
    taskManager = new TaskManager({
        storagePath,
        defaultSaveDir: settings.defaultSaveDir || FALLBACK_SAVE_DIR,
        maxConcurrent: settings.maxConcurrent,
        cookieResolver: resolveCookieArgs,
        sessionJarCreator: (targetUrl, cookieHeader) => cookieManager.createSessionJar(targetUrl, cookieHeader)
    });
    await taskManager.init();
}


function maybeAutoUpdateYtdlp() {
    try {
        const { autoUpdateYtdlp, ytdlpChannel } = settingsStore.getAll();
        if (!autoUpdateYtdlp) return;
        ytdlpHelper.updateBinary(ytdlpChannel || "stable").catch(() => {});
    } catch (_) {}
}

app.whenReady().then(async () => {
    await initEngine();

    setupIPC();
    bindTaskManagerEvents();
    await createWindow();
    createTray();
    maybeAutoUpdateYtdlp();

    app.on("activate", () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        } else {
            createWindow();
        }
    });
});

app.on("before-quit", () => {
    isQuitting = true;
            try { taskManager?.engine?.persist(); } catch (_) {}
});

app.on("window-all-closed", (e) => {
        if (process.platform === "darwin") {
            }
});
