import { EventEmitter } from "events";
import { join, dirname, basename } from "path";
import fs from "fs";
import crypto from "crypto";
import { DownloadStatus, FileCategory, getFileCategory, getCategoryFolder, SpeedTracker } from "./model.js";
import { downloadSegment } from "./worker.js";
import { isYtDlpUrl, isHlsUrl, probeWithYtDlp, YtDlpDownload, findDownloadedFile } from "./ytdlpEngine.js";
import { decideRoute } from "./smartRoute.js";

const MIN_SEGMENT_SIZE = 1 * 1024 * 1024;

const MIN_CONNECTIONS_FLOOR = 16;

const FALLBACK_PROBE_TIMEOUT_MS = 30000;

const PROBE_ATTEMPT_TIMEOUT_MS = 8000;
const PROBE_TOTAL_BUDGET_MS = 12000;

const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

const SENSITIVE_HEADER_KEYS = new Set(["cookie", "authorization", "proxy-authorization"]);


export function sanitizeHeadersForPersistence(headers) {
    if (!headers || typeof headers !== "object") {
        return { headers: {}, redacted: false };
    }
    const out = {};
    let redacted = false;
    for (const [key, value] of Object.entries(headers)) {
        if (SENSITIVE_HEADER_KEYS.has(String(key).toLowerCase())) {
            redacted = true;
            continue;
        }
        out[key] = value;
    }
    return { headers: out, redacted };
}

export function calcSegmentCount(totalSize, resumable, maxConnections = null) {
    if (!resumable || !totalSize || totalSize <= MIN_SEGMENT_SIZE) {
        return 1;
    }

    const bySize = Math.floor(totalSize / MIN_SEGMENT_SIZE);

                if (totalSize < 5 * 1024 * 1024) {
        return Math.max(1, Math.min(4, bySize));
    }
    const cap = Math.max(maxConnections || 0, MIN_CONNECTIONS_FLOOR);
    return Math.max(1, Math.min(cap, bySize));
}

export function createSegments(totalSize, numSegments) {
    if (!totalSize || totalSize <= 0) {
        return [{
            index: 1,
            start: 0,
            end: Infinity,
            size: 0,
            downloaded: 0,
            status: "pending",
            speed: 0
        }];
    }

    const segmentSize = Math.floor(totalSize / numSegments);
    const segments = [];

    for (let i = 0; i < numSegments; i++) {
        const start = i * segmentSize;
        const end = (i === numSegments - 1) ? totalSize : (i + 1) * segmentSize;
        segments.push({
            index: i + 1,
            start,
            end,
            size: end - start,
            downloaded: 0,
            status: "pending",
            speed: 0
        });
    }

    return segments;
}

export class ManagedDownload extends EventEmitter {
    constructor({
        id = crypto.randomUUID(),
        url,
        filename,
        savePath,
        totalSize = null,
        status = DownloadStatus.Queued,
        segments = [],
        category = FileCategory.Other,
        error = null,
        resumable = true,
        headers = {},
        headersRedacted = false,
        awaitingSlot = false,
        maxConnections = 8
    }) {
        super();
        this.id = id;
        this.url = url;
        this.filename = filename;
        this.fileName = filename;
        this.savePath = savePath;
        this.totalSize = totalSize;
        this.status = status;
        this.segments = segments;
        this.category = category || getFileCategory(filename);
        this.error = error;
        this.resumable = resumable;
        this.headers = headers;
                                this.headersRedacted = headersRedacted;
        this.awaitingSlot = awaitingSlot;
        this.maxConnections = maxConnections;

        this.speedTracker = new SpeedTracker();
        this._abortCtrl = null;
        this._fileHandle = null;
        this._workerPromises = [];
    }

    get downloadedBytes() {
        return this.segments.reduce((acc, s) => acc + (s.downloaded || 0), 0);
    }

    get percent() {
        if (!this.totalSize || this.totalSize <= 0) {
            return this.status === DownloadStatus.Completed ? 100 : 0;
        }
        return Math.min(100, parseFloat(((this.downloadedBytes / this.totalSize) * 100).toFixed(1)));
    }

    get speed() {
        return this.speedTracker.speed();
    }

