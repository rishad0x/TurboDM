import { EventEmitter } from "events";
import { DownloadEngine } from "./downloadEngine.js";

export class TaskManager extends EventEmitter {

    constructor({ storagePath, defaultSaveDir, maxConcurrent = 3, cookieResolver = null, sessionJarCreator = null }) {
        super();
        this.storagePath = storagePath;
        this.defaultSaveDir = defaultSaveDir;
        this.maxConcurrent = maxConcurrent;
        this.cookieResolver = cookieResolver;
        this.sessionJarCreator = sessionJarCreator;
        this.engine = new DownloadEngine({ maxConcurrent, storagePath });

                this.engine.on("taskState", (state) => this.emit("taskState", state));
        this.engine.on("segmentUpdate", (data) => this.emit("segmentUpdate", data));
        this.engine.on("taskCompleted", (data) => this.emit("taskCompleted", data));
        this.engine.on("taskError", (data) => this.emit("taskError", data));
    }

    async init() {
        if (this.storagePath) {
            this.engine.restoreDownloads(this.storagePath);
        }
    }


    async createTask({
        url,
        connections = null,
        fileName = null,
        saveDir = null,
        headers = {},
        autoStart = true,
        cookieProfileId = null,
        sessionCookies = null,
        formatId = null,
        formatNeedsAudio = false,
        audioOnly = false,
        audioFormat = null,
        quality = null,
        mergeFormat = null,
        concurrentFragments = null,
        limitRate = null,
        embedThumbnail = false,
        embedMetadata = false
    }) {
        let cookieArgs = [];
        let resolvedProfileId = null;
        if (cookieProfileId === "none") {
                        cookieArgs = [];
            resolvedProfileId = null;
        } else if (cookieProfileId) {
            try {
                const resolved = await this.cookieResolver(cookieProfileId);
                cookieArgs = resolved.args || [];
                resolvedProfileId = resolved.profile?.id ?? null;
            } catch (err) {
                                                throw new Error(`Cookie profile error: ${err.message}`);
            }
        } else if (sessionCookies && this.sessionJarCreator) {
                                                try {
                const jar = await this.sessionJarCreator(url, sessionCookies);
                cookieArgs = jar.args || [];
            } catch (err) {
                throw new Error(`Session cookie error: ${err.message}`);
            }
        } else if (this.cookieResolver) {
            try {
                const resolved = await this.cookieResolver(null);
                cookieArgs = resolved.args || [];
                resolvedProfileId = resolved.profile?.id ?? null;
            } catch (err) {
                throw new Error(`Cookie profile error: ${err.message}`);
            }
        }

        const targetDir = saveDir || this.defaultSaveDir;
        const dl = await this.engine.addDownload({
            url,
            saveDir: targetDir,
            fileName,
            connections,
            headers,
            autoStart,
            cookieArgs,
            ytOptions: {
                cookieProfileId: resolvedProfileId,
                formatId,
                formatNeedsAudio,
                audioOnly,
                audioFormat,
                quality,
                mergeFormat,
                concurrentFragments,
                limitRate,
                embedThumbnail,
                embedMetadata
            }
        });
        return dl;
    }

    async startTask(id) {
        return await this.engine.startDownload(id);
    }

    async pauseTask(id) {
        return await this.engine.pauseDownload(id);
    }

    async resumeTask(id) {
        return await this.engine.resumeDownload(id);
    }

    async pauseAll() {
        return await this.engine.pauseAll();
    }

    async resumeAll() {
        return await this.engine.resumeAll();
    }

    async deleteTask(id, deleteFile = false) {
        return await this.engine.removeDownload(id, deleteFile);
    }

    getAllTasks() {
        return this.engine.getAllTasks();
    }
}
