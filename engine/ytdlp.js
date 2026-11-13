import { spawn, spawnSync, execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_REPO = "yt-dlp/yt-dlp";
const GITHUB_API_LATEST = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_LATEST_DOWNLOAD = `https://github.com/${GITHUB_REPO}/releases/latest/download`;
const HTTP_TIMEOUT_MS = 15000;
const DOWNLOAD_IDLE_TIMEOUT_MS = 30000;
const VERIFY_TIMEOUT_MS = 12000;
const VERSION_RE = /^\d{4}\.\d{2}\.\d{2}/;


export const MERGE_FORMATS = ["mp4", "mkv", "webm"];
export const AUDIO_FORMATS = ["best", "aac", "alac", "flac", "m4a", "mp3", "opus", "vorbis", "wav"];
export const SUPPORTED_BROWSERS = ["brave", "chrome", "chromium", "edge", "firefox", "opera", "safari", "vivaldi", "whale"];
export const UPDATE_CHANNELS = ["stable", "nightly", "master"];
export const FORMAT_ID_RE = /^[\w.+-]+$/;
export const RATE_LIMIT_RE = /^\d+(\.\d+)?[KMGT]?$/i;
export const MAX_FILESIZE_RE = /^\d+(\.\d+)?[KMGT]?i?B?$/i;
export const DEFAULT_OUTPUT_TEMPLATE = "%(title).180B [%(id)s].%(ext)s";


export function isValidProxy(proxy) {
    if (!proxy || typeof proxy !== "string") return false;
    const trimmed = proxy.trim();
    if (!trimmed) return false;
    try {
        const u = new URL(trimmed);
        const scheme = u.protocol.replace(":", "").toLowerCase();
        if (!["http", "https", "socks4", "socks4a", "socks5", "socks5h"].includes(scheme)) return false;
        return !!u.hostname;
    } catch (_) {
        return false;
    }
}


export function isValidBrowserSpec(spec) {
    if (!spec || typeof spec !== "string") return false;
    const trimmed = spec.trim();
    if (!trimmed) return false;
    const parts = trimmed.split("::");
    const head = parts[0];
    const container = parts[1];
    if (parts.length > 2) return false;
    if (container !== undefined && !/^[\w .-]+$/.test(container)) return false;
    const headParts = head.split(":");
    const browser = headParts[0].toLowerCase();
    const profile = headParts[1];
    if (!SUPPORTED_BROWSERS.includes(browser)) return false;
    if (headParts.length > 2) return false;
    if (profile !== undefined && !/^[\w .-]+$/.test(profile)) return false;
    return true;
}


export function classifyYtDlpError(text) {
    if (!text || typeof text !== "string") return null;
    const t = text.toLowerCase();

    if (t.includes("sign in to confirm") || t.includes("members-only") || t.includes("join this channel") ||
        t.includes("login required") || t.includes("account cookies") || t.includes("this video is available to members")) {
        return {
            kind: "auth",
            message: "Sign-in required. Add or select a cookie profile for this site in the Cookie Manager, then retry."
        };
    }
    if (t.includes("http error 429") || t.includes("too many requests") || t.includes("rate limit")) {
        return {
            kind: "ratelimit",
            message: "Rate limited by the site. Wait a while, or try a different cookie profile / proxy."
        };
    }
    if (t.includes("http error 403") || t.includes("forbidden")) {
        return {
            kind: "forbidden",
            message: "The site refused the request (403). Cookies for this site may help."
        };
    }
    if (t.includes("not available in your country") || t.includes("geo-restricted") || t.includes("geo restricted") || t.includes("geo-blocked")) {
        return {
            kind: "geo",
            message: "This content is geo-restricted. Configure a proxy in Settings for the region you need."
        };
    }
    if (t.includes("private video") || t.includes("this video is private")) {
        return { kind: "private", message: "This content is private. Account cookies with access are required." };
    }
    if (t.includes("video unavailable") || t.includes("has been removed") || t.includes("no longer available")) {
        return { kind: "unavailable", message: "This content is unavailable (removed or offline)." };
    }
    if (t.includes("unsupported url")) {
        return { kind: "unsupported", message: "This URL is not supported by yt-dlp." };
    }
    if (t.includes("is not a valid url")) {
        return { kind: "invalid", message: "The URL is not valid." };
    }
    if (t.includes("unable to extract") || t.includes("failed to extract") || t.includes("nsig") ||
        t.includes("signature extraction") || t.includes("player response")) {
        return {
            kind: "extraction",
            message: "Extraction failed — the site probably changed. Update yt-dlp (Settings → yt-dlp → Update, or try the nightly channel)."
        };
    }
    if (t.includes("unable to download webpage") || t.includes("timed out") || t.includes("connection refused") ||
        t.includes("temporary failure in name resolution") || t.includes("getaddrinfo")) {
        return { kind: "network", message: "Network error reaching the site. Check your connection or proxy." };
    }
    if (t.includes("could not find chrome") || t.includes("could not find firefox") || t.includes("could not find edge") ||
        t.includes("cookies database is locked") || t.includes("database is locked") || t.includes("app-bound encryption") ||
        t.includes("failed to decrypt") || t.includes("extracted 0 cookies")) {
        return {
            kind: "browser-cookies",
            message: "Browser cookies could not be read. Close the browser completely and retry, or import a cookies.txt profile in the Cookie Manager instead."
        };
    }
    return null;
}


export function buildCookieArgs(options = {}) {
    if (options.cookiesFromBrowser) {
        const spec = String(options.cookiesFromBrowser).trim();
        if (!isValidBrowserSpec(spec)) {
            throw new Error(`Unsupported browser for cookie extraction: "${spec}". Supported: ${SUPPORTED_BROWSERS.join(", ")}`);
        }
        return ["--cookies-from-browser", spec];
    }
    if (options.cookies) {
        return ["--cookies", String(options.cookies)];
    }
    return [];
}

function clampFragments(n) {
    const num = parseInt(n, 10);
    if (!num || num < 1) return 1;
            return Math.min(32, num);
}

function formatSelectionArgs(options, hasFfmpeg) {
        if (options.formatId) {
        const id = String(options.formatId);
        if (!FORMAT_ID_RE.test(id)) {
            throw new Error(`Invalid format id: "${id}"`);
        }
        const expr = options.formatNeedsAudio ? `${id}+bestaudio/${id}` : id;
        return ["-f", expr];
    }

    if (options.type === "audio" || options.audioOnly) {
        if (!hasFfmpeg) return ["-f", "bestaudio/best"];
        return ["-f", "bestaudio/best", "-x", "--audio-format", AUDIO_FORMATS.includes(options.audioFormat) ? options.audioFormat : "mp3"];
    }

    if (options.quality) {
        if (options.quality === "best") {
            return hasFfmpeg ? ["-f", "bv*+ba/b"] : ["-f", "b"];
        }
        if (options.quality === "max") {
                                                return hasFfmpeg ? ["-f", "bv*+ba/b", "-S", "res,fps,br"] : ["-f", "b"];
        }
        const height = parseInt(options.quality, 10);
        if (!isNaN(height) && height > 0) {
            return hasFfmpeg
                ? ["-f", `bv*[height<=${height}]+ba/b[height<=${height}]/b`]
                : ["-f", `b[height<=${height}]/b`];
        }
                if (typeof options.quality === "string" && /^[\w.,:*\[\]()=+\/-]+$/.test(options.quality)) {
            return ["-f", options.quality];
        }
        return hasFfmpeg ? ["-f", "bv*+ba/b"] : ["-f", "b"];
    }

    return null;
}


export function buildProbeArgs(url, options = {}) {
    if (!url || typeof url !== "string") throw new Error("URL is required");

    const args = [
        "--dump-single-json",
        "--no-warnings",
        "--no-check-certificates"
    ];

    if (!options.allowPlaylist) args.push("--no-playlist");
    if (options.flatPlaylist) args.push("--flat-playlist");

    args.push(...buildCookieArgs(options));
    if (Array.isArray(options.cookieArgs)) args.push(...options.cookieArgs);

    if (options.proxy) {
        if (!isValidProxy(options.proxy)) throw new Error(`Invalid proxy URL: "${options.proxy}"`);
        args.push("--proxy", options.proxy.trim());
    }
    if (options.userAgent) args.push("--user-agent", String(options.userAgent));
    if (options.referer) args.push("--referer", String(options.referer));
    if (options.poToken) {
        args.push("--extractor-args", `youtube:player_client=web,default;po_token=web+${options.poToken}`);
    }
    if (Array.isArray(options.extraArgs)) args.push(...options.extraArgs);

    args.push("--", url);
    return args;
}


export function buildDownloadArgs(url, options = {}) {
    if (!url || typeof url !== "string") throw new Error("URL is required");
    const hasFfmpeg = options.hasFfmpeg !== false;

    const outputTemplate = options.outputTemplate ||
        (options.outputDir ? path.join(options.outputDir, DEFAULT_OUTPUT_TEMPLATE) : DEFAULT_OUTPUT_TEMPLATE);

    const args = [
        "--no-warnings",
        "--no-check-certificates",
        "--newline",
        "--progress",
        "--print", "after_move:filepath",
        "-N", String(clampFragments(options.concurrentFragments ?? 4)),
        "-o", outputTemplate
    ];

    if (!options.allowPlaylist) args.push("--no-playlist");

    const fmtArgs = formatSelectionArgs(options, hasFfmpeg);
    if (fmtArgs) args.push(...fmtArgs);

    const mergeFormat = MERGE_FORMATS.includes(options.mergeFormat) ? options.mergeFormat : null;
    if (mergeFormat && hasFfmpeg && !options.audioOnly && options.type !== "audio") {
        args.push("--merge-output-format", mergeFormat);
    }

    if (options.embedThumbnail && hasFfmpeg) args.push("--embed-thumbnail");
    if (options.embedMetadata && hasFfmpeg) args.push("--embed-metadata");
    if (options.limitRate) {
        if (!RATE_LIMIT_RE.test(String(options.limitRate))) throw new Error(`Invalid rate limit: "${options.limitRate}"`);
        args.push("--limit-rate", String(options.limitRate));
    }
    if (options.maxFilesize) {
        if (!MAX_FILESIZE_RE.test(String(options.maxFilesize))) throw new Error(`Invalid max filesize: "${options.maxFilesize}"`);
        args.push("--max-filesize", String(options.maxFilesize));
    }

    args.push(...buildCookieArgs(options));
    if (Array.isArray(options.cookieArgs)) args.push(...options.cookieArgs);

    if (options.proxy) {
        if (!isValidProxy(options.proxy)) throw new Error(`Invalid proxy URL: "${options.proxy}"`);
        args.push("--proxy", options.proxy.trim());
    }
    if (options.userAgent) args.push("--user-agent", String(options.userAgent));
    if (options.referer) args.push("--referer", String(options.referer));
    if (options.poToken) {
        args.push("--extractor-args", `youtube:player_client=web,default;po_token=web+${options.poToken}`);
    }
    if (Array.isArray(options.extraArgs)) args.push(...options.extraArgs);

    args.push("--", url);
    return args;
}


export function parseProgressLine(line) {
    if (!line || typeof line !== "string") return null;
    if (!line.includes("[download]") || !line.includes("%")) return null;

    const pctMatch = /(\d+(?:\.\d+)?)%/.exec(line);
    if (!pctMatch) return null;
    const percent = Math.min(100, Math.max(0, parseFloat(pctMatch[1])));

    let totalSize = 0;
    const sizeMatch = /of (?:~\s*)?([\d.]+)\s*([KMGTP]?i?B)/i.exec(line);
    if (sizeMatch) {
        const num = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2].toUpperCase();
        let mult = 1;
        if (unit.startsWith("K")) mult = 1024;
        else if (unit.startsWith("M")) mult = 1024 * 1024;
        else if (unit.startsWith("G")) mult = 1024 * 1024 * 1024;
        else if (unit.startsWith("T")) mult = 1024 * 1024 * 1024 * 1024;
        else if (unit.startsWith("P")) mult = 1024 * 1024 * 1024 * 1024 * 1024;
        totalSize = Math.round(num * mult);
    }

    let speed = 0;
    const speedMatch = /at\s+([\d.]+)\s*([KMGTP]?i?B)\/s/i.exec(line);
    if (speedMatch) {
        const num = parseFloat(speedMatch[1]);
        const unit = speedMatch[2].toUpperCase();
        let mult = 1;
        if (unit.startsWith("K")) mult = 1024;
        else if (unit.startsWith("M")) mult = 1024 * 1024;
        else if (unit.startsWith("G")) mult = 1024 * 1024 * 1024;
        else if (unit.startsWith("T")) mult = 1024 * 1024 * 1024 * 1024;
        else if (unit.startsWith("P")) mult = 1024 * 1024 * 1024 * 1024 * 1024;
        speed = Math.round(num * mult);
    }

    let eta = 0;
    const etaMatch = /ETA\s+(\d+):(\d+)(?::(\d+))?/.exec(line);
    if (etaMatch) {
        eta = etaMatch[3]
            ? parseInt(etaMatch[1]) * 3600 + parseInt(etaMatch[2]) * 60 + parseInt(etaMatch[3])
            : parseInt(etaMatch[1]) * 60 + parseInt(etaMatch[2]);
    }

    return {
        percent,
        totalSize,
        downloadedSize: totalSize > 0 ? Math.round((percent / 100) * totalSize) : 0,
        speed,
        eta
    };
}