    async start() {
        if (this.status === DownloadStatus.Downloading) return;
        this.status = DownloadStatus.Connecting;
        this.error = null;
        this._abortCtrl = new AbortController();
        this.emit("state", this.toJSON());

        try {
                        const fileExists = await fs.promises.access(this.savePath).then(() => true).catch(() => false);
            if (!fileExists) {
                const fh = await fs.promises.open(this.savePath, "w+");
                if (this.totalSize && this.totalSize > 0) {
                    await fh.truncate(this.totalSize);
                }
                await fh.close();
            }

            if (this._abortCtrl.signal.aborted || this.status === DownloadStatus.Paused || this.status === DownloadStatus.Cancelled) {
                return;
            }

            this.status = DownloadStatus.Downloading;
            this.emit("state", this.toJSON());

            let lastEmitTime = 0;
            const throttledEmit = (force = false) => {
                const now = performance.now();
                if (force || now - lastEmitTime >= 100) {
                    lastEmitTime = now;
                    this.speedTracker.record(this.downloadedBytes);
                    this.emit("state", this.toJSON());
                }
            };

            this._workerPromises = this.segments.map(seg => {
                if (seg.end !== Infinity && seg.start + (seg.downloaded || 0) >= seg.end) {
                    seg.status = "done";
                    return Promise.resolve();
                }

                return downloadSegment({
                    url: this.url,
                    filePath: this.savePath,
                    start: seg.start,
                    end: seg.end,
                    segmentState: seg,
                    abortCtrl: this._abortCtrl,
                    extraHeaders: this.headers,
                    onProgress: () => {
                        throttledEmit(false);
                    }
                });
            });

            const results = await Promise.allSettled(this._workerPromises);
            throttledEmit(true);

            if (this._abortCtrl.signal.aborted || this.status === DownloadStatus.Paused || this.status === DownloadStatus.Cancelled) {
                return;
            }

                        const isFinished = !this.totalSize || (this.downloadedBytes >= this.totalSize);
            if (isFinished) {
                this.status = DownloadStatus.Completed;
                this.speedTracker.reset();
                for (const seg of this.segments) {
                    seg.status = "done";
                    seg.downloaded = seg.size || seg.downloaded;
                }
                this.emit("completed", this.toJSON());
            } else {
                const failedWorker = results.find(r => r.status === "rejected");
                                const reason = failedWorker?.reason;
                throw (reason instanceof Error) ? reason : new Error(reason?.message || "Download ended prematurely");
            }

                        this._retryCount = 0;

        } catch (err) {
            if (this._abortCtrl?.signal?.aborted || this.status === DownloadStatus.Paused || this.status === DownloadStatus.Cancelled) {
                return;
            }

                                                            if (this.headersRedacted && (err?.statusCode === 401 || err?.statusCode === 403)) {
                this.status = DownloadStatus.Failed;
                this.error = "Authentication expired. Re-send this download from your browser.";
                this.speedTracker.reset();
                this.emit("error", this.error);
                return;
            }

                        this._retryCount = (this._retryCount || 0) + 1;
            const MAX_TASK_RETRIES = 10;

            if (this._retryCount <= MAX_TASK_RETRIES) {
                const backoffMs = Math.min(30000, 1500 * Math.pow(1.5, this._retryCount - 1) + Math.floor(Math.random() * 1000));
                this.status = DownloadStatus.Connecting;
                this.error = `Connection lost. Auto-retrying (${this._retryCount}/${MAX_TASK_RETRIES}) in ${(backoffMs / 1000).toFixed(1)}s...`;
                this.speedTracker.reset();
                this.emit("state", this.toJSON());

                clearTimeout(this._retryTimer);
                this._retryTimer = setTimeout(() => {
                    if (this.status !== DownloadStatus.Paused && this.status !== DownloadStatus.Cancelled) {
                        this.start().catch(() => {});
                    }
                }, backoffMs);
                return;
            }

            this.status = DownloadStatus.Failed;
            this.error = err.message || String(err);
            this.speedTracker.reset();
            this.emit("error", this.error);
        } finally {
            this.emit("state", this.toJSON());
        }
    }

    async pause() {
        if (this.status === DownloadStatus.Paused || this.status === DownloadStatus.Completed) return;
        clearTimeout(this._retryTimer);
        this.status = DownloadStatus.Paused;
        this.awaitingSlot = false;
        this.speedTracker.reset();
        if (this._abortCtrl) {
            try { this._abortCtrl.abort(); } catch (_) {}
        }
        await this._cleanup();
        this.emit("state", this.toJSON());
    }

    async cancel() {
        clearTimeout(this._retryTimer);
        this.status = DownloadStatus.Cancelled;
        this.awaitingSlot = false;
        this.speedTracker.reset();
        if (this._abortCtrl) {
            try { this._abortCtrl.abort(); } catch (_) {}
        }
        await this._cleanup();
        this.emit("state", this.toJSON());
    }

