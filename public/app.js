const api = window.turboAPI;

let tasksMap = new Map();
const deletedTaskIds = new Set();
let currentStatusFilter = "all";
let currentCategoryFilter = null;
let currentSearchQuery = "";
let selectedTaskId = null;
let defaultSaveDir = "";

const winMinBtn = document.getElementById("winMinBtn");
const winMaxBtn = document.getElementById("winMaxBtn");
const winCloseBtn = document.getElementById("winCloseBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const searchClearBtn = document.getElementById("searchClearBtn");

const toolAddBtn = document.getElementById("toolAddBtn");
const toolResumeBtn = document.getElementById("toolResumeBtn");
const toolPauseBtn = document.getElementById("toolPauseBtn");
const toolStopAllBtn = document.getElementById("toolStopAllBtn");
const toolDeleteBtn = document.getElementById("toolDeleteBtn");
const toolOpenFolderBtn = document.getElementById("toolOpenFolderBtn");
const toolOpenFileBtn = document.getElementById("toolOpenFileBtn");
const toolClearDoneBtn = document.getElementById("toolClearDoneBtn");
const globalSpeedEl = document.getElementById("globalSpeed");

const quickUrlInput = document.getElementById("quickUrlInput");
const quickStartBtn = document.getElementById("quickStartBtn");
const searchInput = document.getElementById("searchInput");

const tasksTableBody = document.getElementById("tasksTableBody");
const emptyState = document.getElementById("emptyState");
const statusSummary = document.getElementById("statusSummary");
const defaultDirDisplay = document.getElementById("defaultDirDisplay");

const sidebarTreeItems = document.querySelectorAll(".sidebar-tree .tree-item");

const addModal = document.getElementById("addModal");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalCancelBtn = document.getElementById("modalCancelBtn");
const modalStartBtn = document.getElementById("modalStartBtn");
const modalUrlInput = document.getElementById("modalUrlInput");
const probeUrlBtn = document.getElementById("probeUrlBtn");
const modalSaveDirInput = document.getElementById("modalSaveDirInput");
const browseDirBtn = document.getElementById("browseDirBtn");
const modalFileNameInput = document.getElementById("modalFileNameInput");

const probedCard = document.getElementById("probedCard");
const probedFileName = document.getElementById("probedFileName");
const probedSize = document.getElementById("probedSize");
const probedCategory = document.getElementById("probedCategory");
const probedFolder = document.getElementById("probedFolder");
const probedThumb = document.getElementById("probedThumb");
const probedMetaRow = document.getElementById("probedMetaRow");
const probedMeta = document.getElementById("probedMeta");
const probeError = document.getElementById("probeError");

const ytOptionsSection = document.getElementById("ytOptionsSection");
const modalFormatSelect = document.getElementById("modalFormatSelect");
const modalCookieSelect = document.getElementById("modalCookieSelect");
const modalManageCookiesBtn = document.getElementById("modalManageCookiesBtn");

const toolCookiesBtn = document.getElementById("toolCookiesBtn");
const toolSettingsBtn = document.getElementById("toolSettingsBtn");
const engineBanner = document.getElementById("engineBanner");
const engineBannerText = document.getElementById("engineBannerText");
const engineBannerRetry = document.getElementById("engineBannerRetry");

const cookieModal = document.getElementById("cookieModal");
const cookieModalCloseBtn = document.getElementById("cookieModalCloseBtn");
const cookieDoneBtn = document.getElementById("cookieDoneBtn");
const cookieNoticeText = document.getElementById("cookieNoticeText");
const cookieImportBtn = document.getElementById("cookieImportBtn");
const cookiePasteBtn = document.getElementById("cookiePasteBtn");
const cookieBrowserBtn = document.getElementById("cookieBrowserBtn");
const cookiePasteArea = document.getElementById("cookiePasteArea");
const cookiePasteName = document.getElementById("cookiePasteName");
const cookiePasteContent = document.getElementById("cookiePasteContent");
const cookiePasteSaveBtn = document.getElementById("cookiePasteSaveBtn");
const cookiePasteCancelBtn = document.getElementById("cookiePasteCancelBtn");
const cookieBrowserArea = document.getElementById("cookieBrowserArea");
const cookieBrowserName = document.getElementById("cookieBrowserName");
const cookieBrowserSelect = document.getElementById("cookieBrowserSelect");
const cookieBrowserProfile = document.getElementById("cookieBrowserProfile");
const cookieBrowserSaveBtn = document.getElementById("cookieBrowserSaveBtn");
const cookieBrowserCancelBtn = document.getElementById("cookieBrowserCancelBtn");
const cookieProfileList = document.getElementById("cookieProfileList");

const settingsModal = document.getElementById("settingsModal");
const settingsModalCloseBtn = document.getElementById("settingsModalCloseBtn");
const settingsCancelBtn = document.getElementById("settingsCancelBtn");
const settingsSaveBtn = document.getElementById("settingsSaveBtn");
const settingsError = document.getElementById("settingsError");
const settingsDirtyBadge = document.getElementById("settingsDirtyBadge");
const setTheme = document.getElementById("setTheme");
const setReduceTransparency = document.getElementById("setReduceTransparency");
const setSaveDir = document.getElementById("setSaveDir");
const setBrowseDirBtn = document.getElementById("setBrowseDirBtn");
const setMaxConcurrent = document.getElementById("setMaxConcurrent");
const setMaxConnections = document.getElementById("setMaxConnections");
const setFragments = document.getElementById("setFragments");
const setPreferredFormat = document.getElementById("setPreferredFormat");
const setDefaultQuality = document.getElementById("setDefaultQuality");
const setDefaultCookie = document.getElementById("setDefaultCookie");
const setEmbedThumb = document.getElementById("setEmbedThumb");
const setEmbedMeta = document.getElementById("setEmbedMeta");
const setLimitRate = document.getElementById("setLimitRate");
const setProxy = document.getElementById("setProxy");
const ytdlpStatusLine = document.getElementById("ytdlpStatusLine");
const setYtdlpChannel = document.getElementById("setYtdlpChannel");
const setAutoUpdate = document.getElementById("setAutoUpdate");
const ytdlpUpdateBtn = document.getElementById("ytdlpUpdateBtn");
const bunStatusLine = document.getElementById("bunStatusLine");
const bunUpdateBtn = document.getElementById("bunUpdateBtn");
const setDetectClipboard = document.getElementById("setDetectClipboard");
const setCloseToTray = document.getElementById("setCloseToTray");
const btnLaunchOnboarding = document.getElementById("btnLaunchOnboarding");

const toolHelpBtn = document.getElementById("toolHelpBtn");
const helpModal = document.getElementById("helpModal");
const helpModalCloseBtn = document.getElementById("helpModalCloseBtn");
const helpDoneBtn = document.getElementById("helpDoneBtn");
const helpRerunOnboardingBtn = document.getElementById("helpRerunOnboardingBtn");

const onboardingModal = document.getElementById("onboardingModal");
const onboardingCloseBtn = document.getElementById("onboardingCloseBtn");
const onboardStepDot1 = document.getElementById("onboardStepDot1");
const onboardStepDot2 = document.getElementById("onboardStepDot2");
const onboardStepDot3 = document.getElementById("onboardStepDot3");
const onboardStepDot4 = document.getElementById("onboardStepDot4");
const onboardStep1 = document.getElementById("onboardStep1");
const onboardStep2 = document.getElementById("onboardStep2");
const onboardStep3 = document.getElementById("onboardStep3");
const onboardStep4 = document.getElementById("onboardStep4");
const onboardSaveDir = document.getElementById("onboardSaveDir");
const onboardBrowseDirBtn = document.getElementById("onboardBrowseDirBtn");
const onboardTheme = document.getElementById("onboardTheme");
const onboardReduceTransparency = document.getElementById("onboardReduceTransparency");
const onboardDetectClipboard = document.getElementById("onboardDetectClipboard");
const onboardBackBtn = document.getElementById("onboardBackBtn");
const onboardNextBtn = document.getElementById("onboardNextBtn");

const supportedSitesModal = document.getElementById("supportedSitesModal");
const supportedSitesCloseBtn = document.getElementById("supportedSitesCloseBtn");
const supportedSitesDoneBtn = document.getElementById("supportedSitesDoneBtn");
const addSupportedSitesBtn = document.getElementById("addSupportedSitesBtn");
const helpSupportedSitesBtn = document.getElementById("helpSupportedSitesBtn");
const sitesSearchInput = document.getElementById("sitesSearchInput");
const sitesSearchClearBtn = document.getElementById("sitesSearchClearBtn");
const sitesCategoryTabs = document.getElementById("sitesCategoryTabs");
const popularSitesGrid = document.getElementById("popularSitesGrid");
const allExtractorsContainer = document.getElementById("allExtractorsContainer");
const sitesCountBadge = document.getElementById("sitesCountBadge");
const popularCountBadge = document.getElementById("popularCountBadge");
const sitesNoMatch = document.getElementById("sitesNoMatch");
const btnOpenYtdlpSitesDoc = document.getElementById("btnOpenYtdlpSitesDoc");

const toastContainer = document.getElementById("toastContainer");

let settingsCache = null;
let cookieProfilesCache = { profiles: [], defaultProfileId: null };
let settingsDirty = false;

const setAlwaysAsk = document.getElementById("setAlwaysAsk");

const smartModal = document.getElementById("smartModal");
const smartCloseBtn = document.getElementById("smartCloseBtn");
const smartCancelBtn = document.getElementById("smartCancelBtn");
const smartBackBtn = document.getElementById("smartBackBtn");
const smartNextBtn = document.getElementById("smartNextBtn");
const smartCookiePhase = document.getElementById("smartCookiePhase");
const smartCookieSelect = document.getElementById("smartCookieSelect");
const smartManageBtn = document.getElementById("smartManageBtn");
const smartCookieError = document.getElementById("smartCookieError");
const smartQualityPhase = document.getElementById("smartQualityPhase");
const smartProbedCard = document.getElementById("smartProbedCard");
const smartThumb = document.getElementById("smartThumb");
const smartTitleVal = document.getElementById("smartTitleVal");
const smartUploader = document.getElementById("smartUploader");
const smartDuration = document.getElementById("smartDuration");
const smartFormatSelect = document.getElementById("smartFormatSelect");
const smartQualityError = document.getElementById("smartQualityError");
const smartLoading = document.getElementById("smartLoading");
let smartState = null;

const deleteModal = document.getElementById("deleteModal");
const deleteModalCloseBtn = document.getElementById("deleteModalCloseBtn");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");
const deleteTaskTitle = document.getElementById("deleteTaskTitle");
const deleteFileCheckbox = document.getElementById("deleteFileCheckbox");
let pendingDeleteTask = null;

const contextMenu = document.getElementById("contextMenu");
const ctxResume = document.getElementById("ctxResume");
const ctxPause = document.getElementById("ctxPause");
const ctxOpenFile = document.getElementById("ctxOpenFile");
const ctxOpenFolder = document.getElementById("ctxOpenFolder");
const ctxCopyUrl = document.getElementById("ctxCopyUrl");
const ctxDelete = document.getElementById("ctxDelete");
let contextMenuTargetId = null;

let pendingRowUpdates = new Set();
let rafScheduled = false;

const SVG_ICONS = {
    play: `<svg class="row-svg" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    pause: `<svg class="row-svg" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
    openFile: `<svg class="row-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/></svg>`,
    openFolder: `<svg class="row-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    delete: `<svg class="row-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    catVideo: `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`,
    catMusic: `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    catCompressed: `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
    catPrograms: `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`,
    catDocuments: `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    catImages: `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    catGeneral: `<svg class="cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`
};

function getCategoryIcon(category) {
    switch (category?.toLowerCase()) {
        case "video": return SVG_ICONS.catVideo;
        case "audio":
        case "music": return SVG_ICONS.catMusic;
        case "archive":
        case "compressed": return SVG_ICONS.catCompressed;
        case "application":
        case "programs": return SVG_ICONS.catPrograms;
        case "document":
        case "documents": return SVG_ICONS.catDocuments;
        case "image":
        case "images": return SVG_ICONS.catImages;
        default: return SVG_ICONS.catGeneral;
    }
}

function getCategorySubfolder(filename) {
    if (!filename) return "General";
    const ext = filename.split(".").pop().toLowerCase();
        switch (ext) {
        case "mp4": case "mkv": case "avi": case "mov": case "wmv": case "flv":
        case "webm": case "m4v": case "mpg": case "mpeg": case "3gp": case "ts":
            return "Video";
        case "mp3": case "flac": case "wav": case "aac": case "ogg": case "wma":
        case "m4a": case "opus":
            return "Music";
        case "zip": case "rar": case "7z": case "tar": case "gz": case "bz2":
        case "xz": case "zst": case "iso": case "dmg":
            return "Compressed";
        case "exe": case "msi": case "deb": case "rpm": case "appimage":
        case "flatpak": case "snap": case "apk": case "bin": case "run": case "sh":
            return "Programs";
        case "pdf": case "doc": case "docx": case "xls": case "xlsx": case "ppt":
        case "pptx": case "txt": case "rtf": case "odt": case "csv": case "epub":
            return "Documents";
        case "jpg": case "jpeg": case "png": case "gif": case "bmp": case "svg":
        case "webp": case "ico": case "tiff": case "tif":
            return "Images";
        default:
            return "General";
    }
}

function formatBytes(bytes) {
    if (bytes === 0 || !bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0) return "0 B/s";
    return formatBytes(bytesPerSec) + "/s";
}

function formatEta(seconds) {
    if (!seconds || seconds <= 0 || seconds === Infinity || isNaN(seconds)) return "--:--";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
}

function normalizeTask(raw) {
    if (!raw) return null;
    const prev = tasksMap.get(raw.id);
    const totalSize = raw.totalSize || raw.size || 0;

    let downloaded = raw.downloadedBytes || raw.downloaded || 0;
    if (prev && prev.status === "downloading" && downloaded < prev.downloadedBytes) {
        downloaded = prev.downloadedBytes;
    }

    let percent = typeof raw.percent === "number" && raw.percent > 0 ? raw.percent : (totalSize > 0 ? Math.min(100, (downloaded / totalSize) * 100) : 0);
    let status = (raw.status || "Queued").toLowerCase();
    if (status === "completed") {
        percent = 100;
        downloaded = totalSize || downloaded;
    }

    const speed = raw.speed || 0;
    let etaSeconds = 0;
    if (speed > 0 && totalSize > downloaded) {
        etaSeconds = (totalSize - downloaded) / speed;
    }

    return {
        id: raw.id,
        url: raw.url,
        engine: raw.engine || "http",
        fileName: raw.fileName || raw.filename || "download.bin",
        filePath: raw.filePath || raw.savePath || "",
        totalSize,
        downloadedBytes: downloaded,
        percent: parseFloat(percent.toFixed(1)),
        speed,
        status,
        actualConnections: raw.actualConnections || (raw.segments?.length) || 1,
        supportsRange: raw.supportsRange ?? true,
        category: raw.category || "Other",
        error: raw.error || null,
        isHls: !!raw.isHls,
        etaSeconds,
        segments: raw.segments || []
    };
}

window.addEventListener("DOMContentLoaded", async () => {
    setupWindowControls();
    setupRibbonButtons();
    setupFiltersAndSearch();
    setupTableEvents();
    setupModals();
    setupContextMenu();
    setupKeyboardNavigation();
    setupCookieManager();
    setupSettingsUI();
    setupSmartDownload();
    setupDragAndDrop();
    setupHelpModal();
    setupOnboardingModal();
    setupSupportedSitesModal();
    setupClipboardDetection();

    const authorGithub = document.getElementById("authorGithub");
    if (authorGithub) {
        authorGithub.addEventListener("click", (e) => {
            e.preventDefault();
            if (api && api.openExternal) {
                api.openExternal("https://github.com/rishad0x");
            }
        });
    }

    const authorDiscord = document.getElementById("authorDiscord");
    if (authorDiscord) {
        authorDiscord.addEventListener("click", (e) => {
            e.preventDefault();
            if (api && api.openExternal) {
                api.openExternal("https://discord.com/users/908639550547578881");
            }
        });
    }

    if (api) {
        try {
            defaultSaveDir = await api.getDefaultSaveDir();
            const dirLabel = defaultDirDisplay?.querySelector(".dir-name");
            if (dirLabel) {
                dirLabel.textContent = defaultSaveDir;
            } else if (defaultDirDisplay) {
                defaultDirDisplay.textContent = defaultSaveDir;
            }
            modalSaveDirInput.value = defaultSaveDir;

            const existing = await api.getAllTasks();
            if (Array.isArray(existing)) {
                for (const t of existing) {
                    tasksMap.set(t.id, normalizeTask(t));
                }
            }

            await loadSettingsCache();
            await refreshCookieProfiles();
            checkEngineStatus();
        } catch (e) {
            console.error("Initialization error:", e);
        }
        setupIPCListeners();
    }

    renderTable();
    updateSidebarCounts();
    updateGlobalMetrics();
});

function applyTheme(themeName) {
    const root = document.documentElement;
    let effective = themeName;
    if (themeName === "system" || !themeName) {
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        effective = prefersDark ? "dark" : "light";
    }
    root.setAttribute("data-theme", effective);

    if (api && typeof api.setTitleBarOverlay === "function" && api.platform === "win32") {
        api.setTitleBarOverlay({
            symbolColor: effective === "dark" ? "#f1f5f9" : "#0f172a"
        });
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    if (settingsCache) {
        settingsCache.theme = next;
    }
    if (api && api.settingsSet) {
        api.settingsSet({ theme: next });
    }
}

function applyTransparency(reduce) {
    if (reduce) {
        document.body.classList.add("reduce-transparency");
    } else {
        document.body.classList.remove("reduce-transparency");
    }
}

function showToast(message, type = "info", duration = 3500) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast-item toast-${type}`;

    let iconSvg = '';
    if (type === "success") {
        iconSvg = `<svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === "error") {
        iconSvg = `<svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else {
        iconSvg = `<svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
        <span class="toast-icon-wrap">${iconSvg}</span>
        <span class="toast-text">${escapeHtml(message)}</span>
        <button class="toast-dismiss" aria-label="Dismiss">✕</button>
    `;

    let dismissed = false;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        toast.classList.add("toast-leaving");
        setTimeout(() => { toast.remove(); }, 220);
    };

    toast.querySelector(".toast-dismiss").addEventListener("click", (e) => {
        e.stopPropagation();
        dismiss();
    });
    toast.addEventListener("click", dismiss);

    container.appendChild(toast);
    if (duration > 0) {
        setTimeout(dismiss, duration);
    }
}

let lastCheckedClipboardUrl = "";

function showClipboardPromptToast(url) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const existing = container.querySelector(".toast-clipboard");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "toast-item toast-clipboard";
    const truncatedUrl = url.length > 55 ? url.substring(0, 52) + "…" : url;

    toast.innerHTML = `
        <span class="toast-icon-wrap">
            <svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
        </span>
        <div class="toast-clipboard-body">
            <div class="toast-clipboard-title">Download Copied Link?</div>
            <div class="toast-clipboard-url" title="${escapeHtml(url)}">${escapeHtml(truncatedUrl)}</div>
            <div class="toast-clipboard-actions">
                <button class="btn btn-primary btn-sm" id="toastDownloadBtn">Download</button>
                <button class="btn btn-ghost btn-sm" id="toastDismissBtn">Dismiss</button>
            </div>
        </div>
        <button class="toast-dismiss" aria-label="Dismiss">✕</button>
    `;

    let timer = null;
    let dismissed = false;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        if (timer) clearTimeout(timer);
        toast.classList.add("toast-leaving");
        setTimeout(() => toast.remove(), 240);
    };

    toast.querySelector("#toastDownloadBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        dismiss();
        startSmartDownload(url, { source: "quick" });
    });
    toast.querySelector("#toastDismissBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        dismiss();
    });
    toast.querySelector(".toast-dismiss").addEventListener("click", (e) => {
        e.stopPropagation();
        dismiss();
    });

    container.appendChild(toast);
    timer = setTimeout(dismiss, 12000);
}

async function checkClipboardUrl() {
    if (!api || !api.readClipboardText) return;
    if (settingsCache && settingsCache.detectClipboardUrls === false) return;

    if (document.querySelector(".modal-backdrop.open")) return;

    try {
        const text = await api.readClipboardText();
        if (!text || typeof text !== "string") return;
        const trimmed = text.trim();
        if (!trimmed || trimmed === lastCheckedClipboardUrl) return;

        if (/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed)) {

            const alreadyExists = Array.from(tasksMap.values()).some(t => t.url === trimmed);
            lastCheckedClipboardUrl = trimmed;
            if (!alreadyExists) {
                showClipboardPromptToast(trimmed);
            }
        }
    } catch (_) {}
}

function setupClipboardDetection() {
    window.addEventListener("focus", () => {
        checkClipboardUrl();
    });
    setInterval(() => {
        if (document.hasFocus()) {
            checkClipboardUrl();
        }
    }, 3500);
}

function setupWindowControls() {

    if (api?.platform === "win32" || navigator.userAgent.includes("Windows") || navigator.platform.includes("Win")) {
        document.body.classList.add("has-titlebar-overlay");
    } else if (api?.platform) {
        document.body.classList.remove("has-titlebar-overlay");
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", toggleTheme);
    }

    if (window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
            if (settingsCache?.theme === "system") {
                applyTheme("system");
            }
        });
    }

    if (!api) return;
    winMinBtn?.addEventListener("click", () => api.minimizeWindow());
    winMaxBtn?.addEventListener("click", () => api.maximizeWindow());
    winCloseBtn?.addEventListener("click", () => api.closeWindow());
}

function setupRibbonButtons() {
    toolAddBtn.addEventListener("click", openAddModal);

    toolResumeBtn.addEventListener("click", async () => {
        if (!selectedTaskId || !api) return;
        const task = tasksMap.get(selectedTaskId);
        if (task && (task.status === "paused" || task.status === "failed" || task.status === "queued")) {
            task.status = "connecting";
            updateRowDOM(task);
            updateRibbonState();
            await api.resumeTask(task.id);
        }
    });

    toolPauseBtn.addEventListener("click", async () => {
        if (!selectedTaskId || !api) return;
        const task = tasksMap.get(selectedTaskId);
        if (task && (task.status === "downloading" || task.status === "connecting")) {
            task.status = "paused";
            updateRowDOM(task);
            updateRibbonState();
            await api.pauseTask(task.id);
        }
    });

    toolStopAllBtn.addEventListener("click", async () => {
        if (!api) return;
        for (const task of tasksMap.values()) {
            if (task.status === "downloading" || task.status === "connecting") {
                task.status = "paused";
                updateRowDOM(task);
                api.pauseTask(task.id).catch(() => {});
            }
        }
        updateRibbonState();
        updateGlobalMetrics();
    });

    toolDeleteBtn.addEventListener("click", () => {
        if (!selectedTaskId) return;
        const task = tasksMap.get(selectedTaskId);
        if (task) promptDeleteTask(task);
    });

    toolOpenFolderBtn.addEventListener("click", async () => {
        if (!selectedTaskId || !api) return;
        const task = tasksMap.get(selectedTaskId);
        if (task) await api.showInFolder(task.filePath);
    });

    toolOpenFileBtn.addEventListener("click", async () => {
        if (!selectedTaskId || !api) return;
        const task = tasksMap.get(selectedTaskId);
        if (task) {
            const res = await api.openFile(task.filePath);
            if (!res?.success) await api.showInFolder(task.filePath);
        }
    });

    toolClearDoneBtn.addEventListener("click", async () => {
        if (!api) return;
        const completedIds = [];
        for (const task of tasksMap.values()) {
            if (task.status === "completed") completedIds.push(task.id);
        }
        for (const id of completedIds) {
            tasksMap.delete(id);
            await api.deleteTask(id, false);
        }
        if (selectedTaskId && completedIds.includes(selectedTaskId)) {
            selectedTaskId = null;
        }
        renderTable();
        updateSidebarCounts();
        updateRibbonState();
    });

    quickStartBtn.addEventListener("click", handleQuickAdd);
    quickUrlInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleQuickAdd();
    });
}

async function handleQuickAdd() {
    const url = quickUrlInput.value.trim();
    if (!url) {
        quickUrlInput.focus();
        return;
    }

    quickStartBtn.disabled = true;
    quickStartBtn.textContent = "…";

    try {

        const task = await startSmartDownload(url, { source: "quick" });
        if (task) {
            quickUrlInput.value = "";
            renderTable();
        }
    } catch (err) {
        showToast("Failed to start download: " + (err.message || err), "error");
    } finally {
        quickStartBtn.disabled = false;
        quickStartBtn.textContent = "Download";
    }
}

function setupFiltersAndSearch() {
    sidebarTreeItems.forEach(item => {
        item.addEventListener("click", () => {
            sidebarTreeItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            if (item.dataset.filter) {
                currentStatusFilter = item.dataset.filter;
                currentCategoryFilter = null;
            } else if (item.dataset.category) {
                currentCategoryFilter = item.dataset.category;
                currentStatusFilter = "all";
            }

            renderTable();
        });
    });

    searchInput.addEventListener("input", (e) => {
        currentSearchQuery = e.target.value.trim().toLowerCase();
        if (searchClearBtn) {
            searchClearBtn.style.display = currentSearchQuery ? "block" : "none";
        }
        renderTable();
    });

    if (searchClearBtn) {
        searchClearBtn.addEventListener("click", () => {
            searchInput.value = "";
            currentSearchQuery = "";
            searchClearBtn.style.display = "none";
            searchInput.focus();
            renderTable();
        });
    }
}

function getFilteredTasks() {
    return Array.from(tasksMap.values()).filter(task => {
        if (currentStatusFilter === "active" && task.status !== "downloading" && task.status !== "connecting") return false;
        if (currentStatusFilter === "paused" && task.status !== "paused") return false;
        if (currentStatusFilter === "completed" && task.status !== "completed") return false;
        if (currentStatusFilter === "failed" && task.status !== "failed" && task.status !== "cancelled") return false;

        if (currentCategoryFilter) {
            const cat = (task.category || "other").toLowerCase();
            const sub = getCategorySubfolder(task.fileName).toLowerCase();
            if (cat !== currentCategoryFilter && sub !== currentCategoryFilter) {
                if (currentCategoryFilter === "compressed" && cat !== "archive") return false;
                if (currentCategoryFilter === "programs" && cat !== "application") return false;
                if (currentCategoryFilter !== "compressed" && currentCategoryFilter !== "programs") return false;
            }
        }

        if (currentSearchQuery) {
            const matchName = task.fileName.toLowerCase().includes(currentSearchQuery);
            const matchUrl = task.url.toLowerCase().includes(currentSearchQuery);
            if (!matchName && !matchUrl) return false;
        }

        return true;
    });
}

function renderTable() {
    const list = getFilteredTasks();
    if (list.length === 0) {
        tasksTableBody.innerHTML = "";
        emptyState.style.display = "flex";
        return;
    }

    emptyState.style.display = "none";
    tasksTableBody.innerHTML = list.map(task => createTableRowHTML(task)).join("");
    updateRibbonState();
}

function createTableRowHTML(task) {
    const isSelected = selectedTaskId === task.id;
    const catIcon = getCategoryIcon(task.category || getCategorySubfolder(task.fileName));
    const isDone = task.status === "completed";
    const isDownloading = task.status === "downloading" || task.status === "connecting";
    const fillClass = isDone ? "done" : (task.status === "paused" ? "paused" : (task.status === "failed" ? "failed" : ""));

    return `
        <tr class="task-row ${isSelected ? "selected" : ""}" data-id="${task.id}" id="row-${task.id}">
            <td class="col-filename">
                <div class="file-cell" title="${escapeHtml(task.fileName)}">
                    <span class="file-cell-icon">${catIcon}</span>
                    <span class="file-cell-name">${escapeHtml(task.fileName)}</span>
                </div>
            </td>
            <td class="col-size font-mono">${formatBytes(task.totalSize || task.downloadedBytes)}</td>
            <td class="col-status">
                <span class="status-pill status-${escapeHtml(task.status)}">
                    <span class="status-dot-mini"></span>
                    <span class="status-text">${escapeHtml(task.status)}</span>
                </span>
            </td>
            <td class="col-progress">
                <div class="progress-cell-wrap">
                    <div class="progress-cell-text">
                        <span class="prog-pct">${task.percent}%</span>
                        <span class="prog-bytes">${formatBytes(task.downloadedBytes)}</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-bar-fill ${fillClass}" style="width: ${task.percent}%;"></div>
                    </div>
                </div>
            </td>
            <td class="col-speed font-mono">${task.status === "downloading" ? formatSpeed(task.speed) : (isDone ? "—" : "0 B/s")}</td>
            <td class="col-eta font-mono">${task.status === "downloading" ? formatEta(task.etaSeconds) : (isDone ? "Done" : "--:--")}</td>
            <td class="col-channels">
                ${task.engine === "ytdlp"
                    ? `<span class="engine-badge badge-ytdlp" title="Engine: yt-dlp stream extractor">yt-dlp</span>`
                    : `<span class="engine-badge badge-http" title="Engine: HTTP segment accelerator · ${task.actualConnections || 1} connections">${task.actualConnections || 1} Ch</span>`
                }
            </td>
            <td class="col-actions">
                <div class="row-actions-cell">
                    ${isDone ? `
                        <button class="row-action-btn open-file-btn" data-action="open-file" title="Open File">${SVG_ICONS.openFile}</button>
                        <button class="row-action-btn open-folder-btn" data-action="open-folder" title="Open Folder">${SVG_ICONS.openFolder}</button>
                    ` : `
                        <button class="row-action-btn toggle-btn" data-action="toggle" data-state="${isDownloading ? "pause" : "resume"}" title="${isDownloading ? "Pause" : "Resume"}">
                            ${isDownloading ? SVG_ICONS.pause : SVG_ICONS.play}
                        </button>
                    `}
                    <button class="row-action-btn delete-btn" data-action="delete" title="Delete Download">${SVG_ICONS.delete}</button>
                </div>
            </td>
        </tr>
    `;
}

function queueRowUpdate(task) {
    pendingRowUpdates.add(task.id);
    if (!rafScheduled) {
        rafScheduled = true;
        requestAnimationFrame(flushPendingRowUpdates);
    }
}

function flushPendingRowUpdates() {
    rafScheduled = false;
    for (const id of pendingRowUpdates) {
        const task = tasksMap.get(id);
        if (task) updateRowDOM(task);
    }
    pendingRowUpdates.clear();
    updateSidebarCounts();
    updateGlobalMetrics();
}

function updateRowDOM(task) {
    const row = document.getElementById(`row-${task.id}`);
    if (!row) {
        renderTable();
        return;
    }

    const isDone = task.status === "completed";
    const statusPill = row.querySelector(".col-status .status-pill");
    if (statusPill) {
        const textSpan = statusPill.querySelector(".status-text");
        if (textSpan && textSpan.textContent !== task.status) {
            textSpan.textContent = task.status;
            statusPill.className = `status-pill status-${task.status}`;
        } else if (!textSpan && statusPill.textContent !== task.status) {
            statusPill.innerHTML = `<span class="status-dot-mini"></span><span class="status-text">${escapeHtml(task.status)}</span>`;
            statusPill.className = `status-pill status-${escapeHtml(task.status)}`;
        }
    }

    const progressFill = row.querySelector(".progress-bar-fill");
    if (progressFill) {
        progressFill.style.width = `${task.percent}%`;
        const expectedClass = `progress-bar-fill ${isDone ? "done" : (task.status === "paused" ? "paused" : (task.status === "failed" ? "failed" : ""))}`;
        if (progressFill.className !== expectedClass) progressFill.className = expectedClass;
    }

    const pctSpan = row.querySelector(".prog-pct");
    if (pctSpan && pctSpan.textContent !== `${task.percent}%`) {
        pctSpan.textContent = `${task.percent}%`;
    }

    const bytesSpan = row.querySelector(".prog-bytes");
    const formattedBytes = formatBytes(task.downloadedBytes);
    if (bytesSpan && bytesSpan.textContent !== formattedBytes) {
        bytesSpan.textContent = formattedBytes;
    }

    const speedCell = row.querySelector(".col-speed");
    const speedText = task.status === "downloading" ? formatSpeed(task.speed) : (isDone ? "—" : "0 B/s");
    if (speedCell && speedCell.textContent !== speedText) {
        speedCell.textContent = speedText;
    }

    const etaCell = row.querySelector(".col-eta");
    const etaText = task.status === "downloading" ? formatEta(task.etaSeconds) : (isDone ? "Done" : "--:--");
    if (etaCell && etaCell.textContent !== etaText) {
        etaCell.textContent = etaText;
    }

    const sizeCell = row.querySelector(".col-size");
    const sizeText = formatBytes(task.totalSize || task.downloadedBytes);
    if (sizeCell && sizeCell.textContent !== sizeText) {
        sizeCell.textContent = sizeText;
    }

    const isDownloading = task.status === "downloading" || task.status === "connecting";
    const toggleBtn = row.querySelector(".toggle-btn");
    if (toggleBtn) {
        const expectedState = isDownloading ? "pause" : "resume";
        if (toggleBtn.dataset.state !== expectedState) {
            toggleBtn.dataset.state = expectedState;
            toggleBtn.title = isDownloading ? "Pause" : "Resume";
            toggleBtn.innerHTML = isDownloading ? SVG_ICONS.pause : SVG_ICONS.play;
        }
    }
}

function setupTableEvents() {
    tasksTableBody.addEventListener("click", async (e) => {
        const row = e.target.closest(".task-row");
        if (!row) return;

        const id = row.dataset.id;
        const task = tasksMap.get(id);
        if (!task) return;

        selectTaskRow(id);

        const actionBtn = e.target.closest("[data-action]");
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            if (action === "delete") {
                promptDeleteTask(task);
            } else if (action === "open-file") {
                const res = await api.openFile(task.filePath);
                if (!res?.success) await api.showInFolder(task.filePath);
            } else if (action === "open-folder") {
                await api.showInFolder(task.filePath);
            } else if (action === "toggle") {
                if (task.status === "downloading" || task.status === "connecting") {
                    task.status = "paused";
                    updateRowDOM(task);
                    updateRibbonState();
                    if (api) await api.pauseTask(task.id);
                } else if (task.status === "paused" || task.status === "failed" || task.status === "queued") {
                    task.status = "connecting";
                    updateRowDOM(task);
                    updateRibbonState();
                    if (api) await api.resumeTask(task.id);
                }
            }
            return;
        }

        if (task.status === "completed" && e.target.closest(".file-cell-name")) {
            const res = await api.openFile(task.filePath);
            if (!res?.success) await api.showInFolder(task.filePath);
        }
    });

    tasksTableBody.addEventListener("dblclick", async (e) => {
        const row = e.target.closest(".task-row");
        if (row && api) {
            const task = tasksMap.get(row.dataset.id);
            if (task) {
                if (task.status === "completed") {
                    const res = await api.openFile(task.filePath);
                    if (!res?.success) await api.showInFolder(task.filePath);
                } else {
                    await api.showInFolder(task.filePath);
                }
            }
        }
    });

    tasksTableBody.addEventListener("contextmenu", (e) => {
        const row = e.target.closest(".task-row");
        if (row) {
            e.preventDefault();
            selectTaskRow(row.dataset.id);
            showContextMenu(e.clientX, e.clientY, row.dataset.id);
        }
    });
}

function selectTaskRow(id) {
    selectedTaskId = id;
    document.querySelectorAll(".task-row").forEach(r => {
        r.classList.toggle("selected", r.dataset.id === id);
    });
    updateRibbonState();
}

function updateRibbonState() {
    const task = selectedTaskId ? tasksMap.get(selectedTaskId) : null;
    if (!task) {
        toolResumeBtn.disabled = true;
        toolPauseBtn.disabled = true;
        toolDeleteBtn.disabled = true;
        toolOpenFolderBtn.disabled = true;
        toolOpenFileBtn.disabled = true;
        return;
    }

    toolDeleteBtn.disabled = false;
    toolOpenFolderBtn.disabled = !task.filePath;
    toolOpenFileBtn.disabled = task.status !== "completed" || !task.filePath;

    if (task.status === "downloading" || task.status === "connecting") {
        toolResumeBtn.disabled = true;
        toolPauseBtn.disabled = false;
    } else if (task.status === "paused" || task.status === "failed" || task.status === "queued") {
        toolResumeBtn.disabled = false;
        toolPauseBtn.disabled = true;
    } else {
        toolResumeBtn.disabled = true;
        toolPauseBtn.disabled = true;
    }
}

function updateSidebarCounts() {
    let all = 0, active = 0, paused = 0, completed = 0, failed = 0;
    let compressed = 0, video = 0, music = 0, programs = 0, documents = 0, images = 0, general = 0;

    for (const t of tasksMap.values()) {
        all++;
        if (t.status === "downloading" || t.status === "connecting") active++;
        else if (t.status === "paused") paused++;
        else if (t.status === "completed") completed++;
        else if (t.status === "failed" || t.status === "cancelled") failed++;

        const sub = getCategorySubfolder(t.fileName).toLowerCase();
        if (sub === "compressed") compressed++;
        else if (sub === "video") video++;
        else if (sub === "music") music++;
        else if (sub === "programs") programs++;
        else if (sub === "documents") documents++;
        else if (sub === "images") images++;
        else general++;
    }

    document.getElementById("countAll").textContent = all;
    document.getElementById("countActive").textContent = active;
    document.getElementById("countPaused").textContent = paused;
    document.getElementById("countCompleted").textContent = completed;
    document.getElementById("countFailed").textContent = failed;

    document.getElementById("countCompressed").textContent = compressed;
    document.getElementById("countVideo").textContent = video;
    document.getElementById("countMusic").textContent = music;
    document.getElementById("countPrograms").textContent = programs;
    document.getElementById("countDocuments").textContent = documents;
    document.getElementById("countImages").textContent = images;
    document.getElementById("countGeneral").textContent = general;

            document.body.classList.toggle("has-active-downloads", active > 0);

    statusSummary.textContent = `${active} Active Downloads | ${completed} Completed`;
}

function updateGlobalMetrics() {
    let totalSpeed = 0;
    for (const t of tasksMap.values()) {
        if (t.status === "downloading") {
            totalSpeed += (t.speed || 0);
        }
    }
    globalSpeedEl.textContent = formatSpeed(totalSpeed);
}

function setupKeyboardNavigation() {
    window.addEventListener("keydown", async (e) => {

        if (e.key === "Escape") {
            if (contextMenu.style.display === "block") {
                contextMenu.style.display = "none";
                return;
            }
            if (helpModal && helpModal.classList.contains("open")) {
                closeHelpModal();
                return;
            }
            if (supportedSitesModal && supportedSitesModal.classList.contains("open")) {
                closeSupportedSitesModal();
                return;
            }
            if (onboardingModal && onboardingModal.classList.contains("open")) {
                closeOnboardingModal(true);
                return;
            }
            if (cookieModal.classList.contains("open")) {
                closeCookieModal();
                return;
            }
            if (smartModal.classList.contains("open")) {
                closeSmartModal();
                return;
            }
            if (settingsModal.classList.contains("open")) {
                requestCloseSettings();
                return;
            }
            if (addModal.classList.contains("open")) {
                closeAddModal();
                return;
            }
            if (deleteModal.classList.contains("open")) {
                closeDeleteModal();
                return;
            }
            return;
        }

        if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
            if (onboardingModal && onboardingModal.classList.contains("open")) {
                e.preventDefault();
                onboardNextBtn.click();
                return;
            }
            if (helpModal && helpModal.classList.contains("open")) {
                e.preventDefault();
                closeHelpModal();
                return;
            }
            if (deleteModal.classList.contains("open")) {
                e.preventDefault();
                deleteConfirmBtn.click();
                return;
            }
            if (addModal.classList.contains("open")) {
                if (e.target !== browseDirBtn && e.target !== modalCancelBtn && e.target !== modalCloseBtn && e.target !== modalManageCookiesBtn) {
                    e.preventDefault();
                    modalStartBtn.click();
                    return;
                }
            }
            if (smartModal.classList.contains("open")) {
                if (e.target !== smartCancelBtn && e.target !== smartCloseBtn && e.target !== smartBackBtn && e.target !== smartManageBtn) {
                    e.preventDefault();
                    smartNextBtn.click();
                    return;
                }
            }
            if (settingsModal.classList.contains("open")) {
                if (e.target !== settingsCancelBtn && e.target !== settingsModalCloseBtn && e.target !== setBrowseDirBtn && e.target !== ytdlpUpdateBtn) {
                    e.preventDefault();
                    settingsSaveBtn.click();
                    return;
                }
            }
        }

        const isTyping = ["INPUT", "TEXTAREA"].includes(e.target.tagName);
        if (!isTyping) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
                e.preventDefault();
                openAddModal();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === ",") {
                e.preventDefault();
                openSettingsModal();
                return;
            }
            if (e.key === "F1" || e.key === "?") {
                e.preventDefault();
                openHelpModal();
                return;
            }
        }

        if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;

        if (document.querySelector(".modal-backdrop.open")) return;

        const tasks = getFilteredTasks();
        if (tasks.length === 0) return;

        const currentIndex = tasks.findIndex(t => t.id === selectedTaskId);

        if (e.key === "ArrowDown") {
            e.preventDefault();
            const nextIndex = (currentIndex + 1) < tasks.length ? currentIndex + 1 : 0;
            selectTaskRow(tasks[nextIndex].id);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const prevIndex = (currentIndex - 1) >= 0 ? currentIndex - 1 : tasks.length - 1;
            selectTaskRow(tasks[prevIndex].id);
        } else if (e.key === "Delete" && selectedTaskId) {
            const task = tasksMap.get(selectedTaskId);
            if (task) promptDeleteTask(task);
        } else if (e.key === " " && selectedTaskId) {
            e.preventDefault();
            const task = tasksMap.get(selectedTaskId);
            if (task && api) {
                if (task.status === "downloading" || task.status === "connecting") {
                    await api.pauseTask(task.id);
                } else if (task.status === "paused" || task.status === "failed") {
                    await api.resumeTask(task.id);
                }
            }
        } else if (e.key === "Enter" && selectedTaskId) {
            const task = tasksMap.get(selectedTaskId);
            if (task && task.filePath && api) {
                await api.openFile(task.filePath);
            }
        }
    });

    [addModal, deleteModal, cookieModal, settingsModal, smartModal, helpModal, onboardingModal, supportedSitesModal].forEach(modalEl => {
        if (!modalEl) return;
        modalEl.addEventListener("click", (e) => {
            if (e.target === modalEl) {
                if (modalEl === settingsModal) {
                    requestCloseSettings();
                } else if (modalEl === cookieModal) {
                    closeCookieModal();
                } else if (modalEl === smartModal) {
                    closeSmartModal();
                } else if (modalEl === addModal) {
                    closeAddModal();
                } else if (modalEl === deleteModal) {
                    closeDeleteModal();
                } else if (modalEl === helpModal) {
                    closeHelpModal();
                } else if (modalEl === onboardingModal) {
                    closeOnboardingModal(true);
                } else if (modalEl === supportedSitesModal) {
                    closeSupportedSitesModal();
                }
            }
        });
    });
}

function openHelpModal() {
    if (helpModal) helpModal.classList.add("open");
}

function closeHelpModal() {
    if (helpModal) helpModal.classList.remove("open");
}

function setupHelpModal() {
    if (toolHelpBtn) toolHelpBtn.addEventListener("click", openHelpModal);
    if (helpModalCloseBtn) helpModalCloseBtn.addEventListener("click", closeHelpModal);
    if (helpDoneBtn) helpDoneBtn.addEventListener("click", closeHelpModal);
    if (helpRerunOnboardingBtn) {
        helpRerunOnboardingBtn.addEventListener("click", () => {
            closeHelpModal();
            openOnboardingModal();
        });
    }
}

let currentOnboardStep = 1;

function showOnboardStep(step) {
    currentOnboardStep = step;
    const steps = [onboardStep1, onboardStep2, onboardStep3, onboardStep4];
    const dots = [onboardStepDot1, onboardStepDot2, onboardStepDot3, onboardStepDot4];

    steps.forEach((el, idx) => {
        if (el) el.style.display = (idx + 1 === step) ? "block" : "none";
    });

    dots.forEach((dot, idx) => {
        if (!dot) return;
        dot.classList.remove("active", "completed");
        if (idx + 1 === step) {
            dot.classList.add("active");
        } else if (idx + 1 < step) {
            dot.classList.add("completed");
        }
    });

    if (onboardBackBtn) {
        onboardBackBtn.style.display = step > 1 ? "inline-block" : "none";
    }

    if (onboardNextBtn) {
        if (step === 1) {
            onboardNextBtn.textContent = "Get Started →";
        } else if (step < 4) {
            onboardNextBtn.textContent = "Next →";
        } else {
            onboardNextBtn.textContent = "Finish Setup";
        }
    }
}

function openOnboardingModal() {
    if (!onboardingModal) return;
    showOnboardStep(1);
    if (onboardSaveDir) onboardSaveDir.value = defaultSaveDir || "";
    if (onboardTheme) onboardTheme.value = settingsCache?.theme || "system";
    if (onboardReduceTransparency) onboardReduceTransparency.checked = !!settingsCache?.reduceTransparency;
    if (onboardDetectClipboard) onboardDetectClipboard.checked = settingsCache?.detectClipboardUrls !== false;
    onboardingModal.classList.add("open");
}

async function closeOnboardingModal(markCompleted = true) {
    if (!onboardingModal) return;
    onboardingModal.classList.remove("open");
    if (markCompleted && api) {
        try {
            await api.settingsSet({ firstRunCompleted: true });
            if (settingsCache) settingsCache.firstRunCompleted = true;
        } catch (_) {}
    }
}

async function completeOnboarding() {
    if (!api) return;
    const saveDirVal = (onboardSaveDir ? onboardSaveDir.value.trim() : "") || defaultSaveDir;
    const themeVal = onboardTheme ? onboardTheme.value : "system";
    const reduceVal = onboardReduceTransparency ? onboardReduceTransparency.checked : false;
    const clipboardVal = onboardDetectClipboard ? onboardDetectClipboard.checked : true;

    try {
        const patch = {
            firstRunCompleted: true,
            defaultSaveDir: saveDirVal,
            theme: themeVal,
            reduceTransparency: reduceVal,
            detectClipboardUrls: clipboardVal
        };
        const updated = await api.settingsSet(patch);
        settingsCache = updated;
        applyTheme(updated.theme || "system");
        applyTransparency(!!updated.reduceTransparency);
        defaultSaveDir = updated.defaultSaveDir || defaultSaveDir;
        if (defaultDirDisplay) {
            const dirLabel = defaultDirDisplay.querySelector(".dir-name");
            if (dirLabel) dirLabel.textContent = defaultSaveDir;
            else defaultDirDisplay.textContent = defaultSaveDir;
        }
        if (modalSaveDirInput) modalSaveDirInput.value = defaultSaveDir;
    } catch (e) {
        console.error("Failed to save onboarding settings:", e);
    }
    await closeOnboardingModal(false);
    showToast("TurboDM is ready.", "success");
}

function setupOnboardingModal() {
    if (!onboardingModal) return;

    if (onboardingCloseBtn) {
        onboardingCloseBtn.addEventListener("click", () => closeOnboardingModal(true));
    }

    if (onboardBackBtn) {
        onboardBackBtn.addEventListener("click", () => {
            if (currentOnboardStep > 1) {
                showOnboardStep(currentOnboardStep - 1);
            }
        });
    }

    if (onboardNextBtn) {
        onboardNextBtn.addEventListener("click", async () => {
            if (currentOnboardStep < 4) {
                showOnboardStep(currentOnboardStep + 1);
            } else {
                await completeOnboarding();
            }
        });
    }

    [onboardStepDot1, onboardStepDot2, onboardStepDot3, onboardStepDot4].forEach((dot, idx) => {
        if (!dot) return;
        dot.addEventListener("click", () => {
            showOnboardStep(idx + 1);
        });
    });

    if (onboardBrowseDirBtn) {
        onboardBrowseDirBtn.addEventListener("click", async () => {
            if (!api) return;
            const chosen = await api.selectFolder(onboardSaveDir.value || defaultSaveDir);
            if (chosen) {
                onboardSaveDir.value = chosen;
            }
        });
    }

    if (onboardTheme) {
        onboardTheme.addEventListener("change", () => {
            applyTheme(onboardTheme.value);
        });
    }

    if (onboardReduceTransparency) {
        onboardReduceTransparency.addEventListener("change", () => {
            applyTransparency(onboardReduceTransparency.checked);
        });
    }
}

let currentSitesCategory = "all";
let currentSitesQuery = "";

function openSupportedSitesModal() {
    if (!supportedSitesModal) return;
    supportedSitesModal.classList.add("open");
    if (sitesSearchInput) {
        sitesSearchInput.value = "";
        currentSitesQuery = "";
        if (sitesSearchClearBtn) sitesSearchClearBtn.style.display = "none";
        setTimeout(() => sitesSearchInput.focus(), 60);
    }
    renderSupportedSites();
}

function closeSupportedSitesModal() {
    if (!supportedSitesModal) return;
    supportedSitesModal.classList.remove("open");
}

function renderSupportedSites() {
    const popular = window.TURBODM_POPULAR_SITES || [];
    const extractors = window.TURBODM_ALL_EXTRACTORS || [];

    const q = currentSitesQuery.trim().toLowerCase();
    const cat = currentSitesCategory;

    const filteredPopular = popular.filter(item => {
        const matchesCategory = (cat === "all" || cat === "popular" || item.category === cat);
        if (!matchesCategory) return false;
        if (!q) return true;
        return item.name.toLowerCase().includes(q) ||
               item.domain.toLowerCase().includes(q) ||
               item.tags.some(t => t.toLowerCase().includes(q));
    });

    if (popularSitesGrid) {
        popularSitesGrid.innerHTML = filteredPopular.map(item => `
            <div class="site-card">
                <div class="site-card-header">
                    <span class="site-card-icon">${item.icon || "🌐"}</span>
                    <div>
                        <div class="site-card-name">${escapeHtml(item.name)}</div>
                        <div class="site-card-domain">${escapeHtml(item.domain)}</div>
                    </div>
                </div>
                <div class="site-card-tags">
                    ${item.tags.map(t => `<span class="site-tag">${escapeHtml(t)}</span>`).join("")}
                </div>
            </div>
        `).join("");
    }

    if (popularCountBadge) {
        popularCountBadge.textContent = `${filteredPopular.length} verified`;
    }

    const popularTitle = document.getElementById("sitesPopularTitle");
    if (popularTitle) {
        popularTitle.style.display = filteredPopular.length > 0 ? "flex" : "none";
    }

    let filteredExtractors = extractors;
    if (q) {
        filteredExtractors = extractors.filter(name => name.toLowerCase().includes(q));
    } else if (cat !== "all") {
        if (cat === "audio") {
            filteredExtractors = extractors.filter(n => /audio|music|sound|podcast|band|radio/i.test(n));
        } else if (cat === "video") {
            filteredExtractors = extractors.filter(n => /video|tube|tv|movie|stream/i.test(n));
        } else if (cat === "social") {
            filteredExtractors = extractors.filter(n => /insta|face|tweet|tik|pin|reddit|vk|thread/i.test(n));
        } else if (cat === "streaming") {
            filteredExtractors = extractors.filter(n => /stream|live|cast|twitch|kick|rumble/i.test(n));
        }
    }

    const displayList = q ? filteredExtractors.slice(0, 300) : filteredExtractors.slice(0, 160);

    if (allExtractorsContainer) {
        allExtractorsContainer.innerHTML = displayList.map(name =>
            `<span class="extractor-chip" title="${escapeHtml(name)}">${escapeHtml(name)}</span>`
        ).join("");
    }

    if (sitesCountBadge) {
        sitesCountBadge.textContent = `${filteredExtractors.length} services`;
    }

    const allTitle = document.getElementById("allExtractorsTitle");
    if (allTitle) {
        allTitle.style.display = filteredExtractors.length > 0 ? "flex" : "none";
    }
    if (allExtractorsContainer) {
        allExtractorsContainer.style.display = filteredExtractors.length > 0 ? "flex" : "none";
    }

    if (sitesNoMatch) {
        sitesNoMatch.style.display = (filteredPopular.length === 0 && filteredExtractors.length === 0) ? "block" : "none";
    }
}

function setupSupportedSitesModal() {
    if (!supportedSitesModal) return;

    if (supportedSitesCloseBtn) {
        supportedSitesCloseBtn.addEventListener("click", closeSupportedSitesModal);
    }
    if (supportedSitesDoneBtn) {
        supportedSitesDoneBtn.addEventListener("click", closeSupportedSitesModal);
    }

    if (addSupportedSitesBtn) {
        addSupportedSitesBtn.addEventListener("click", (e) => {
            e.preventDefault();
            openSupportedSitesModal();
        });
    }

    if (helpSupportedSitesBtn) {
        helpSupportedSitesBtn.addEventListener("click", () => {
            closeHelpModal();
            openSupportedSitesModal();
        });
    }

    if (sitesSearchInput) {
        sitesSearchInput.addEventListener("input", (e) => {
            currentSitesQuery = e.target.value;
            if (sitesSearchClearBtn) {
                sitesSearchClearBtn.style.display = currentSitesQuery ? "block" : "none";
            }
            renderSupportedSites();
        });
    }

    if (sitesSearchClearBtn) {
        sitesSearchClearBtn.addEventListener("click", () => {
            if (sitesSearchInput) sitesSearchInput.value = "";
            currentSitesQuery = "";
            sitesSearchClearBtn.style.display = "none";
            renderSupportedSites();
            if (sitesSearchInput) sitesSearchInput.focus();
        });
    }

    if (sitesCategoryTabs) {
        const pills = sitesCategoryTabs.querySelectorAll(".category-pill");
        pills.forEach(pill => {
            pill.addEventListener("click", () => {
                pills.forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                currentSitesCategory = pill.getAttribute("data-category") || "all";
                renderSupportedSites();
            });
        });
    }

    if (btnOpenYtdlpSitesDoc) {
        btnOpenYtdlpSitesDoc.addEventListener("click", (e) => {
            e.preventDefault();
            if (api && api.openExternal) {
                api.openExternal("https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md");
            }
        });
    }
}

function setupContextMenu() {
    window.addEventListener("click", () => {
        contextMenu.style.display = "none";
    });

    ctxResume.addEventListener("click", async () => {
        if (contextMenuTargetId && api) await api.resumeTask(contextMenuTargetId);
    });

    ctxPause.addEventListener("click", async () => {
        if (contextMenuTargetId && api) await api.pauseTask(contextMenuTargetId);
    });

    ctxOpenFile.addEventListener("click", async () => {
        if (contextMenuTargetId && api) {
            const task = tasksMap.get(contextMenuTargetId);
            if (task) {
                const res = await api.openFile(task.filePath);
                if (!res?.success) await api.showInFolder(task.filePath);
            }
        }
    });

    ctxOpenFolder.addEventListener("click", async () => {
        if (contextMenuTargetId && api) {
            const task = tasksMap.get(contextMenuTargetId);
            if (task) await api.showInFolder(task.filePath);
        }
    });

    ctxCopyUrl.addEventListener("click", () => {
        if (contextMenuTargetId) {
            const task = tasksMap.get(contextMenuTargetId);
            if (task && task.url) {
                navigator.clipboard.writeText(task.url);
                showToast("Download link copied to clipboard", "success");
            }
        }
    });

    ctxDelete.addEventListener("click", () => {
        if (contextMenuTargetId) {
            const task = tasksMap.get(contextMenuTargetId);
            if (task) promptDeleteTask(task);
        }
    });
}

function showContextMenu(x, y, taskId) {
    contextMenuTargetId = taskId;
    const task = tasksMap.get(taskId);
    if (!task) return;

    ctxResume.style.display = (task.status === "paused" || task.status === "failed") ? "flex" : "none";
    ctxPause.style.display = (task.status === "downloading" || task.status === "connecting") ? "flex" : "none";
    ctxOpenFile.style.display = task.status === "completed" ? "flex" : "none";
    ctxOpenFolder.style.display = "flex";
    ctxCopyUrl.style.display = "flex";
    ctxDelete.style.display = "flex";

    contextMenu.style.left = `${Math.min(window.innerWidth - 200, x)}px`;
    contextMenu.style.top = `${Math.min(window.innerHeight - 240, y)}px`;
    contextMenu.style.display = "block";
}

function setupDragAndDrop() {
    const overlay = document.getElementById("dragDropOverlay");
    let dragCounter = 0;

    window.addEventListener("dragenter", (e) => {
        e.preventDefault();
        dragCounter++;
        if (overlay) overlay.classList.add("active");
    });

    window.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    });

    window.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            if (overlay) overlay.classList.remove("active");
        }
    });

    window.addEventListener("drop", async (e) => {
        e.preventDefault();
        dragCounter = 0;
        if (overlay) overlay.classList.remove("active");

        const urls = [];

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            for (const file of e.dataTransfer.files) {
                if (file.name.endsWith(".txt") || file.type.startsWith("text/")) {
                    try {
                        const content = await file.text();
                        const lines = content.split(/[\r\n]+/);
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (/^https?:\/\//i.test(trimmed) && !urls.includes(trimmed)) {
                                urls.push(trimmed);
                            }
                        }
                    } catch (_) {}
                }
            }
        }

        const uriList = e.dataTransfer.getData("text/uri-list");
        if (uriList) {
            const lines = uriList.split(/[\r\n]+/);
            for (const line of lines) {
                const trimmed = line.trim();
                if (/^https?:\/\//i.test(trimmed) && !urls.includes(trimmed)) {
                    urls.push(trimmed);
                }
            }
        }

        const plainText = e.dataTransfer.getData("text/plain");
        if (plainText) {
            const matches = plainText.match(/https?:\/\/[^\s"'<>]+/gi);
            if (matches) {
                for (const m of matches) {
                    if (!urls.includes(m)) urls.push(m);
                }
            }
        }

        if (urls.length === 0) return;

        for (const url of urls) {
            try {
                await startSmartDownload(url, { source: "drag-drop" });
            } catch (err) {
                console.error("Drag-drop download failed for:", url, err);
            }
        }
        renderTable();
    });
}

async function deleteTaskDirect(id, deleteFile = false) {
    if (!id) return;
    deletedTaskIds.add(id);
    tasksMap.delete(id);
    if (selectedTaskId === id) selectedTaskId = null;
    const row = document.getElementById(`row-${id}`);
    if (row) row.remove();
    renderTable();
    updateSidebarCounts();
    updateGlobalMetrics();
    updateRibbonState();
    if (api) await api.deleteTask(id, deleteFile);
}

function setupModals() {
    modalCloseBtn.addEventListener("click", closeAddModal);
    modalCancelBtn.addEventListener("click", closeAddModal);
    probeUrlBtn.addEventListener("click", inspectUrl);

    browseDirBtn.addEventListener("click", async () => {
        if (api) {
            const chosen = await api.selectFolder(modalSaveDirInput.value || defaultSaveDir);
            if (chosen) modalSaveDirInput.value = chosen;
        }
    });

    modalStartBtn.addEventListener("click", async () => {
        const url = modalUrlInput.value.trim();
        if (!url) {
            modalUrlInput.focus();
            return;
        }

        const fileName = modalFileNameInput.value.trim() || probedFileName.textContent;
        const saveDir = modalSaveDirInput.value.trim() || defaultSaveDir;

        if (lastProbeInfo?.isYtDlp && lastProbeInfo.ytInfo) {
            const fmtOptions = formatOptionsFromPicker(modalFormatSelect.value, lastProbeInfo.ytInfo);
            const taskOptions = {
                url,
                fileName: fileName && fileName !== "—" ? fileName : null,
                saveDir,
                autoStart: true,
                cookieProfileId: currentCookieSelection(),
                ...fmtOptions,
                mergeFormat: settingsCache?.preferredFormat || null,
                concurrentFragments: settingsCache?.concurrentFragments || null,
                limitRate: settingsCache?.limitRate || null,
                embedThumbnail: !!settingsCache?.embedThumbnail,
                embedMetadata: !!settingsCache?.embedMetadata,
                proxy: settingsCache?.proxy || null
            };

            modalStartBtn.disabled = true;
            modalStartBtn.textContent = "Starting...";

            try {
                if (api) {
                    const task = await api.createTask(taskOptions);
                    tasksMap.set(task.id, normalizeTask(task));
                    closeAddModal();
                    renderTable();
                    updateSidebarCounts();
                    selectTaskRow(task.id);
                }
            } catch (err) {
                showToast("Error starting download: " + (err.message || err), "error");
            } finally {
                modalStartBtn.disabled = false;
                modalStartBtn.textContent = "Download Now";
            }
            return;
        }

        modalStartBtn.disabled = true;
        modalStartBtn.textContent = "Checking…";
        let route = { engine: "http" };
        try {
            route = await api.routeUrl(url);
        } catch (_) {}

        const alwaysAsk = settingsCache ? settingsCache.alwaysAsk !== false : true;
        if (route.engine !== "ytdlp" || !alwaysAsk) {

            try {
                if (api) {
                    const task = await api.createTask({
                        url,
                        fileName: fileName && fileName !== "—" ? fileName : null,
                        saveDir,
                        autoStart: true,
                        cookieProfileId: currentCookieSelection(),
                        connections: settingsCache?.maxConnections || null,
                        mergeFormat: settingsCache?.preferredFormat || null,
                        concurrentFragments: settingsCache?.concurrentFragments || null,
                        limitRate: settingsCache?.limitRate || null,
                        embedThumbnail: !!settingsCache?.embedThumbnail,
                        embedMetadata: !!settingsCache?.embedMetadata,
                        proxy: settingsCache?.proxy || null,
                        quality: settingsCache?.defaultQuality ?? "best"
                    });
                    tasksMap.set(task.id, normalizeTask(task));
                    closeAddModal();
                    renderTable();
                    updateSidebarCounts();
                    selectTaskRow(task.id);
                }
            } catch (err) {
                showToast("Error starting download: " + (err.message || err), "error");
            } finally {
                modalStartBtn.disabled = false;
                modalStartBtn.textContent = "Download Now";
            }
            return;
        }

        modalStartBtn.disabled = false;
        modalStartBtn.textContent = "Download Now";
        closeAddModal();
        await startSmartDownload(url, {
            fileName: fileName && fileName !== "—" ? fileName : null,
            saveDir,
            source: "modal"
        });
    });

    deleteModalCloseBtn.addEventListener("click", closeDeleteModal);
    deleteCancelBtn.addEventListener("click", closeDeleteModal);
    deleteConfirmBtn.addEventListener("click", async () => {
        if (pendingDeleteTask) {
            const task = pendingDeleteTask;
            const id = task.id;
            const deleteFile = deleteFileCheckbox.checked;
            closeDeleteModal();
            await deleteTaskDirect(id, deleteFile);
            showToast(`Deleted "${task.fileName}"`, "info");
        }
    });
}

function openAddModal() {
    addModal.classList.add("open");
    modalUrlInput.value = "";
    modalFileNameInput.value = "";
    modalSaveDirInput.value = defaultSaveDir;
    probedCard.style.display = "none";
    probeError.style.display = "none";
    ytOptionsSection.style.display = "none";
    modalFormatSelect.innerHTML = "";
    lastProbeInfo = null;
    refreshCookieSelect();
    modalUrlInput.focus();
}

function closeAddModal() {
    addModal.classList.remove("open");
}

let lastProbeInfo = null;

function currentCookieSelection() {
    const v = modalCookieSelect.value;
    if (!v || v === "default") return null;
    if (v === "none") return "none";
    return v;
}

function populateFormatOptions(sel, ytInfo, settings) {
    sel.innerHTML = "";
    const q = settings?.defaultQuality ?? "best";
    const qLabel = q === "best" ? "Best available (efficient codecs)"
        : q === "max" ? "Highest quality (max bitrate)"
        : q === "audio" ? "Audio only"
        : `${q}p cap`;
    const auto = document.createElement("option");
    auto.value = "auto";
    auto.textContent = `⭐ Best quality — ${qLabel} (recommended)`;
    sel.appendChild(auto);

    const formats = (ytInfo?.formats || []).filter(f => f.formatId);

    const premerged = formats.filter(f => f.hasVideo && f.hasAudio).sort((a, b) => (b.height || 0) - (a.height || 0));

    const videoOnly = formats.filter(f => f.hasVideo && !f.hasAudio).sort((a, b) => (b.height || 0) - (a.height || 0));

    const audioOnly = formats.filter(f => f.hasAudio && !f.hasVideo).sort((a, b) => (b.tbr || 0) - (a.tbr || 0));

    const addOpt = (value, label) => {
        const o = document.createElement("option");
        o.value = value;
        o.textContent = label;
        sel.appendChild(o);
    };

    if (premerged.length || videoOnly.length) {
        const g1 = document.createElement("optgroup");
        g1.label = "Video";
        for (const f of premerged) {
            const o = document.createElement("option");
            o.value = `id:${f.formatId}`;
            o.textContent = `${f.height ? f.height + "p" : "video"} · ${f.ext} · pre-merged${f.filesize ? " · " + formatBytes(f.filesize) : ""}`;
            g1.appendChild(o);
        }
        for (const f of videoOnly.slice(0, 15)) {
            const o = document.createElement("option");
            o.value = `id:${f.formatId}`;
            o.textContent = `${f.height ? f.height + "p" : "video"} · ${f.ext} · ${f.vcodec || ""} + bestaudio${f.filesize ? " · " + formatBytes(f.filesize) : ""}`;
            g1.appendChild(o);
        }
        sel.appendChild(g1);
    }
    if (audioOnly.length) {
        const g2 = document.createElement("optgroup");
        g2.label = "Audio";
        for (const f of audioOnly.slice(0, 10)) {
            const o = document.createElement("option");
            o.value = `id:${f.formatId}`;
            o.textContent = `${f.ext} · ${Math.round(f.tbr || 0)}k${f.filesize ? " · " + formatBytes(f.filesize) : ""}`;
            g2.appendChild(o);
        }
        sel.appendChild(g2);
    }
}

async function inspectUrl() {
    const url = modalUrlInput.value.trim();
    if (!url) return;

    probeUrlBtn.disabled = true;
    probeUrlBtn.textContent = "...";
    probeError.style.display = "none";
    ytOptionsSection.style.display = "none";

    try {
        if (!api) return;
        const info = await api.probeUrl(url, currentCookieSelection());
        lastProbeInfo = info;

        if (info.error && !info.isYtDlp) {
            probeError.textContent = `⚠️ ${info.error}`;
            probeError.style.display = "block";
        }

        probedFileName.textContent = info.fileName || "unknown";
        modalFileNameInput.value = info.fileName || "";
        probedSize.textContent = info.totalSize ? formatBytes(info.totalSize) : "Unknown Size";

        const subfolder = getCategorySubfolder(info.fileName);
        probedCategory.textContent = subfolder;
        const sep = defaultSaveDir.includes("\\") ? "\\" : "/";
        probedFolder.textContent = `${defaultSaveDir}${sep}${subfolder}${sep}`;

        const yt = info.ytInfo;
        if (info.isYtDlp && yt) {
            if (yt.thumbnail) {
                probedThumb.src = yt.thumbnail;
                probedThumb.style.display = "block";
            } else {
                probedThumb.style.display = "none";
            }
            const bits = [yt.uploader, yt.duration ? `⏱ ${yt.duration}s` : null, yt.extractorKey].filter(Boolean);
            if (bits.length) {
                probedMeta.textContent = bits.join("  •  ");
                probedMetaRow.style.display = "flex";
            } else {
                probedMetaRow.style.display = "none";
            }
            populateFormatOptions(modalFormatSelect, yt, settingsCache);
            ytOptionsSection.style.display = "block";
            if (info.error) {
                probeError.textContent = `⚠️ ${info.error}`;
                probeError.style.display = "block";
            }
        } else {
            probedThumb.style.display = "none";
            probedMetaRow.style.display = "none";
        }

        probedCard.style.display = "flex";
    } catch (e) {
        probeError.textContent = `⚠️ Probe failed: ${e.message || e}`;
        probeError.style.display = "block";
        console.error("Probe error:", e);
    } finally {
        probeUrlBtn.disabled = false;
        probeUrlBtn.textContent = "Inspect";
    }
}

function promptDeleteTask(task) {
    pendingDeleteTask = task;
    deleteTaskTitle.textContent = `"${task.fileName}"`;
    deleteFileCheckbox.checked = false;
    deleteModal.classList.add("open");
}

function closeDeleteModal() {
    deleteModal.classList.remove("open");
    pendingDeleteTask = null;
}

function openCookieModal() {
    cookieModal.classList.add("open");
    cookiePasteArea.style.display = "none";
    cookieBrowserArea.style.display = "none";
    renderCookieList();
}

function closeCookieModal() {
    cookieModal.classList.remove("open");
    refreshCookieSelect();
}

function showCookieArea(area) {
    cookiePasteArea.style.display = area === "paste" ? "block" : "none";
    cookieBrowserArea.style.display = area === "browser" ? "block" : "none";
    if (area === "paste") cookiePasteName.focus();
    if (area === "browser") cookieBrowserName.focus();
}

function setupCookieManager() {
    if (!api) return;
    toolCookiesBtn.addEventListener("click", openCookieModal);
    modalManageCookiesBtn.addEventListener("click", openCookieModal);
    cookieModalCloseBtn.addEventListener("click", closeCookieModal);
    cookieDoneBtn.addEventListener("click", closeCookieModal);
    cookiePasteBtn.addEventListener("click", () => showCookieArea("paste"));
    cookieBrowserBtn.addEventListener("click", () => showCookieArea("browser"));
    cookiePasteCancelBtn.addEventListener("click", () => showCookieArea("none"));
    cookieBrowserCancelBtn.addEventListener("click", () => showCookieArea("none"));

    cookiePasteSaveBtn.addEventListener("click", async () => {
        const name = cookiePasteName.value.trim();
        const content = cookiePasteContent.value;
        if (!name) { cookiePasteName.focus(); return; }
        cookiePasteSaveBtn.disabled = true;
        try {
            const res = await api.cookiesCreateFile(name, content);
            if (res.ok) {
                cookiePasteName.value = "";
                cookiePasteContent.value = "";
                showCookieArea("none");
                renderCookieList();
                refreshCookieSelect();
                showToast("Cookie profile saved", "success");
            } else {
                showToast(res.error || "Could not save cookie profile", "error");
            }
        } finally {
            cookiePasteSaveBtn.disabled = false;
        }
    });

    cookieBrowserSaveBtn.addEventListener("click", async () => {
        const name = cookieBrowserName.value.trim();
        const browser = cookieBrowserSelect.value;
        const profile = cookieBrowserProfile.value.trim();
        if (!name) { cookieBrowserName.focus(); return; }
        cookieBrowserSaveBtn.disabled = true;
        try {
            const spec = profile ? `${browser}:${profile}` : browser;
            const res = await api.cookiesCreateBrowser(name, spec);
            if (res.ok) {
                cookieBrowserName.value = "";
                cookieBrowserProfile.value = "";
                showCookieArea("none");
                renderCookieList();
                refreshCookieSelect();
                showToast("Browser cookie profile added", "success");
            } else {
                showToast(res.error || "Could not save browser profile", "error");
            }
        } finally {
            cookieBrowserSaveBtn.disabled = false;
        }
    });

    cookieImportBtn.addEventListener("click", async () => {
        cookieImportBtn.disabled = true;
        try {
            const res = await api.cookiesImportFile(null);
            if (res.ok) {
                renderCookieList();
                refreshCookieSelect();
                showToast("Cookie file imported", "success");
            } else if (res.error) {
                showToast(res.error, "error");
            }
        } finally {
            cookieImportBtn.disabled = false;
        }
    });
}

async function refreshCookieProfiles() {
    if (!api) return;
    try {
        const res = await api.cookiesList();
        if (res.ok) {
            cookieProfilesCache = { profiles: res.profiles || [], defaultProfileId: res.defaultProfileId ?? null };
        }
    } catch (_) {}
}

async function renderCookieList() {
    await refreshCookieProfiles();
    const { profiles, defaultProfileId } = cookieProfilesCache;
    cookieProfileList.innerHTML = "";

    if (!profiles.length) {
        cookieProfileList.innerHTML = `<div class="cookie-empty">No cookie profiles yet. Import a cookies.txt, paste one, or add a browser profile above.</div>`;
        return;
    }

    for (const p of profiles) {
        const isDefault = p.id === defaultProfileId;
        const badge = p.type === "browser" ? "BROWSER" : "FILE";
        const meta = p.type === "browser"
            ? `${p.browserSpec}`
            : `${p.cookieCount ?? "?"} cookies${p.domains?.length ? " · " + p.domains.slice(0, 3).join(", ") : ""}`;
        const lastUsed = p.lastUsed ? new Date(p.lastUsed).toLocaleString() : "never used";

        const starSvg = isDefault
            ? `<svg class="row-action-svg" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
            : `<svg class="row-action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
        const trashSvg = `<svg class="row-action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

        const row = document.createElement("div");
        row.className = "profile-row";
        row.innerHTML = `
            <div class="profile-info">
                <div class="profile-name-line">
                    <span class="profile-name">${escapeHtml(p.name)}</span>
                    <span class="profile-badge ${p.type === "browser" ? "badge-browser" : "badge-file"}">${badge}</span>
                    ${isDefault ? `<span class="profile-badge badge-default">DEFAULT</span>` : ""}
                </div>
                <div class="profile-meta">${escapeHtml(meta)} · last used ${lastUsed}</div>
            </div>
            <div class="profile-actions">
                <button class="row-action-btn" data-cookie-action="default" title="${isDefault ? "Unset default" : "Set as default"}">${starSvg}</button>
                <button class="row-action-btn" data-cookie-action="delete" title="Delete profile">${trashSvg}</button>
            </div>
        `;

        row.querySelector('[data-cookie-action="default"]').addEventListener("click", async () => {
            await api.cookiesSetDefault(isDefault ? null : p.id);
            renderCookieList();
            refreshCookieSelect();
            showToast(isDefault ? "Default profile cleared" : `Set "${p.name}" as default`, "info");
        });

        const delBtn = row.querySelector('[data-cookie-action="delete"]');
        delBtn.addEventListener("click", async () => {
            if (delBtn.dataset.confirm !== "1") {
                delBtn.dataset.confirm = "1";
                delBtn.classList.add("btn-danger-confirm");
                delBtn.title = "Click again to confirm deletion";
                setTimeout(() => { delBtn.dataset.confirm = "0"; delBtn.classList.remove("btn-danger-confirm"); }, 2500);
                return;
            }
            await api.cookiesDelete(p.id);
            renderCookieList();
            refreshCookieSelect();
            showToast(`Deleted cookie profile "${p.name}"`, "info");
        });

        cookieProfileList.appendChild(row);
    }
}

