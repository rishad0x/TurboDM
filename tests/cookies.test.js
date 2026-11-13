import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import {
    validateNetscapeCookies,
    mapBrowserCookieError,
    CookieManager,
    COOKIES_SCHEMA_VERSION,
    ACCOUNT_ACCESS_NOTICE
} from "../engine/cookieManager.js";
import { buildProbeArgs } from "../engine/ytdlp.js";
import { YtDlpDownload } from "../engine/ytdlpEngine.js";

describe("validateNetscapeCookies", () => {
    const validJar = [
        "# Netscape HTTP Cookie File",
        "# This is a generated file! Do not edit.",
        "",
        ".youtube.com\tTRUE\t/\tTRUE\t1900000000\tVISITOR_INFO1_LIVE\tab cdef1234",
        ".youtube.com\tTRUE\t/\tTRUE\t1900000000\tPREF\thello",
        "#HttpOnly_.youtube.com\tTRUE\t/youtubei\tTRUE\t0\tSESSION\tsess-value"
    ].join("\n");

    test("accepts a valid jar incl. #HttpOnly_ lines", () => {
        const r = validateNetscapeCookies(validJar);
        expect(r.valid).toBe(true);
        expect(r.cookieCount).toBe(3);
        expect(r.domains).toEqual(["youtube.com"]);
        expect(r.error).toBeNull();
    });

    test("reports domains, never cookie names/values", () => {
        const json = JSON.stringify(validateNetscapeCookies(validJar));
        expect(json).not.toContain("PREF");
        expect(json).not.toContain("sess-value");
        expect(json).not.toContain("VISITOR_INFO1_LIVE");
    });

    test("rejects empty and cookie-less content", () => {
        expect(validateNetscapeCookies("").valid).toBe(false);
        expect(validateNetscapeCookies(null).valid).toBe(false);
        const commentsOnly = validateNetscapeCookies("# just a comment\n# another");
        expect(commentsOnly.valid).toBe(false);
        expect(commentsOnly.error).toMatch(/No valid cookies/);
    });

    test("counts malformed lines but keeps valid ones", () => {
        const mixed = [
            ".example.com\tTRUE\t/\tTRUE\t1900000000\tNAME\tvalue",
            "this line is not a cookie",
            "bad.com\tnotabs"
        ].join("\n");
        const r = validateNetscapeCookies(mixed);
        expect(r.valid).toBe(true);
        expect(r.cookieCount).toBe(1);
        expect(r.malformedCount).toBe(2);
    });

    test("session cookies (expiry 0) are valid", () => {
        const r = validateNetscapeCookies("site.org\tFALSE\t/\tFALSE\t0\tsid\tabc");
        expect(r.valid).toBe(true);
        expect(r.domains).toEqual(["site.org"]);
    });
});

describe("mapBrowserCookieError", () => {
    test("locked database suggests closing the browser", () => {
        const msg = mapBrowserCookieError("ERROR: cookies database is locked");
        expect(msg).toMatch(/close that browser/i);
    });
    test("app-bound encryption suggests cookies.txt import", () => {
        const msg = mapBrowserCookieError("failed to decrypt with error: The requested operation is not supported (app-bound encryption)");
        expect(msg).toMatch(/cookies\.txt/i);
    });
    test("zero cookies suggests login/profile check", () => {
        expect(mapBrowserCookieError("Extracted 0 cookies from chrome")).toMatch(/logged in/i);
    });
    test("keyring failures mapped", () => {
        expect(mapBrowserCookieError("unable to open keyring")).toMatch(/keyring|cookies\.txt/i);
    });
    test("unknown text returns null", () => {
        expect(mapBrowserCookieError("unrelated error")).toBeNull();
        expect(mapBrowserCookieError(null)).toBeNull();
    });
});

