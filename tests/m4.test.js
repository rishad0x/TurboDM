import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { buildProbeArgs, buildDownloadArgs } from "../engine/ytdlp.js";
import { DownloadEngine, ManagedDownload, sanitizeHeadersForPersistence } from "../engine/downloadEngine.js";
import { YtDlpDownload, isYtDlpUrl, isHlsUrl } from "../engine/ytdlpEngine.js";
import { DownloadStatus } from "../engine/model.js";

describe("cookieArgs passthrough", () => {
    test("buildProbeArgs accepts resolved cookie args", () => {
        const args = buildProbeArgs("https://youtu.be/x", { cookieArgs: ["--cookies", "/p/cookies.txt"] });
        expect(args.join(" ")).toContain("--cookies /p/cookies.txt");
    });

    test("buildDownloadArgs accepts resolved cookie args", () => {
        const args = buildDownloadArgs("https://youtu.be/x", { cookieArgs: ["--cookies-from-browser", "firefox"] });
        expect(args.join(" ")).toContain("--cookies-from-browser firefox");
    });

    test("explicit cookies still work alongside", () => {
        const args = buildDownloadArgs("https://youtu.be/x", { cookies: "/a.txt", cookieArgs: ["--proxy", "x"] });
        expect(args.join(" ")).toContain("--cookies /a.txt");
    });
});

describe("routing helpers", () => {
    test("isYtDlpUrl recognizes known hosts incl. subdomains", () => {
        expect(isYtDlpUrl("https://www.youtube.com/watch?v=x")).toBe(true);
        expect(isYtDlpUrl("https://youtu.be/x")).toBe(true);
        expect(isYtDlpUrl("https://m.twitch.tv/videos/1")).toBe(true);
        expect(isYtDlpUrl("https://example.com/file.zip")).toBe(false);
        expect(isYtDlpUrl("not a url")).toBe(false);
    });

    test("isHlsUrl matches .m3u8 only", () => {
        expect(isHlsUrl("https://cdn.example.com/master.m3u8")).toBe(true);
        expect(isHlsUrl("https://cdn.example.com/master.m3u8?token=1")).toBe(true);
        expect(isHlsUrl("https://cdn.example.com/video.mp4")).toBe(false);
        expect(isHlsUrl("https://cdn.example.com/playlist.html")).toBe(false);
    });
});

describe("DownloadEngine persist/restore", () => {
    let dir;
    let storagePath;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "turbodm-engine-test-"));
        storagePath = path.join(dir, "tasks.json");
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test("ytdlp task persists engine:'ytdlp' + options and restores as YtDlpDownload", () => {
        const engine = new DownloadEngine({ storagePath, maxConcurrent: 2 });
        const dl = new YtDlpDownload({
            url: "https://youtu.be/abc123",
            filename: "Test Video.mp4",
            savePath: path.join(dir, "Video", "%(title).180B [abc123].%(ext)s"),
            totalSize: 1000,
            status: DownloadStatus.Paused,
            cookieProfileId: "prof-1",
            cookieArgs: ["--cookies", path.join(dir, "cookies", "prof-1.txt")],
            formatId: "137",
            formatNeedsAudio: true,
            quality: null,
            mergeFormat: "mp4"
        });
        engine.downloads.set(dl.id, dl);
        engine.persist();

        const raw = JSON.parse(fs.readFileSync(storagePath, "utf8"));
        expect(raw).toHaveLength(1);
        expect(raw[0].engine).toBe("ytdlp");
        expect(raw[0].ytOptions.formatId).toBe("137");
        expect(raw[0].ytOptions.cookieProfileId).toBe("prof-1");
        expect(raw[0].ytOptions.formatNeedsAudio).toBe(true);

        const engine2 = new DownloadEngine({ storagePath: path.join(dir, "unused.json") });
        engine2.restoreDownloads(storagePath);
        expect(engine2.downloads.size).toBe(1);
        const restored = [...engine2.downloads.values()][0];
        expect(restored instanceof YtDlpDownload).toBe(true);
        expect(restored.formatId).toBe("137");
        expect(restored.cookieProfileId).toBe("prof-1");
        expect(restored.cookieArgs).toEqual(["--cookies", path.join(dir, "cookies", "prof-1.txt")]);
        expect(restored.formatNeedsAudio).toBe(true);
        expect(restored.toJSON().engine).toBe("ytdlp");
    });

    test("http task persists without engine marker and restores as ManagedDownload", () => {
        const engine = new DownloadEngine({ storagePath, maxConcurrent: 2 });
        const dl = new ManagedDownload({
            url: "https://example.com/file.zip",
            filename: "file.zip",
            savePath: path.join(dir, "Compressed", "file.zip"),
            totalSize: 500,
            status: DownloadStatus.Paused,
            segments: [{ index: 1, start: 0, end: 500, size: 500, downloaded: 100, status: "paused", speed: 0 }]
        });
        engine.downloads.set(dl.id, dl);
        engine.persist();

        const raw = JSON.parse(fs.readFileSync(storagePath, "utf8"));
        expect(raw[0].engine).toBeUndefined();

        const engine2 = new DownloadEngine({ storagePath: path.join(dir, "unused.json") });
        engine2.restoreDownloads(storagePath);
        const restored = [...engine2.downloads.values()][0];
        expect(restored instanceof YtDlpDownload).toBe(false);
        expect(restored.segments[0].downloaded).toBe(100);
        expect(restored.toJSON().engine).toBe("http");
    });
});