function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function refreshCookieSelect() {
    if (!api) return;
    await refreshCookieProfiles();
    const { profiles, defaultProfileId } = cookieProfilesCache;
    const prev = modalCookieSelect.value;
    modalCookieSelect.innerHTML = "";

    const optDefault = document.createElement("option");
    const defProfile = profiles.find(p => p.id === defaultProfileId);
    optDefault.value = "default";
    optDefault.textContent = defProfile ? `⭐ Default profile (${defProfile.name})` : "Use default profile (none set)";
    modalCookieSelect.appendChild(optDefault);

    const optNone = document.createElement("option");
    optNone.value = "none";
    optNone.textContent = "No cookies";
    modalCookieSelect.appendChild(optNone);

    for (const p of profiles) {
        const o = document.createElement("option");
        o.value = p.id;
        o.textContent = `${p.type === "browser" ? "🌐" : "📄"} ${p.name}`;
        modalCookieSelect.appendChild(o);
    }

    if (profiles.some(p => p.id === prev) || prev === "none") {
        modalCookieSelect.value = prev;
    } else if (defaultProfileId) {
        modalCookieSelect.value = "default";
    } else if (profiles.length === 1) {
        modalCookieSelect.value = profiles[0].id;
    } else {
        modalCookieSelect.value = "default";
    }
}

