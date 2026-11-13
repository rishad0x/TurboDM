import { test, expect, describe } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";
import {
    isValidProxy,
    isValidBrowserSpec,
    classifyYtDlpError,
    buildCookieArgs,
    buildProbeArgs,
    buildDownloadArgs,
    parseProgressLine,
    formatDuration,
    getBinaryCandidates,
    parseSumsForAsset,
    SUPPORTED_BROWSERS,
    MERGE_FORMATS
} from "../engine/ytdlp.js";

describe("isValidProxy", () => {
    test("accepts http/https/socks proxies", () => {
        expect(isValidProxy("http://127.0.0.1:8080")).toBe(true);
        expect(isValidProxy("https://proxy.example.com")).toBe(true);
        expect(isValidProxy("socks5://user:pass@host:1080")).toBe(true);
        expect(isValidProxy("socks4://host:1080")).toBe(true);
    });

    test("rejects bad or wrong-scheme proxies", () => {
        expect(isValidProxy("")).toBe(false);
        expect(isValidProxy(null)).toBe(false);
        expect(isValidProxy("not a url")).toBe(false);
        expect(isValidProxy("ftp://host")).toBe(false);
        expect(isValidProxy("javascript:alert(1)")).toBe(false);
        expect(isValidProxy("http://")).toBe(false);
    });
});

describe("isValidBrowserSpec", () => {
    test("accepts supported browsers, with optional profile and container", () => {
        expect(isValidBrowserSpec("chrome")).toBe(true);
        expect(isValidBrowserSpec("firefox")).toBe(true);
        expect(isValidBrowserSpec("edge:Profile 2")).toBe(true);
        expect(isValidBrowserSpec("chrome::Default")).toBe(true);
        expect(isValidBrowserSpec("firefox:abcd::Mozilla")).toBe(true);
    });

    test("rejects unknown browsers and hostile input", () => {
        expect(isValidBrowserSpec("notabrowser")).toBe(false);
        expect(isValidBrowserSpec("")).toBe(false);
        expect(isValidBrowserSpec(null)).toBe(false);
        expect(isValidBrowserSpec("chrome; rm -rf /")).toBe(false);
        expect(isValidBrowserSpec("chrome--flag")).toBe(false);
        expect(isValidBrowserSpec("chrome:a:b::c")).toBe(false);
    });

    test("SUPPORTED_BROWSERS matches yt-dlp's documented set", () => {
        expect(SUPPORTED_BROWSERS).toContain("chrome");
        expect(SUPPORTED_BROWSERS).toContain("firefox");
        expect(SUPPORTED_BROWSERS).toContain("edge");
        expect(SUPPORTED_BROWSERS).toContain("safari");
        expect(SUPPORTED_BROWSERS).not.toContain("internet_explorer");
    });
});

describe("classifyYtDlpError", () => {
    test("maps sign-in / bot walls to auth", () => {
        const r = classifyYtDlpError("ERROR: Sign in to confirm you're not a bot.");
        expect(r.kind).toBe("auth");
        expect(r.message).toMatch(/cookie/i);
    });

    test("maps rate limiting, private, geo, unavailable, unsupported", () => {
        expect(classifyYtDlpError("ERROR: HTTP Error 429: Too Many Requests").kind).toBe("ratelimit");
        expect(classifyYtDlpError("ERROR: This video is private.").kind).toBe("private");
        expect(classifyYtDlpError("This video is not available in your country.").kind).toBe("geo");
        expect(classifyYtDlpError("ERROR: Video unavailable").kind).toBe("unavailable");
        expect(classifyYtDlpError("ERROR: Unsupported URL: foo://bar").kind).toBe("unsupported");
    });

    test("maps extraction failures to update advice", () => {
        expect(classifyYtDlpError("ERROR: Unable to extract yt initial player response").kind).toBe("extraction");
    });

    test("maps browser cookie extraction failures", () => {
        expect(classifyYtDlpError("Could not find chrome cookies database").kind).toBe("browser-cookies");
        expect(classifyYtDlpError("cookies database is locked").kind).toBe("browser-cookies");
    });

    test("returns null for unknown text and empty input", () => {
        expect(classifyYtDlpError("some totally unknown failure")).toBeNull();
        expect(classifyYtDlpError("")).toBeNull();
        expect(classifyYtDlpError(null)).toBeNull();
    });
});

