import { isYtDlpUrl, isHlsUrl } from "./ytdlpEngine.js";


export function decideRoute({ url, contentType = "", probeOk = false }) {
    if (isYtDlpUrl(url) || isHlsUrl(url)) return "ytdlp";

    if (!probeOk) return "http";

    const ct = String(contentType || "").toLowerCase();
    if (ct.includes("text/html") || ct.includes("application/xhtml")) return "ytdlp";
    if (ct.includes("application/json") || ct.includes("text/plain") || ct.includes("application/xml")) return "ytdlp";
    return "http";
}


export function popupsRequired({ engine, alwaysAsk }) {
    if (engine !== "ytdlp" || !alwaysAsk) return { cookie: false, quality: false };
    return { cookie: true, quality: true };
}