async function loadSettingsCache() {
    if (!api) return;
    try {
        const res = await api.settingsGet();
        settingsCache = res.settings;
        if (settingsCache?.theme) {
            applyTheme(settingsCache.theme);
        } else {
            applyTheme("system");
        }
        applyTransparency(!!settingsCache?.reduceTransparency);
        if (res.cookiesNotice && cookieNoticeText) {
            cookieNoticeText.textContent = res.cookiesNotice;
        }

        if (settingsCache && settingsCache.firstRunCompleted === false) {
            setTimeout(() => {
                openOnboardingModal();
            }, 350);
        }
    } catch (_) {}
}

function openSettingsModal() {
    settingsModal.classList.add("open");
    settingsDirty = false;
    if (settingsDirtyBadge) settingsDirtyBadge.style.display = "none";
    settingsCancelBtn.dataset.confirm = "0";
    settingsCancelBtn.textContent = "Cancel";
    settingsSaveBtn.disabled = false;
    settingsSaveBtn.textContent = "Save Settings";
    settingsError.style.display = "none";
    fillSettingsForm();
    refreshYtdlpStatus();
    refreshBunStatus();
}

function closeSettingsModal() {
    settingsModal.classList.remove("open");
    settingsDirty = false;
    if (settingsDirtyBadge) settingsDirtyBadge.style.display = "none";
    settingsCancelBtn.dataset.confirm = "0";
    settingsCancelBtn.textContent = "Cancel";
    settingsSaveBtn.disabled = false;
    settingsSaveBtn.textContent = "Save Settings";
    settingsError.style.display = "none";
    loadSettingsCache();
}