export function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return "00:00";
    const secNum = parseInt(seconds, 10);
    const h = Math.floor(secNum / 3600);
    const m = Math.floor((secNum % 3600) / 60);
    const s = secNum % 60;
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    return h > 0 ? [pad(h), pad(m), pad(s)].join(":") : [pad(m), pad(s)].join(":");
}



export const BIN_DIR = process.env.TURBODM_BIN_DIR || path.join(__dirname, "..", "bin");
export const TEMP_DIR = path.join(os.tmpdir(), "turbodm-ytdlp");

export function ensureTempDir() {
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    return TEMP_DIR;
}


export function getBinDirCandidates() {
    const dirs = [];
    if (process.env.TURBODM_BIN_DIR) dirs.push(process.env.TURBODM_BIN_DIR);
    dirs.push(path.join(__dirname, "..", "bin"));
    if (typeof process.resourcesPath === "string" && process.resourcesPath) {
        dirs.push(path.join(process.resourcesPath, "bin"));
    }
    return [...new Set(dirs)];
}


export function resolveWritableBinDir() {
    for (const dir of getBinDirCandidates()) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            fs.accessSync(dir, fs.constants.W_OK);
            return dir;
        } catch (_) {}
    }
    throw new Error("No writable yt-dlp binary directory found");
}