    async _cleanup() {
        if (this._fileHandle) {
            try { await this._fileHandle.close(); } catch (_) {}
            this._fileHandle = null;
        }
    }

    toJSON() {
        return {
            id: this.id,
            engine: "http",
            url: this.url,
            fileName: this.filename,
            filePath: this.savePath,
            totalSize: this.totalSize,
            downloadedBytes: this.downloadedBytes,
            percent: this.percent,
            speed: this.speed,
            status: this.status.toLowerCase(),
            actualConnections: this.segments.length || 1,
            requestedConnections: this.maxConnections,
            supportsRange: this.resumable,
            category: this.category,
            error: this.error,
            segments: this.segments.map(s => ({
                id: `${this.id}-s${s.index}`,
                index: s.index,
                start: s.start,
                end: s.end,
                size: s.size,
                downloaded: s.downloaded,
                progress: s.size > 0 ? Math.min(100, (s.downloaded / s.size) * 100) : 100,
                status: s.status,
                speed: s.speed || 0
            }))
        };
    }
}

export class DownloadEngine extends EventEmitter {
    constructor({ maxConcurrent = 3, storagePath = null } = {}) {
        super();
        this.downloads = new Map();
        this.maxConcurrent = maxConcurrent;
        this.storagePath = storagePath;
        this._progressPersistTimer = null;
    }

                                    static async _httpProbe(url, reqHeaders) {
        let response = null;
        let finalUrl = url;
        const started = Date.now();
        const budgetLeft = () => Date.now() - started < PROBE_TOTAL_BUDGET_MS;

                if (budgetLeft()) {
            try {
                const headRes = await fetch(url, {
                    method: "HEAD",
                    headers: reqHeaders,
                    redirect: "follow",
                    signal: AbortSignal.timeout(PROBE_ATTEMPT_TIMEOUT_MS)
                });
                if (headRes.ok || headRes.status === 301 || headRes.status === 302) {
                    response = headRes;
                    finalUrl = headRes.url || url;
                }
            } catch (_) {}
        }

                if ((!response || !response.ok) && budgetLeft()) {
            try {
                const getRes = await fetch(url, {
                    method: "GET",
                    headers: { ...reqHeaders, range: "bytes=0-0" },
                    redirect: "follow",
                    signal: AbortSignal.timeout(PROBE_ATTEMPT_TIMEOUT_MS)
                });
                if (getRes.ok || getRes.status === 206) {
                    response = getRes;
                    finalUrl = getRes.url || url;
                }
            } catch (_) {}
        }

                if ((!response || (!response.ok && response.status !== 206)) && budgetLeft()) {
            try {
                const plainRes = await fetch(url, {
                    method: "GET",
                    headers: reqHeaders,
                    redirect: "follow",
                    signal: AbortSignal.timeout(PROBE_ATTEMPT_TIMEOUT_MS)
                });
                if (plainRes.ok || plainRes.status === 206) {
                    response = plainRes;
                    finalUrl = plainRes.url || url;
                }
            } catch (_) {}
        }

                if (response?.body) {
            response.body.cancel().catch(() => {});
        }

        return { response, finalUrl };
    }

                        static async quickRoute(url, headers = {}) {
        if (isYtDlpUrl(url) || isHlsUrl(url)) {
            return { engine: "ytdlp", reason: "known-host" };
        }

        const reqHeaders = { "user-agent": DEFAULT_UA, "accept": "*/*", ...headers };
        let contentType = "";
        let ok = false;
        const { response } = await DownloadEngine._httpProbe(url, reqHeaders);
        if (response && (response.ok || response.status === 206)) {
            ok = true;
            contentType = response.headers.get("content-type") || "";
        }

        const engine = decideRoute({ url, contentType, probeOk: ok });
        return { engine, reason: engine === "ytdlp" ? "content-fallback" : "direct" };
    }