function requestCloseSettings() {
    if (!settingsDirty) {
        closeSettingsModal();
        return;
    }
    if (settingsCancelBtn.dataset.confirm === "1") {
        closeSettingsModal();
        return;
    }
    settingsCancelBtn.dataset.confirm = "1";
    settingsCancelBtn.textContent = "Discard changes";
    settingsError.textContent = "⚠ You have unsaved changes. Press Save Settings, or Discard changes to close without saving.";
    settingsError.style.display = "block";
    setTimeout(() => {
        if (settingsCancelBtn.dataset.confirm === "1") {
            settingsCancelBtn.dataset.confirm = "0";
            if (settingsModal.classList.contains("open")) {
                settingsCancelBtn.textContent = "Cancel";
            }
        }
    }, 4000);
}

function fillSettingsForm() {
    const s = settingsCache || {};
    if (setTheme) setTheme.value = s.theme || "system";
    if (setReduceTransparency) setReduceTransparency.checked = !!s.reduceTransparency;
    if (setDetectClipboard) setDetectClipboard.checked = s.detectClipboardUrls !== false;
    if (setCloseToTray) setCloseToTray.checked = s.closeToTray !== false;
    setSaveDir.value = s.defaultSaveDir || defaultSaveDir;
    setMaxConcurrent.value = s.maxConcurrent ?? 5;
    setMaxConnections.value = s.maxConnections ?? 32;
    setFragments.value = s.concurrentFragments ?? 16;
    setPreferredFormat.value = s.preferredFormat || "mp4";
    setDefaultQuality.value = String(s.defaultQuality ?? "best");
    setEmbedThumb.checked = !!s.embedThumbnail;
    setEmbedMeta.checked = !!s.embedMetadata;
    setAlwaysAsk.checked = s.alwaysAsk !== false;
    setLimitRate.value = s.limitRate || "";
    setProxy.value = s.proxy || "";
    setYtdlpChannel.value = s.ytdlpChannel || "stable";
    setAutoUpdate.checked = !!s.autoUpdateYtdlp;
    fillDefaultCookieSelect(s.defaultCookieProfileId ?? null);
    if (settingsDirtyBadge) settingsDirtyBadge.style.display = "none";
}