const _discoveryCache = new Map();

async function cachedDiscovery(key, fn) {
    if (_discoveryCache.has(key)) return _discoveryCache.get(key);
    const result = await fn();
    _discoveryCache.set(key, result);
    return result;
}

function clearDiscoveryCache() {
    _discoveryCache.clear();
}


export function checkSystemPath(command) {
    return new Promise((resolve) => {
        const cmd = process.platform === "win32" ? "where" : "which";
        execFile(cmd, [command], { windowsHide: true }, (error, stdout) => {
            if (!error && stdout) {
                const foundPath = stdout.trim().split(/\r?\n/)[0];
                resolve(foundPath || null);
            } else {
                resolve(null);
            }
        });
    });
}


export async function getPythonExecutable() {
    return cachedDiscovery("python", async () => {
        for (const cmd of ["python3", "python", "py"]) {
            const p = await checkSystemPath(cmd);
            if (p) return p;
        }
        return null;
    });
}


export async function getJsRuntime() {
    return cachedDiscovery("jsRuntime", async () => {
        const deno = await checkSystemPath("deno");
        if (deno) return `deno:${deno}`;
        const node = await checkSystemPath("node");
        if (node) return `node:${node}`;
        const qjs = await checkSystemPath("qjs");
        if (qjs) return `quickjs:${qjs}`;
        const bun = await checkSystemPath("bun");
        if (bun) return `bun:${bun}`;
        return null;
    });
}


