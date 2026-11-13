export const MAX_FILENAME_LENGTH = 200;
export const MAX_SAVEDIR_LENGTH = 1024;

const RESERVED_DEVICE_NAMES = new Set([
    "CON", "PRN", "AUX", "NUL",
    "COM0", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT0", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
]);

const FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F\u007F]/g;


export function isReservedDeviceName(name) {
    const stem = String(name ?? "").split(".")[0].toUpperCase();
    return RESERVED_DEVICE_NAMES.has(stem);
}


export function sanitizeFilename(name) {
    let n = String(name ?? "").trim();
    if (!n) return "download";

            n = n.split(/[\\/]/).pop().trim() || "";

    n = n.replace(FORBIDDEN_FILENAME_CHARS, "_");

            if (isReservedDeviceName(n)) n = `_${n}`;

    n = n.replace(/[.\s]+$/, "");
    if (!n) return "download";

    if (n.length > MAX_FILENAME_LENGTH) {
        const extMatch = /(\.[^.\s\\/]{1,20})$/.exec(n);
        if (extMatch) {
            const ext = extMatch[1];
            const stem = n.slice(0, n.length - ext.length);
            n = stem.slice(0, Math.max(0, MAX_FILENAME_LENGTH - ext.length)) + ext;
        } else {
            n = n.slice(0, MAX_FILENAME_LENGTH);
        }
        n = n.replace(/[.\s]+$/, "");
        if (!n) return "download";
    }

    return n;
}

const SYSTEM_DIR_DENY_BASES = [
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\ProgramData",
    "C:\\PROGRA~1",
    "C:\\PROGRA~2"
];

const STARTUP_TAIL = ["start menu", "programs", "startup"];

function canonicalForDenyMatch(dir) {
    return dir
        .replace(/\//g, "\\")
        .split("\\")
        .map(seg => seg.replace(/[.\s]+$/, "").toLowerCase())
        .filter(seg => seg !== "")
        .join("\\");
}

function systemDirDenyReason(dir) {
    const norm = canonicalForDenyMatch(dir);
    for (const base of SYSTEM_DIR_DENY_BASES) {
        const b = canonicalForDenyMatch(base);
        if (norm === b || norm.startsWith(b + "\\")) return base;
    }
    const segs = norm.split("\\");
    for (let i = 0; i + STARTUP_TAIL.length <= segs.length; i++) {
        if (STARTUP_TAIL.every((s, j) => segs[i + j] === s)) {
            return "the Windows Startup folder";
        }
    }
    return null;
}


export function validateSaveDirPath(dir) {
    const d = String(dir ?? "").trim();
    if (!d) return { ok: false, reason: "saveDir is empty" };
    if (d.length > MAX_SAVEDIR_LENGTH) {
        return { ok: false, reason: `saveDir exceeds ${MAX_SAVEDIR_LENGTH} characters` };
    }
    if (/[\u0000-\u001F\u007F]/.test(d)) {
        return { ok: false, reason: "saveDir contains control characters" };
    }

    const isWinDrive = /^[A-Za-z]:[\\/]/.test(d);
    const isUnc = /^\\\\[^\\/]/.test(d);
    if (!isWinDrive && !isUnc && !d.startsWith("/")) {
        return { ok: false, reason: "saveDir must be an absolute path" };
    }

    const segments = d.split(/[\\/]+/);
    if (segments.some(s => s === "..")) {
        return { ok: false, reason: 'saveDir must not contain ".." path segments' };
    }

    const denyHit = systemDirDenyReason(d);
    if (denyHit) {
        return { ok: false, reason: `saveDir targets a protected system location (${denyHit})` };
    }

    const last = segments[segments.length - 1];
    if (/[.\s]$/.test(last)) {
        return { ok: false, reason: "saveDir must not end with a dot or space" };
    }
    if (last && isReservedDeviceName(last)) {
        return { ok: false, reason: `saveDir ends with reserved device name "${last}"` };
    }

    return { ok: true, dir: d };
}