async function fillDefaultCookieSelect(selectedId) {
    await refreshCookieProfiles();
    const { profiles } = cookieProfilesCache;
    setDefaultCookie.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "(none)";
    setDefaultCookie.appendChild(none);
    for (const p of profiles) {
        const o = document.createElement("option");
        o.value = p.id;
        o.textContent = p.name;
        setDefaultCookie.appendChild(o);
    }
    setDefaultCookie.value = profiles.some(p => p.id === selectedId) ? selectedId : "";
}

function setupSettingsUI() {
    if (!api) return;
    toolCookiesBtn.addEventListener("click", openCookieModal);
    toolSettingsBtn.addEventListener("click", openSettingsModal);
    engineBannerRetry.addEventListener("click", checkEngineStatus);

    settingsModalCloseBtn.addEventListener("click", requestCloseSettings);
    settingsCancelBtn.addEventListener("click", requestCloseSettings);

    const markDirty = () => {
        if (settingsDirty) return;
        settingsDirty = true;
        settingsCancelBtn.textContent = "Discard changes";
        if (settingsDirtyBadge) settingsDirtyBadge.style.display = "inline-flex";
    };
    settingsModal.addEventListener("input", markDirty);
    settingsModal.addEventListener("change", markDirty);

    setBrowseDirBtn.addEventListener("click", async () => {
        const chosen = await api.selectFolder(setSaveDir.value || defaultSaveDir);
        if (chosen) {
            setSaveDir.value = chosen;
            markDirty();
        }
    });

    if (btnLaunchOnboarding) {
        btnLaunchOnboarding.addEventListener("click", () => {
            closeSettingsModal();
            openOnboardingModal();
        });
    }

    settingsSaveBtn.addEventListener("click", async () => {
        settingsError.style.display = "none";
        const patch = {
            theme: setTheme ? setTheme.value : (settingsCache?.theme || "system"),
            reduceTransparency: setReduceTransparency ? setReduceTransparency.checked : (settingsCache?.reduceTransparency || false),
            detectClipboardUrls: setDetectClipboard ? setDetectClipboard.checked : true,
            closeToTray: setCloseToTray ? setCloseToTray.checked : true,
            defaultSaveDir: setSaveDir.value.trim(),
            maxConcurrent: parseInt(setMaxConcurrent.value, 10),
            maxConnections: parseInt(setMaxConnections.value, 10),
            concurrentFragments: parseInt(setFragments.value, 10),
            preferredFormat: setPreferredFormat.value,
            defaultQuality: ["best", "audio", "max"].includes(setDefaultQuality.value) ? setDefaultQuality.value : parseInt(setDefaultQuality.value, 10),
            defaultCookieProfileId: setDefaultCookie.value || null,
            embedThumbnail: setEmbedThumb.checked,
            embedMetadata: setEmbedMeta.checked,
            alwaysAsk: setAlwaysAsk.checked,
            limitRate: setLimitRate.value.trim(),
            proxy: setProxy.value.trim(),
            ytdlpChannel: setYtdlpChannel.value,
            autoUpdateYtdlp: setAutoUpdate.checked
        };
        settingsSaveBtn.disabled = true;
        settingsSaveBtn.textContent = "Saving…";
        try {
            const updated = await api.settingsSet(patch);
            settingsCache = updated;
            settingsDirty = false;
            applyTheme(updated.theme || "system");
            applyTransparency(!!updated.reduceTransparency);
            defaultSaveDir = updated.defaultSaveDir || defaultSaveDir;
            defaultDirDisplay.textContent = `📂 ${defaultSaveDir}`;
            modalSaveDirInput.value = defaultSaveDir;
            if (settingsDirtyBadge) settingsDirtyBadge.style.display = "none";
            settingsSaveBtn.textContent = "✔ Saved";
            showToast("Settings saved successfully", "success");
            setTimeout(closeSettingsModal, 600);
        } catch (err) {
            settingsSaveBtn.disabled = false;
            settingsSaveBtn.textContent = "Save Settings";
            settingsError.textContent = `⚠ ${err.message || err}`;
            settingsError.style.display = "block";
            showToast(`Could not save settings: ${err.message || err}`, "error");
        }
    });

    ytdlpUpdateBtn.addEventListener("click", async () => {
        ytdlpUpdateBtn.disabled = true;
        ytdlpUpdateBtn.textContent = "Updating…";
        try {
            const res = await api.ytdlpUpdate();
            ytdlpStatusLine.textContent = `✔ Updated to ${res.version || "latest"} (channel: ${setYtdlpChannel.value})`;
        } catch (err) {
            ytdlpStatusLine.textContent = `⚠ Update failed: ${String(err.message || err).split("\n")[0]}`;
        } finally {
            ytdlpUpdateBtn.disabled = false;
            ytdlpUpdateBtn.textContent = "Check & Update";
        }
    });

    if (bunUpdateBtn) {
        bunUpdateBtn.addEventListener("click", async () => {
            bunUpdateBtn.disabled = true;
            bunUpdateBtn.textContent = "Upgrading…";
            try {
                const res = await api.bunUpdate();
                if (res.success) {
                    showToast(`Bun updated: v${res.version || "latest"}`, "success");
                    if (bunStatusLine) bunStatusLine.textContent = `✔ Bun v${res.version}`;
                } else {
                    showToast(`Bun upgrade failed: ${res.error || "unknown"}`, "error");
                    if (bunStatusLine) bunStatusLine.textContent = `✖ Upgrade failed`;
                }
            } catch (err) {
                showToast(`Bun upgrade error: ${err.message || err}`, "error");
            } finally {
                bunUpdateBtn.disabled = false;
                bunUpdateBtn.textContent = "Check & Upgrade Bun";
            }
        });
    }
}