export async function getFfmpegPath() {
    return cachedDiscovery("ffmpeg", discoverFfmpegPath);
}

async function discoverFfmpegPath() {
            try {
        const require = createRequire(import.meta.url);
        const ffmpegStatic = require("ffmpeg-static");
        if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
            return ffmpegStatic;
        }
        if (ffmpegStatic) {
            const pkgDir = path.dirname(require.resolve("ffmpeg-static/package.json"));
            const installerScript = path.join(pkgDir, "install.js");
            if (fs.existsSync(installerScript)) {
                try {
                    const runtime = typeof Bun !== "undefined" ? "bun" : "node";
                    spawnSyncSafe(runtime, [installerScript]);
                    if (fs.existsSync(ffmpegStatic)) return ffmpegStatic;
                } catch (_) {}
            }
        }
    } catch (_) {}

    try {
        const require = createRequire(import.meta.url);
        const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
        if (ffmpegInstaller && ffmpegInstaller.path && fs.existsSync(ffmpegInstaller.path)) {
            return ffmpegInstaller.path;
        }
    } catch (_) {}

        const sysFfmpeg = await checkSystemPath("ffmpeg");
    if (sysFfmpeg && fs.existsSync(sysFfmpeg)) return sysFfmpeg;

    const exeName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

        const botRoot = path.resolve(__dirname, "..", "..");
    const projectSearchPaths = [
        path.join(BIN_DIR, exeName),
        path.join(botRoot, "bin", exeName),
        path.join(botRoot, exeName),
        path.join(botRoot, "assets", exeName)
    ];
    for (const p of projectSearchPaths) {
        if (fs.existsSync(p)) return p;
    }

        if (process.platform === "win32") {
        const userProfile = process.env.USERPROFILE || "";
        const localAppData = process.env.LOCALAPPDATA || "";
        const programData = process.env.ProgramData || "";
        const programFiles = process.env.ProgramFiles || "C:\\Program Files";
        const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

        const winLocations = [
            path.join(userProfile, "scoop", "shims", "ffmpeg.exe"),
            path.join(userProfile, "scoop", "apps", "ffmpeg", "current", "bin", "ffmpeg.exe"),
            path.join(programData, "chocolatey", "bin", "ffmpeg.exe"),
            "C:\\ffmpeg\\bin\\ffmpeg.exe",
            "C:\\ffmpeg\\ffmpeg.exe",
            path.join(programFiles, "ffmpeg", "bin", "ffmpeg.exe"),
            path.join(programFiles, "ffmpeg", "ffmpeg.exe"),
            path.join(programFilesX86, "ffmpeg", "bin", "ffmpeg.exe"),
            path.join(localAppData, "Programs", "ffmpeg", "bin", "ffmpeg.exe")
        ];
        for (const loc of winLocations) {
            if (loc && fs.existsSync(loc)) return loc;
        }

        const wingetDir = path.join(localAppData, "Microsoft", "WinGet", "Packages");
        if (fs.existsSync(wingetDir)) {
            try {
                for (const sub of fs.readdirSync(wingetDir)) {
                    if (/ffmpeg/i.test(sub)) {
                        const found = findExeRecursive(path.join(wingetDir, sub), exeName, 3);
                        if (found) return found;
                    }
                }
            } catch (_) {}
        }
    } else {
                const unixLocations = [
            "/usr/bin/ffmpeg",
            "/usr/local/bin/ffmpeg",
            "/bin/ffmpeg",
            "/opt/homebrew/bin/ffmpeg",
            "/nix/var/nix/profiles/default/bin/ffmpeg",
            "/run/current-system/sw/bin/ffmpeg"
        ];
        for (const loc of unixLocations) {
            if (fs.existsSync(loc)) return loc;
        }
        if (fs.existsSync("/nix/store")) {
            try {
                for (const entry of fs.readdirSync("/nix/store")) {
                    if (entry.includes("ffmpeg") && !entry.endsWith(".drv")) {
                        const candidate = path.join("/nix/store", entry, "bin", "ffmpeg");
                        if (fs.existsSync(candidate)) return candidate;
                    }
                }
            } catch (_) {}
        }
    }

    return null;
}

function spawnSyncSafe(runtime, args) {
    const res = spawnSync(runtime, args, { timeout: 60000, stdio: "ignore", windowsHide: true });
    return res.status === 0;
}

function findExeRecursive(dir, exeName, maxDepth) {
    try {
        for (const f of fs.readdirSync(dir)) {
            const full = path.join(dir, f);
            if (f.toLowerCase() === exeName.toLowerCase()) return full;
            try {
                if (maxDepth > 0 && fs.statSync(full).isDirectory()) {
                    const res = findExeRecursive(full, exeName, maxDepth - 1);
                    if (res) return res;
                }
            } catch (_) {}
        }
    } catch (_) {}
    return null;
}