describe("buildCookieArgs", () => {
    test("file profile", () => {
        expect(buildCookieArgs({ cookies: "/path/cookies.txt" })).toEqual(["--cookies", "/path/cookies.txt"]);
    });

    test("browser profile", () => {
        expect(buildCookieArgs({ cookiesFromBrowser: "edge:Profile 1" })).toEqual(["--cookies-from-browser", "edge:Profile 1"]);
    });

    test("browser takes precedence over file", () => {
        const args = buildCookieArgs({ cookies: "/a.txt", cookiesFromBrowser: "chrome" });
        expect(args).toEqual(["--cookies-from-browser", "chrome"]);
    });

    test("empty when unset", () => {
        expect(buildCookieArgs({})).toEqual([]);
    });

    test("throws on unsupported browser", () => {
        expect(() => buildCookieArgs({ cookiesFromBrowser: "netscape" })).toThrow(/Unsupported browser/);
    });
});

describe("buildProbeArgs", () => {
    test("base shape with URL last after --", () => {
        const args = buildProbeArgs("https://youtu.be/xyz");
        expect(args[0]).toBe("--dump-single-json");
        expect(args).toContain("--no-playlist");
        const sep = args.indexOf("--");
        expect(args[sep + 1]).toBe("https://youtu.be/xyz");
        expect(sep + 2).toBe(args.length);
    });

    test("allowPlaylist omits --no-playlist; flatPlaylist adds --flat-playlist", () => {
        expect(buildProbeArgs("https://x", { allowPlaylist: true })).not.toContain("--no-playlist");
        expect(buildProbeArgs("https://x", { flatPlaylist: true })).toContain("--flat-playlist");
    });

    test("includes validated cookies, proxy, user agent", () => {
        const args = buildProbeArgs("https://x", {
            cookies: "/c.txt",
            proxy: "socks5://127.0.0.1:9050",
            userAgent: "TestAgent/1.0"
        });
        expect(args).toContain("--cookies");
        expect(args).toContain("socks5://127.0.0.1:9050");
        expect(args).toContain("TestAgent/1.0");
    });

    test("throws on invalid proxy or empty url", () => {
        expect(() => buildProbeArgs("https://x", { proxy: "garbage" })).toThrow(/Invalid proxy/);
        expect(() => buildProbeArgs("")).toThrow(/URL is required/);
    });
});