async function refreshBunStatus() {
    if (!api || !api.bunStatus || !bunStatusLine) return;
    bunStatusLine.textContent = "checking…";
    try {
        const info = await api.bunStatus();
        if (info.available) {
            bunStatusLine.textContent = `✔ Bun v${info.version}`;
        } else {
            bunStatusLine.textContent = `✖ Bun not detected on PATH`;
        }
    } catch (err) {
        bunStatusLine.textContent = `✖ ${String(err.message || err).split("\n")[0]}`;
    }
}

async function refreshYtdlpStatus() {
    if (!api) return;
    ytdlpStatusLine.textContent = "checking…";
    try {
        const info = await api.ytdlpStatus();
        if (info.available) {
            ytdlpStatusLine.textContent = `✔ yt-dlp ${info.version || "?"} (${info.source}${info.ffmpeg ? " · ffmpeg ✔" : " · no ffmpeg"})`;
        } else {
            ytdlpStatusLine.textContent = `✖ yt-dlp unavailable: ${(info.error || "not found").split("\n")[0]}`;
        }
    } catch (err) {
        ytdlpStatusLine.textContent = `✖ ${String(err.message || err).split("\n")[0]}`;
    }
}

async function checkEngineStatus() {
    if (!api) return;
    try {
        const info = await api.ytdlpStatus();
        if (!info.available) {
            engineBannerText.textContent = "⚠ yt-dlp engine unavailable — video downloads are disabled until the binary can be downloaded (check your internet connection) or a system yt-dlp is installed.";
            engineBanner.style.display = "flex";
        } else {
            engineBanner.style.display = "none";
        }
    } catch (_) {
        engineBanner.style.display = "none";
    }
}

