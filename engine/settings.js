import fs from "fs";
import { UPDATE_CHANNELS, MERGE_FORMATS, isValidProxy, RATE_LIMIT_RE } from "./ytdlp.js";

export const SETTINGS_SCHEMA_VERSION = 2;
export const MAX_RECENT_SAVE_DIRS = 8;

const QUALITY_HEIGHTS = [144, 240, 360, 480, 720, 1080, 1440, 2160];


export function defaultSettings(defaultSaveDir = null) {
    return {
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        theme: "dark",
        reduceTransparency: false,
        firstRunCompleted: false,
        detectClipboardUrls: true,
        closeToTray: true,
        defaultSaveDir: defaultSaveDir || null,
        recentSaveDirs: [],
        maxConcurrent: 5,
        maxConnections: 32,
        defaultCookieProfileId: null,
        ytdlpChannel: "stable",
        autoUpdateYtdlp: false,
        preferredFormat: "mp4",
        defaultQuality: "best",
        alwaysAsk: true,
        concurrentFragments: 16,
        limitRate: "",
        embedThumbnail: false,
        embedMetadata: false,
        proxy: ""
    };
}


export function sanitizeSettings(patch) {
    const cleaned = {};
    const errors = [];
    const p = patch && typeof patch === "object" ? patch : {};

    const int = (key, min, max) => {
        if (!(key in p)) return;
        const n = Number(p[key]);
        if (!Number.isInteger(n) || n < min || n > max) {
            errors.push(`${key} must be an integer between ${min} and ${max}`);
        } else {
            cleaned[key] = n;
        }
    };
    const bool = (key) => {
        if (!(key in p)) return;
        if (typeof p[key] !== "boolean") {
            errors.push(`${key} must be true or false`);
        } else {
            cleaned[key] = p[key];
        }
    };
    const str = (key, maxLen = 512) => {
        if (!(key in p)) return;
        if (typeof p[key] !== "string" || p[key].length > maxLen) {
            errors.push(`${key} must be a string (max ${maxLen} chars)`);
        } else {
            cleaned[key] = p[key].trim();
        }
    };

    str("defaultSaveDir", 1024);
    int("maxConcurrent", 1, 10);
    int("maxConnections", 1, 64);

    if ("theme" in p) {
        if (["dark", "light", "system"].includes(p.theme)) {
            cleaned.theme = p.theme;
        } else {
            errors.push('theme must be "dark", "light", or "system"');
        }
    }
    bool("reduceTransparency");
    bool("firstRunCompleted");
    bool("detectClipboardUrls");
    bool("closeToTray");

    if ("recentSaveDirs" in p) {
        if (!Array.isArray(p.recentSaveDirs)) {
            errors.push("recentSaveDirs must be an array of absolute paths");
        } else {
            const seen = new Set();
            const dirs = [];
            for (const item of p.recentSaveDirs) {
                if (typeof item !== "string") continue;
                const d = item.trim();
                if (!d || d.length > 1024 || seen.has(d)) continue;
                seen.add(d);
                dirs.push(d);
                if (dirs.length >= MAX_RECENT_SAVE_DIRS) break;
            }
            cleaned.recentSaveDirs = dirs;
        }
    }

    if ("defaultCookieProfileId" in p) {
        if (p.defaultCookieProfileId === null || p.defaultCookieProfileId === "") {
            cleaned.defaultCookieProfileId = null;
        } else if (typeof p.defaultCookieProfileId === "string" && /^[\w-]{1,64}$/.test(p.defaultCookieProfileId)) {
            cleaned.defaultCookieProfileId = p.defaultCookieProfileId;
        } else {
            errors.push("defaultCookieProfileId must be null or a valid profile id");
        }
    }

    if ("ytdlpChannel" in p) {
        if (UPDATE_CHANNELS.includes(p.ytdlpChannel)) {
            cleaned.ytdlpChannel = p.ytdlpChannel;
        } else {
            errors.push(`ytdlpChannel must be one of: ${UPDATE_CHANNELS.join(", ")}`);
        }
    }
    bool("autoUpdateYtdlp");
    bool("alwaysAsk");

    if ("preferredFormat" in p) {
        if (MERGE_FORMATS.includes(p.preferredFormat)) {
            cleaned.preferredFormat = p.preferredFormat;
        } else {
            errors.push(`preferredFormat must be one of: ${MERGE_FORMATS.join(", ")}`);
        }
    }

    if ("defaultQuality" in p) {
        const q = p.defaultQuality;
        if (q === "best" || q === "audio" || q === "max") {
            cleaned.defaultQuality = q;
        } else {
            const n = Number(q);
            if (Number.isInteger(n) && n >= 144 && n <= 2160) {
                cleaned.defaultQuality = n;
            } else {
                errors.push(`defaultQuality must be "best", "max", "audio", or a height between 144 and 2160`);
            }
        }
    }

    int("concurrentFragments", 1, 32);

    if ("limitRate" in p) {
        const v = String(p.limitRate ?? "").trim();
        if (v === "") {
            cleaned.limitRate = "";
        } else if (RATE_LIMIT_RE.test(v)) {
            cleaned.limitRate = v;
        } else {
            errors.push('limitRate must be empty or like "50K" / "4.2M"');
        }
    }

    bool("embedThumbnail");
    bool("embedMetadata");

    if ("proxy" in p) {
        const v = String(p.proxy ?? "").trim();
        if (v === "") {
            cleaned.proxy = "";
        } else if (isValidProxy(v)) {
            cleaned.proxy = v;
        } else {
            errors.push("proxy must be empty or a valid http/https/socks4/socks5 URL");
        }
    }

    return { cleaned, errors };
}