export function getBinaryCandidates(platform = process.platform, arch = process.arch) {
    const candidates = [];

    if (platform === "win32") {
        if (arch === "arm64") {
            candidates.push({ asset: "yt-dlp_arm64.exe", filename: "yt-dlp_arm64.exe", requiresPython: false });
        }
        candidates.push({ asset: "yt-dlp.exe", filename: "yt-dlp.exe", requiresPython: false });
        candidates.push({ asset: "yt-dlp_x86.exe", filename: "yt-dlp_x86.exe", requiresPython: false });
        candidates.push({ asset: "yt-dlp", filename: "yt-dlp", requiresPython: true });
    } else if (platform === "darwin") {
        candidates.push({ asset: "yt-dlp_macos", filename: "yt-dlp_macos", requiresPython: false });
        candidates.push({ asset: "yt-dlp", filename: "yt-dlp", requiresPython: true });
    } else if (platform === "linux") {
        const isMusl = (() => {
            try { return fs.existsSync("/etc/alpine-release"); } catch (_) { return false; }
        })();
        if (arch === "arm64" || arch === "aarch64") {
            if (isMusl) candidates.push({ asset: "yt-dlp_musllinux_aarch64", filename: "yt-dlp_musllinux_aarch64", requiresPython: false });
            candidates.push({ asset: "yt-dlp_linux_aarch64", filename: "yt-dlp_linux_aarch64", requiresPython: false });
        } else if (arch === "x64") {
            if (isMusl) candidates.push({ asset: "yt-dlp_musllinux", filename: "yt-dlp_musllinux", requiresPython: false });
            candidates.push({ asset: "yt-dlp_linux", filename: "yt-dlp_linux", requiresPython: false });
        }
        candidates.push({ asset: "yt-dlp", filename: "yt-dlp", requiresPython: true });
    } else {
        candidates.push({ asset: "yt-dlp", filename: "yt-dlp", requiresPython: true });
    }

    return candidates;
}


export async function fetchLatestReleaseInfo() {
    try {
        const res = await fetch(GITHUB_API_LATEST, {
            headers: { "User-Agent": "TurboDM", "Accept": "application/vnd.github+json" },
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
        });
        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.assets)) {
                return {
                    tag: data.tag_name,
                    assets: data.assets.map(a => ({ name: a.name, downloadUrl: a.browser_download_url }))
                };
            }
        }
    } catch (_) {}
    return { tag: "latest", assets: null };
}


export async function verifyBinary(binaryPath, requiresPython) {
    const runCheck = (execCmd, execArgs) => new Promise((resolve) => {
        try {
            const proc = spawn(execCmd, execArgs, { windowsHide: true, timeout: VERIFY_TIMEOUT_MS });
            let stdout = "";
            proc.stdout?.on("data", d => { stdout += d.toString(); });
            proc.on("close", (code) => {
                resolve(code === 0 && VERSION_RE.test(stdout.trim()));
            });
            proc.on("error", () => resolve(false));
        } catch (_) {
            resolve(false);
        }
    });

    if (requiresPython) {
        const py = await getPythonExecutable();
        if (!py) return false;
        return runCheck(py, [binaryPath, "--version"]);
    }
    return runCheck(binaryPath, ["--version"]);
}


export function parseSumsForAsset(sumsText, assetName) {
    if (!sumsText || !assetName) return null;
    for (const line of sumsText.split(/\r?\n/)) {
        const m = /^([a-fA-F0-9]{64})\s+\*?(.+)$/i.exec(line.trim());
        if (m && m[2].trim() === assetName) return m[1].toLowerCase();
    }
    return null;
}

function sha256File(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha256");
        const stream = fs.createReadStream(filePath);
        stream.on("data", (c) => hash.update(c));
        stream.on("error", reject);
        stream.on("end", () => resolve(hash.digest("hex")));
    });
}


