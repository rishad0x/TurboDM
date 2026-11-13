import fs from "fs";
import path from "path";
import crypto from "crypto";
import { SUPPORTED_BROWSERS, isValidBrowserSpec } from "./ytdlp.js";

export const COOKIES_SCHEMA_VERSION = 1;


export const ACCOUNT_ACCESS_NOTICE =
    "Cookie files grant full access to the accounts they were exported from. " +
    "TurboDM stores them only inside this app's user-data folder and never sends them anywhere " +
    "except to the site you are downloading from. Never share exported cookie files.";


export function validateNetscapeCookies(text) {
    const result = { valid: false, error: null, cookieCount: 0, malformedCount: 0, domains: [] };
    if (typeof text !== "string" || !text.trim()) {
        result.error = "Cookie content is empty.";
        return result;
    }

    const domains = new Set();
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trimEnd();
        if (!line.trim()) continue;

                let cookieLine = null;
        if (line.startsWith("#HttpOnly_")) {
            cookieLine = line.slice("#HttpOnly_".length);
        } else if (line.startsWith("#")) {
            continue;
        } else {
            cookieLine = line;
        }

        const fields = cookieLine.split("\t");
        if (fields.length < 7 || !fields[0] || !fields[5] || !/^\d+$/.test(fields[4].trim())) {
            result.malformedCount++;
            continue;
        }
        const domain = fields[0].trim();
        if (!domain || /\s/.test(domain)) {
            result.malformedCount++;
            continue;
        }
        domains.add(domain.replace(/^\./, "").toLowerCase());
        result.cookieCount++;
    }

    if (result.cookieCount === 0) {
        result.error = "No valid cookies found. Expected Netscape format (cookies.txt) — " +
            "7 tab-separated fields per line. You can export one via a browser extension like 'Get cookies.txt'.";
        return result;
    }

    result.valid = true;
    result.domains = [...domains].slice(0, 10);
    return result;
}


export function mapBrowserCookieError(text) {
    if (!text || typeof text !== "string") return null;
    const t = text.toLowerCase();

    if (t.includes("locked") || t.includes("in use by another process")) {
        return "The browser's cookie database is locked. Fully close that browser (check the system tray) and retry, or use an imported cookies.txt profile instead.";
    }
    if (t.includes("app-bound") || t.includes("failed to decrypt") || t.includes("could not decrypt")) {
        return "This browser encrypts its cookies so external apps can't read them (newer Chrome/Edge). Import a cookies.txt profile in the Cookie Manager instead — export it with a browser extension like 'Get cookies.txt' while logged in.";
    }
    if (t.includes("extracted 0 cookies") || t.includes("no cookies") || t.includes("could not find")) {
        return "No cookies could be read from that browser/profile. Make sure you are logged in to the site in that browser, the profile name is right, and the browser is fully closed. Or import a cookies.txt profile.";
    }
    if (t.includes("keyring") || t.includes("decrypt")) {
        return "The browser's cookie keyring could not be opened on this system. Try an imported cookies.txt profile instead.";
    }
    return null;
}

function assertSafeName(name) {
    const trimmed = String(name ?? "").trim();
    if (!trimmed) throw new Error("Profile name is required.");
    if (trimmed.length > 64) throw new Error("Profile name is too long (max 64 characters).");
        if (/[\u0000-\u001f]/.test(trimmed)) throw new Error("Profile name contains invalid characters.");
    return trimmed;
}

export class CookieManager {

    constructor(storeDir) {
        this.storeDir = storeDir;
        this.filesDir = path.join(storeDir, "files");
        this.profilesPath = path.join(storeDir, "profiles.json");
        this.index = null;
    }

    async init() {
        fs.mkdirSync(this.filesDir, { recursive: true });
        this.index = this._loadIndex();
        this._saveIndex();
        return this.index;
    }


    _loadIndex() {
        try {
            const raw = JSON.parse(fs.readFileSync(this.profilesPath, "utf8"));
            return this._migrate(raw);
        } catch (_) {
            return this._defaultIndex();
        }
    }