function smartShowPhase(phase) {
    smartCookiePhase.style.display = phase === "cookie" ? "block" : "none";
    smartQualityPhase.style.display = phase === "quality" ? "block" : "none";
    smartLoading.style.display = phase === "loading" ? "block" : "none";
    smartBackBtn.style.display = phase === "quality" ? "inline-block" : "none";
    smartNextBtn.textContent = phase === "quality" ? "Download Now" : "Continue";
    smartNextBtn.disabled = false;
}

function openSmartModal(url, { fileName = null, saveDir = null, source = "quick" } = {}) {
    smartState = { url, phase: "cookie", cookieProfileId: null, ytInfo: null, fileName, saveDir, source };
    smartCookieError.style.display = "none";
    smartQualityError.style.display = "none";
    smartThumb.style.display = "none";
    smartProbedCard.style.display = "none";
    smartFormatSelect.innerHTML = "";
    smartShowPhase("cookie");
    populateSmartCookieSelect();
    smartModal.classList.add("open");
}

function closeSmartModal() {
    smartModal.classList.remove("open");
    smartState = null;
    refreshCookieSelect();
}

async function populateSmartCookieSelect() {
    await refreshCookieProfiles();
    const { profiles, defaultProfileId } = cookieProfilesCache;
    smartCookieSelect.innerHTML = "";
    const optDefault = document.createElement("option");
    const defProfile = profiles.find(p => p.id === defaultProfileId);
    optDefault.value = "default";
    optDefault.textContent = defProfile ? `⭐ Default profile (${defProfile.name})` : "Use default profile (none set)";
    smartCookieSelect.appendChild(optDefault);
    const optNone = document.createElement("option");
    optNone.value = "none";
    optNone.textContent = "No cookies";
    smartCookieSelect.appendChild(optNone);
    for (const p of profiles) {
        const o = document.createElement("option");
        o.value = p.id;
        o.textContent = `${p.type === "browser" ? "🌐" : "📄"} ${p.name}`;
        smartCookieSelect.appendChild(o);
    }

    if (defaultProfileId) {
        smartCookieSelect.value = "default";
    } else if (profiles.length === 1) {
        smartCookieSelect.value = profiles[0].id;
    } else {
        smartCookieSelect.value = "default";
    }
}

