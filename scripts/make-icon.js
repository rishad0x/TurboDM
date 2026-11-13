import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function decodePng(data) {
    if (!data.subarray(0, 8).equals(PNG_SIG)) throw new Error("not a PNG");
    let pos = 8;
    let w = 0, h = 0, colorType = 0, interlace = 0;
    const idat = [];
    while (pos < data.length) {
        const len = data.readUInt32BE(pos);
        const type = data.toString("ascii", pos + 4, pos + 8);
        const body = data.subarray(pos + 8, pos + 8 + len);
        if (type === "IHDR") {
            w = body.readUInt32BE(0); h = body.readUInt32BE(4);
            if (body[8] !== 8) throw new Error("unsupported bit depth");
            colorType = body[9];
            interlace = body[12];
        } else if (type === "IDAT") {
            idat.push(body);
        } else if (type === "IEND") {
            break;
        }
        pos += 12 + len;
    }
    if (colorType !== 6) throw new Error(`unsupported color type ${colorType} (need RGBA)`);
    if (interlace !== 0) throw new Error("interlaced PNG not supported");

    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = w * 4;
    const rgba = Buffer.alloc(h * stride);
    const paeth = (a, b, c) => {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        if (pa <= pb && pa <= pc) return a;
        if (pb <= pc) return b;
        return c;
    };
    let prev = Buffer.alloc(stride);
    for (let y = 0; y < h; y++) {
        const ft = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const recon = rgba.subarray(y * stride, (y + 1) * stride);
        for (let i = 0; i < stride; i++) {
            const left = i >= 4 ? recon[i - 4] : 0;
            const up = prev[i];
            const ul = i >= 4 ? prev[i - 4] : 0;
            let v = line[i];
            if (ft === 1) v += left;
            else if (ft === 2) v += up;
            else if (ft === 3) v += (left + up) >> 1;
            else if (ft === 4) v += paeth(left, up, ul);
            else if (ft !== 0) throw new Error(`bad filter ${ft}`);
            recon[i] = v & 0xff;
        }
        prev = recon;
    }
    return { w, h, rgba };
}

function chunk(type, body) {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, "ascii");
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
}
function encodePng(w, h, rgba) {
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) {
        raw[y * (w * 4 + 1)] = 0;
        rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[12] = 0;
    return Buffer.concat([
        PNG_SIG,
        chunk("IHDR", ihdr),
        chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0))
    ]);
}

function upscale2x(w, h, rgba) {
    const W = w * 2;
    const out = Buffer.alloc(W * 4 * h * 2);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const p = (y * w + x) * 4;
            for (let dy = 0; dy < 2; dy++) {
                const row = ((y * 2 + dy) * W + x * 2) * 4;
                out[row] = rgba[p]; out[row + 1] = rgba[p + 1];
                out[row + 2] = rgba[p + 2]; out[row + 3] = rgba[p + 3];
                out[row + 4] = rgba[p]; out[row + 5] = rgba[p + 1];
                out[row + 6] = rgba[p + 2]; out[row + 7] = rgba[p + 3];
            }
        }
    }
    return { w: W, h: h * 2, rgba: out };
}

const iconsDir = join(root, "build", "icons");
const src128 = decodePng(readFileSync(join(iconsDir, "icon128.png")));
const up = upscale2x(src128.w, src128.h, src128.rgba);
const png256 = encodePng(up.w, up.h, up.rgba);

const roundTrip256 = decodePng(png256);
if (!roundTrip256.rgba.equals(up.rgba)) throw new Error("self-check failed: 256 round-trip mismatch");
const roundTrip128 = decodePng(encodePng(src128.w, src128.h, src128.rgba));
if (!roundTrip128.rgba.equals(src128.rgba)) throw new Error("self-check failed: 128 round-trip mismatch");

const entries = [16, 32, 48, 128].map((s) => ({
    w: s,
    h: s,
    data: readFileSync(join(iconsDir, `icon${s}.png`))
}));
entries.push({ w: 256, h: 256, data: png256 });
entries.sort((a, b) => a.w - b.w);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
let offset = 6 + 16 * entries.length;
const dirEntries = entries.map((e) => {
    const d = Buffer.alloc(16);
    d.writeUInt8(e.w >= 256 ? 0 : e.w, 0);
    d.writeUInt8(e.h >= 256 ? 0 : e.h, 1);
    d.writeUInt16LE(1, 4);
    d.writeUInt16LE(32, 6);
    d.writeUInt32LE(e.data.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += e.data.length;
    return d;
});
const ico = Buffer.concat([header, ...dirEntries, ...entries.map(e => e.data)]);

mkdirSync(join(root, "build"), { recursive: true });
writeFileSync(join(root, "build", "icon.ico"), ico);
writeFileSync(join(root, "build", "icon.png"), png256);
console.log(`wrote build/icon.ico (${ico.length} bytes, sizes ${entries.map(e => e.w).join("/")})`);
console.log(`wrote build/icon.png (${png256.length} bytes, 256x256 upscaled from 128)`);