                                static async resolveFileInfo(url, headers = {}, cookieArgs = []) {
        const wantsYtDlp = isYtDlpUrl(url) || isHlsUrl(url);

        if (wantsYtDlp) {
            const { info, error } = await probeWithYtDlp(url, headers, cookieArgs);
            if (info) {
                return {
                    url,
                    finalUrl: url,
                    fileName: info.fileName,
                    totalSize: info.totalSize,
                    supportsRange: true,
                    contentType: "video/mp4",
                    isYtDlp: true,
                    ytInfo: info,
                    error: null
                };
            }
                                    return {
                url,
                finalUrl: url,
                fileName: null,
                totalSize: 0,
                supportsRange: true,
                contentType: "",
                isYtDlp: true,
                ytDlpFailed: true,
                ytInfo: null,
                error: error || "yt-dlp could not process this URL"
            };
        }

        const reqHeaders = {
            "user-agent": DEFAULT_UA,
            "accept": "*/*",
            ...headers
        };

        const { response, finalUrl } = await DownloadEngine._httpProbe(url, reqHeaders);

        let contentType = "";
        let totalSize = 0;
        let resumable = true;
        let filename = null;
        let outcome = "error";

        if (response && (response.ok || response.status === 206)) {
            contentType = response.headers.get("content-type") || "";
            const cl = response.headers.get("content-length");
            const cr = response.headers.get("content-range");
            const ar = response.headers.get("accept-ranges");

            if (cr) {
                const m = /\/(\d+)/.exec(cr);
                if (m) totalSize = parseInt(m[1], 10);
                resumable = true;
            } else if (cl) {
                totalSize = parseInt(cl, 10);
                if (ar && ar.toLowerCase().includes("bytes")) resumable = true;
            }

            filename = extractFilename(response, finalUrl);

            const ct = contentType.toLowerCase();
            if (ct.includes("text/html") || ct.includes("application/xhtml")) {
                outcome = "html";
            } else if (ct.includes("application/json") || ct.includes("text/plain") || ct.includes("application/xml")) {
                outcome = "unsupported";
            } else {
                outcome = "ok";
            }
        } else {
            filename = extractFilenameFromUrl(url);
        }

                                if (decideRoute({ url, contentType, probeOk: outcome !== "error" }) === "ytdlp") {
            const { info, error } = await probeWithYtDlp(url, headers, cookieArgs, { timeout: FALLBACK_PROBE_TIMEOUT_MS });
            if (info) {
                return {
                    url,
                    finalUrl: url,
                    fileName: info.fileName,
                    totalSize: info.totalSize,
                    supportsRange: true,
                    contentType: "video/mp4",
                    isYtDlp: true,
                    ytInfo: info,
                    error: null
                };
            }
                                                return {
                url,
                finalUrl: url,
                fileName: null,
                totalSize: 0,
                supportsRange: true,
                contentType,
                isYtDlp: true,
                ytDlpFailed: true,
                ytInfo: null,
                error: error || "No downloadable media found at this URL"
            };
        }

        return {
            url,
            finalUrl,
            fileName: filename,
            totalSize,
            supportsRange: resumable,
            contentType,
            isHls: false,
            error: outcome === "error" ? "The server could not be reached or returned an error" : null
        };
    }

        async addDownload({
        url,
        saveDir,
        fileName = null,
        connections = null,
        headers = {},
        autoStart = true,
        cookieArgs = [],
        ytOptions = {}
    }) {
        const info = await DownloadEngine.resolveFileInfo(url, headers, cookieArgs);

                        if (info.isYtDlp) {
            const opts = { ...ytOptions, cookieArgs };
            const resolvedName = fileName || info.fileName || (info.ytInfo?.fileName) || `video_${Date.now().toString(36)}.mp4`;
            const catFolder = getCategoryFolder(getFileCategory(resolvedName));

            let finalDir = saveDir;
            if (saveDir && !saveDir.toLowerCase().endsWith(catFolder.toLowerCase())) {
                finalDir = join(saveDir, catFolder);
            }
            await fs.promises.mkdir(finalDir, { recursive: true }).catch(() => {});

                                    const savePath = join(finalDir, "%(title).180B [%(id)s].%(ext)s");

            const dl = new YtDlpDownload({
                url,
                filename: resolvedName,
                savePath,
                totalSize: info.totalSize || 0,
                headers,
                status: DownloadStatus.Queued,
                category: getFileCategory(resolvedName),
                ...opts
            });
            if (info.ytInfo?.totalSize && !dl.totalSize) dl.totalSize = info.ytInfo.totalSize;

            this._bindEvents(dl);
            this.downloads.set(dl.id, dl);
            this.persist();

            if (autoStart) {
                this.startDownload(dl.id);
            }

            return dl;
        }

                const resolvedName = fileName || info.fileName || `download_${Date.now().toString(36)}.bin`;
        const category = getFileCategory(resolvedName);
        const catFolder = getCategoryFolder(category);

        let finalDir = saveDir;
        if (saveDir) {
            if (!saveDir.toLowerCase().endsWith(catFolder.toLowerCase())) {
                finalDir = join(saveDir, catFolder);
            }
        }
        await fs.promises.mkdir(finalDir, { recursive: true }).catch(() => {});
        const savePath = join(finalDir, resolvedName);

        const numSegments = calcSegmentCount(info.totalSize, info.supportsRange, connections);
        const segments = createSegments(info.totalSize, numSegments);

        const dl = new ManagedDownload({
            url: info.finalUrl || url,
            filename: resolvedName,
            savePath,
            totalSize: info.totalSize || null,
            status: DownloadStatus.Queued,
            segments,
            category,
            resumable: info.supportsRange,
            headers,
            awaitingSlot: autoStart,
            maxConnections: connections
        });

        this._bindEvents(dl);
        this.downloads.set(dl.id, dl);
        this.persist();

        if (autoStart) {
            this.startDownload(dl.id);
        }

        return dl;
    }

