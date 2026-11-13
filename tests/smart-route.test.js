import { test, expect, describe } from "bun:test";
import { decideRoute, popupsRequired } from "../engine/smartRoute.js";

describe("decideRoute", () => {
    test("known video hosts route to yt-dlp instantly", () => {
        expect(decideRoute({ url: "https://www.youtube.com/watch?v=x" })).toBe("ytdlp");
        expect(decideRoute({ url: "https://youtu.be/x" })).toBe("ytdlp");
        expect(decideRoute({ url: "https://m.twitch.tv/videos/1" })).toBe("ytdlp");
        expect(decideRoute({ url: "https://www.tiktok.com/@u/video/1" })).toBe("ytdlp");
    });

    test(".m3u8 streams route to yt-dlp regardless of host", () => {
        expect(decideRoute({ url: "https://cdn.example.com/master.m3u8" })).toBe("ytdlp");
        expect(decideRoute({ url: "https://example.com/hls/playlist.m3u8?token=1" })).toBe("ytdlp");
    });

    test("direct files with file-ish content types stay on the HTTP engine", () => {
        expect(decideRoute({ url: "https://example.com/file.zip", probeOk: true, contentType: "application/zip" })).toBe("http");
        expect(decideRoute({ url: "https://example.com/video.mp4", probeOk: true, contentType: "video/mp4" })).toBe("http");
        expect(decideRoute({ url: "https://example.com/img.png", probeOk: true, contentType: "image/png" })).toBe("http");
        expect(decideRoute({ url: "https://example.com/app.exe", probeOk: true, contentType: "application/octet-stream" })).toBe("http");
    });

    test("HTML/JSON/XML/plain-text responses fall back to yt-dlp (page, not file)", () => {
        expect(decideRoute({ url: "https://example.com/page", probeOk: true, contentType: "text/html; charset=utf-8" })).toBe("ytdlp");
        expect(decideRoute({ url: "https://example.com/page", probeOk: true, contentType: "application/xhtml+xml" })).toBe("ytdlp");
        expect(decideRoute({ url: "https://example.com/api", probeOk: true, contentType: "application/json" })).toBe("ytdlp");
        expect(decideRoute({ url: "https://example.com/notes", probeOk: true, contentType: "text/plain" })).toBe("ytdlp");
    });

    test("plain errors / 404s are never routed to yt-dlp", () => {
        expect(decideRoute({ url: "https://example.com/missing", probeOk: false, contentType: "" })).toBe("http");
        expect(decideRoute({ url: "https://example.com/dead", probeOk: false, contentType: "text/html" })).toBe("http");
        expect(decideRoute({ url: "https://example.com/x", probeOk: true, contentType: "" })).toBe("http");
    });
});

describe("popupsRequired", () => {
    test("media URL + always-ask → cookie popup then quality popup", () => {
        expect(popupsRequired({ engine: "ytdlp", alwaysAsk: true })).toEqual({ cookie: true, quality: true });
    });

    test("always-ask off → one-click, no popups (old behavior)", () => {
        expect(popupsRequired({ engine: "ytdlp", alwaysAsk: false })).toEqual({ cookie: false, quality: false });
        expect(popupsRequired({ engine: "ytdlp", alwaysAsk: undefined })).toEqual({ cookie: false, quality: false });
    });

    test("direct files never ask even with always-ask on", () => {
        expect(popupsRequired({ engine: "http", alwaysAsk: true })).toEqual({ cookie: false, quality: false });
    });
});