export function mergeSettings(raw, defaults) {
    const merged = { ...defaults };
    const r = raw && typeof raw === "object" ? raw : {};

    const clampInt = (key, min, max) => {
        const n = Number(r[key]);
        if (Number.isInteger(n)) merged[key] = Math.min(max, Math.max(min, n));
    };
    const coerceBool = (key) => {
        if (typeof r[key] === "boolean") merged[key] = r[key];
    };

    if (typeof r.defaultSaveDir === "string" && r.defaultSaveDir.trim()) {
        merged.defaultSaveDir = r.defaultSaveDir.trim();
    }
                if (["dark", "light", "system"].includes(r.theme)) merged.theme = r.theme;
    if (Array.isArray(r.recentSaveDirs)) {
        merged.recentSaveDirs = r.recentSaveDirs
            .filter(d => typeof d === "string" && d.trim())
            .map(d => d.trim())
            .filter((d, i, a) => a.indexOf(d) === i)
            .slice(0, MAX_RECENT_SAVE_DIRS);
    }
    clampInt("maxConcurrent", 1, 10);
    clampInt("maxConnections", 1, 64);

    coerceBool("reduceTransparency");
    coerceBool("detectClipboardUrls");
    coerceBool("closeToTray");
    coerceBool("firstRunCompleted");

    if (typeof r.defaultCookieProfileId === "string" && r.defaultCookieProfileId) {
        merged.defaultCookieProfileId = r.defaultCookieProfileId;
    }

    if (UPDATE_CHANNELS.includes(r.ytdlpChannel)) merged.ytdlpChannel = r.ytdlpChannel;
    coerceBool("autoUpdateYtdlp");
    coerceBool("alwaysAsk");

    if (MERGE_FORMATS.includes(r.preferredFormat)) merged.preferredFormat = r.preferredFormat;
    if (r.defaultQuality === "best" || r.defaultQuality === "audio" || r.defaultQuality === "max") {
        merged.defaultQuality = r.defaultQuality;
    } else {
        const n = Number(r.defaultQuality);
        if (Number.isInteger(n) && n >= 144 && n <= 2160) merged.defaultQuality = n;
    }

    clampInt("concurrentFragments", 1, 32);
    if (typeof r.limitRate === "string" && RATE_LIMIT_RE.test(r.limitRate.trim())) {
        merged.limitRate = r.limitRate.trim();
    }
    coerceBool("embedThumbnail");
    coerceBool("embedMetadata");
    if (typeof r.proxy === "string" && r.proxy.trim() && isValidProxy(r.proxy.trim())) {
        merged.proxy = r.proxy.trim();
    }

        return merged;
}

export class SettingsStore {

    constructor(settingsPath, { defaultSaveDir = null } = {}) {
        this.settingsPath = settingsPath;
        this.defaults = defaultSettings(defaultSaveDir);
        this.settings = null;
    }

    async init() {
        let raw = null;
        try {
            raw = JSON.parse(fs.readFileSync(this.settingsPath, "utf8"));
        } catch (_) {
            raw = null;
        }
        this.settings = this._migrateAndMerge(raw);
        this._save();
        return this.settings;
    }

    _migrateAndMerge(raw) {
        const merged = mergeSettings(raw, this.defaults);
                        let version = typeof raw?.schemaVersion === "number" ? raw.schemaVersion : 0;
        if (version < 1) version = 1;
        if (version < 2) {
                                                merged.maxConcurrent = this.defaults.maxConcurrent;
            merged.maxConnections = this.defaults.maxConnections;
            merged.concurrentFragments = this.defaults.concurrentFragments;
            version = 2;
        }
        merged.schemaVersion = version;
        return merged;
    }

    _save() {
        try {
            const tmp = `${this.settingsPath}.tmp_${Date.now()}`;
            fs.writeFileSync(tmp, JSON.stringify(this.settings, null, 2), "utf8");
            fs.renameSync(tmp, this.settingsPath);
        } catch (_) {}
    }

    getAll() {
        return { ...this.settings };
    }


    set(patch) {
        const { cleaned, errors } = sanitizeSettings(patch);
        if (errors.length) {
            throw new Error(`Invalid settings: ${errors.join("; ")}`);
        }
        this.settings = { ...this.settings, ...cleaned };
                this._save();
        return this.getAll();
    }


    setDefaultSaveDir(dir) {
        if (typeof dir === "string" && dir.trim()) {
            this.settings.defaultSaveDir = dir.trim();
            this._save();
        }
        return this.getAll();
    }


    pushRecentSaveDir(dir) {
        if (typeof dir !== "string" || !dir.trim()) return this.getAll();
        const clean = dir.trim();
        const cur = Array.isArray(this.settings.recentSaveDirs) ? this.settings.recentSaveDirs : [];
        this.settings.recentSaveDirs = [clean, ...cur.filter(d => d !== clean)].slice(0, MAX_RECENT_SAVE_DIRS);
        this._save();
        return this.getAll();
    }
}
