import { describe, test, expect } from "bun:test";
import { DownloadEngine } from "../engine/downloadEngine.js";
import { TaskManager } from "../engine/taskManager.js";
import { DownloadStatus } from "../engine/model.js";
import { calcSegmentCount } from "../engine/downloadEngine.js";


function makeFake(id, status, { awaitingSlot = false, canResume = false } = {}) {
    const fake = {
        id,
        status,
        awaitingSlot,
        startedCount: 0,
        resumedCount: 0,
        headers: {},
        segments: [],
        savePath: null,
        maxConnections: 8,
                        async start() {
            this.startedCount++;
            this.status = DownloadStatus.Connecting;
        },
        async pause() {},
        async cancel() {},
        on() {},
        removeAllListeners() {},
        toJSON() { return { id: this.id, status: this.status }; }
    };
    if (canResume) {
        fake.resume = () => {
            if (![DownloadStatus.Paused, DownloadStatus.Failed, DownloadStatus.Queued].includes(fake.status)) return;
            fake.resumedCount++;
            fake.status = DownloadStatus.Connecting;
        };
    }
    return fake;
}

function seed(engine, entries) {
    for (const [id, status, opts] of entries) {
        const fake = makeFake(id, status, opts || {});
        engine._bindEvents(fake);
        engine.downloads.set(id, fake);
    }
}

describe("resumeAll", () => {
    test("resumes Paused and Failed tasks (regression: used to be a no-op)", async () => {
        const engine = new DownloadEngine({ maxConcurrent: 5 });
        seed(engine, [
            ["paused1", DownloadStatus.Paused],
            ["failed1", DownloadStatus.Failed]
        ]);
        await engine.resumeAll();
        const p = engine.downloads.get("paused1");
        const f = engine.downloads.get("failed1");
                expect(p.startedCount).toBe(1);
        expect([DownloadStatus.Connecting, DownloadStatus.Downloading, DownloadStatus.Queued]).toContain(p.status);
        expect(f.startedCount).toBe(1);
    });

    test("yt-dlp style tasks resume via dl.resume()", async () => {
        const engine = new DownloadEngine({ maxConcurrent: 5 });
        seed(engine, [["yt1", DownloadStatus.Paused, { canResume: true }]]);
        await engine.resumeAll();
        const t = engine.downloads.get("yt1");
        expect(t.resumedCount).toBe(1);
        expect(t.startedCount).toBe(0);
    });

    test("respects maxConcurrent — overflow goes Queued and auto-starts later", async () => {
        const engine = new DownloadEngine({ maxConcurrent: 1 });
        seed(engine, [
            ["a", DownloadStatus.Paused],
            ["b", DownloadStatus.Paused],
            ["c", DownloadStatus.Paused]
        ]);
        await engine.resumeAll();
        const started = [...engine.downloads.values()].filter(d => d.startedCount === 1);
        const queued = [...engine.downloads.values()].filter(d => d.status === DownloadStatus.Queued && d.awaitingSlot);
        expect(started.length).toBe(1);
        expect(queued.length).toBe(2);
    });

    test("leaves active/completed tasks untouched", async () => {
        const engine = new DownloadEngine({ maxConcurrent: 5 });
        seed(engine, [
            ["downloading", DownloadStatus.Downloading],
            ["completed", DownloadStatus.Completed]
        ]);
        await engine.resumeAll();
        for (const dl of engine.downloads.values()) {
            expect(dl.startedCount).toBe(0);
            expect(dl.resumedCount).toBe(0);
        }
    });
});

describe("calcSegmentCount — aggressive segmentation (always on)", () => {
    const MB = 1024 * 1024;

    test("untouched slider still gets the 16-connection floor for big files", () => {
        expect(calcSegmentCount(300 * MB, true, null)).toBe(16);
        expect(calcSegmentCount(300 * MB, true, 8)).toBe(16);
    });

    test("a raised slider goes all the way (up to 64)", () => {
        expect(calcSegmentCount(300 * MB, true, 64)).toBe(64);
        expect(calcSegmentCount(1024 * MB, true, 64)).toBe(64);
        expect(calcSegmentCount(300 * MB, true, 24)).toBe(24);
    });

    test("mid-size files fan out (100MB → 16 connections)", () => {
        expect(calcSegmentCount(100 * MB, true, null)).toBe(16);
        expect(calcSegmentCount(30 * MB, true, null)).toBe(16);
        expect(calcSegmentCount(20 * MB, true, null)).toBe(16);
    });

    test("small files cap at 4 connections, 1MB per segment", () => {
        expect(calcSegmentCount(3 * MB, true, null)).toBe(3);
        expect(calcSegmentCount(4.5 * MB, true, null)).toBe(4);
        expect(calcSegmentCount(1 * MB, true, null)).toBe(1);
    });

    test("never splits finer than one segment per 1MB", () => {
        expect(calcSegmentCount(300 * MB, true, 1024)).toBeLessThanOrEqual(300);
    });

    test("non-resumable or unknown size stays single-connection", () => {
        expect(calcSegmentCount(300 * MB, false, 64)).toBe(1);
        expect(calcSegmentCount(0, true, 64)).toBe(1);
    });
});

describe("TaskManager.createTask connections plumbing", () => {
    test("forwards connections to the engine (dead-setting regression)", async () => {
        const tm = new TaskManager({ storagePath: null, defaultSaveDir: "C:\\tmp\\turbodm-test" });
        let captured = null;
        tm.engine.addDownload = async (opts) => {
            captured = opts;
            return { id: "stub", toJSON: () => ({ id: "stub" }) };
        };
        await tm.createTask({ url: "https://example.com/file.zip", connections: 16 });
        expect(captured?.connections).toBe(16);
    });

    test("connections defaults to null when not supplied", async () => {
        const tm = new TaskManager({ storagePath: null, defaultSaveDir: "C:\\tmp\\turbodm-test" });
        let captured = null;
        tm.engine.addDownload = async (opts) => {
            captured = opts;
            return { id: "stub", toJSON: () => ({ id: "stub" }) };
        };
        await tm.createTask({ url: "https://example.com/file.zip" });
        expect(captured?.connections).toBeNull();
    });
});