    _bindEvents(dl) {
        dl.on("state", (s) => this.emit("taskState", s));
        dl.on("segmentUpdate", (d) => this.emit("segmentUpdate", d));
        dl.on("completed", (d) => {
            this.emit("taskCompleted", d);
            this.persist();
            this.autoStartQueued();
        });
        dl.on("error", (err) => {
            this.emit("taskError", { id: dl.id, error: typeof err === "string" ? err : (err?.error || err) });
            this.persist();
            this.autoStartQueued();
        });
    }

    countActive() {
        let count = 0;
        for (const dl of this.downloads.values()) {
            if (dl.status === DownloadStatus.Downloading || dl.status === DownloadStatus.Connecting) {
                count++;
            }
        }
        return count;
    }

    async startDownload(id) {
        const dl = this.downloads.get(id);
        if (!dl) return null;

        dl.awaitingSlot = true;
        if (this.countActive() >= this.maxConcurrent) {
            dl.status = DownloadStatus.Queued;
            this.emit("taskState", dl.toJSON());
            this.persist();
            return dl.toJSON();
        }

        dl.start().catch(() => {});
        this._ensureProgressPersist();
        return dl.toJSON();
    }

    async pauseDownload(id) {
        const dl = this.downloads.get(id);
        if (!dl) return null;
        await dl.pause();
        this.persist();
        this.autoStartQueued();
        return dl.toJSON();
    }

    async pauseAll() {
        for (const dl of this.downloads.values()) {
            if (dl.status === DownloadStatus.Downloading || dl.status === DownloadStatus.Connecting) {
                await dl.pause().catch(() => {});
            }
        }
        this.persist();
    }

    async resumeAll() {
                                        for (const dl of this.downloads.values()) {
            if (dl.status === DownloadStatus.Paused || dl.status === DownloadStatus.Failed || dl.status === DownloadStatus.Queued) {
                await this.resumeDownload(dl.id);
            }
        }
        this.persist();
    }

    async resumeDownload(id) {
        const dl = this.downloads.get(id);
        if (!dl) return null;
        if (typeof dl.resume === "function") {
            dl.awaitingSlot = true;
            if (this.countActive() >= this.maxConcurrent) {
                dl.status = DownloadStatus.Queued;
                this.emit("taskState", dl.toJSON());
                this.persist();
                return dl.toJSON();
            }
            await dl.resume();
            return dl.toJSON();
        }
        return this.startDownload(id);
    }

    async cancelDownload(id) {
        const dl = this.downloads.get(id);
        if (!dl) return null;
        await dl.cancel();
        this.persist();
        this.autoStartQueued();
        return dl.toJSON();
    }

    async removeDownload(id, deleteFile = false) {
        const dl = this.downloads.get(id);
        if (!dl) return { success: true };

        this.downloads.delete(id);
        dl.removeAllListeners();
        await dl.cancel().catch(() => {});

        if (deleteFile && dl.savePath && fs.existsSync(dl.savePath)) {
            const st = await fs.promises.stat(dl.savePath).catch(() => null);
            if (st?.isFile()) {
                await fs.promises.unlink(dl.savePath).catch(() => {});
            }
        }

        this.persist();
        this.autoStartQueued();
        return { success: true };
    }

