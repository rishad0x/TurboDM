import { contextBridge, ipcRenderer } from "electron";

const api = {

    probeUrl: (url, cookieProfileId = null) => ipcRenderer.invoke("probe-url", { url, cookieProfileId }),
    routeUrl: (url) => ipcRenderer.invoke("route-url", url),

    createTask: (data) => ipcRenderer.invoke("create-task", data),
    startTask: (id) => ipcRenderer.invoke("start-task", id),
    pauseTask: (id) => ipcRenderer.invoke("pause-task", id),
    resumeTask: (id) => ipcRenderer.invoke("resume-task", id),
    deleteTask: (id, deleteFile) => ipcRenderer.invoke("delete-task", { id, deleteFile }),
    getAllTasks: () => ipcRenderer.invoke("get-all-tasks"),

    cookiesList: () => ipcRenderer.invoke("cookies:list"),
    cookiesCreateFile: (name, content) => ipcRenderer.invoke("cookies:create-file", { name, content }),
    cookiesCreateBrowser: (name, browserSpec) => ipcRenderer.invoke("cookies:create-browser", { name, browserSpec }),
    cookiesImportFile: (name) => ipcRenderer.invoke("cookies:import-file", { name }),
    cookiesDelete: (id) => ipcRenderer.invoke("cookies:delete", { id }),
    cookiesRename: (id, name) => ipcRenderer.invoke("cookies:rename", { id, name }),
    cookiesSetDefault: (id) => ipcRenderer.invoke("cookies:set-default", { id }),
    cookiesRead: (id) => ipcRenderer.invoke("cookies:read", { id }),

    settingsGet: () => ipcRenderer.invoke("settings:get"),
    settingsSet: (patch) => ipcRenderer.invoke("settings:set", patch),

    ytdlpStatus: () => ipcRenderer.invoke("ytdlp:status"),
    ytdlpUpdate: () => ipcRenderer.invoke("ytdlp:update"),
    bunStatus: () => ipcRenderer.invoke("bun:status"),
    bunUpdate: () => ipcRenderer.invoke("bun:update"),

    selectFolder: (defaultPath) => ipcRenderer.invoke("select-folder", defaultPath),
    getDefaultSaveDir: () => ipcRenderer.invoke("get-default-save-dir"),
    openFile: (filePath) => ipcRenderer.invoke("open-file", filePath),
    showInFolder: (filePath) => ipcRenderer.invoke("show-in-folder", filePath),
    openExternal: (url) => ipcRenderer.invoke("open-external", url),

    readClipboardText: () => ipcRenderer.invoke("clipboard:read-text"),

    minimizeWindow: () => ipcRenderer.invoke("window-minimize"),
    maximizeWindow: () => ipcRenderer.invoke("window-maximize"),
    closeWindow: () => ipcRenderer.invoke("window-close"),
    setTitleBarOverlay: (options) => ipcRenderer.invoke("set-title-bar-overlay", options),
    platform: process.platform,

    onActionOpenAddModal: (callback) => {
        const handler = () => callback();
        ipcRenderer.on("action:open-add-modal", handler);
        return () => ipcRenderer.removeListener("action:open-add-modal", handler);
    },
    onTaskState: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on("task-state", handler);
        return () => ipcRenderer.removeListener("task-state", handler);
    },
    onSegmentUpdate: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on("segment-update", handler);
        return () => ipcRenderer.removeListener("segment-update", handler);
    },
    onTaskCompleted: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on("task-completed", handler);
        return () => ipcRenderer.removeListener("task-completed", handler);
    },
    onTaskError: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on("task-error", handler);
        return () => ipcRenderer.removeListener("task-error", handler);
    }
};

contextBridge.exposeInMainWorld("turboAPI", api);