describe("cookie args reach the final yt-dlp invocation", () => {
    let storeDir;
    let mgr;

    beforeEach(() => {
        storeDir = fs.mkdtempSync(path.join(os.tmpdir(), "turbodm-cookieflow-"));
        mgr = new CookieManager(storeDir);
        return mgr.init();
    });

    afterEach(() => {
        fs.rmSync(storeDir, { recursive: true, force: true });
    });

    const NETSCAPE = ".youtube.com\tTRUE\t/\tTRUE\t1900000000\tPREF\tvalue";

    test("download args for a task with a FILE profile contain --cookies <jar path>", async () => {
        const profile = await mgr.createFileProfile({ name: "yt", content: NETSCAPE });
        const { args, profile: resolved } = await mgr.resolveProfileArgs(profile.id);

                const dl = new YtDlpDownload({
            url: "https://www.youtube.com/watch?v=abc",
            filename: "video.mp4",
            savePath: path.join(storeDir, "out", "%(title)s.%(ext)s"),
            cookieProfileId: resolved.id,
            cookieArgs: args,
            quality: "best"
        });
        const buildArgs = await dl._buildArgs();

        const idx = buildArgs.indexOf("--cookies");
        expect(idx).toBeGreaterThan(-1);
        expect(buildArgs[idx + 1]).toBe(path.join(storeDir, "files", `${profile.id}.txt`));
        expect(fs.existsSync(buildArgs[idx + 1])).toBe(true);
        expect(buildArgs[buildArgs.indexOf("--") + 1]).toBe("https://www.youtube.com/watch?v=abc");
    });

    test("download args for a task with a BROWSER profile contain --cookies-from-browser <spec>", async () => {
        const profile = await mgr.createBrowserProfile({ name: "edge", browserSpec: "edge:Profile 2" });
        const { args } = await mgr.resolveProfileArgs(profile.id);

        const dl = new YtDlpDownload({
            url: "https://www.youtube.com/watch?v=abc",
            filename: "video.mp4",
            savePath: path.join(storeDir, "out", "%(title)s.%(ext)s"),
            cookieArgs: args
        });
        const buildArgs = await dl._buildArgs();
        const idx = buildArgs.indexOf("--cookies-from-browser");
        expect(idx).toBeGreaterThan(-1);
        expect(buildArgs[idx + 1]).toBe("edge:Profile 2");
        expect(buildArgs).not.toContain("--cookies");
    });

    test("probe (Inspect) args include the cookie args too", async () => {
        const profile = await mgr.createFileProfile({ name: "yt", content: NETSCAPE });
        const { args } = await mgr.resolveProfileArgs(profile.id);

        const probeArgs = buildProbeArgs("https://www.youtube.com/watch?v=abc", { cookieArgs: args });
        const idx = probeArgs.indexOf("--cookies");
        expect(idx).toBeGreaterThan(-1);
        expect(probeArgs[idx + 1]).toBe(path.join(storeDir, "files", `${profile.id}.txt`));

        const browserProbe = buildProbeArgs("https://www.youtube.com/watch?v=abc", {
            cookieArgs: ["--cookies-from-browser", "firefox"]
        });
        expect(browserProbe.join(" ")).toContain("--cookies-from-browser firefox");
    });

    test("default-profile semantics: resolver(null) uses the starred default, or no cookies", async () => {
                const none = await mgr.resolveProfileArgs(null);
        expect(none.args).toEqual([]);

        const profile = await mgr.createFileProfile({ name: "yt", content: NETSCAPE });
        await mgr.setDefaultProfile(profile.id);
        const defaulted = await mgr.resolveProfileArgs(null);
        expect(defaulted.args).toEqual(["--cookies", path.join(storeDir, "files", `${profile.id}.txt`)]);

                const explicit = await mgr.resolveProfileArgs(profile.id);
        expect(explicit.args).toContain("--cookies");
    });
});