    autoStartQueued() {
        const availableSlots = this.maxConcurrent - this.countActive();
        if (availableSlots <= 0) return;

        let started = 0;
        for (const dl of this.downloads.values()) {
            if (dl.status === DownloadStatus.Queued && dl.awaitingSlot) {
                dl.start().catch(() => {});
                started++;
                if (started >= availableSlots) break;
            }
        }
        if (started > 0) this._ensureProgressPersist();
    }


    _ensureProgressPersist() {
        if (this._progressPersistTimer || !this.storagePath) return;
        this._progressPersistTimer = setInterval(() => {
            if (this.countActive() === 0) {
                clearInterval(this._progressPersistTimer);
                this._progressPersistTimer = null;
                return;
            }
            this.persist();
        }, 5000);
    }

    getAllTasks() {
        return Array.from(this.downloads.values()).map(dl => dl.toJSON());
    }

    persist() {
        if (!this.storagePath) return;
        try {
            const data = Array.from(this.downloads.values()).map(dl => {
                                                const { headers: persistedHeaders, redacted: headersRedacted } = sanitizeHeadersForPersistence(dl.headers);
                const base = {
                    id: dl.id,
                    url: dl.url,
                    filename: dl.filename,
                    savePath: dl.savePath,
                    totalSize: dl.totalSize,
                    status: (dl.status === DownloadStatus.Downloading || dl.status === DownloadStatus.Connecting) ? DownloadStatus.Paused : dl.status,
                    segments: dl.segments.map(s => ({
                        start: s.start,
                        end: s.end,
                        downloaded: s.downloaded,
                        status: s.status
                    })),
                    category: dl.category,
                    resumable: dl.resumable,
                    headers: persistedHeaders,
                    headersRedacted,
                    maxConnections: dl.maxConnections
                };
                if (dl instanceof YtDlpDownload) {
                    base.engine = "ytdlp";
                    base.ytOptions = dl.ytOptions;
                }
                return base;
            });
            fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), "utf8");
        } catch (_) {}
    }

    restoreDownloads(storagePath) {
        this.storagePath = storagePath;
        if (!fs.existsSync(storagePath)) return;

        try {
            const text = fs.readFileSync(storagePath, "utf8");
            const data = JSON.parse(text);
            if (!Array.isArray(data)) return;

            let modified = false;
            for (const item of data) {
                let dl;
                let savePath = item.savePath;
                let filename = item.filename;
                if (item.engine === "ytdlp") {
                    const outputDir = dirname(savePath || "");
                    const actual = findDownloadedFile(outputDir, item.url, filename, savePath);
                    if (actual && fs.existsSync(actual)) {
                        savePath = actual;
                        filename = basename(actual);
                        if (savePath !== item.savePath || filename !== item.filename) {
                            modified = true;
                        }
                    }
                    dl = new YtDlpDownload({
                        id: item.id,
                        url: item.url,
                        filename: filename,
                        savePath: savePath,
                        totalSize: item.totalSize,
                        headers: item.headers || {},
                        status: item.status === DownloadStatus.Downloading ? DownloadStatus.Paused : item.status,
                        category: item.category,
                        ...(item.ytOptions || {})
                    });
                } else {
                    dl = new ManagedDownload({
                        id: item.id,
                        url: item.url,
                        filename: item.filename,
                        savePath: item.savePath,
                        totalSize: item.totalSize,
                        status: item.status === DownloadStatus.Downloading ? DownloadStatus.Paused : item.status,
                        segments: item.segments || [],
                        category: item.category,
                        resumable: item.resumable,
                        headers: item.headers || {},
                        headersRedacted: item.headersRedacted === true,
                        maxConnections: item.maxConnections || 32
                    });
                }
                this._bindEvents(dl);
                this.downloads.set(dl.id, dl);
            }
            if (modified) {
                this.persist();
            }
        } catch (_) {}
    }
}

function extractFilename(response, url) {
    if (response) {
        const cd = response.headers.get("content-disposition");
        if (cd) {
            const m = /filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i.exec(cd);
            if (m?.[1]) return decodeURIComponent(m[1].trim());
        }
    }
    return extractFilenameFromUrl(url);
}

function extractFilenameFromUrl(url) {
    try {
        const u = new URL(url);
        const name = u.pathname.split("/").filter(Boolean).pop();
        if (name && name.includes(".")) {
            return decodeURIComponent(name.split("?")[0]);
        }
    } catch (_) {}

    return `download_${Date.now().toString(36)}.bin`;
}

export const DownloadTask = {
    probeUrl: (url, headers = {}, cookieArgs = []) => DownloadEngine.resolveFileInfo(url, headers, cookieArgs)
};
