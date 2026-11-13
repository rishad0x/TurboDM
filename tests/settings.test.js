import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import {
    defaultSettings,
    sanitizeSettings,
    mergeSettings,
    SettingsStore,
    SETTINGS_SCHEMA_VERSION
} from "../engine/settings.js";

describe("defaultSettings", () => {
    test("shape and schemaVersion", () => {
        const d = defaultSettings("C:/dl");
        expect(d.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
        expect(d.defaultSaveDir).toBe("C:/dl");
        expect(d.maxConcurrent).toBe(5);
        expect(d.maxConnections).toBe(32);
        expect(d.concurrentFragments).toBe(16);
        expect(d.preferredFormat).toBe("mp4");
        expect(d.defaultQuality).toBe("best");
        expect(d.ytdlpChannel).toBe("stable");
        expect(d.autoUpdateYtdlp).toBe(false);
        expect(d.alwaysAsk).toBe(true);
        expect(d.defaultCookieProfileId).toBeNull();
        expect(d.proxy).toBe("");
    });
});

describe("sanitizeSettings", () => {
    test("valid patch passes fully", () => {
        const { cleaned, errors } = sanitizeSettings({
            maxConcurrent: 5,
            preferredFormat: "mkv",
            defaultQuality: 1080,
            proxy: "socks5://127.0.0.1:9050",
            embedThumbnail: true,
            limitRate: "2M",
            ytdlpChannel: "nightly",
            defaultCookieProfileId: "some-uuid-123"
        });
        expect(errors).toEqual([]);
        expect(cleaned.maxConcurrent).toBe(5);
        expect(cleaned.preferredFormat).toBe("mkv");
        expect(cleaned.defaultQuality).toBe(1080);
        expect(cleaned.proxy).toBe("socks5://127.0.0.1:9050");
        expect(cleaned.embedThumbnail).toBe(true);
        expect(cleaned.ytdlpChannel).toBe("nightly");
    });

    test("theme and reduceTransparency sanitize correctly", () => {
        const { cleaned, errors } = sanitizeSettings({
            theme: "light",
            reduceTransparency: true,
            firstRunCompleted: true,
            detectClipboardUrls: false,
            closeToTray: true
        });
        expect(errors).toEqual([]);
        expect(cleaned.theme).toBe("light");
        expect(cleaned.reduceTransparency).toBe(true);
        expect(cleaned.firstRunCompleted).toBe(true);
        expect(cleaned.detectClipboardUrls).toBe(false);
        expect(cleaned.closeToTray).toBe(true);

        const bad = sanitizeSettings({
            theme: "neon",
            reduceTransparency: "no",
            firstRunCompleted: "yes",
            detectClipboardUrls: "maybe"
        });
        expect(bad.errors).toHaveLength(4);
        expect(bad.cleaned.theme).toBeUndefined();
        expect(bad.cleaned.reduceTransparency).toBeUndefined();
        expect(bad.cleaned.firstRunCompleted).toBeUndefined();
        expect(bad.cleaned.detectClipboardUrls).toBeUndefined();
    });

    test("unknown keys are dropped (whitelist)", () => {
        const { cleaned, errors } = sanitizeSettings({ evil: "--flag-injection", maxConcurrent: 2 });
        expect(errors).toEqual([]);
        expect("evil" in cleaned).toBe(false);
    });

    test("invalid values produce errors and are excluded", () => {
        const { cleaned, errors } = sanitizeSettings({
            maxConcurrent: 0,
            maxConnections: 99,
            preferredFormat: "exe",
            defaultQuality: 9999,
            proxy: "garbage",
            ytdlpChannel: "beta",
            limitRate: "fast",
            defaultCookieProfileId: "../traversal"
        });
        expect(errors).toHaveLength(8);
        expect(Object.keys(cleaned)).toHaveLength(0);
    });

    test("quality accepts best/audio/max and heights; null clears cookie profile", () => {
        const a = sanitizeSettings({ defaultQuality: "audio" });
        expect(a.errors).toEqual([]);
        expect(a.cleaned.defaultQuality).toBe("audio");

        const b = sanitizeSettings({ defaultCookieProfileId: null });
        expect(b.cleaned.defaultCookieProfileId).toBeNull();

        const c = sanitizeSettings({ defaultQuality: 720 });
        expect(c.cleaned.defaultQuality).toBe(720);

        const m = sanitizeSettings({ defaultQuality: "max" });
        expect(m.errors).toEqual([]);
        expect(m.cleaned.defaultQuality).toBe("max");
    });

    test("booleans are strict", () => {
        const { errors } = sanitizeSettings({ embedMetadata: "yes" });
        expect(errors.join(" ")).toMatch(/embedMetadata/);
    });
});

describe("mergeSettings", () => {
    const defaults = defaultSettings(null);

    test("fills missing keys, drops unknown, clamps ranges", () => {
        const m = mergeSettings({
            unknownKey: "dropped",
            maxConcurrent: 50,
            maxConnections: 0,
            preferredFormat: "mkv",
            defaultQuality: 480,
            concurrentFragments: 100
        }, defaults);
        expect("unknownKey" in m).toBe(false);
        expect(m.maxConcurrent).toBe(10);
        expect(m.maxConnections).toBe(1);
        expect(m.preferredFormat).toBe("mkv");
        expect(m.defaultQuality).toBe(480);
        expect(m.concurrentFragments).toBe(32);
        expect(m.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
    });

    test("migrates schema-less raw (v0) — keeps valid values", () => {
        const m = mergeSettings({ preferredFormat: "webm", proxy: "http://p:1", defaultQuality: "max" }, defaults);
        expect(m.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
        expect(m.preferredFormat).toBe("webm");
        expect(m.proxy).toBe("http://p:1");
        expect(m.defaultQuality).toBe("max");
    });

    test("theme and boolean prefs survive a restart (regression: 5 keys reset on every launch)", () => {
        const m = mergeSettings({
            theme: "light",
            reduceTransparency: true,
            detectClipboardUrls: false,
            closeToTray: false,
            firstRunCompleted: true
        }, defaults);
        expect(m.theme).toBe("light");
        expect(m.reduceTransparency).toBe(true);
        expect(m.detectClipboardUrls).toBe(false);
        expect(m.closeToTray).toBe(false);
        expect(m.firstRunCompleted).toBe(true);
    });

    test("ceilings: maxConnections up to 64, fragments up to 32", () => {
        const m = mergeSettings({ maxConnections: 64, concurrentFragments: 32 }, defaults);
        expect(m.maxConnections).toBe(64);
        expect(m.concurrentFragments).toBe(32);
        expect(mergeSettings({ maxConnections: 100 }, defaults).maxConnections).toBe(64);
        expect(mergeSettings({ concurrentFragments: 100 }, defaults).concurrentFragments).toBe(32);
                expect(mergeSettings({ maxConnections: 8 }, defaults).maxConnections).toBe(8);
    });

    test("removed keys are dropped (turboMode toggle is gone)", () => {
                        const m = mergeSettings({ turboMode: false }, defaults);
        expect("turboMode" in m).toBe(false);
    });

    test("bad theme value falls back to default", () => {
        expect(mergeSettings({ theme: "neon" }, defaults).theme).toBe("dark");
    });

    test("garbage input yields pure defaults", () => {
        const m = mergeSettings("not an object", defaults);
        expect(m).toEqual(defaults);
        expect(mergeSettings(null, defaults)).toEqual(defaults);
    });

    test("stale/bad stored values fall back to defaults", () => {
        const m = mergeSettings({
            ytdlpChannel: "bogus",
            defaultSaveDir: "",
            limitRate: "xx",
            proxy: "ftp://x",
            embedThumbnail: "nope"
        }, defaults);
        expect(m.ytdlpChannel).toBe("stable");
        expect(m.defaultSaveDir).toBeNull();
        expect(m.limitRate).toBe("");
        expect(m.proxy).toBe("");
        expect(m.embedThumbnail).toBe(false);
    });
});

describe("SettingsStore", () => {
    let dir;
    let settingsPath;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "turbodm-settings-test-"));
        settingsPath = path.join(dir, "settings.json");
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test("init creates file with defaults + schemaVersion; persists across instances", async () => {
        const store = new SettingsStore(settingsPath, { defaultSaveDir: "C:/dl" });
        await store.init();
        expect(store.getAll().schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);

        store.set({ maxConcurrent: 5, preferredFormat: "mkv", defaultQuality: 720 });

        const store2 = new SettingsStore(settingsPath, { defaultSaveDir: "C:/dl" });
        await store2.init();
        const all = store2.getAll();
        expect(all.maxConcurrent).toBe(5);
        expect(all.preferredFormat).toBe("mkv");
        expect(all.defaultQuality).toBe(720);
        expect(all.defaultSaveDir).toBe("C:/dl");
    });

    test("set() is all-or-nothing on invalid patches", async () => {
        const store = new SettingsStore(settingsPath, { defaultSaveDir: "C:/dl" });
        await store.init();
        expect(() => store.set({ maxConcurrent: 99, preferredFormat: "mp4" })).toThrow(/Invalid settings/);
        expect(store.getAll().maxConcurrent).toBe(5);
        expect(() => store.set({ proxy: "not-a-proxy" })).toThrow(/Invalid settings/);
        expect(store.getAll().proxy).toBe("");
    });

    test("set() writes settings.json to disk", async () => {
        const store = new SettingsStore(settingsPath, { defaultSaveDir: "C:/dl" });
        await store.init();
        store.set({ embedThumbnail: true });
        const raw = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        expect(raw.embedThumbnail).toBe(true);
        expect(raw.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
    });

    test("v1 store migrates to v2: old conservative download defaults are modernized", async () => {
        fs.writeFileSync(settingsPath, JSON.stringify({
            schemaVersion: 1,
            maxConcurrent: 3,
            maxConnections: 8,
            concurrentFragments: 4
        }), "utf8");
        const store = new SettingsStore(settingsPath, { defaultSaveDir: "C:/dl" });
        await store.init();
        const all = store.getAll();
        expect(all.schemaVersion).toBe(2);
        expect(all.maxConcurrent).toBe(5);
        expect(all.maxConnections).toBe(32);
        expect(all.concurrentFragments).toBe(16);
                const reopened = new SettingsStore(settingsPath, { defaultSaveDir: "C:/dl" });
        await reopened.init();
        expect(reopened.getAll().maxConnections).toBe(32);
        expect(reopened.getAll().schemaVersion).toBe(2);
    });

    test("setDefaultSaveDir updates and persists", async () => {
        const store = new SettingsStore(settingsPath, { defaultSaveDir: "C:/dl" });
        await store.init();
        store.setDefaultSaveDir("D:/Media");
        expect(store.getAll().defaultSaveDir).toBe("D:/Media");
        const store2 = new SettingsStore(settingsPath, { defaultSaveDir: "C:/dl" });
        await store2.init();
        expect(store2.getAll().defaultSaveDir).toBe("D:/Media");
    });

    test("Save-button round-trip: modal patch → save → close → reopen persists to settings.json", async () => {
                const store = new SettingsStore(settingsPath, { defaultSaveDir: "C:/dl" });
        await store.init();
        const saved = store.set({
            defaultSaveDir: "D:/Media",
            maxConcurrent: 5,
            maxConnections: 16,
            concurrentFragments: 8,
            preferredFormat: "mkv",
            defaultQuality: 1080,
            defaultCookieProfileId: "abc-123",
            embedThumbnail: true,
            embedMetadata: false,
            limitRate: "2M",
            proxy: "socks5://127.0.0.1:9050",
            ytdlpChannel: "nightly",
            autoUpdateYtdlp: true
        });
        expect(saved.defaultSaveDir).toBe("D:/Media");

                expect(() => store.set({ proxy: "garbage" })).toThrow(/Invalid settings/);
        expect(store.getAll().proxy).toBe("socks5://127.0.0.1:9050");

                const reopened = new SettingsStore(settingsPath, { defaultSaveDir: "C:/dl" });
        await reopened.init();
        const all = reopened.getAll();
        expect(all.defaultSaveDir).toBe("D:/Media");
        expect(all.maxConcurrent).toBe(5);
        expect(all.maxConnections).toBe(16);
        expect(all.concurrentFragments).toBe(8);
        expect(all.preferredFormat).toBe("mkv");
        expect(all.defaultQuality).toBe(1080);
        expect(all.defaultCookieProfileId).toBe("abc-123");
        expect(all.embedThumbnail).toBe(true);
        expect(all.limitRate).toBe("2M");
        expect(all.proxy).toBe("socks5://127.0.0.1:9050");
        expect(all.ytdlpChannel).toBe("nightly");
        expect(all.autoUpdateYtdlp).toBe(true);

                const raw = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        expect(raw.proxy).toBe("socks5://127.0.0.1:9050");
        expect(raw.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
    });
});

describe("recentSaveDirs", () => {
    test("sanitizeSettings keeps a trimmed, deduped, capped array", () => {
        const { cleaned, errors } = sanitizeSettings({
            recentSaveDirs: ["C:\a", "C:\b", "C:\a", 42, null, "", "C:\c"]
        });
        expect(errors).toEqual([]);
        expect(cleaned.recentSaveDirs).toEqual(["C:\a", "C:\b", "C:\c"]);
    });

    test("sanitizeSettings rejects non-arrays and caps over-length entries", () => {
        const bad = sanitizeSettings({ recentSaveDirs: "C:\a" });
        expect(bad.errors.length).toBeGreaterThan(0);

        const { cleaned } = sanitizeSettings({
            recentSaveDirs: Array.from({ length: 12 }, (_, i) => `C:\dir${i}`)
        });
        expect(cleaned.recentSaveDirs).toHaveLength(8);
    });

    test("mergeSettings fills recentSaveDirs from raw, deduped and capped", () => {
        const merged = mergeSettings(
            { recentSaveDirs: ["C:\a", "C:\a", "C:\b", 7, null] },
            defaultSettings("C:/dl")
        );
        expect(merged.recentSaveDirs).toEqual(["C:\a", "C:\b"]);
                expect(mergeSettings({}, defaultSettings("C:/dl")).recentSaveDirs).toEqual([]);
    });

    test("SettingsStore.pushRecentSaveDir moves to front, dedupes, caps, persists", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "turbodm-recent-test-"));
        const settingsPath = path.join(dir, "settings.json");
        const store = new SettingsStore(settingsPath, { defaultSaveDir: "C:\dl" });
        await store.init();

        for (let i = 1; i <= 9; i++) store.pushRecentSaveDir(`C:\dir${i}`);
        expect(store.getAll().recentSaveDirs).toHaveLength(8);
        expect(store.getAll().recentSaveDirs[0]).toBe("C:\dir9");

        store.pushRecentSaveDir("C:\dir3");
        const list = store.getAll().recentSaveDirs;
        expect(list[0]).toBe("C:\dir3");
        expect(list.filter(d => d === "C:\dir3")).toHaveLength(1);

                const reopened = new SettingsStore(settingsPath, { defaultSaveDir: "C:\dl" });
        await reopened.init();
        expect(reopened.getAll().recentSaveDirs[0]).toBe("C:\dir3");

                expect(store.pushRecentSaveDir("").recentSaveDirs[0]).toBe("C:\dir3");
        expect(store.pushRecentSaveDir(null).recentSaveDirs[0]).toBe("C:\dir3");

        fs.rmSync(dir, { recursive: true, force: true });
    });
});
