import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { readdirSync, existsSync } from "fs";

const root = process.cwd();
const electronExe = path.join(root, "node_modules", "electron", "dist", "electron.exe");
const icon = path.join(root, "build", "icon.ico");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;

if (!existsSync(icon)) {
    console.warn("brand-exe: build/icon.ico not found");
    process.exit(0);
}

function findRcedit() {
    const cacheRoot = path.join(process.env.LOCALAPPDATA || "", "electron-builder", "Cache", "winCodeSign");
    if (!existsSync(cacheRoot)) return null;
    for (const entry of readdirSync(cacheRoot)) {
        const candidate = path.join(cacheRoot, entry, "rcedit-x64.exe");
        if (existsSync(candidate)) return candidate;
    }
    return null;
}

const rcedit = findRcedit();
if (!rcedit) {
    console.warn("brand-exe: rcedit not found in electron-builder cache");
    process.exit(0);
}

function brand(targetExe, label) {
    if (!existsSync(targetExe)) return;
    try {
        const res = spawnSync(rcedit, [
            targetExe,
            "--set-icon", icon,
            "--set-version-string", "ProductName", pkg.productName || "TurboDM",
            "--set-version-string", "FileDescription", pkg.description || "TurboDM",
            "--set-version-string", "CompanyName", "Rishad",
            "--set-version-string", "LegalCopyright", "© " + new Date().getFullYear() + " Rishad",
            "--set-file-version", version,
            "--set-product-version", version
        ], { stdio: "inherit" });

        if (res.status === 0) {
            console.log(`brand-exe: ${label} branded with lightning icon`);
        } else {
            console.warn(`brand-exe: failed to brand ${label} (status ${res.status})`);
        }
    } catch (err) {
        console.warn(`brand-exe: error branding ${label}: ${err.message}`);
    }
}

brand(electronExe, "electron.exe");
