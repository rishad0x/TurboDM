import { EventEmitter } from "events";
import { spawn, spawnSync } from "child_process";
import fs from "fs";
import crypto from "crypto";
import { join, dirname, basename } from "path";
import {
    ensureBinary,
    getFfmpegPath,
    getJsRuntime,
    getPythonExecutable,
    buildProbeArgs,
    buildDownloadArgs,
    parseProgressLine,
    classifyYtDlpError
} from "./ytdlp.js";
import { DownloadStatus, getFileCategory } from "./model.js";

import { EXTRACTOR_KEYWORDS, SHORT_MEDIA_HOSTS } from "./supportedExtractors.js";

const GENERIC_TLDS = new Set([
    "com", "net", "org", "co", "io", "tv", "cc", "me", "to", "is",
    "gg", "fm", "am", "us", "uk", "ca", "de", "fr", "jp", "cn", "in",
    "app", "dev", "xyz", "live", "site", "online", "edu", "gov"
]);

export function isYtDlpUrl(url) {
    if (!url || typeof url !== "string") return false;
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (SHORT_MEDIA_HOSTS.has(host)) return true;

        const parts = host.split(".").filter(p => p !== "www" && p !== "m" && p !== "mobile");
        for (const part of parts) {
            if (GENERIC_TLDS.has(part)) continue;
            const clean = part.replace(/[^a-z0-9]/g, "");
            if (clean.length >= 3 && EXTRACTOR_KEYWORDS.has(clean)) {
                return true;
            }
        }
        return false;
    } catch (_) {
        return false;
    }
}


export function isHlsUrl(url) {
    if (!url || typeof url !== "string") return false;
    try {
        const p = new URL(url);
        return /\.m3u8($|\?)/i.test(p.pathname + p.search);
    } catch (_) {
        return false;
    }
}


async function prepareSpawnArgs(args) {
    const binaryConfig = await ensureBinary();
    let cmd = binaryConfig.path;
    let finalArgs = [...args];

    if (binaryConfig.requiresPython || binaryConfig.path.endsWith(".py")) {
        const pythonCmd = await getPythonExecutable();
        if (!pythonCmd) {
            throw new Error("Python 3.9+ is required for the universal zipapp fallback on this platform.");
        }
        cmd = pythonCmd;
        finalArgs = [binaryConfig.path, ...finalArgs];
    }

    const ffmpegPath = await getFfmpegPath();
    if (ffmpegPath && !finalArgs.includes("--ffmpeg-location")) {
        finalArgs.unshift("--ffmpeg-location", dirname(ffmpegPath));
    }
    const jsRuntime = await getJsRuntime();
    if (jsRuntime && !finalArgs.includes("--js-runtimes")) {
        finalArgs.unshift("--js-runtimes", jsRuntime);
    }

    const defaultFlags = [
        "--socket-timeout", "30",
        "--retries", "10",
        "--fragment-retries", "10",
        "--retry-sleep", "fragment:exp=1:20"
    ];
    for (let i = defaultFlags.length - 2; i >= 0; i -= 2) {
        if (!finalArgs.includes(defaultFlags[i])) {
            finalArgs.unshift(defaultFlags[i], defaultFlags[i + 1]);
        }
    }

    return { cmd, args: finalArgs };
}