describe("sanitizeHeadersForPersistence (pure)", () => {
    test("drops cookie/authorization/proxy-authorization case-insensitively, keeps the rest", () => {
        const { headers, redacted } = sanitizeHeadersForPersistence({
            Cookie: "session=SECRET",
            AUTHORIZATION: "Bearer SECRET",
            "proxy-authorization": "Basic SECRET",
            "User-Agent": "TestAgent/1.0",
            Referer: "https://example.com/page"
        });
        expect("Cookie" in headers).toBe(false);
        expect("AUTHORIZATION" in headers).toBe(false);
        expect("proxy-authorization" in headers).toBe(false);
        expect(headers["User-Agent"]).toBe("TestAgent/1.0");
        expect(headers.Referer).toBe("https://example.com/page");
        expect(redacted).toBe(true);
    });

    test("non-sensitive headers report redacted:false; garbage input is safe", () => {
        expect(sanitizeHeadersForPersistence({ "User-Agent": "x" })).toEqual({ headers: { "User-Agent": "x" }, redacted: false });
        expect(sanitizeHeadersForPersistence(undefined)).toEqual({ headers: {}, redacted: false });
        expect(sanitizeHeadersForPersistence(null)).toEqual({ headers: {}, redacted: false });
    });
});

describe("tasks.json header redaction (persist + restore)", () => {
    let dir;
    let storagePath;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "turbodm-redact-test-"));
        storagePath = path.join(dir, "tasks.json");
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test("persist strips Cookie/Authorization, keeps User-Agent/Referer; memory untouched", () => {
        const engine = new DownloadEngine({ storagePath, maxConcurrent: 2 });
        const dl = new ManagedDownload({
            url: "https://cdn.example.com/media/file.bin",
            filename: "file.bin",
            savePath: path.join(dir, "General", "file.bin"),
            totalSize: 1000,
            status: DownloadStatus.Paused,
            headers: {
                Cookie: "session=SECRET-VALUE",
                Authorization: "Bearer SECRET-VALUE",
                "User-Agent": "Mozilla/5.0 TestAgent",
                Referer: "https://example.com/page"
            }
        });
        engine.downloads.set(dl.id, dl);
        engine.persist();

        const raw = JSON.parse(fs.readFileSync(storagePath, "utf8"));
        expect(raw).toHaveLength(1);
        expect(raw[0].headers.Cookie).toBeUndefined();
        expect(raw[0].headers.Authorization).toBeUndefined();
        expect(JSON.stringify(raw[0])).not.toContain("SECRET-VALUE");
        expect(raw[0].headers["User-Agent"]).toBe("Mozilla/5.0 TestAgent");
        expect(raw[0].headers.Referer).toBe("https://example.com/page");
        expect(raw[0].headersRedacted).toBe(true);

                expect(dl.headers.Cookie).toBe("session=SECRET-VALUE");
        expect(dl.headers.Authorization).toBe("Bearer SECRET-VALUE");
    });

    test("task without sensitive headers persists headersRedacted:false", () => {
        const engine = new DownloadEngine({ storagePath, maxConcurrent: 2 });
        const dl = new ManagedDownload({
            url: "https://example.com/file.zip",
            filename: "file.zip",
            savePath: path.join(dir, "Compressed", "file.zip"),
            headers: { "User-Agent": "UA" }
        });
        engine.downloads.set(dl.id, dl);
        engine.persist();
        const raw = JSON.parse(fs.readFileSync(storagePath, "utf8"));
        expect(raw[0].headersRedacted).toBe(false);
        expect(raw[0].headers["User-Agent"]).toBe("UA");
    });

    test("restored task keeps the headersRedacted flag (drives the auth-expired message)", () => {
        const engine = new DownloadEngine({ storagePath, maxConcurrent: 2 });
        const dl = new ManagedDownload({
            url: "https://cdn.example.com/media/file.bin",
            filename: "file.bin",
            savePath: path.join(dir, "General", "file.bin"),
            headers: { Cookie: "session=SECRET-VALUE", Referer: "https://example.com" }
        });
        engine.downloads.set(dl.id, dl);
        engine.persist();

        const engine2 = new DownloadEngine({ storagePath: path.join(dir, "unused.json") });
        engine2.restoreDownloads(storagePath);
        const restored = [...engine2.downloads.values()][0];
        expect(restored.headersRedacted).toBe(true);
        expect(restored.headers.Cookie).toBeUndefined();
        expect(restored.headers.Referer).toBe("https://example.com");
    });
});