    _defaultIndex() {
        return { schemaVersion: COOKIES_SCHEMA_VERSION, defaultProfileId: null, profiles: [] };
    }

    _migrate(raw) {
        let index = raw && typeof raw === "object" ? raw : this._defaultIndex();
        if (!Array.isArray(index.profiles)) index.profiles = [];
        if (!("defaultProfileId" in index)) index.defaultProfileId = null;

                let version = typeof index.schemaVersion === "number" ? index.schemaVersion : 0;
        if (version < 1) {
            version = 1;
                                    index.profiles = index.profiles
                .filter(p => p && typeof p === "object" && p.id)
                .map(p => ({
                    ...p,
                    id: String(p.id),
                    type: p.type === "browser" ? "browser" : "file",
                    lastUsed: p.lastUsed ?? null
                }));
        }
        index.schemaVersion = version;
        return index;
    }

    _saveIndex() {
                const tmp = `${this.profilesPath}.tmp_${Date.now()}`;
        fs.writeFileSync(tmp, JSON.stringify(this.index, null, 2), "utf8");
        fs.renameSync(tmp, this.profilesPath);
    }

    _getProfile(id) {
        const profile = this.index.profiles.find(p => p.id === id);
        if (!profile) throw new Error(`Cookie profile not found: ${id}`);
        return profile;
    }

    _touch(id, field) {
        const profile = this._getProfile(id);
        profile[field] = Date.now();
        this._saveIndex();
    }


    async listProfiles() {
        return {
            schemaVersion: this.index.schemaVersion,
            defaultProfileId: this.index.defaultProfileId,
            profiles: this.index.profiles.map(p => ({
                id: p.id,
                name: p.name,
                type: p.type,
                browser: p.browser ?? null,
                browserProfile: p.browserProfile ?? null,
                browserSpec: p.browserSpec ?? null,
                cookieCount: p.cookieCount ?? null,
                domains: p.domains ?? null,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt ?? null,
                lastUsed: p.lastUsed
            }))
        };
    }


    async createFileProfile({ name, content }) {
        const safeName = assertSafeName(name);
        const validation = validateNetscapeCookies(content);
        if (!validation.valid) throw new Error(validation.error);

        const id = crypto.randomUUID();
        const fileName = `${id}.txt`;
        fs.writeFileSync(path.join(this.filesDir, fileName), content.replace(/\r?\n/g, "\n"), "utf8");

        const profile = {
            id,
            name: safeName,
            type: "file",
            fileName,
            cookieCount: validation.cookieCount,
            domains: validation.domains,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastUsed: null
        };
        this.index.profiles.push(profile);
        this._saveIndex();
        return this._publicProfile(profile);
    }


    async importFileProfile({ name, sourcePath }) {
        if (!sourcePath || !fs.existsSync(sourcePath)) {
            throw new Error("Cookie file not found.");
        }
        const content = fs.readFileSync(sourcePath, "utf8");
        return this.createFileProfile({ name, content });
    }


    async updateFileProfileContent(id, content) {
        const profile = this._getProfile(id);
        if (profile.type !== "file") throw new Error("Only file profiles can have their content updated.");
        const validation = validateNetscapeCookies(content);
        if (!validation.valid) throw new Error(validation.error);

        fs.writeFileSync(path.join(this.filesDir, profile.fileName), content.replace(/\r?\n/g, "\n"), "utf8");
        profile.cookieCount = validation.cookieCount;
        profile.domains = validation.domains;
        profile.updatedAt = Date.now();
        this._saveIndex();
        return this._publicProfile(profile);
    }


    async createBrowserProfile({ name, browserSpec }) {
        const safeName = assertSafeName(name);
        const spec = String(browserSpec ?? "").trim();
        if (!isValidBrowserSpec(spec)) {
            throw new Error(`Unsupported browser spec: "${spec}". Supported browsers: ${SUPPORTED_BROWSERS.join(", ")}. Optional profile: browser:ProfileName.`);
        }

        const [browser, browserProfile = null] = spec.split("::")[0].split(":");
        const id = crypto.randomUUID();
        const profile = {
            id,
            name: safeName,
            type: "browser",
            browser: browser.toLowerCase(),
            browserProfile: browserProfile || null,
            browserSpec: spec,
            createdAt: Date.now(),
            lastUsed: null
        };
        this.index.profiles.push(profile);
        this._saveIndex();
        return this._publicProfile(profile);
    }