describe("buildDownloadArgs", () => {
    const url = "https://youtu.be/xyz";

    test("base shape: newline, progress, print path, no-playlist, fragments, -- + url last", () => {
        const args = buildDownloadArgs(url);
        expect(args).toContain("--newline");
        expect(args).toContain("--progress");
        expect(args.join(" ")).toContain("--print after_move:filepath");
        expect(args).toContain("--no-playlist");
        const nIdx = args.indexOf("-N");
        expect(args[nIdx + 1]).toBe("4");
        const sep = args.indexOf("--");
        expect(args[sep + 1]).toBe(url);
        expect(sep + 2).toBe(args.length);
    });

    test("audioOnly with ffmpeg adds -x and audio format", () => {
        const args = buildDownloadArgs(url, { audioOnly: true, audioFormat: "mp3", hasFfmpeg: true });
        expect(args.join(" ")).toContain("-f bestaudio/best");
        expect(args).toContain("-x");
        expect(args.join(" ")).toContain("--audio-format mp3");
    });

    test("explicit format id that needs audio gets +bestaudio fallback", () => {
        const args = buildDownloadArgs(url, { formatId: "137", formatNeedsAudio: true });
        expect(args.join(" ")).toContain("-f 137+bestaudio/137");
    });

    test("explicit format id alone stays bare", () => {
        const args = buildDownloadArgs(url, { formatId: "hls-1080" });
        expect(args.join(" ")).toContain("-f hls-1080");
    });

    test("format id whitelist blocks flag injection", () => {
        expect(() => buildDownloadArgs(url, { formatId: "--exec;rm" })).toThrow(/Invalid format id/);
        expect(() => buildDownloadArgs(url, { formatId: "best; calc" })).toThrow(/Invalid format id/);
    });

    test("quality presets", () => {
        const withFfmpeg = buildDownloadArgs(url, { quality: 720, hasFfmpeg: true });
        expect(withFfmpeg.join(" ")).toContain("-f bv*[height<=720]+ba/b[height<=720]/b");

        const noFfmpeg = buildDownloadArgs(url, { quality: 720, hasFfmpeg: false });
        expect(noFfmpeg.join(" ")).toContain("-f b[height<=720]/b");

        const best = buildDownloadArgs(url, { quality: "best", hasFfmpeg: true });
        expect(best.join(" ")).toContain("-f bv*+ba/b");
    });

    test("quality 'max' adds bitrate-first format sorting", () => {
        const max = buildDownloadArgs(url, { quality: "max", hasFfmpeg: true });
        expect(max.join(" ")).toContain("-f bv*+ba/b");
        const sIdx = max.indexOf("-S");
        expect(sIdx).toBeGreaterThan(-1);
        expect(max[sIdx + 1]).toBe("res,fps,br");

                const maxNoFfmpeg = buildDownloadArgs(url, { quality: "max", hasFfmpeg: false });
        expect(maxNoFfmpeg.join(" ")).toContain("-f b");
        expect(maxNoFfmpeg).not.toContain("-S");
    });

    test("merge format whitelist", () => {
        const ok = buildDownloadArgs(url, { mergeFormat: "mkv", hasFfmpeg: true });
        expect(ok.join(" ")).toContain("--merge-output-format mkv");
        const bad = buildDownloadArgs(url, { mergeFormat: "exe", hasFfmpeg: true });
        expect(bad).not.toContain("--merge-output-format");
    });

    test("concurrent fragments clamped to 1..16", () => {
        const low = buildDownloadArgs(url, { concurrentFragments: 0 });
        expect(low[low.indexOf("-N") + 1]).toBe("1");
        const high = buildDownloadArgs(url, { concurrentFragments: 99 });
        expect(high[high.indexOf("-N") + 1]).toBe("32");
    });

    test("embed and limit flags", () => {
        const args = buildDownloadArgs(url, { embedThumbnail: true, embedMetadata: true, limitRate: "2M", maxFilesize: "500MB" });
        expect(args).toContain("--embed-thumbnail");
        expect(args).toContain("--embed-metadata");
        expect(args.join(" ")).toContain("--limit-rate 2M");
        expect(args.join(" ")).toContain("--max-filesize 500MB");
        expect(() => buildDownloadArgs(url, { limitRate: "notanumber" })).toThrow(/Invalid rate limit/);
    });

    test("cookie args flow through", () => {
        const args = buildDownloadArgs(url, { cookies: "/c.txt" });
        expect(args.join(" ")).toContain("--cookies /c.txt");
    });

    test("custom output template honored", () => {
        const args = buildDownloadArgs(url, { outputTemplate: "C:/tmp/%(title)s.%(ext)s" });
        const oIdx = args.indexOf("-o");
        expect(args[oIdx + 1]).toBe("C:/tmp/%(title)s.%(ext)s");
    });
});

