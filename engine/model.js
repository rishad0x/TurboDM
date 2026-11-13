import crypto from "crypto";

export const DownloadStatus = Object.freeze({
    Queued: "Queued",
    Connecting: "Connecting",
    Downloading: "Downloading",
    Paused: "Paused",
    Completed: "Completed",
    Failed: "Failed",
    Cancelled: "Cancelled"
});

export const FileCategory = Object.freeze({
    Video: "Video",
    Audio: "Audio",
    Document: "Document",
    Archive: "Archive",
    Image: "Image",
    Application: "Application",
    Other: "Other"
});

export function getFileCategory(filename) {
    if (!filename) return FileCategory.Other;
    const ext = filename.split(".").pop().toLowerCase();
    switch (ext) {
        case "mp4": case "mkv": case "avi": case "mov": case "wmv": case "flv":
        case "webm": case "m4v": case "mpg": case "mpeg": case "3gp": case "ts":
            return FileCategory.Video;
        case "mp3": case "flac": case "wav": case "aac": case "ogg": case "wma":
        case "m4a": case "opus":
            return FileCategory.Audio;
        case "pdf": case "doc": case "docx": case "xls": case "xlsx": case "ppt":
        case "pptx": case "txt": case "rtf": case "odt": case "csv": case "epub":
            return FileCategory.Document;
        case "zip": case "rar": case "7z": case "tar": case "gz": case "bz2":
        case "xz": case "zst": case "iso": case "dmg":
            return FileCategory.Archive;
        case "jpg": case "jpeg": case "png": case "gif": case "bmp": case "svg":
        case "webp": case "ico": case "tiff": case "tif":
            return FileCategory.Image;
        case "exe": case "msi": case "deb": case "rpm": case "appimage":
        case "flatpak": case "snap": case "apk": case "bin": case "run": case "sh":
            return FileCategory.Application;
        default:
            return FileCategory.Other;
    }
}

export function getCategoryFolder(category) {
    switch (category) {
        case FileCategory.Video: return "Video";
        case FileCategory.Audio: return "Music";
        case FileCategory.Archive: return "Compressed";
        case FileCategory.Document: return "Documents";
        case FileCategory.Application: return "Programs";
        case FileCategory.Image: return "Images";
        default: return "General";
    }
}

export class SpeedTracker {
    constructor() {
        this.samples = [];
        this.currentSpeed = 0;
        this.lastTotalBytes = 0;
    }

    record(currentDownloadedBytes) {
        const now = performance.now();
        this.lastTotalBytes = currentDownloadedBytes;
        this.samples.push({ time: now, bytes: currentDownloadedBytes });

                const cutoff = now - 2000;
        while (this.samples.length > 2 && this.samples[0].time < cutoff) {
            this.samples.shift();
        }

        if (this.samples.length < 2) {
            return;
        }

        const oldest = this.samples[0];
        const newest = this.samples[this.samples.length - 1];
        const timeDelta = (newest.time - oldest.time) / 1000;
        const bytesDelta = newest.bytes - oldest.bytes;

        if (timeDelta > 0.1 && bytesDelta >= 0) {
            const rawSpeed = bytesDelta / timeDelta;
                        this.currentSpeed = this.currentSpeed === 0 ? rawSpeed : (this.currentSpeed * 0.75 + rawSpeed * 0.25);
        }
    }

    speed() {
        return Math.round(this.currentSpeed);
    }

    reset() {
        this.samples = [];
        this.currentSpeed = 0;
        this.lastTotalBytes = 0;
    }
}

export function formatBytes(bytes) {
    if (bytes === 0 || !bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatSpeed(bytesPerSec) {
    return `${formatBytes(bytesPerSec)}/s`;
}

export function formatDuration(seconds) {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return "--:--";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
        return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${mins}:${String(secs).padStart(2, "0")}`;
}