    async renameProfile(id, newName) {
        const profile = this._getProfile(id);
        profile.name = assertSafeName(newName);
        if (profile.type === "file") profile.updatedAt = Date.now();
        this._saveIndex();
        return this._publicProfile(profile);
    }

    async deleteProfile(id) {
        const profile = this._getProfile(id);
        if (profile.type === "file" && profile.fileName) {
            try { fs.unlinkSync(path.join(this.filesDir, profile.fileName)); } catch (_) {}
        }
        this.index.profiles = this.index.profiles.filter(p => p.id !== id);
        if (this.index.defaultProfileId === id) {
            this.index.defaultProfileId = null;
        }
        this._saveIndex();
        return { success: true };
    }

    async setDefaultProfile(id) {
        if (id === null || id === undefined || id === "") {
            this.index.defaultProfileId = null;
        } else {
            this._getProfile(id);
            this.index.defaultProfileId = id;
        }
        this._saveIndex();
        return { success: true, defaultProfileId: this.index.defaultProfileId };
    }

    async getDefaultProfileId() {
        return this.index.defaultProfileId;
    }


    async readProfileContent(id) {
        const profile = this._getProfile(id);
        if (profile.type !== "file") throw new Error("Browser profiles have no stored file content.");
        return fs.readFileSync(path.join(this.filesDir, profile.fileName), "utf8");
    }


    async resolveProfileArgs(profileId = null) {
        let id = profileId;
        if (!id && this.index.defaultProfileId) id = this.index.defaultProfileId;

        if (!id) return { args: [], profile: null };

        const profile = this._getProfile(id);
        profile.lastUsed = Date.now();
        this._saveIndex();

        if (profile.type === "browser") {
            return { args: ["--cookies-from-browser", profile.browserSpec], profile };
        }
        const jarPath = path.join(this.filesDir, profile.fileName);
        if (!fs.existsSync(jarPath)) {
            throw new Error(`Cookie jar file is missing for profile "${profile.name}" — re-import it.`);
        }
        return { args: ["--cookies", jarPath], profile };
    }


    createSessionJar(url, cookieHeader) {
        let host = null;
        let secure = false;
        try {
            const u = new URL(url);
            host = u.hostname;
            secure = u.protocol === "https:";
        } catch (_) {
            throw new Error("Invalid URL for session cookies");
        }
        if (!cookieHeader || typeof cookieHeader !== "string") {
            throw new Error("No cookies captured for this download");
        }

        const lines = [];
        for (const pair of cookieHeader.split(";")) {
            const eq = pair.indexOf("=");
            if (eq < 1) continue;
            const name = pair.slice(0, eq).trim();
            const value = pair.slice(eq + 1).trim();
            if (!name || !value) continue;
                        if (/[\u0000-\u001f]/.test(name) || /[\u0000-\u001f]/.test(value)) continue;
                        lines.push(`${host}\tFALSE\t/\t${secure ? "TRUE" : "FALSE"}\t0\t${name}\t${value}`);
        }
        if (!lines.length) {
            throw new Error("No usable cookies in the captured header");
        }

        const id = crypto.randomUUID();
        const fileName = `session-${id}.txt`;
        fs.writeFileSync(
            path.join(this.filesDir, fileName),
            "# Netscape HTTP Cookie File\n" + lines.join("\n") + "\n",
            "utf8"
        );
        return { args: ["--cookies", path.join(this.filesDir, fileName)], sessionId: id, cookieCount: lines.length };
    }

    _publicProfile(p) {
        return {
            id: p.id,
            name: p.name,
            type: p.type,
            browser: p.browser ?? null,
            browserProfile: p.browserProfile ?? null,
            browserSpec: p.browserSpec ?? null,
            cookieCount: p.cookieCount ?? null,
            domains: p.domains ?? null,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt ?? null,
            lastUsed: p.lastUsed
        };
    }
}