async function downloadFileTo(url, destPath, onProgress) {
    const controller = new AbortController();
    let idleTimer = null;
    const armIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => controller.abort(new Error(`Download stalled (no data for ${DOWNLOAD_IDLE_TIMEOUT_MS / 1000}s)`)), DOWNLOAD_IDLE_TIMEOUT_MS);
    };
    armIdle();

    let res;
    try {
        res = await fetch(url, {
            headers: { "User-Agent": "TurboDM", "Accept": "application/octet-stream" },
            redirect: "follow",
            signal: controller.signal
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        if (!res.body) throw new Error(`Empty response body for ${url}`);

        const total = parseInt(res.headers.get("content-length") || "0", 10);
        let received = 0;
        const hash = crypto.createHash("sha256");
        const source = Readable.fromWeb(res.body);
        source.on("data", (chunk) => {
            hash.update(chunk);
            received += chunk.length;
            armIdle();
            if (onProgress && total > 0) {
                onProgress({ received, total, percent: Math.round((received / total) * 100) });
            }
        });
        await pipeline(source, fs.createWriteStream(destPath));
        return hash.digest("hex");
    } finally {
        clearTimeout(idleTimer);
    }
}


export async function downloadAndVerifyAsset(candidate, releaseInfo, onProgress = null) {
    const binDir = resolveWritableBinDir();
    const localPath = path.join(binDir, candidate.filename);
    const tempDownloadPath = `${localPath}.tmp_${Date.now()}`;
    const sumsTempPath = path.join(binDir, `SHA2-256SUMS.tmp_${Date.now()}`);

    try {
                let assetUrl = `${GITHUB_LATEST_DOWNLOAD}/${candidate.asset}`;
        let sumsUrl = `${GITHUB_LATEST_DOWNLOAD}/SHA2-256SUMS`;
        if (releaseInfo && Array.isArray(releaseInfo.assets)) {
            const asset = releaseInfo.assets.find(a => a.name === candidate.asset);
            const sums = releaseInfo.assets.find(a => a.name === "SHA2-256SUMS");
            if (asset) assetUrl = asset.downloadUrl;
            if (sums) sumsUrl = sums.downloadUrl;
        }

                let expectedHash;
        try {
            await downloadFileTo(sumsUrl, sumsTempPath);
            const sumsText = fs.readFileSync(sumsTempPath, "utf8");
            expectedHash = parseSumsForAsset(sumsText, candidate.asset);
            if (!expectedHash) {
                throw new Error(`Asset "${candidate.asset}" not listed in SHA2-256SUMS`);
            }
        } catch (err) {
            throw new Error(`Checksum file could not be fetched/parsed (${err.message}); refusing to install an unverified binary`);
        }

                const actualHash = await downloadFileTo(assetUrl, tempDownloadPath, onProgress);

                if (actualHash.toLowerCase() !== expectedHash) {
            throw new Error(`SHA-256 mismatch for ${candidate.asset}: expected ${expectedHash}, got ${actualHash}`);
        }

                if (process.platform !== "win32") {
            try { fs.chmodSync(tempDownloadPath, 0o755); } catch (_) {}
        }
        const runs = await verifyBinary(tempDownloadPath, candidate.requiresPython);
        if (!runs) {
            throw new Error(`Downloaded ${candidate.asset} failed --version verification`);
        }

                if (fs.existsSync(localPath)) {
            try { fs.unlinkSync(localPath); } catch (_) {}
        }
        fs.renameSync(tempDownloadPath, localPath);

        return { path: localPath, requiresPython: candidate.requiresPython, managed: true, source: "download" };
    } finally {
        try { fs.unlinkSync(sumsTempPath); } catch (_) {}
        try { fs.unlinkSync(tempDownloadPath); } catch (_) {}
    }
}

let activeBinaryConfig = null;


export async function ensureBinary(forceDownload = false) {
    if (!forceDownload && activeBinaryConfig) {
        return activeBinaryConfig;
    }

    const candidates = getBinaryCandidates();

        if (!forceDownload) {
        const dirs = getBinDirCandidates();
        for (const candidate of candidates) {
            for (const dir of dirs) {
                const candidatePath = path.join(dir, candidate.filename);
                if (!fs.existsSync(candidatePath)) continue;
                if (process.platform !== "win32") {
                    try { fs.chmodSync(candidatePath, 0o755); } catch (_) {}
                }
                if (await verifyBinary(candidatePath, candidate.requiresPython)) {
                    activeBinaryConfig = {
                        path: candidatePath,
                        requiresPython: candidate.requiresPython,
                        managed: true,
                        source: dir === BIN_DIR ? "bin" : "existing"
                    };
                    return activeBinaryConfig;
                }
            }
        }

                const sysBinary = await checkSystemPath("yt-dlp");
        if (sysBinary && await verifyBinary(sysBinary, false)) {
            activeBinaryConfig = { path: sysBinary, requiresPython: false, managed: false, source: "system" };
            return activeBinaryConfig;
        }
    }

        const releaseInfo = await fetchLatestReleaseInfo();
    const errors = [];
    for (const candidate of candidates) {
        try {
            const result = await downloadAndVerifyAsset(candidate, releaseInfo);
            activeBinaryConfig = result;
            return activeBinaryConfig;
        } catch (err) {
            errors.push(`${candidate.asset}: ${err.message}`);
        }
    }
    throw new Error(`Could not obtain a working yt-dlp binary.\n${errors.join("\n")}`);
}


export async function getVersion() {
    try {
        const { stdout } = await exec(["--version"], { timeout: 30000 });
        return stdout.trim() || null;
    } catch (_) {
        return null;
    }
}


export async function updateBinary(channel = "stable") {
    if (!UPDATE_CHANNELS.includes(channel)) {
        throw new Error(`Invalid update channel: "${channel}". Allowed: ${UPDATE_CHANNELS.join(", ")}`);
    }
    const config = await ensureBinary();
    if (!config.managed) {
        throw new Error("yt-dlp is a system install — TurboDM does not self-update binaries it does not own. Update it via your package manager.");
    }
    const { stdout } = await exec(["--update-to", channel], { timeout: 300000 });
        activeBinaryConfig = null;
    const updated = await ensureBinary(true);
    return { message: stdout.trim(), version: await getVersion(), path: updated.path };
}


export async function getBinaryInfo() {
    const info = {
        available: false,
        path: null,
        version: null,
        managed: false,
        source: null,
        ffmpeg: !!(await getFfmpegPath()),
        jsRuntime: !!(await getJsRuntime()),
        python: !!(await getPythonExecutable())
    };
    try {
        const config = await ensureBinary();
        info.available = true;
        info.path = config.path;
        info.managed = config.managed;
        info.source = config.source;
        info.version = await getVersion();
    } catch (err) {
        info.error = err.message;
    }
    return info;
}



export async function exec(args = [], options = {}) {
    const binaryConfig = await ensureBinary();
    const [ffmpegPath, jsRuntime] = await Promise.all([getFfmpegPath(), getJsRuntime()]);

    let execCmd = binaryConfig.path;
    let execArgs = [...args];

    if (binaryConfig.requiresPython || binaryConfig.path.endsWith(".py")) {
        const pythonCmd = await getPythonExecutable();
        if (!pythonCmd) {
            throw new Error("Python 3.9+ is required for the universal zipapp fallback on this platform.");
        }
        execCmd = pythonCmd;
        execArgs = [binaryConfig.path, ...execArgs];
    }

    if (ffmpegPath && !execArgs.includes("--ffmpeg-location")) {
        execArgs.unshift("--ffmpeg-location", path.dirname(ffmpegPath));
    }
    if (jsRuntime && !execArgs.includes("--js-runtimes")) {
        execArgs.unshift("--js-runtimes", jsRuntime);
    }

    const defaultFlags = [
        "--socket-timeout", "30",
        "--retries", "10",
        "--fragment-retries", "10",
        "--retry-sleep", "fragment:exp=1:20"
    ];
    for (let i = defaultFlags.length - 2; i >= 0; i -= 2) {
        if (!execArgs.includes(defaultFlags[i])) {
            execArgs.unshift(defaultFlags[i], defaultFlags[i + 1]);
        }
    }

    const spawnOptions = {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env, PYTHONUNBUFFERED: "1" },
        windowsHide: true
    };

    return new Promise((resolve, reject) => {
        const proc = spawn(execCmd, execArgs, spawnOptions);
        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", (data) => {
            const str = data.toString();
            stdout += str;
            options.onStdout?.(str);
        });
        proc.stderr?.on("data", (data) => {
            const str = data.toString();
            stderr += str;
            options.onStderr?.(str);
        });

        const timeoutMs = options.timeout || 300000;
        const timer = setTimeout(() => {
            try { proc.kill("SIGKILL"); } catch (_) {}
            reject(new Error(`yt-dlp execution timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        proc.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });

        proc.on("close", (code) => {
            clearTimeout(timer);
            if (code === 0) {
                resolve({ stdout, stderr, code });
            } else {
                const friendly = classifyYtDlpError(stderr || stdout);
                const error = new Error(
                    (friendly ? `${friendly.message}\n` : "") +
                    `yt-dlp exited with code ${code}\n${stderr || stdout}`.trim()
                );
                error.code = code;
                error.stderr = stderr;
                error.stdout = stdout;
                error.kind = friendly?.kind || null;
                reject(error);
            }
        });
    });
}



export async function getInfo(url, options = {}) {
    const args = buildProbeArgs(url, options);
    let res;
    try {
        res = await exec(args, { timeout: options.timeout || 120000 });
    } catch (err) {
        if (err.kind) throw err;
        const friendly = classifyYtDlpError(err.message);
        if (friendly) {
            err.kind = friendly.kind;
            err.message = `${friendly.message}\n${err.message}`;
        }
        throw err;
    }

    const rawData = JSON.parse(res.stdout.trim().split(/\r?\n/)[0]);

    const formats = (rawData.formats || []).map(f => ({
        formatId: f.format_id,
        formatNote: f.format_note,
        ext: f.ext,
        resolution: f.resolution || (f.width && f.height ? `${f.width}x${f.height}` : null),
        width: f.width,
        height: f.height,
        fps: f.fps,
        vcodec: f.vcodec,
        acodec: f.acodec,
        filesize: f.filesize || f.filesize_approx,
        filesizeFormatted: f.filesize ? `${(f.filesize / (1024 * 1024)).toFixed(2)} MB` : null,
        hasVideo: f.vcodec && f.vcodec !== "none",
        hasAudio: f.acodec && f.acodec !== "none",
        tbr: f.tbr
    }));

    const bestAudio = formats.filter(f => f.hasAudio && !f.hasVideo).sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0] ||
        formats.filter(f => f.hasAudio).sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0];
    const bestVideoWithAudio = formats.filter(f => f.hasVideo && f.hasAudio).sort((a, b) => (b.height || 0) - (a.height || 0))[0] ||
        formats.filter(f => f.hasVideo).sort((a, b) => (b.height || 0) - (a.height || 0))[0];

    return {
        id: rawData.id,
        title: rawData.title,
        description: rawData.description,
        uploader: rawData.uploader || rawData.channel || rawData.uploader_id,
        uploaderUrl: rawData.uploader_url || rawData.channel_url,
        channel: rawData.channel,
        duration: rawData.duration,
        durationFormatted: formatDuration(rawData.duration),
        viewCount: rawData.view_count,
        likeCount: rawData.like_count,
        thumbnail: rawData.thumbnail,
        thumbnails: rawData.thumbnails || [],
        webpageUrl: rawData.webpage_url || url,
        extractor: rawData.extractor,
        extractorKey: rawData.extractor_key,
        uploadDate: rawData.upload_date,
        isLive: !!rawData.is_live,
        isPlaylist: rawData._type === "playlist",
        tags: rawData.tags || [],
        categories: rawData.categories || [],
        bestAudioFormatId: bestAudio?.formatId || null,
        bestVideoFormatId: bestVideoWithAudio?.formatId || null,
        formats,
        raw: rawData
    };
}


export async function dumpJson(url, options = {}) {
    const args = [
        options.flatPlaylist ? "--dump-single-json" : "--dump-json",
        "--no-warnings",
        "--no-check-certificates"
    ];
    if (options.flatPlaylist) args.push("--flat-playlist");
    if (!options.allowPlaylist) args.push("--no-playlist");

    args.push(...buildCookieArgs(options));
    if (Array.isArray(options.cookieArgs)) args.push(...options.cookieArgs);
    if (options.proxy) {
        if (!isValidProxy(options.proxy)) throw new Error(`Invalid proxy URL: "${options.proxy}"`);
        args.push("--proxy", options.proxy.trim());
    }
    if (options.userAgent) args.push("--user-agent", String(options.userAgent));
    if (Array.isArray(options.extraArgs)) args.push(...options.extraArgs);
    args.push("--", url);

    const { stdout } = await exec(args, { timeout: options.timeout || 120000 });
    const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length === 1) return JSON.parse(lines[0]);
    return lines.map(line => {
        try { return JSON.parse(line); } catch (_) { return line; }
    });
}


export async function search(query, limit = 5, options = {}) {
    const searchPrefix = options.searchPrefix || `ytsearch${limit}:`;
    const args = [
        "--dump-single-json",
        "--no-warnings",
        "--flat-playlist",
        "--no-check-certificates"
    ];
    args.push(...buildCookieArgs(options));
    if (Array.isArray(options.cookieArgs)) args.push(...options.cookieArgs);
    if (options.proxy) {
        if (!isValidProxy(options.proxy)) throw new Error(`Invalid proxy URL: "${options.proxy}"`);
        args.push("--proxy", options.proxy.trim());
    }
    if (Array.isArray(options.extraArgs)) args.push(...options.extraArgs);
    args.push("--", `${searchPrefix}${query}`);

    const { stdout } = await exec(args, { timeout: options.timeout || 120000 });
    const data = JSON.parse(stdout);
    const entries = data.entries || [data];
    return entries.map(item => ({
        id: item.id,
        title: item.title,
        url: item.url || (item.id ? `https://www.youtube.com/watch?v=${item.id}` : null),
        duration: item.duration,
        durationFormatted: formatDuration(item.duration),
        uploader: item.uploader || item.channel,
        thumbnail: item.thumbnail || (item.thumbnails?.[0]?.url) || null,
        viewCount: item.view_count
    }));
}


export async function getStreamUrl(url, options = {}) {
    const args = [
        "-g",
        "--no-warnings",
        "--no-check-certificates",
        "--no-playlist"
    ];
    if (options.format) {
        args.push("-f", String(options.format));
    } else if (options.audioOnly) {
        args.push("-f", "bestaudio/best");
    } else if (options.quality) {
        const height = parseInt(options.quality, 10);
        if (!isNaN(height)) args.push("-f", `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`);
    }
    args.push(...buildCookieArgs(options));
    if (Array.isArray(options.cookieArgs)) args.push(...options.cookieArgs);
    if (options.proxy) {
        if (!isValidProxy(options.proxy)) throw new Error(`Invalid proxy URL: "${options.proxy}"`);
        args.push("--proxy", options.proxy.trim());
    }
    args.push("--", url);

    const { stdout } = await exec(args, { timeout: options.timeout || 120000 });
    const urls = stdout.trim().split(/\r?\n/).filter(Boolean);
    return { url: urls[0] || null, audioUrl: urls[1] || urls[0] || null, allUrls: urls };
}


export async function download(url, options = {}) {
    const outputDir = options.outputDir || ensureTempDir();
    fs.mkdirSync(outputDir, { recursive: true });

    const hasFfmpeg = !!(await getFfmpegPath());
    const args = buildDownloadArgs(url, { ...options, outputDir, hasFfmpeg });

    const { stdout } = await exec(args, {
        ...options,
        onStdout: (data) => {
            for (const line of data.split(/[\r\n]+/)) {
                const progress = parseProgressLine(line);
                if (progress) options.onProgress?.(progress);
            }
        }
    });

        const lines = stdout.trim().split(/\r?\n/).map(l => l.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    let downloadedFilePath = null;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (fs.existsSync(lines[i]) && fs.statSync(lines[i]).isFile() && !lines[i].endsWith(".part") && !lines[i].endsWith(".ytdl")) {
            downloadedFilePath = lines[i];
            break;
        }
    }
    if (!downloadedFilePath) {
        throw new Error("Download finished but the output file could not be located.");
    }

    const stats = fs.statSync(downloadedFilePath);
    return {
        filePath: downloadedFilePath,
        fileName: path.basename(downloadedFilePath),
        sizeBytes: stats.size,
        sizeFormatted: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
        extension: path.extname(downloadedFilePath).replace(".", "")
    };
}