describe("parseProgressLine", () => {
    test("parses the classic download line", () => {
        const r = parseProgressLine("[download]  24.5% of ~ 120.00MiB at  3.50MiB/s ETA 00:25");
        expect(r.percent).toBeCloseTo(24.5);
        expect(r.totalSize).toBe(120 * 1024 * 1024);
        expect(r.speed).toBe(Math.round(3.5 * 1024 * 1024));
        expect(r.eta).toBe(25);
        expect(r.downloadedSize).toBe(Math.round(0.245 * 120 * 1024 * 1024));
    });

    test("parses h:m:s ETA and KiB units", () => {
        const r = parseProgressLine("[download]  50.0% of 1.00GiB at 512.00KiB/s ETA 01:02:03");
        expect(r.totalSize).toBe(1024 * 1024 * 1024);
        expect(r.speed).toBe(512 * 1024);
        expect(r.eta).toBe(3723);
    });

    test("ignores non-progress lines", () => {
        expect(parseProgressLine("[Merger] Merging formats into \"out.mp4\"")).toBeNull();
        expect(parseProgressLine("[download] Destination: out.mp4")).toBeNull();
        expect(parseProgressLine("")).toBeNull();
        expect(parseProgressLine(null)).toBeNull();
    });
});

describe("parseSumsForAsset", () => {
    const sums = [
        "# SHA256 checksums generated by yt-dlp",
        "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789  yt-dlp",
        "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef  yt-dlp.exe",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  yt-dlp_linux"
    ].join("\n");

    test("finds the right asset", () => {
        expect(parseSumsForAsset(sums, "yt-dlp.exe")).toBe("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
        expect(parseSumsForAsset(sums, "yt-dlp_linux")).toBe("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    });

    test("missing asset and empty input", () => {
        expect(parseSumsForAsset(sums, "yt-dlp_macos")).toBeNull();
        expect(parseSumsForAsset("", "yt-dlp")).toBeNull();
        expect(parseSumsForAsset(null, "yt-dlp")).toBeNull();
    });
});

describe("formatDuration", () => {
    test("hours minutes seconds", () => {
        expect(formatDuration(3725)).toBe("01:02:05");
        expect(formatDuration(65)).toBe("01:05");
        expect(formatDuration(0)).toBe("00:00");
        expect(formatDuration(null)).toBe("00:00");
        expect(formatDuration(NaN)).toBe("00:00");
    });
});

describe("getBinaryCandidates", () => {
    test("win32 x64 prefers standalone exe", () => {
        const c = getBinaryCandidates("win32", "x64");
        expect(c[0].asset).toBe("yt-dlp.exe");
        expect(c[0].requiresPython).toBe(false);
        expect(c.some(x => x.requiresPython)).toBe(true);
    });

    test("win32 arm64 includes arm64 asset first", () => {
        const c = getBinaryCandidates("win32", "arm64");
        expect(c[0].asset).toBe("yt-dlp_arm64.exe");
    });

    test("linux x64 glibc includes linux binary; musl variant when musl", () => {
        const c = getBinaryCandidates("linux", "x64");
        expect(c.some(x => x.asset === "yt-dlp_linux")).toBe(true);
    });

    test("darwin prefers macos binary", () => {
        const c = getBinaryCandidates("darwin", "arm64");
        expect(c[0].asset).toBe("yt-dlp_macos");
    });
});

describe("constants", () => {
    test("merge formats are the yt-dlp-safe set", () => {
        expect(MERGE_FORMATS).toEqual(["mp4", "mkv", "webm"]);
    });
});

describe("findDownloadedFile", () => {
    test("resolves downloaded file by id in directory", async () => {
        const { findDownloadedFile } = await import("../engine/ytdlpEngine.js");
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "turbodm-find-"));
        try {
            const actualFile = path.join(tmpDir, "Cool Video [abc123XYZ].mp4");
            fs.writeFileSync(actualFile, "video data");

            const resolved = findDownloadedFile(tmpDir, "https://youtube.com/watch?v=abc123XYZ", "template", "%(title).180B [%(id)s].%(ext)s");
            expect(resolved).toBe(actualFile);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    test("resolves downloaded file when extension changed by merger", async () => {
        const { findDownloadedFile } = await import("../engine/ytdlpEngine.js");
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "turbodm-find-"));
        try {
            const actualFile = path.join(tmpDir, "Music Video.mp4");
            fs.writeFileSync(actualFile, "video data");

            const resolved = findDownloadedFile(tmpDir, "https://custom.com/video", "Music Video.webm", "");
            expect(resolved).toBe(actualFile);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});