describe("CookieManager.createSessionJar", () => {
    let storeDir;
    let mgr;

    beforeEach(() => {
        storeDir = fs.mkdtempSync(path.join(os.tmpdir(), "turbodm-sessionjar-"));
        mgr = new CookieManager(storeDir);
        return mgr.init();
    });

    afterEach(() => {
        fs.rmSync(storeDir, { recursive: true, force: true });
    });

    test("builds a Netscape jar from a raw Cookie header", () => {
        const jar = mgr.createSessionJar("https://www.youtube.com/watch?v=x", "SID=abc; VISITOR=def; __Host-x=ghi");
        const jarPath = path.join(storeDir, "files", `session-${jar.sessionId}.txt`);
        expect(jar.args).toEqual(["--cookies", jarPath]);
        expect(fs.existsSync(jarPath)).toBe(true);
        expect(jar.cookieCount).toBe(3);

        const raw = fs.readFileSync(jarPath, "utf8");
        expect(raw).toContain("www.youtube.com\tFALSE\t/\tTRUE\t0\tSID\tabc");
        expect(raw).toContain("www.youtube.com\tFALSE\t/\tTRUE\t0\tVISITOR\tdef");
    });

    test("http URLs get secure=FALSE; malformed pairs are skipped", () => {
        const jar = mgr.createSessionJar("http://example.com/page", "good=1; broken; =novalue; ok=2");
        expect(jar.cookieCount).toBe(2);
        const raw = fs.readFileSync(jar.args[1], "utf8");
        expect(raw).toContain("example.com\tFALSE\t/\tFALSE\t0\tgood\t1");
        expect(raw).not.toContain("broken");
    });

    test("rejects invalid URL / empty header; jars are not managed profiles", async () => {
        expect(() => mgr.createSessionJar("notaurl", "a=b")).toThrow(/Invalid URL/);
        expect(() => mgr.createSessionJar("https://x.com", "")).toThrow(/No cookies captured/);
        expect(() => mgr.createSessionJar("https://x.com", ";;;")).toThrow(/No usable cookies/);

        mgr.createSessionJar("https://x.com", "a=b");
        const list = await mgr.listProfiles();
        expect(list.profiles).toHaveLength(0);
    });

    test("jar resolves to --cookies args a YtDlpDownload can consume", async () => {
        const jar = mgr.createSessionJar("https://www.youtube.com/watch?v=x", "SID=abc");
        const dl = new YtDlpDownload({
            url: "https://www.youtube.com/watch?v=x",
            filename: "v.mp4",
            savePath: path.join(storeDir, "out", "%(title)s.%(ext)s"),
            cookieArgs: jar.args
        });
        const buildArgs = await dl._buildArgs();
        const idx = buildArgs.indexOf("--cookies");
        expect(idx).toBeGreaterThan(-1);
        expect(fs.existsSync(buildArgs[idx + 1])).toBe(true);
    });
});

