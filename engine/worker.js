import fs from "fs";


export async function downloadSegment({
    url,
    filePath,
    start,
    end,
    segmentState,
    abortCtrl,
    extraHeaders = {},
    onProgress
}) {
    let attempt = 0;
    const MAX_RETRIES = 12;

    while (attempt <= MAX_RETRIES) {
        if (abortCtrl?.signal?.aborted) {
            return;
        }

        try {
            await tryDownloadSegment({
                url,
                filePath,
                start,
                end,
                segmentState,
                abortCtrl,
                extraHeaders,
                onProgress
            });
            segmentState.status = "done";
            segmentState.progress = 100;
            return;
        } catch (err) {
            if (abortCtrl?.signal?.aborted) {
                return;
            }

                                    if (err.statusCode === 401 || err.statusCode === 403) {
                segmentState.status = "error";
                throw err;
            }

            const isRateLimit = err.message && (
                err.message.includes("429") ||
                err.message.includes("503") ||
                err.message.includes("RATE_LIMITED")
            );

                        if (!isRateLimit) {
                attempt++;
            }

            if (attempt > MAX_RETRIES) {
                segmentState.status = "error";
                throw err;
            }

            segmentState.status = "reconnecting";

                        const sleepMs = isRateLimit
                ? Math.min(8000, 1500 + Math.floor(Math.random() * 2000))
                : Math.min(30000, Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 500));

            await new Promise(resolve => setTimeout(resolve, sleepMs));
        }
    }
}

async function tryDownloadSegment({
    url,
    filePath,
    start,
    end,
    segmentState,
    abortCtrl,
    extraHeaders = {},
    onProgress
}) {
    const alreadyDownloaded = segmentState.downloaded || 0;
    const actualStart = start + alreadyDownloaded;

    if (end !== Infinity && actualStart >= end) {
        segmentState.status = "done";
        segmentState.progress = 100;
        return;
    }

    const headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        "accept": "*/*",
        "connection": "keep-alive",
        ...extraHeaders
    };

    if (end !== Infinity) {
        headers["range"] = `bytes=${actualStart}-${end - 1}`;
    } else if (actualStart > 0) {
        headers["range"] = `bytes=${actualStart}-`;
    }

    const res = await fetch(url, {
        headers,
        signal: abortCtrl?.signal
    });

    if (res.status === 429 || res.status === 503) {
        const retryAfterSec = parseInt(res.headers.get("retry-after"), 10);
        const waitMs = (!isNaN(retryAfterSec) && retryAfterSec > 0) ? retryAfterSec * 1000 : 2000;
        throw new Error(`ERR_RATE_LIMITED_${res.status}_WAIT_${waitMs}`);
    }

    if (!res.ok && res.status !== 206) {
        const err = new Error(`HTTP error: ${res.status}`);
        err.statusCode = res.status;
        throw err;
    }

        const fileHandle = await fs.promises.open(filePath, "r+");
    let writeOffset = actualStart;
    let segDown = alreadyDownloaded;
    segmentState.status = "downloading";

    const reader = res.body.getReader();
    try {
        while (true) {
            if (abortCtrl?.signal?.aborted) break;

            const { done, value } = await reader.read();
            if (done) break;

            const expectedEnd = end !== Infinity ? (end - start) : Infinity;
            const remaining = expectedEnd - segDown;
            const slice = (remaining !== Infinity && value.length > remaining)
                ? value.subarray(0, remaining)
                : value;

            if (slice.length === 0) break;

            await fileHandle.write(slice, 0, slice.length, writeOffset);
            writeOffset += slice.length;
            segDown += slice.length;
            segmentState.downloaded = segDown;

            const segTotal = (end !== Infinity) ? (end - start) : segmentState.size;
            if (segTotal && segTotal > 0) {
                segmentState.progress = Math.min(100, parseFloat(((segDown / segTotal) * 100).toFixed(1)));
            }

            if (typeof onProgress === "function") {
                onProgress(slice.length);
            }
        }
    } finally {
        reader.releaseLock();
        await fileHandle.close().catch(() => {});
    }

    if (end !== Infinity && segDown >= (end - start)) {
        segmentState.status = "done";
        segmentState.progress = 100;
    }
}