function formatOptionsFromPicker(fmtVal, ytInfo) {
    const opts = {};
    if (fmtVal === "audio") {
        opts.audioOnly = true;
    } else if (fmtVal && fmtVal.startsWith("id:")) {
        const fmtId = fmtVal.slice(3);
        const fmt = (ytInfo?.formats || []).find(f => f.formatId === fmtId);
        opts.formatId = fmtId;
        opts.formatNeedsAudio = !!(fmt && fmt.hasVideo && !fmt.hasAudio);
    } else {
        opts.quality = settingsCache?.defaultQuality ?? "best";
    }
    return opts;
}

async function createTaskDirect(url, cookieProfileId, fmtOptions = null, { fileName = null, saveDir = null, source = "quick" } = {}) {
    const taskOptions = {
        url,
        fileName: fileName || null,
        saveDir: saveDir || defaultSaveDir,
        autoStart: true,
        cookieProfileId,
        connections: settingsCache?.maxConnections || null
    };
    if (fmtOptions) {
        Object.assign(taskOptions, fmtOptions);
        taskOptions.mergeFormat = settingsCache?.preferredFormat || null;
        taskOptions.concurrentFragments = settingsCache?.concurrentFragments || null;
        taskOptions.limitRate = settingsCache?.limitRate || null;
        taskOptions.embedThumbnail = !!settingsCache?.embedThumbnail;
        taskOptions.embedMetadata = !!settingsCache?.embedMetadata;
        taskOptions.proxy = settingsCache?.proxy || null;
    }
    const task = await api.createTask(taskOptions);
    tasksMap.set(task.id, normalizeTask(task));
    renderTable();
    updateSidebarCounts();
    selectTaskRow(task.id);
    if (source === "quick") quickUrlInput.value = "";
    return task;
}

async function startSmartDownload(url, { fileName = null, saveDir = null, source = "quick" } = {}) {
    if (!api || !url) return null;

    let route = { engine: "http", popups: { cookie: false, quality: false } };
    try {
        route = await api.routeUrl(url);
    } catch (_) {}
    if (!route.popups?.cookie) {

        return await createTaskDirect(url, null, null, { fileName, saveDir, source });
    }
    openSmartModal(url, { fileName, saveDir, source });
    return null;
}

async function smartGoQuality() {
    if (!smartState) return;
    const selection = smartCookieSelect.value;
    smartState.cookieProfileId = (!selection || selection === "default") ? null : (selection === "none" ? "none" : selection);
    smartCookieError.style.display = "none";
    smartShowPhase("loading");
    let info;
    try {
        info = await api.probeUrl(smartState.url, smartState.cookieProfileId);
    } catch (err) {
        smartState.phase = "cookie";
        smartShowPhase("cookie");
        smartCookieError.textContent = `⚠ ${err.message || err}`;
        smartCookieError.style.display = "block";
        return;
    }

    const yt = info.isYtDlp ? info.ytInfo : null;
    if (!yt) {

        smartState.phase = "cookie";
        smartShowPhase("cookie");
        const msg = info.error || "yt-dlp could not process this URL.";
        smartCookieError.textContent = `⚠ ${msg} — pick a different cookie profile and retry, or Cancel.`;
        smartCookieError.style.display = "block";
        return;
    }

    smartState.phase = "quality";
    smartState.ytInfo = yt;
    smartTitleVal.textContent = yt.title || "—";
    smartUploader.textContent = yt.uploader || "—";
    smartDuration.textContent = yt.duration ? formatEta(yt.duration) : "—";
    smartProbedCard.style.display = "flex";
    if (yt.thumbnail) {
        smartThumb.src = yt.thumbnail;
        smartThumb.style.display = "block";
    } else {
        smartThumb.style.display = "none";
    }
    populateFormatOptions(smartFormatSelect, yt, settingsCache);
    smartQualityError.style.display = "none";
    smartShowPhase("quality");
}

function setupSmartDownload() {
    if (!api) return;

    smartCancelBtn.addEventListener("click", closeSmartModal);
    smartCloseBtn.addEventListener("click", closeSmartModal);

    smartBackBtn.addEventListener("click", () => {
        if (!smartState) return;
        smartState.phase = "cookie";
        smartProbedCard.style.display = "none";
        smartShowPhase("cookie");
    });

    smartManageBtn.addEventListener("click", () => {
        openCookieModal();
    });

    smartNextBtn.addEventListener("click", async () => {
        if (!smartState) return;
        if (smartState.phase === "cookie") {
            await smartGoQuality();
            return;
        }

        const fmtOptions = formatOptionsFromPicker(smartFormatSelect.value, smartState.ytInfo);
        smartNextBtn.disabled = true;
        smartNextBtn.textContent = "Starting…";
        try {
            await createTaskDirect(smartState.url, smartState.cookieProfileId, fmtOptions, {
                fileName: smartState.fileName,
                saveDir: smartState.saveDir,
                source: smartState.source
            });
            closeSmartModal();
        } catch (err) {
            smartNextBtn.disabled = false;
            smartNextBtn.textContent = "Download Now";
            smartQualityError.textContent = `⚠ ${err.message || err}`;
            smartQualityError.style.display = "block";
        }
    });

    cookieDoneBtn.addEventListener("click", () => {
        if (smartState && smartModal.classList.contains("open")) {
            populateSmartCookieSelect();
        }
    });
}

function setupIPCListeners() {
    if (!api) return;

    if (api.onActionOpenAddModal) {
        api.onActionOpenAddModal(() => {
            openAddModal();
        });
    }

    api.onTaskState((rawState) => {
        if (!rawState || deletedTaskIds.has(rawState.id)) return;
        const task = normalizeTask(rawState);
        tasksMap.set(task.id, task);
                                queueRowUpdate(task);
    });

    api.onSegmentUpdate((payload) => {
        const id = payload.id || payload.total?.id;
        if (id && deletedTaskIds.has(id)) return;
        if (payload.total) {
            const task = normalizeTask(payload.total);
            tasksMap.set(task.id, task);
            queueRowUpdate(task);
        }
    });

    api.onTaskCompleted((rawState) => {
        if (!rawState || deletedTaskIds.has(rawState.id)) return;
        const task = normalizeTask(rawState);
        task.status = "completed";
        task.percent = 100;
        tasksMap.set(task.id, task);
        updateRowDOM(task);
        updateSidebarCounts();
        updateGlobalMetrics();
        updateRibbonState();
    });

    api.onTaskError(({ id, error }) => {
        if (!id || deletedTaskIds.has(id)) return;
        const task = tasksMap.get(id);
        if (task) {
            task.status = "failed";
            task.error = error;
            updateRowDOM(task);
            updateSidebarCounts();
            updateGlobalMetrics();
            updateRibbonState();
        }
    });
}