describe("CookieManager", () => {
    let storeDir;
    let mgr;

    beforeEach(() => {
        storeDir = fs.mkdtempSync(path.join(os.tmpdir(), "turbodm-cookies-test-"));
        mgr = new CookieManager(storeDir);
        return mgr.init();
    });

    afterEach(() => {
        fs.rmSync(storeDir, { recursive: true, force: true });
    });

    test("init stamps schemaVersion", () => {
        const raw = JSON.parse(fs.readFileSync(path.join(storeDir, "profiles.json"), "utf8"));
        expect(raw.schemaVersion).toBe(COOKIES_SCHEMA_VERSION);
    });

    test("migrates a schema-less index (v0 → v1)", async () => {
                const legacy = {
            profiles: [{ id: "legacy-1", name: "Old", type: "file", fileName: "legacy-1.txt" }],
            defaultProfileId: "legacy-1"
        };
        fs.writeFileSync(path.join(storeDir, "profiles.json"), JSON.stringify(legacy), "utf8");
        fs.writeFileSync(path.join(storeDir, "files", "legacy-1.txt"), "site.org\tFALSE\t/\tFALSE\t0\tsid\tabc", "utf8");

        const mgr2 = new CookieManager(storeDir);
        await mgr2.init();
        const list = await mgr2.listProfiles();
        expect(list.schemaVersion).toBe(COOKIES_SCHEMA_VERSION);
        expect(list.profiles).toHaveLength(1);
        expect(list.profiles[0].lastUsed).toBeNull();
        expect(list.defaultProfileId).toBe("legacy-1");
    });

    test("file profile: create → list → resolve args → lastUsed", async () => {
        const jar = ".youtube.com\tTRUE\t/\tTRUE\t1900000000\tPREF\thello";
        const p = await mgr.createFileProfile({ name: "My YT", content: jar });

        expect(p.type).toBe("file");
        expect(p.cookieCount).toBe(1);
        expect(p.domains).toEqual(["youtube.com"]);
        expect(fs.existsSync(path.join(storeDir, "files", `${p.id}.txt`))).toBe(true);

        const list = await mgr.listProfiles();
        expect(list.profiles).toHaveLength(1);
        expect(list.profiles[0].name).toBe("My YT");

        const resolved = await mgr.resolveProfileArgs(p.id);
        expect(resolved.args).toEqual(["--cookies", path.join(storeDir, "files", `${p.id}.txt`)]);
        expect(resolved.profile.id).toBe(p.id);

        const after = (await mgr.listProfiles()).profiles[0];
        expect(after.lastUsed).not.toBeNull();
    });

    test("file profile rejects invalid content", async () => {
        await expect(mgr.createFileProfile({ name: "bad", content: "nope" })).rejects.toThrow(/No valid cookies/);
        await expect(mgr.createFileProfile({ name: "", content: "site.org\tFALSE\t/\tFALSE\t0\ts\tv" })).rejects.toThrow(/name is required/i);
    });

    test("updateFileProfileContent replaces jar", async () => {
        const p = await mgr.createFileProfile({ name: "edit", content: "a.com\tFALSE\t/\tFALSE\t0\ts\tv" });
        const updated = await mgr.updateFileProfileContent(p.id, "b.com\tFALSE\t/\tFALSE\t0\ts2\tv2\na.com\tFALSE\t/\tFALSE\t0\ts\tv");
        expect(updated.cookieCount).toBe(2);
        expect(updated.domains.sort()).toEqual(["a.com", "b.com"]);
        const raw = fs.readFileSync(path.join(storeDir, "files", `${p.id}.txt`), "utf8");
        expect(raw).toContain("b.com");
    });

    test("browser profile: create → resolve args; invalid spec rejected", async () => {
        const p = await mgr.createBrowserProfile({ name: "Edge main", browserSpec: "edge:Profile 2" });
        expect(p.type).toBe("browser");
        expect(p.browser).toBe("edge");
        expect(p.browserProfile).toBe("Profile 2");

        const resolved = await mgr.resolveProfileArgs(p.id);
        expect(resolved.args).toEqual(["--cookies-from-browser", "edge:Profile 2"]);

        await expect(mgr.createBrowserProfile({ name: "x", browserSpec: "totallynotabrowser" }))
            .rejects.toThrow(/Unsupported browser spec/);
    });

    test("default profile used when no id passed; cleared when deleted", async () => {
        const p = await mgr.createFileProfile({ name: "default-me", content: "a.com\tFALSE\t/\tFALSE\t0\ts\tv" });
        await mgr.setDefaultProfile(p.id);
        expect(await mgr.getDefaultProfileId()).toBe(p.id);

        const resolved = await mgr.resolveProfileArgs(null);
        expect(resolved.profile.id).toBe(p.id);

        await mgr.deleteProfile(p.id);
        expect(await mgr.getDefaultProfileId()).toBeNull();
        const none = await mgr.resolveProfileArgs(null);
        expect(none.args).toEqual([]);
        expect(none.profile).toBeNull();
    });

    test("delete removes jar file from disk", async () => {
        const p = await mgr.createFileProfile({ name: "doomed", content: "a.com\tFALSE\t/\tFALSE\t0\ts\tv" });
        const jarPath = path.join(storeDir, "files", `${p.id}.txt`);
        expect(fs.existsSync(jarPath)).toBe(true);
        await mgr.deleteProfile(p.id);
        expect(fs.existsSync(jarPath)).toBe(false);
        expect((await mgr.listProfiles()).profiles).toHaveLength(0);
    });

    test("rename works for both profile types", async () => {
        const f = await mgr.createFileProfile({ name: "a", content: "a.com\tFALSE\t/\tFALSE\t0\ts\tv" });
        const b = await mgr.createBrowserProfile({ name: "b", browserSpec: "chrome" });
        expect((await mgr.renameProfile(f.id, "renamed-file")).name).toBe("renamed-file");
        expect((await mgr.renameProfile(b.id, "renamed-browser")).name).toBe("renamed-browser");
        await expect(mgr.renameProfile(f.id, "   ")).rejects.toThrow(/name is required/i);
    });

    test("importFileProfile reads from disk", async () => {
        const src = path.join(storeDir, "imported-src.txt");
        fs.writeFileSync(src, "imp.com\tFALSE\t/\tFALSE\t0\ts\tv", "utf8");
        const p = await mgr.importFileProfile({ name: "imported", sourcePath: src });
        expect(p.domains).toEqual(["imp.com"]);
        expect(fs.existsSync(path.join(storeDir, "files", `${p.id}.txt`))).toBe(true);
    });

    test("readProfileContent returns jar text; browser profiles have none", async () => {
        const p = await mgr.createFileProfile({ name: "readme", content: "a.com\tFALSE\t/\tFALSE\t0\ts\tv" });
        expect(await mgr.readProfileContent(p.id)).toContain("a.com");
        const b = await mgr.createBrowserProfile({ name: "bb", browserSpec: "chrome" });
        await expect(mgr.readProfileContent(b.id)).rejects.toThrow(/Browser profiles/);
    });

    test("ACCOUNT_ACCESS_NOTICE mentions account access", () => {
        expect(ACCOUNT_ACCESS_NOTICE).toMatch(/grant full access/i);
    });
});