function execCapture(cmd, args, timeoutMs) {
    return new Promise((resolve, reject) => {
        let stdout = "";
        let stderr = "";
        let settled = false;
        const proc = spawn(cmd, args, { windowsHide: true });

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            try { proc.kill("SIGKILL"); } catch (_) {}
            reject(new Error(`yt-dlp probe timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        proc.stdout?.on("data", d => { stdout += d.toString(); });
        proc.stderr?.on("data", d => { stderr += d.toString(); });
        proc.on("error", (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err);
        });
        proc.on("close", (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (code === 0 && stdout.trim()) {
                resolve({ stdout, stderr });
            } else {
                const err = new Error(stderr || stdout || `yt-dlp exited with code ${code}`);
                err.code = code;
                reject(err);
            }
        });
    });
}

function mapFormats(formats) {
    return (formats || []).map(f => ({
        formatId: String(f.format_id),
        formatNote: f.format_note || null,
        ext: f.ext,
        height: f.height || null,
        width: f.width || null,
        fps: f.fps || null,
        vcodec: f.vcodec,
        acodec: f.acodec,
                                filesize: f.filesize || null,
        hasVideo: f.vcodec && f.vcodec !== "none",
        hasAudio: f.acodec && f.acodec !== "none",
        tbr: f.tbr || null
    }));
}


export async function probeWithYtDlp(url, headers = {}, cookieArgs = [], options = {}) {
    const timeoutMs = options.timeout || 45000;
    let args;
    try {
        args = buildProbeArgs(url, {
            cookieArgs,
            userAgent: headers["User-Agent"] || headers["user-agent"] || undefined,
            referer: headers["Referer"] || headers["referer"] || undefined,
            allowPlaylist: !!options.allowPlaylist
        });
    } catch (err) {
        return { info: null, error: err.message };
    }

    try {
        const { cmd, args: finalArgs } = await prepareSpawnArgs(args);
        const { stdout } = await execCapture(cmd, finalArgs, timeoutMs);
        const data = JSON.parse(stdout.trim().split(/\r?\n/)[0]);

        if (data._type === "playlist" && !options.allowPlaylist) {
            return { info: null, error: "This URL is a playlist. Enable playlist mode to download all entries." };
        }

        const cleanTitle = (data.title || "video").replace(/[\\/:*?"<>|]/g, "_").trim();
        const ext = data.ext || "mp4";
        const formats = mapFormats(data.formats);

        const info = {
            isYtDlp: true,
            url,
            webpageUrl: data.webpage_url || url,
            extractorKey: data.extractor_key || null,
            title: cleanTitle,
            fileName: `${cleanTitle}.${ext}`,
            totalSize: data.filesize || data.filesize_approx || 0,
            duration: data.duration || 0,
            thumbnail: data.thumbnail || null,
            uploader: data.uploader || data.channel || data.uploader_id || null,
            isLive: !!data.is_live,
            isPlaylist: data._type === "playlist",
            defaultFormatId: data.format_id ? String(data.format_id) : null,
            formats
        };
        return { info, error: null };
    } catch (err) {
        const friendly = classifyYtDlpError(err.message || "");
        const raw = String(err.message || err).split(/\r?\n/).filter(l => !l.startsWith("yt-dlp exited")).slice(0, 3).join(" ").trim();
        return { info: null, error: friendly ? friendly.message : (raw || "yt-dlp probe failed") };
    }
}


function ytOptionsSnapshot(o) {
    return {
        cookieProfileId: o.cookieProfileId ?? null,
        cookieArgs: Array.isArray(o.cookieArgs) ? o.cookieArgs : [],
        formatId: o.formatId ?? null,
        formatNeedsAudio: !!o.formatNeedsAudio,
        audioOnly: !!o.audioOnly,
        audioFormat: o.audioFormat ?? null,
        quality: o.quality ?? null,
        mergeFormat: o.mergeFormat ?? null,
        concurrentFragments: o.concurrentFragments ?? 4,
        limitRate: o.limitRate ?? null,
        maxFilesize: o.maxFilesize ?? null,
        embedThumbnail: !!o.embedThumbnail,
        embedMetadata: !!o.embedMetadata,
        proxy: o.proxy ?? null
    };
}


export function findDownloadedFile(outputDir, url = "", filename = "", savePath = "") {
    if (!outputDir || !fs.existsSync(outputDir)) return null;

        let id = null;
    const urlMatch = /(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{6,15})/.exec(url || "");
    if (urlMatch) id = urlMatch[1];
    if (!id) {
        const idMatch = /\[([a-zA-Z0-9_-]{6,15})\]/.exec(filename || savePath || "");
        if (idMatch) id = idMatch[1];
    }

    try {
        const files = fs.readdirSync(outputDir);
        if (id) {
            const found = files.find(f => f.includes(`[${id}]`) && !f.endsWith(".part") && !f.endsWith(".ytdl"));
            if (found) return join(outputDir, found);
        }

                const base = basename(filename || "").replace(/\.[^.]+$/, "");
        if (base && !base.includes("%(")) {
            const found = files.find(f => f.startsWith(base) && !f.endsWith(".part") && !f.endsWith(".ytdl"));
            if (found) return join(outputDir, found);
        }
    } catch (_) {}

    return null;
}

export class YtDlpDownload extends EventEmitter {
    constructor({
        id = null,
        url,
        filename,
        savePath,
        totalSize = 0,
        headers = {},
        status = DownloadStatus.Queued,
        category = null,
                cookieProfileId = null,
        cookieArgs = [],
        formatId = null,
        formatNeedsAudio = false,
        audioOnly = false,
        audioFormat = null,
        quality = null,
        mergeFormat = null,
        concurrentFragments = 4,
        limitRate = null,
        maxFilesize = null,
        embedThumbnail = false,
        embedMetadata = false,
        proxy = null
    }) {
        super();
        this.id = id || crypto.randomUUID();
        this.engine = "ytdlp";
        this.url = url;
        this.filename = filename || "video.mp4";
        this.savePath = savePath;
        this.totalSize = totalSize || 0;
        this.downloadedSize = 0;
        this.progress = 0;
        this.speed = 0;
        this.eta = 0;
        this.stage = "downloading";
        this.status = status;
        this.category = category || getFileCategory(this.filename);
        this.headers = headers || {};
        this.cookieProfileId = cookieProfileId;
        this.cookieArgs = Array.isArray(cookieArgs) ? cookieArgs : [];
        this.formatId = formatId;
        this.formatNeedsAudio = formatNeedsAudio;
        this.audioOnly = audioOnly;
        this.audioFormat = audioFormat;
        this.quality = quality;
        this.mergeFormat = mergeFormat;
        this.concurrentFragments = concurrentFragments;
        this.limitRate = limitRate;
        this.maxFilesize = maxFilesize;
        this.embedThumbnail = embedThumbnail;
        this.embedMetadata = embedMetadata;
        this.proxy = proxy;
        this.process = null;
        this.createdAt = Date.now();
        this.completedAt = null;
        this.error = null;
        this.errorKind = null;
        this.segments = [{
            index: 1,
            start: 0,
            end: Infinity,
            size: totalSize || 0,
            downloaded: 0,
            status: "pending",
            speed: 0
        }];
    }

    get ytOptions() {
        return ytOptionsSnapshot(this);
    }


    async _buildArgs() {
        const outputDir = dirname(this.savePath);
        return buildDownloadArgs(this.url, {
            ...this.ytOptions,
            cookieArgs: this.cookieArgs,
            userAgent: this.headers["User-Agent"] || this.headers["user-agent"] || undefined,
            referer: this.headers["Referer"] || this.headers["referer"] || undefined,
            outputTemplate: join(outputDir, "%(title).180B [%(id)s].%(ext)s"),
            hasFfmpeg: !!(await getFfmpegPath()),
            allowPlaylist: false
        });
    }

    async start() {
        if (this.status === DownloadStatus.Downloading || this.status === DownloadStatus.Connecting) return;
        this.status = DownloadStatus.Connecting;
        this.error = null;
        this.errorKind = null;
        this.emitState();

        const outputDir = dirname(this.savePath);
        await fs.promises.mkdir(outputDir, { recursive: true }).catch(() => {});

        const args = await this._buildArgs();

        let cmd, finalArgs;
        try {
            ({ cmd, args: finalArgs } = await prepareSpawnArgs(args));
        } catch (err) {
            this.status = DownloadStatus.Failed;
            this.error = err.message;
            this.emitState();
            this.emit("error", { id: this.id, error: err.message });
            return;
        }

        this.status = DownloadStatus.Downloading;
        this.stage = "downloading";
        this.emitState();

        let finalFilePath = null;
        let stderrTail = "";

        try {
                                                this.process = spawn(cmd, finalArgs, {
                windowsHide: true,
                cwd: outputDir,
                env: { ...process.env, PYTHONUNBUFFERED: "1" }
            });
        } catch (e) {
            this.status = DownloadStatus.Failed;
            this.error = e.message;
            this.emitState();
            this.emit("error", { id: this.id, error: e.message });
            return;
        }

        let lastEmit = 0;
        const throttledState = () => {
            const now = performance.now();
            if (now - lastEmit >= 100) {
                lastEmit = now;
                this.emitState();
                this.emit("segmentUpdate", { id: this.id, total: this.toJSON(), segments: this.segments });
            }
        };

        this.process.stdout.on("data", (chunk) => {
            for (const line of chunk.toString().split(/\r?\n/)) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                const progress = parseProgressLine(line);
                if (progress) {
                    this.progress = progress.percent;
                    if (progress.totalSize) this.totalSize = progress.totalSize;
                    this.downloadedSize = progress.downloadedSize || Math.round((progress.percent / 100) * this.totalSize);
                    this.speed = progress.speed;
                    this.eta = progress.eta;
                    if (this.segments[0]) {
                        this.segments[0].downloaded = this.downloadedSize;
                        this.segments[0].size = this.totalSize;
                        this.segments[0].speed = this.speed;
                        this.segments[0].status = "downloading";
                    }
                    throttledState();
                    continue;
                }

                if (trimmed.includes("Destination:")) {
                    const dest = trimmed.split("Destination:")[1]?.trim();
                    if (dest) {
                        this.filename = basename(dest);
                        if (fs.existsSync(dest) && !dest.endsWith(".part") && !dest.endsWith(".ytdl")) {
                            finalFilePath = dest;
                        }
                    }
                } else if (trimmed.includes("[Merger]")) {
                    this.stage = "merging";
                    const m = /Merging formats into ["']?([^"'\r\n]+)["']?/.exec(trimmed);
                    if (m?.[1]) {
                        finalFilePath = m[1].trim();
                        this.filename = basename(finalFilePath);
                        this.savePath = finalFilePath;
                    }
                } else if (trimmed.includes("[ExtractAudio]")) {
                    this.stage = "extracting";
                    const m = /Destination:\s*(.+)/.exec(trimmed);
                    if (m?.[1]) {
                        finalFilePath = m[1].trim();
                        this.filename = basename(finalFilePath);
                        this.savePath = finalFilePath;
                    }
                }

                                if (fs.existsSync(trimmed) && fs.statSync(trimmed).isFile() &&
                    !trimmed.endsWith(".part") && !trimmed.endsWith(".ytdl")) {
                    finalFilePath = trimmed;
                }
            }
        });

        this.process.stderr.on("data", (chunk) => {
            const str = chunk.toString();
            stderrTail = (stderrTail + str).slice(-4000);
            const match = /ERROR:\s*(.+)/.exec(str);
            if (match) this.error = match[1].trim();
        });

        this.process.on("close", (code) => {
            this.process = null;
            if (code === 0) {
                this.status = DownloadStatus.Completed;
                this.progress = 100;
                this.speed = 0;
                this.eta = 0;
                this.stage = "done";
                this.completedAt = Date.now();
                if (!finalFilePath || !fs.existsSync(finalFilePath)) {
                    finalFilePath = findDownloadedFile(outputDir, this.url, this.filename, this.savePath);
                }
                if (finalFilePath && fs.existsSync(finalFilePath)) {
                    this.savePath = finalFilePath;
                    this.filename = basename(finalFilePath);
                }
                if (this.segments[0]) {
                    this.segments[0].status = "done";
                    this.segments[0].downloaded = this.totalSize || this.segments[0].downloaded;
                }
                this.emitState();
                this.emit("completed", this.toJSON());
            } else if (this.status !== DownloadStatus.Paused && this.status !== DownloadStatus.Cancelled) {
                this.status = DownloadStatus.Failed;
                this.speed = 0;
                const friendly = classifyYtDlpError(this.error || stderrTail);
                if (friendly) {
                    this.error = friendly.message;
                    this.errorKind = friendly.kind;
                }
                this.emitState();
                this.emit("error", { id: this.id, error: this.error, kind: this.errorKind });
            }
        });

        this.process.on("error", (err) => {
            this.process = null;
            this.status = DownloadStatus.Failed;
            this.error = err.message;
            this.emitState();
            this.emit("error", { id: this.id, error: err.message });
        });
    }


    _stopProcess(onDone) {
        const proc = this.process;
        if (!proc || proc.exitCode !== null || proc.signalCode !== null) {
            this.process = null;
            onDone?.();
            return;
        }
        const pid = proc.pid;

        let finished = false;
        const timeoutIds = [];
        const pollRef = { current: null };
        const finish = () => {
            if (finished) return;
            finished = true;
            for (const t of timeoutIds) clearTimeout(t);
            if (pollRef.current) clearInterval(pollRef.current);
            this.process = null;
            onDone?.();
        };

        if (process.platform === "win32") {
                        try {
                spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, timeout: 10000 });
            } catch (_) {
                try { proc.kill("SIGKILL"); } catch (_) {}
            }
        } else {
                        try {
                proc.kill("SIGINT");
            } catch (_) {
                try { proc.kill("SIGKILL"); } catch (_) {}
            }
                        timeoutIds.push(setTimeout(() => {
                if (proc.exitCode === null && proc.signalCode === null) {
                    try { proc.kill("SIGKILL"); } catch (_) {}
                }
            }, 1500));
        }

                proc.once("close", finish);
        pollRef.current = setInterval(() => {
            if (proc.exitCode !== null || proc.signalCode !== null) finish();
        }, 250);

                timeoutIds.push(setTimeout(finish, 8000));
    }

    async pause() {
        if (this.status === DownloadStatus.Paused || this.status === DownloadStatus.Completed) return;
        this.status = DownloadStatus.Paused;
        this.speed = 0;
        this.eta = 0;
        if (this.segments[0] && this.segments[0].status === "downloading") {
            this.segments[0].status = "paused";
        }
        this._stopProcess();
        this.emitState();
    }

    async resume() {
        if (this.status === DownloadStatus.Paused || this.status === DownloadStatus.Failed || this.status === DownloadStatus.Queued) {
            await this.start();
        }
    }

    async cancel() {
        this.status = DownloadStatus.Cancelled;
        this.speed = 0;
        if (this.process) {
            this._stopProcess();
        }
        this.emitState();
    }

    emitState() {
        this.emit("state", this.toJSON());
    }

    toJSON() {
        return {
            id: this.id,
            engine: "ytdlp",
            url: this.url,
            fileName: this.filename,
            filePath: this.savePath,
            totalSize: this.totalSize,
            downloadedSize: this.downloadedSize,
            progress: this.progress,
            speed: this.speed,
            eta: this.eta,
            stage: this.stage,
            status: String(this.status).toLowerCase(),
            connections: 1,
            category: this.category,
            resumable: true,
            cookieProfileId: this.cookieProfileId,
            formatId: this.formatId,
            audioOnly: this.audioOnly,
            createdAt: this.createdAt,
            completedAt: this.completedAt,
            error: this.error,
            errorKind: this.errorKind,
            segments: this.segments
        };
    }
}
